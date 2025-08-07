use crate::error::{KeychainError, Result};
use crate::platform::{KeychainAccess, KeychainEntry};
use crate::KeychainOptions;
use async_trait::async_trait;

pub struct LinuxKeychain;

impl LinuxKeychain {
    pub fn new(_options: Option<KeychainOptions>) -> Result<Self> {
        // For now, we'll return an error as we haven't implemented Linux support yet
        Err(KeychainError::Unsupported(
            "Linux keychain support not yet implemented. Use fallback.".to_string()
        ))
    }
}

#[async_trait]
impl KeychainAccess for LinuxKeychain {
    async fn set_password(&self, _service: &str, _account: &str, _password: &str) -> Result<()> {
        Err(KeychainError::Unsupported("Not implemented".to_string()))
    }

    async fn get_password(&self, _service: &str, _account: &str) -> Result<Option<String>> {
        Err(KeychainError::Unsupported("Not implemented".to_string()))
    }

    async fn delete_password(&self, _service: &str, _account: &str) -> Result<bool> {
        Err(KeychainError::Unsupported("Not implemented".to_string()))
    }

    async fn find_credentials(&self, _service: &str) -> Result<Vec<KeychainEntry>> {
        Err(KeychainError::Unsupported("Not implemented".to_string()))
    }

    async fn find_by_account(&self, _account: &str) -> Result<Vec<KeychainEntry>> {
        Err(KeychainError::Unsupported("Not implemented".to_string()))
    }
}