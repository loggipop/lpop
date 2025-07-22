use keyring::Entry;

fn main() {
    let service = "github.com/loggipop/lpop?env=development";
    let account = "TEST_VAR";
    
    println!("Checking keychain for service: {}, account: {}", service, account);
    
    let entry = Entry::new(service, account).unwrap();
    
    match entry.get_password() {
        Ok(password) => println!("Found password: {}", password),
        Err(keyring::Error::NoEntry) => println!("No entry found"),
        Err(e) => println!("Error: {:?}", e),
    }
}