use keyring::Entry;
use anyhow::Result;

fn main() -> Result<()> {
    println!("Testing keychain access...");
    
    // Create an entry
    let service = "lpop-debug-test";
    let account = "TEST_KEY";
    
    println!("Creating keychain entry for service: {}, account: {}", service, account);
    let entry = Entry::new(service, account)?;
    
    // Try to set a password
    println!("Setting password...");
    match entry.set_password("test_value") {
        Ok(()) => println!("✓ Successfully set password"),
        Err(e) => println!("✗ Failed to set password: {:?}", e),
    }
    
    // Try to get it back
    println!("\nGetting password...");
    match entry.get_password() {
        Ok(password) => println!("✓ Retrieved password: {}", password),
        Err(e) => println!("✗ Failed to get password: {:?}", e),
    }
    
    // Try to delete it
    println!("\nDeleting password...");
    match entry.delete_credential() {
        Ok(()) => println!("✓ Successfully deleted password"),
        Err(e) => println!("✗ Failed to delete password: {:?}", e),
    }
    
    println!("\nTest complete!");
    Ok(())
}