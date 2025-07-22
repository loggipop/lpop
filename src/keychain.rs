use anyhow::{Context, Result};
use keyring::Entry;
use std::collections::HashMap;

pub struct KeychainManager {
    service_name: String,
}

impl KeychainManager {
    pub fn new(service_name: String) -> Self {
        Self { service_name }
    }
    
    pub fn set_var(&self, key: &str, value: &str) -> Result<()> {
        let entry = Entry::new(&self.service_name, key)?;
        entry.set_password(value)
            .with_context(|| format!("Failed to set {} in keychain", key))?;
        Ok(())
    }
    
    pub fn get_var(&self, key: &str) -> Result<Option<String>> {
        let entry = Entry::new(&self.service_name, key)?;
        match entry.get_password() {
            Ok(password) => Ok(Some(password)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(e).context("Failed to read from keychain"),
        }
    }
    
    pub fn delete_var(&self, key: &str) -> Result<bool> {
        let entry = Entry::new(&self.service_name, key)?;
        match entry.delete_credential() {
            Ok(()) => Ok(true),
            Err(keyring::Error::NoEntry) => Ok(false),
            Err(e) => Err(e).context("Failed to delete from keychain"),
        }
    }
    
    pub fn list_vars(&self) -> Result<HashMap<String, String>> {
        // Note: keyring crate doesn't support listing all entries
        // This is a limitation we'll need to work around
        // For now, return empty - in real implementation we'd need to
        // track keys separately or use platform-specific APIs
        Ok(HashMap::new())
    }
    
    pub fn set_vars(&self, vars: HashMap<String, String>) -> Result<()> {
        for (key, value) in vars {
            self.set_var(&key, &value)?;
        }
        Ok(())
    }
    
    pub fn clear_all(&self) -> Result<()> {
        // Would need to track keys or use platform-specific APIs
        // For now, this is a no-op
        Ok(())
    }
}