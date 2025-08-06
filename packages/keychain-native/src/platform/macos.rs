use crate::error::{KeychainError, Result};
use crate::platform::{KeychainAccess, KeychainEntry};
use crate::KeychainOptions;
use async_trait::async_trait;
use core_foundation::base::{CFRelease, TCFType};
use core_foundation::boolean::CFBoolean;
use core_foundation::dictionary::CFDictionary;
use core_foundation::string::CFString;
use security_framework::item::{ItemClass, ItemSearchOptions, SearchResult};
use security_framework::passwords::delete_generic_password;
use security_framework_sys::base::errSecItemNotFound;
use security_framework_sys::item::*;
use security_framework_sys::keychain_item::SecItemCopyMatching;
use std::collections::HashMap;
use std::os::raw::c_void;
use std::ptr;

pub struct MacOSKeychain {
    team_id: Option<String>,
    access_group: Option<String>,
    synchronizable: bool,
}

impl MacOSKeychain {
    pub fn new(options: Option<KeychainOptions>) -> Result<Self> {
        let options = options.unwrap_or(KeychainOptions {
            team_id: None,
            access_group: None,
            synchronizable: None,
        });

        Ok(Self {
            team_id: options.team_id,
            access_group: options.access_group,
            synchronizable: options.synchronizable.unwrap_or(false),
        })
    }

    fn build_base_query(&self, service: &str, account: Option<&str>) -> HashMap<CFString, CFString> {
        let mut query = HashMap::new();
        
        // Basic query parameters
        query.insert(
            unsafe { CFString::wrap_under_get_rule(kSecClass) },
            unsafe { CFString::wrap_under_get_rule(kSecClassGenericPassword) },
        );
        
        query.insert(
            unsafe { CFString::wrap_under_get_rule(kSecAttrService) },
            CFString::new(service),
        );
        
        if let Some(account) = account {
            query.insert(
                unsafe { CFString::wrap_under_get_rule(kSecAttrAccount) },
                CFString::new(account),
            );
        }
        
        // Add access group if specified
        if let Some(access_group) = &self.access_group {
            // On macOS, the access group should include the team ID
            let full_access_group = if let Some(team_id) = &self.team_id {
                format!("{}.{}", team_id, access_group)
            } else {
                access_group.clone()
            };
            
            query.insert(
                unsafe { CFString::wrap_under_get_rule(kSecAttrAccessGroup) },
                CFString::new(&full_access_group),
            );
        }
        
        // Add synchronizable flag if enabled
        if self.synchronizable {
            query.insert(
                unsafe { CFString::wrap_under_get_rule(kSecAttrSynchronizable) },
                unsafe { CFString::wrap_under_get_rule(kCFBooleanTrue as *const c_void) },
            );
        }
        
        query
    }
}

#[async_trait]
impl KeychainAccess for MacOSKeychain {
    async fn set_password(&self, service: &str, account: &str, password: &str) -> Result<()> {
        // First try to delete any existing password
        let _ = self.delete_password(service, account).await;
        
        // Build the query with the password
        let mut query = self.build_base_query(service, Some(account));
        query.insert(
            unsafe { CFString::wrap_under_get_rule(kSecValueData) },
            CFString::new(password),
        );
        
        // Add label for better keychain UI display
        query.insert(
            unsafe { CFString::wrap_under_get_rule(kSecAttrLabel) },
            CFString::new(&format!("{} ({})", service, account)),
        );
        
        // Create the dictionary and add the item
        let dict = CFDictionary::from_CFType_pairs(&query);
        let result = unsafe { SecItemAdd(dict.as_concrete_TypeRef(), ptr::null_mut()) };
        
        if result == 0 {
            Ok(())
        } else {
            Err(KeychainError::PlatformError(format!(
                "Failed to add keychain item: OSStatus {}",
                result
            )))
        }
    }

    async fn get_password(&self, service: &str, account: &str) -> Result<Option<String>> {
        let mut query = self.build_base_query(service, Some(account));
        
        // Request the password data
        query.insert(
            unsafe { CFString::wrap_under_get_rule(kSecReturnData) },
            unsafe { CFString::wrap_under_get_rule(kCFBooleanTrue as *const c_void) },
        );
        
        // Limit to one result
        query.insert(
            unsafe { CFString::wrap_under_get_rule(kSecMatchLimit) },
            unsafe { CFString::wrap_under_get_rule(kSecMatchLimitOne) },
        );
        
        let dict = CFDictionary::from_CFType_pairs(&query);
        let mut result_ptr: *mut c_void = ptr::null_mut();
        let status = unsafe { SecItemCopyMatching(dict.as_concrete_TypeRef(), &mut result_ptr) };
        
        if status == errSecItemNotFound {
            Ok(None)
        } else if status == 0 && !result_ptr.is_null() {
            // Extract the password from CFData
            let data = unsafe { core_foundation::data::CFData::wrap_under_create_rule(result_ptr as _) };
            let bytes = data.bytes();
            let password = String::from_utf8_lossy(bytes).to_string();
            Ok(Some(password))
        } else {
            Err(KeychainError::PlatformError(format!(
                "Failed to get keychain item: OSStatus {}",
                status
            )))
        }
    }

    async fn delete_password(&self, service: &str, account: &str) -> Result<bool> {
        match delete_generic_password(service, account) {
            Ok(_) => Ok(true),
            Err(e) if e.code() == errSecItemNotFound => Ok(false),
            Err(e) => Err(KeychainError::PlatformError(format!(
                "Failed to delete keychain item: {}",
                e
            ))),
        }
    }

    async fn find_credentials(&self, service: &str) -> Result<Vec<KeychainEntry>> {
        let search = ItemSearchOptions::new()
            .class(ItemClass::generic_password())
            .service(service)
            .load_data(true);

        match search.search() {
            Ok(items) => {
                let mut entries = Vec::new();
                for item in items {
                    if let SearchResult::Dict(dict) = item {
                        if let (Some(account), Some(password_data)) = (
                            dict.get("acct").and_then(|v| v.as_string()),
                            dict.get("v_Data").and_then(|v| v.as_data()),
                        ) {
                            let password = String::from_utf8_lossy(password_data).to_string();
                            entries.push(KeychainEntry {
                                service: service.to_string(),
                                account: account.to_string(),
                                password,
                            });
                        }
                    }
                }
                Ok(entries)
            }
            Err(e) if e.code() == errSecItemNotFound => Ok(Vec::new()),
            Err(e) => Err(KeychainError::PlatformError(format!(
                "Failed to search keychain: {}",
                e
            ))),
        }
    }

    async fn find_by_account(&self, account: &str) -> Result<Vec<KeychainEntry>> {
        let search = ItemSearchOptions::new()
            .class(ItemClass::generic_password())
            .account(account)
            .load_data(true);

        match search.search() {
            Ok(items) => {
                let mut entries = Vec::new();
                for item in items {
                    if let SearchResult::Dict(dict) = item {
                        if let (Some(service), Some(password_data)) = (
                            dict.get("svce").and_then(|v| v.as_string()),
                            dict.get("v_Data").and_then(|v| v.as_data()),
                        ) {
                            let password = String::from_utf8_lossy(password_data).to_string();
                            entries.push(KeychainEntry {
                                service: service.to_string(),
                                account: account.to_string(),
                                password,
                            });
                        }
                    }
                }
                Ok(entries)
            }
            Err(e) if e.code() == errSecItemNotFound => Ok(Vec::new()),
            Err(e) => Err(KeychainError::PlatformError(format!(
                "Failed to search keychain: {}",
                e
            ))),
        }
    }
}