use lpop_keychain_native::*;

#[tokio::test]
async fn test_keychain_creation_with_minimal_options() {
    let options = KeychainOptions {
        service: "com.test.lpop.integration".to_string(),
        environment: None,
        access_group: None,
        synchronizable: None,
    };

    let keychain = Keychain::new(options);
    assert!(keychain.is_ok());
}

#[tokio::test]
async fn test_keychain_creation_with_full_options() {
    let options = KeychainOptions {
        service: "com.test.lpop.integration".to_string(),
        environment: Some("test".to_string()),
        access_group: Some("com.test.shared".to_string()),
        synchronizable: Some(true),
    };

    let keychain = Keychain::new(options);
    assert!(keychain.is_ok());
}

#[tokio::test]
async fn test_keychain_password_lifecycle() {
    let service_id = uuid::Uuid::new_v4();
    let options = KeychainOptions {
        service: format!("com.test.lpop.{}", service_id),
        environment: Some("integration_test".to_string()),
        access_group: None,
        synchronizable: Some(false),
    };

    let keychain = Keychain::new(options).unwrap();
    let test_account = format!("integration_test_{}", uuid::Uuid::new_v4());

    // Ensure clean state
    let _ = keychain.delete_password(test_account.clone()).await;

    // Test 1: Set password
    let result = keychain.set_password(
        test_account.clone(),
        "test_password_123".to_string(),
        None,
    ).await;
    assert!(result.is_ok());

    // Test 2: Get password
    let password = keychain.get_password(test_account.clone()).await.unwrap();
    assert_eq!(password, Some("test_password_123".to_string()));

    // Test 3: Update password
    let result = keychain.set_password(
        test_account.clone(),
        "updated_password_456".to_string(),
        None,
    ).await;
    assert!(result.is_ok());

    let password = keychain.get_password(test_account.clone()).await.unwrap();
    assert_eq!(password, Some("updated_password_456".to_string()));

    // Test 4: Delete password
    let deleted = keychain.delete_password(test_account.clone()).await.unwrap();
    assert!(deleted);

    // Test 5: Verify deletion
    let password = keychain.get_password(test_account.clone()).await.unwrap();
    assert_eq!(password, None);

    // Test 6: Delete non-existent returns false
    let deleted = keychain.delete_password(test_account.clone()).await.unwrap();
    assert!(!deleted);
}

#[tokio::test]
async fn test_keychain_with_metadata() {
    let service_id = uuid::Uuid::new_v4();
    let options = KeychainOptions {
        service: format!("com.test.lpop.{}", service_id),
        environment: Some("metadata_test".to_string()),
        access_group: None,
        synchronizable: Some(false),
    };

    let keychain = Keychain::new(options).unwrap();
    let test_account = format!("metadata_test_{}", uuid::Uuid::new_v4());

    // Clean up
    let _ = keychain.delete_password(test_account.clone()).await;

    // Create metadata
    let metadata = KeychainMetadata {
        created_at: Some(1234567890),
        modified_at: Some(1234567891),
        label: Some("Integration Test Entry".to_string()),
        comment: Some("This is a test comment for integration testing".to_string()),
        team_id: None, // Will be set by platform if available
        code_signing_info: None,
        access_group: None,
        synchronizable: Some(false),
    };

    // Set password with metadata
    let result = keychain.set_password(
        test_account.clone(),
        "metadata_password".to_string(),
        Some(metadata.clone()),
    ).await;
    assert!(result.is_ok());

    // Get entry with metadata
    let entry = keychain.get_entry(test_account.clone()).await.unwrap();
    assert!(entry.is_some());

    let entry = entry.unwrap();
    assert_eq!(entry.account, test_account);
    assert_eq!(entry.password, "metadata_password");
    assert!(entry.metadata.is_some());

    let retrieved_metadata = entry.metadata.unwrap();
    assert_eq!(retrieved_metadata.label, Some("Integration Test Entry".to_string()));
    assert_eq!(retrieved_metadata.comment, Some("This is a test comment for integration testing".to_string()));

    // Clean up
    let _ = keychain.delete_password(test_account).await;
}

#[tokio::test]
async fn test_keychain_find_entries() {
    let service_id = uuid::Uuid::new_v4();
    let options = KeychainOptions {
        service: format!("com.test.lpop.{}", service_id),
        environment: Some("find_test".to_string()),
        access_group: None,
        synchronizable: Some(false),
    };

    let keychain = Keychain::new(options).unwrap();

    // Create test entries
    let entries = vec![
        (format!("user_alice_{}", service_id), "alice_password"),
        (format!("user_bob_{}", service_id), "bob_password"),
        (format!("admin_charlie_{}", service_id), "charlie_password"),
        (format!("admin_david_{}", service_id), "david_password"),
    ];

    // Clean up and add entries
    for (account, password) in &entries {
        let _ = keychain.delete_password(account.clone()).await;
        keychain.set_password(account.clone(), password.to_string(), None).await.unwrap();
    }

    // Test 1: Find all entries
    let found = keychain.find_entries(None).await.unwrap();
    assert_eq!(found.len(), 4);

    // Test 2: Find by prefix
    let query = FindQuery {
        account_prefix: Some("user_".to_string()),
        environment: None,
        team_id: None,
        access_group: None,
    };
    let found = keychain.find_entries(Some(query)).await.unwrap();
    assert_eq!(found.len(), 2);

    // Test 3: Find by different prefix
    let query = FindQuery {
        account_prefix: Some("admin_".to_string()),
        environment: None,
        team_id: None,
        access_group: None,
    };
    let found = keychain.find_entries(Some(query)).await.unwrap();
    assert_eq!(found.len(), 2);

    // Test 4: Find with non-matching prefix
    let query = FindQuery {
        account_prefix: Some("nonexistent_".to_string()),
        environment: None,
        team_id: None,
        access_group: None,
    };
    let found = keychain.find_entries(Some(query)).await.unwrap();
    assert_eq!(found.len(), 0);

    // Clean up
    for (account, _) in &entries {
        let _ = keychain.delete_password(account.clone()).await;
    }
}

