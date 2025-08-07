#[cfg(test)]
mod tests {
    use super::super::*;
    use crate::error::KeychainError;
    use std::collections::HashMap;

    // Mock implementation for testing
    pub struct MockKeychain {
        storage: std::sync::Mutex<HashMap<String, String>>,
        metadata: std::sync::Mutex<HashMap<String, KeychainMetadata>>,
        fail_on_set: bool,
        fail_on_get: bool,
    }

    impl MockKeychain {
        pub fn new() -> Self {
            Self {
                storage: std::sync::Mutex::new(HashMap::new()),
                metadata: std::sync::Mutex::new(HashMap::new()),
                fail_on_set: false,
                fail_on_get: false,
            }
        }

        pub fn with_failures(fail_on_set: bool, fail_on_get: bool) -> Self {
            Self {
                storage: std::sync::Mutex::new(HashMap::new()),
                metadata: std::sync::Mutex::new(HashMap::new()),
                fail_on_set,
                fail_on_get,
            }
        }
    }

    #[async_trait::async_trait]
    impl PlatformKeychain for MockKeychain {
        async fn set_password(
            &self,
            account: &str,
            password: &str,
            metadata: Option<KeychainMetadata>,
        ) -> Result<(), KeychainError> {
            if self.fail_on_set {
                return Err(KeychainError::AccessDenied);
            }

            let mut storage = self.storage.lock().unwrap();
            storage.insert(account.to_string(), password.to_string());

            if let Some(meta) = metadata {
                let mut metadata_storage = self.metadata.lock().unwrap();
                metadata_storage.insert(account.to_string(), meta);
            }

            Ok(())
        }

        async fn get_password(&self, account: &str) -> Result<Option<String>, KeychainError> {
            if self.fail_on_get {
                return Err(KeychainError::AccessDenied);
            }

            let storage = self.storage.lock().unwrap();
            Ok(storage.get(account).cloned())
        }

        async fn delete_password(&self, account: &str) -> Result<bool, KeychainError> {
            let mut storage = self.storage.lock().unwrap();
            let mut metadata = self.metadata.lock().unwrap();
            
            let existed = storage.remove(account).is_some();
            metadata.remove(account);
            
            Ok(existed)
        }

        async fn get_entry(&self, account: &str) -> Result<Option<KeychainEntry>, KeychainError> {
            let storage = self.storage.lock().unwrap();
            let metadata = self.metadata.lock().unwrap();

            if let Some(password) = storage.get(account) {
                Ok(Some(KeychainEntry {
                    service: "mock-service".to_string(),
                    account: account.to_string(),
                    password: password.clone(),
                    metadata: metadata.get(account).cloned(),
                }))
            } else {
                Ok(None)
            }
        }

        async fn find_entries(&self, query: Option<FindQuery>) -> Result<Vec<KeychainEntry>, KeychainError> {
            let storage = self.storage.lock().unwrap();
            let metadata = self.metadata.lock().unwrap();

            let mut entries = Vec::new();

            for (account, password) in storage.iter() {
                let should_include = if let Some(ref q) = query {
                    q.account_prefix.as_ref().map_or(true, |prefix| account.starts_with(prefix))
                } else {
                    true
                };

                if should_include {
                    entries.push(KeychainEntry {
                        service: "mock-service".to_string(),
                        account: account.clone(),
                        password: password.clone(),
                        metadata: metadata.get(account).cloned(),
                    });
                }
            }

            Ok(entries)
        }

        fn get_platform_info(&self) -> &'static str {
            "mock"
        }
    }

    #[tokio::test]
    async fn test_mock_keychain_basic_operations() {
        let keychain = MockKeychain::new();
        
        // Test set and get
        keychain.set_password("test_account", "test_password", None).await.unwrap();
        let password = keychain.get_password("test_account").await.unwrap();
        assert_eq!(password, Some("test_password".to_string()));

        // Test get non-existent
        let password = keychain.get_password("non_existent").await.unwrap();
        assert_eq!(password, None);

        // Test delete
        let deleted = keychain.delete_password("test_account").await.unwrap();
        assert!(deleted);
        
        let password = keychain.get_password("test_account").await.unwrap();
        assert_eq!(password, None);
    }

    #[tokio::test]
    async fn test_mock_keychain_with_metadata() {
        let keychain = MockKeychain::new();
        
        let metadata = KeychainMetadata {
            created_at: Some(1234567890),
            modified_at: Some(1234567891),
            label: Some("Test Label".to_string()),
            comment: Some("Test Comment".to_string()),
            team_id: Some("TEAM123".to_string()),
            code_signing_info: None,
            access_group: Some("com.test.app".to_string()),
            synchronizable: Some(true),
        };

        keychain.set_password("test_account", "test_password", Some(metadata.clone())).await.unwrap();
        
        let entry = keychain.get_entry("test_account").await.unwrap().unwrap();
        assert_eq!(entry.password, "test_password");
        assert!(entry.metadata.is_some());
        
        let retrieved_metadata = entry.metadata.unwrap();
        assert_eq!(retrieved_metadata.label, metadata.label);
        assert_eq!(retrieved_metadata.team_id, metadata.team_id);
        assert_eq!(retrieved_metadata.access_group, metadata.access_group);
    }

    #[tokio::test]
    async fn test_mock_keychain_find_entries() {
        let keychain = MockKeychain::new();
        
        // Add multiple entries
        keychain.set_password("app_user1", "pass1", None).await.unwrap();
        keychain.set_password("app_user2", "pass2", None).await.unwrap();
        keychain.set_password("other_user", "pass3", None).await.unwrap();

        // Find all
        let entries = keychain.find_entries(None).await.unwrap();
        assert_eq!(entries.len(), 3);

        // Find with prefix
        let query = FindQuery {
            account_prefix: Some("app_".to_string()),
            environment: None,
            team_id: None,
            access_group: None,
        };
        let entries = keychain.find_entries(Some(query)).await.unwrap();
        assert_eq!(entries.len(), 2);
    }

    #[tokio::test]
    async fn test_mock_keychain_error_handling() {
        let keychain = MockKeychain::with_failures(true, false);
        
        // Test set failure
        let result = keychain.set_password("test", "pass", None).await;
        assert!(result.is_err());
        match result.unwrap_err() {
            KeychainError::AccessDenied => {}
            _ => panic!("Expected AccessDenied error"),
        }

        let keychain = MockKeychain::with_failures(false, true);
        
        // Test get failure
        let result = keychain.get_password("test").await;
        assert!(result.is_err());
    }
}