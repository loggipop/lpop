use crate::error::{KeychainError, Result};
use crate::platform::{KeychainAccess, KeychainEntry};
use crate::KeychainOptions;
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Mutex;

pub struct FallbackKeychain {
    storage: Mutex<HashMap<(String, String), String>>,
}

impl FallbackKeychain {
    pub fn new(_options: Option<KeychainOptions>) -> Result<Self> {
        Ok(Self {
            storage: Mutex::new(HashMap::new()),
        })
    }
}

#[async_trait]
impl KeychainAccess for FallbackKeychain {
    async fn set_password(&self, service: &str, account: &str, password: &str) -> Result<()> {
        let mut storage = self.storage.lock().unwrap();
        storage.insert((service.to_string(), account.to_string()), password.to_string());
        Ok(())
    }

    async fn get_password(&self, service: &str, account: &str) -> Result<Option<String>> {
        let storage = self.storage.lock().unwrap();
        Ok(storage.get(&(service.to_string(), account.to_string())).cloned())
    }

    async fn delete_password(&self, service: &str, account: &str) -> Result<bool> {
        let mut storage = self.storage.lock().unwrap();
        Ok(storage.remove(&(service.to_string(), account.to_string())).is_some())
    }

    async fn find_credentials(&self, service: &str) -> Result<Vec<KeychainEntry>> {
        let storage = self.storage.lock().unwrap();
        let entries: Vec<KeychainEntry> = storage
            .iter()
            .filter(|((s, _), _)| s == service)
            .map(|((s, a), p)| KeychainEntry {
                service: s.clone(),
                account: a.clone(),
                password: p.clone(),
            })
            .collect();
        Ok(entries)
    }

    async fn find_by_account(&self, account: &str) -> Result<Vec<KeychainEntry>> {
        let storage = self.storage.lock().unwrap();
        let entries: Vec<KeychainEntry> = storage
            .iter()
            .filter(|((_, a), _)| a == account)
            .map(|((s, a), p)| KeychainEntry {
                service: s.clone(),
                account: a.clone(),
                password: p.clone(),
            })
            .collect();
        Ok(entries)
    }
}