#[tokio::test]
async fn test_keychain_special_characters_in_password() {
    let service_id = uuid::Uuid::new_v4();
    let options = KeychainOptions {
        service: format!("com.test.lpop.{}", service_id),
        environment: Some("special_char_test".to_string()),
        access_group: None,
        synchronizable: Some(false),
    };

    let keychain = Keychain::new(options).unwrap();
    let test_account = format!("special_test_{}", uuid::Uuid::new_v4());

    // Test various special characters
    let special_passwords = vec![
        "password with spaces",
        "p@ssw0rd!with#special$chars",
        "密码123", // Unicode characters
        "emoji🔐password🎉",
        r#"{"json": "password", "with": "quotes"}"#,
        "multi\nline\npassword",
        "tab\tseparated\tpassword",
    ];

    for password in special_passwords {
        // Clean up
        let _ = keychain.delete_password(test_account.clone()).await;

        // Set password
        let result = keychain.set_password(
            test_account.clone(),
            password.to_string(),
            None,
        ).await;
        assert!(result.is_ok(), "Failed to set password: {}", password);

        // Get password
        let retrieved = keychain.get_password(test_account.clone()).await.unwrap();
        assert_eq!(retrieved, Some(password.to_string()), "Password mismatch for: {}", password);
    }

    // Clean up
    let _ = keychain.delete_password(test_account).await;
}

#[tokio::test]
async fn test_keychain_concurrent_operations() {
    let service_id = uuid::Uuid::new_v4();
    let options = KeychainOptions {
        service: format!("com.test.lpop.{}", service_id),
        environment: Some("concurrent_test".to_string()),
        access_group: None,
        synchronizable: Some(false),
    };

    let keychain = Keychain::new(options).unwrap();
    
    // Create multiple tasks that operate on different accounts
    let mut handles = vec![];
    
    for i in 0..5 {
        let keychain_clone = keychain.clone();
        let account = format!("concurrent_account_{}_{}", i, service_id);
        let password = format!("password_{}", i);
        
        let handle = tokio::spawn(async move {
            // Clean up
            let _ = keychain_clone.delete_password(account.clone()).await;
            
            // Set password
            keychain_clone.set_password(account.clone(), password.clone(), None).await.unwrap();
            
            // Get password
            let retrieved = keychain_clone.get_password(account.clone()).await.unwrap();
            assert_eq!(retrieved, Some(password));
            
            // Delete password
            keychain_clone.delete_password(account).await.unwrap()
        });
        
        handles.push(handle);
    }
    
    // Wait for all tasks to complete
    for handle in handles {
        let result = handle.await.unwrap();
        assert!(result);
    }
}

#[tokio::test]
async fn test_keychain_empty_values() {
    let service_id = uuid::Uuid::new_v4();
    let options = KeychainOptions {
        service: format!("com.test.lpop.{}", service_id),
        environment: Some("empty_test".to_string()),
        access_group: None,
        synchronizable: Some(false),
    };

    let keychain = Keychain::new(options).unwrap();
    let test_account = format!("empty_test_{}", uuid::Uuid::new_v4());

    // Test with empty password (should work)
    let result = keychain.set_password(
        test_account.clone(),
        "".to_string(),
        None,
    ).await;
    assert!(result.is_ok());

    let password = keychain.get_password(test_account.clone()).await.unwrap();
    assert_eq!(password, Some("".to_string()));

    // Clean up
    let _ = keychain.delete_password(test_account).await;
}

#[tokio::test]
async fn test_keychain_large_password() {
    let service_id = uuid::Uuid::new_v4();
    let options = KeychainOptions {
        service: format!("com.test.lpop.{}", service_id),
        environment: Some("large_test".to_string()),
        access_group: None,
        synchronizable: Some(false),
    };

    let keychain = Keychain::new(options).unwrap();
    let test_account = format!("large_test_{}", uuid::Uuid::new_v4());

    // Create a large password (1MB)
    let large_password = "x".repeat(1024 * 1024);

    // Clean up
    let _ = keychain.delete_password(test_account.clone()).await;

    // Set large password
    let result = keychain.set_password(
        test_account.clone(),
        large_password.clone(),
        None,
    ).await;
    
    // This might fail on some platforms due to size limits
    if result.is_ok() {
        let retrieved = keychain.get_password(test_account.clone()).await.unwrap();
        assert_eq!(retrieved, Some(large_password));
    }

    // Clean up
    let _ = keychain.delete_password(test_account).await;
}