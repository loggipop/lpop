use keyring::Entry;

fn test_service(service: &str, description: &str) {
    println!("\nTesting {}: '{}'", description, service);
    
    let key = "TEST_KEY";
    let value = "test_value";
    
    // Set
    let entry1 = Entry::new(service, key).unwrap();
    match entry1.set_password(value) {
        Ok(()) => print!("  Set: ✓"),
        Err(e) => {
            println!("  Set: ✗ ({:?})", e);
            return;
        }
    }
    
    // Get with same instance
    match entry1.get_password() {
        Ok(v) => print!("  Get(same): ✓"),
        Err(e) => print!("  Get(same): ✗ ({:?})", e),
    }
    
    // Get with new instance
    let entry2 = Entry::new(service, key).unwrap();
    match entry2.get_password() {
        Ok(v) => println!("  Get(new): ✓"),
        Err(e) => println!("  Get(new): ✗ ({:?})", e),
    }
    
    // Clean up
    let _ = entry1.delete_credential();
}

fn main() {
    println!("Testing different service name formats...");
    
    test_service("simple-service", "Simple alphanumeric");
    test_service("service.with.dots", "With dots");
    test_service("service/with/slashes", "With slashes");
    test_service("service?with=query", "With query string");
    test_service("github.com/owner/repo", "GitHub style");
    test_service("github.com/owner/repo?env=dev", "Full lpop format");
}