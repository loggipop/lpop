use keyring::Entry;

fn test_service_format(service: &str, account: &str) {
    println!("\nTesting service='{}', account='{}'", service, account);
    
    // Set
    let e1 = Entry::new(service, account).unwrap();
    e1.set_password("test").unwrap();
    
    // Get with new instance
    let e2 = Entry::new(service, account).unwrap();
    match e2.get_password() {
        Ok(_) => println!("  ✓ Works!"),
        Err(_) => println!("  ✗ Fails"),
    }
    
    // Cleanup
    e1.delete_credential().unwrap();
}

fn main() {
    println!("Testing different naming patterns...");
    
    // Test increasingly complex names
    test_service_format("lpop", "KEY1");
    test_service_format("lpop", "TEST_VAR");
    test_service_format("lpop-dev", "KEY1");
    test_service_format("lpop.dev", "KEY1");
    test_service_format("lpop_github_com_owner_repo", "KEY1");
    test_service_format("lpop", "github.com/owner/repo?env=dev:KEY1");
}