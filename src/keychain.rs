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

#[cfg(test)]
mod tests {
    use super::*;
    use serial_test::serial;

    // Note: These tests require keychain access and might prompt for authorization
    // Run with --test-threads=1 to avoid conflicts
    
    #[test]
    #[serial]
    fn test_set_and_get_var() {
        let service = "lpop-test-service".to_string();
        let keychain = KeychainManager::new(service.clone());
        
        // Set a test variable
        keychain.set_var("TEST_KEY", "test_value").unwrap();
        
        // Get it back
        let value = keychain.get_var("TEST_KEY").unwrap();
        assert_eq!(value, Some("test_value".to_string()));
        
        // Clean up
        keychain.delete_var("TEST_KEY").unwrap();
    }

    #[test]
    #[serial]
    fn test_get_nonexistent_var() {
        let service = "lpop-test-service".to_string();
        let keychain = KeychainManager::new(service);
        
        let value = keychain.get_var("NONEXISTENT_KEY_12345").unwrap();
        assert_eq!(value, None);
    }

    #[test]
    #[serial]
    fn test_delete_var() {
        let service = "lpop-test-service".to_string();
        let keychain = KeychainManager::new(service.clone());
        
        // Set a test variable
        keychain.set_var("DELETE_TEST", "value").unwrap();
        
        // Delete it
        let deleted = keychain.delete_var("DELETE_TEST").unwrap();
        assert!(deleted);
        
        // Verify it's gone
        let value = keychain.get_var("DELETE_TEST").unwrap();
        assert_eq!(value, None);
    }

    #[test]
    #[serial]
    fn test_set_multiple_vars() {
        let service = "lpop-test-service".to_string();
        let keychain = KeychainManager::new(service);
        
        let mut vars = HashMap::new();
        vars.insert("MULTI_1".to_string(), "value1".to_string());
        vars.insert("MULTI_2".to_string(), "value2".to_string());
        
        keychain.set_vars(vars).unwrap();
        
        // Verify both were set
        assert_eq!(keychain.get_var("MULTI_1").unwrap(), Some("value1".to_string()));
        assert_eq!(keychain.get_var("MULTI_2").unwrap(), Some("value2".to_string()));
        
        // Clean up
        keychain.delete_var("MULTI_1").unwrap();
        keychain.delete_var("MULTI_2").unwrap();
    }
}