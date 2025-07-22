use keyring::Entry;

fn main() {
    let service = "github.com/loggipop/lpop?env=development";
    let key1 = "TEST_VAR2";
    let key2 = "DEBUG_VAR";
    
    println!("Checking both keys in service: {}", service);
    
    // Check TEST_VAR2
    println!("\nChecking {}", key1);
    let entry1 = Entry::new(service, key1).unwrap();
    match entry1.get_password() {
        Ok(val) => println!("  Found: {}", val),
        Err(keyring::Error::NoEntry) => println!("  Not found"),
        Err(e) => println!("  Error: {:?}", e),
    }
    
    // Check DEBUG_VAR
    println!("\nChecking {}", key2);
    let entry2 = Entry::new(service, key2).unwrap();
    match entry2.get_password() {
        Ok(val) => println!("  Found: {}", val),
        Err(keyring::Error::NoEntry) => println!("  Not found"),
        Err(e) => println!("  Error: {:?}", e),
    }
    
    // Try setting and getting immediately
    println!("\nTrying immediate set/get:");
    let test_key = "IMMEDIATE_TEST";
    let entry3 = Entry::new(service, test_key).unwrap();
    
    println!("  Setting {}...", test_key);
    if let Err(e) = entry3.set_password("immediate_value") {
        println!("  Set error: {:?}", e);
        return;
    }
    
    println!("  Getting {}...", test_key);
    match entry3.get_password() {
        Ok(val) => println!("  ✓ Got: {}", val),
        Err(e) => println!("  ✗ Error: {:?}", e),
    }
    
    // Try with a new Entry instance
    println!("\n  Getting with new Entry instance...");
    let entry4 = Entry::new(service, test_key).unwrap();
    match entry4.get_password() {
        Ok(val) => println!("  ✓ Got: {}", val),
        Err(e) => println!("  ✗ Error: {:?}", e),
    }
    
    // Clean up
    let _ = entry3.delete_credential();
}