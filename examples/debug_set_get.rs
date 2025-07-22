use keyring::Entry;
use lpop::git_resolver::GitPathResolver;
use lpop::keychain::KeychainManager;

fn main() {
    println!("=== Debug Set/Get Test ===\n");
    
    // Get service name
    let resolver = GitPathResolver::new(None);
    let service_name = resolver.generate_service_name("development");
    println!("Service name: {}", service_name);
    
    // Method 1: Direct keyring
    println!("\n1. Testing with direct keyring Entry:");
    let entry = Entry::new(&service_name, "DEBUG_VAR").unwrap();
    
    println!("   Setting value...");
    match entry.set_password("debug_value") {
        Ok(()) => println!("   ✓ Set succeeded"),
        Err(e) => println!("   ✗ Set failed: {:?}", e),
    }
    
    println!("   Getting value...");
    match entry.get_password() {
        Ok(val) => println!("   ✓ Got value: {}", val),
        Err(e) => println!("   ✗ Get failed: {:?}", e),
    }
    
    // Method 2: Through KeychainManager
    println!("\n2. Testing with KeychainManager:");
    let keychain = KeychainManager::new(service_name.clone());
    
    println!("   Setting TEST_VAR2...");
    match keychain.set_var("TEST_VAR2", "hello2") {
        Ok(()) => println!("   ✓ Set succeeded"),
        Err(e) => println!("   ✗ Set failed: {:?}", e),
    }
    
    println!("   Getting TEST_VAR2...");
    match keychain.get_var("TEST_VAR2") {
        Ok(Some(val)) => println!("   ✓ Got value: {}", val),
        Ok(None) => println!("   ✗ Value not found"),
        Err(e) => println!("   ✗ Get failed: {:?}", e),
    }
    
    // Clean up
    println!("\n3. Cleaning up...");
    let _ = entry.delete_credential();
    let _ = keychain.delete_var("TEST_VAR2");
    
    println!("\nDone!");
}