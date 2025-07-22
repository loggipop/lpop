# Keyring Crate Issue on macOS

## Problem

The `keyring` crate (v3.6.1) has a critical issue on macOS where credentials set through one `Entry` instance cannot be retrieved through a new `Entry` instance with the same service/account combination.

## Symptoms

```rust
let entry1 = Entry::new("service", "account").unwrap();
entry1.set_password("value").unwrap();
entry1.get_password().unwrap(); // Works: returns "value"

let entry2 = Entry::new("service", "account").unwrap();
entry2.get_password().unwrap(); // Fails: NoEntry error
```

## Impact on lpop

This makes the Rust version unusable because:
- Setting a variable in one lpop invocation
- Cannot be retrieved in another lpop invocation
- Each command creates new Entry instances

## Tested Scenarios

All service name formats fail:
- Simple: `simple-service`
- With dots: `service.with.dots`
- With slashes: `service/with/slashes`
- With query: `service?with=query`
- GitHub format: `github.com/owner/repo?env=dev`

## Potential Solutions

1. **Use a different keyring crate**
   - `security-framework` (macOS specific)
   - `keychain-services` (macOS specific)
   - Roll our own using macOS Security Framework

2. **Work around the issue**
   - Cache Entry instances (not practical for CLI)
   - Use a different storage backend

3. **Fix the keyring crate**
   - Submit bug report
   - Contribute a fix

4. **Platform-specific implementation**
   - Use native APIs directly on each platform
   - More work but guaranteed to work correctly

## Recommendation

For now, the TypeScript version with `@napi-rs/keyring` is more reliable, despite the security limitations. The Rust version needs either:
- A fix to the keyring crate
- A different keyring library
- Platform-specific implementations