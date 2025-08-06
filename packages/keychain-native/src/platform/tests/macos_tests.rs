#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::super::macos::*;
    use super::super::*;
    use crate::error::KeychainError;

    #[tokio::test]
    async fn test_macos_keychain_creation() {
        let options = KeychainOptions {
            service: "com.test.lpop".to_string(),
            environment: Some("test".to_string()),
            access_group: None,
            synchronizable: Some(false),
        };

        let keychain = MacOSKeychain::new(options);
        assert!(keychain.is_ok());
        
        let keychain = keychain.unwrap();
        assert_eq!(keychain.get_platform_info(), "macos");
    }

    #[tokio::test]
    async fn test_macos_keychain_with_access_group() {
        let options = KeychainOptions {
            service: "com.test.lpop".to_string(),
            environment: Some("test".to_string()),
            access_group: Some("TEAM123.com.test.shared".to_string()),
            synchronizable: Some(true),
        };

        let keychain = MacOSKeychain::new(options);
        assert!(keychain.is_ok());
    }

    #[tokio::test]
    async fn test_macos_service_name_generation() {
        let keychain = MacOSKeychain {
            service: "com.test.lpop".to_string(),
            environment: Some("production".to_string()),
            access_group: None,
            synchronizable: false,
        };

        let service_name = keychain.get_service_name();
        assert_eq!(service_name, "com.test.lpop?env=production");

        let keychain = MacOSKeychain {
            service: "com.test.lpop".to_string(),
            environment: None,
            access_group: None,
            synchronizable: false,
        };

        let service_name = keychain.get_service_name();
        assert_eq!(service_name, "com.test.lpop");
    }

    #[tokio::test]
    async fn test_macos_keychain_basic_operations() {
        let options = KeychainOptions {
            service: format!("com.test.lpop.{}", uuid::Uuid::new_v4()),
            environment: Some("test".to_string()),
            access_group: None,
            synchronizable: Some(false),
        };

        let keychain = MacOSKeychain::new(options).unwrap();
        let test_account = format!("test_account_{}", uuid::Uuid::new_v4());
        let test_password = "test_password_123";

        // Clean up any existing entry
        let _ = keychain.delete_password(&test_account).await;

        // Test set password
        let result = keychain.set_password(&test_account, test_password, None).await;
        assert!(result.is_ok(), "Failed to set password: {:?}", result);

        // Test get password
        let password = keychain.get_password(&test_account).await.unwrap();
        assert_eq!(password, Some(test_password.to_string()));

        // Test delete password
        let deleted = keychain.delete_password(&test_account).await.unwrap();
        assert!(deleted);

        // Verify deleted
        let password = keychain.get_password(&test_account).await.unwrap();
        assert_eq!(password, None);
    }

    #[tokio::test]
    async fn test_macos_keychain_with_metadata() {
        let options = KeychainOptions {
            service: format!("com.test.lpop.{}", uuid::Uuid::new_v4()),
            environment: Some("test".to_string()),
            access_group: None,
            synchronizable: Some(false),
        };

        let keychain = MacOSKeychain::new(options).unwrap();
        let test_account = format!("test_meta_{}", uuid::Uuid::new_v4());
        let test_password = "meta_password_123";

        let metadata = KeychainMetadata {
            created_at: None, // Will be set by keychain
            modified_at: None, // Will be set by keychain
            label: Some("Test Keychain Entry".to_string()),
            comment: Some("This is a test comment".to_string()),
            team_id: None, // Will be detected from code signing
            code_signing_info: None,
            access_group: None,
            synchronizable: Some(false),
        };

        // Clean up any existing entry
        let _ = keychain.delete_password(&test_account).await;

        // Set with metadata
        let result = keychain.set_password(&test_account, test_password, Some(metadata)).await;
        assert!(result.is_ok(), "Failed to set password with metadata: {:?}", result);

        // Get entry with metadata
        let entry = keychain.get_entry(&test_account).await.unwrap();
        assert!(entry.is_some());

        let entry = entry.unwrap();
        assert_eq!(entry.password, test_password);
        assert!(entry.metadata.is_some());

        let retrieved_metadata = entry.metadata.unwrap();
        assert_eq!(retrieved_metadata.label, Some("Test Keychain Entry".to_string()));
        assert_eq!(retrieved_metadata.comment, Some("This is a test comment".to_string()));

        // Clean up
        let _ = keychain.delete_password(&test_account).await;
    }

    #[tokio::test]
    async fn test_macos_keychain_find_entries() {
        let service_id = uuid::Uuid::new_v4();
        let options = KeychainOptions {
            service: format!("com.test.lpop.{}", service_id),
            environment: Some("test".to_string()),
            access_group: None,
            synchronizable: Some(false),
        };

        let keychain = MacOSKeychain::new(options).unwrap();

        // Create multiple test entries
        let accounts = vec![
            format!("app_user1_{}", service_id),
            format!("app_user2_{}", service_id),
            format!("other_user_{}", service_id),
        ];

        // Clean up any existing entries
        for account in &accounts {
            let _ = keychain.delete_password(account).await;
        }

        // Add entries
        for (i, account) in accounts.iter().enumerate() {
            let password = format!("password_{}", i);
            keychain.set_password(account, &password, None).await.unwrap();
        }

        // Find all entries
        let entries = keychain.find_entries(None).await.unwrap();
        assert_eq!(entries.len(), 3);

        // Find with prefix
        let query = FindQuery {
            account_prefix: Some(format!("app_")),
            environment: None,
            team_id: None,
            access_group: None,
        };
        let entries = keychain.find_entries(Some(query)).await.unwrap();
        assert_eq!(entries.len(), 2);

        // Clean up
        for account in &accounts {
            let _ = keychain.delete_password(account).await;
        }
    }

    #[tokio::test]
    async fn test_macos_keychain_error_handling() {
        let options = KeychainOptions {
            service: format!("com.test.lpop.{}", uuid::Uuid::new_v4()),
            environment: Some("test".to_string()),
            access_group: Some("INVALID.GROUP.THAT.SHOULD.NOT.EXIST".to_string()),
            synchronizable: Some(false),
        };

        let keychain = MacOSKeychain::new(options).unwrap();
        let test_account = "test_error_account";

        // This might fail due to invalid access group
        let result = keychain.set_password(test_account, "password", None).await;
        
        // The exact error depends on keychain configuration
        // We just verify it handles errors gracefully
        if result.is_err() {
            match result.unwrap_err() {
                KeychainError::PlatformError(_) => {}
                KeychainError::AccessDenied => {}
                e => panic!("Unexpected error type: {:?}", e),
            }
        }
    }

    #[tokio::test]
    async fn test_macos_keychain_synchronizable() {
        let options = KeychainOptions {
            service: format!("com.test.lpop.{}", uuid::Uuid::new_v4()),
            environment: Some("test".to_string()),
            access_group: None,
            synchronizable: Some(true),
        };

        let keychain = MacOSKeychain::new(options).unwrap();
        let test_account = format!("test_sync_{}", uuid::Uuid::new_v4());

        // Clean up
        let _ = keychain.delete_password(&test_account).await;

        // Set synchronizable password
        let metadata = KeychainMetadata {
            created_at: None,
            modified_at: None,
            label: Some("Sync Test".to_string()),
            comment: None,
            team_id: None,
            code_signing_info: None,
            access_group: None,
            synchronizable: Some(true),
        };

        let result = keychain.set_password(&test_account, "sync_password", Some(metadata)).await;
        assert!(result.is_ok());

        // Verify it was created
        let password = keychain.get_password(&test_account).await.unwrap();
        assert_eq!(password, Some("sync_password".to_string()));

        // Clean up
        let _ = keychain.delete_password(&test_account).await;
    }
}