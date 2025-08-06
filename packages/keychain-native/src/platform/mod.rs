#[cfg(target_os = "macos")]
pub mod macos;
#[cfg(target_os = "linux")]
pub mod linux;
#[cfg(target_os = "windows")]
pub mod windows;
pub mod fallback;

#[cfg(test)]
mod tests;

use crate::error::{Result, KeychainError};
use crate::{KeychainOptions, KeychainMetadata, CodeSigningInfo, FindQuery};
use async_trait::async_trait;
use serde::{Serialize, Deserialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct KeychainEntry {
    pub service: String,
    pub account: String,
    pub password: String,
    pub metadata: Option<KeychainMetadata>,
}

#[async_trait]
pub trait PlatformKeychain: Send + Sync {
    async fn set_password(
        &self,
        account: &str,
        password: &str,
        metadata: Option<KeychainMetadata>,
    ) -> Result<()>;
    
    async fn get_password(&self, account: &str) -> Result<Option<String>>;
    
    async fn delete_password(&self, account: &str) -> Result<bool>;
    
    async fn get_entry(&self, account: &str) -> Result<Option<KeychainEntry>>;
    
    async fn find_entries(&self, query: Option<FindQuery>) -> Result<Vec<KeychainEntry>>;
    
    fn get_platform_info(&self) -> &'static str;
}

pub fn create_keychain(options: KeychainOptions) -> Result<Box<dyn PlatformKeychain>> {
    #[cfg(target_os = "macos")]
    {
        Ok(Box::new(macos::MacOSKeychain::new(options)?))
    }
    
    #[cfg(target_os = "linux")]
    {
        Ok(Box::new(linux::LinuxKeychain::new(options)?))
    }
    
    #[cfg(target_os = "windows")]
    {
        Ok(Box::new(windows::WindowsKeychain::new(options)?))
    }
    
    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        Ok(Box::new(fallback::FallbackKeychain::new(options)?))
    }
}