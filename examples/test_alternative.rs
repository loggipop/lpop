// Test if updating to latest keyring helps
use keyring::Entry;

fn main() {
    println!("Testing with keyring v{}", env!("CARGO_PKG_VERSION"));
    
    let service = "test-service";
    let account = "test-account";
    let password = "test-password";
    
    // Create and set
    println!("Creating entry and setting password...");
    let entry = Entry::new(service, account).unwrap();
    entry.set_password(password).unwrap();
    
    // Try to get with new instance multiple times
    for i in 1..=3 {
        println!("\nAttempt {} to get with new Entry instance:", i);
        let new_entry = Entry::new(service, account).unwrap();
        match new_entry.get_password() {
            Ok(pwd) => println!("  ✓ Success: {}", pwd),
            Err(e) => println!("  ✗ Failed: {:?}", e),
        }
        
        // Small delay
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
    
    // Clean up
    println!("\nCleaning up...");
    entry.delete_credential().unwrap();
}