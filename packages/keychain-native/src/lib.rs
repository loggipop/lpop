#![deny(clippy::all)]

use napi_derive::napi;

mod platform;
mod error;

use error::KeychainError;
use platform::{KeychainAccess, KeychainEntry as PlatformEntry};

#[napi(object)]
pub struct KeychainEntry {
    pub service: String,
    pub account: String,
    pub password: String,
}

#[napi(object)]
pub struct KeychainOptions {
    /// Team ID for macOS code signing (e.g., "ABC123XYZ")
    pub team_id: Option<String>,
    /// Access group for sharing between apps
    pub access_group: Option<String>,
    /// Whether to synchronize with iCloud Keychain
    pub synchronizable: Option<bool>,
}

#[napi]
pub struct Keychain {
    platform: Box<dyn KeychainAccess + Send + Sync>,
}

#[napi]
impl Keychain {
    #[napi(constructor)]
    pub fn new(options: Option<KeychainOptions>) -> napi::Result<Self> {
        let platform = platform::create_keychain_access(options)
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure, e.to_string()))?;
        
        Ok(Self { platform })
    }

    #[napi]
    pub async fn set_password(
        &self,
        service: String,
        account: String,
        password: String,
    ) -> napi::Result<()> {
        self.platform
            .set_password(&service, &account, &password)
            .await
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure, e.to_string()))
    }

    #[napi]
    pub async fn get_password(
        &self,
        service: String,
        account: String,
    ) -> napi::Result<Option<String>> {
        self.platform
            .get_password(&service, &account)
            .await
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure, e.to_string()))
    }

    #[napi]
    pub async fn delete_password(
        &self,
        service: String,
        account: String,
    ) -> napi::Result<bool> {
        self.platform
            .delete_password(&service, &account)
            .await
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure, e.to_string()))
    }

    #[napi]
    pub async fn find_credentials(
        &self,
        service: String,
    ) -> napi::Result<Vec<KeychainEntry>> {
        let entries = self.platform
            .find_credentials(&service)
            .await
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure, e.to_string()))?;

        Ok(entries
            .into_iter()
            .map(|e| KeychainEntry {
                service: e.service,
                account: e.account,
                password: e.password,
            })
            .collect())
    }

    #[napi]
    pub async fn find_by_account(
        &self,
        account: String,
    ) -> napi::Result<Vec<KeychainEntry>> {
        let entries = self.platform
            .find_by_account(&account)
            .await
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure, e.to_string()))?;

        Ok(entries
            .into_iter()
            .map(|e| KeychainEntry {
                service: e.service,
                account: e.account,
                password: e.password,
            })
            .collect())
    }
}