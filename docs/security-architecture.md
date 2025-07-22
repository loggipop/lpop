# Security Architecture

## Overview

lpop stores environment variables in the system keychain, providing secure storage with OS-level encryption and access controls.

## TypeScript Version Security Issues

### The Problem
- Uses `@napi-rs/keyring` which wraps native keychain APIs
- macOS identifies the application by its binary path
- All Node.js applications share the same identity: `/usr/local/bin/node`
- **Result**: Any Node.js script can access lpop's stored credentials

### Example Attack Vector
```javascript
// Any malicious npm package could do this:
import { findCredentials } from '@napi-rs/keyring';
const creds = findCredentials('github.com/user/repo?env=production');
// Now they have your production secrets!
```

## Rust Version Security Benefits

### Application Identity
- Compiled Rust binary has unique identity
- Only the lpop binary can access its keychain entries
- Other applications (including Node.js) cannot access lpop's data

### Code Signing
Maintains identity across updates:
```bash
# Sign the binary
codesign --sign "Developer ID" target/release/lpop

# Verify signature
codesign --verify --verbose target/release/lpop
```

## Keychain Storage Format

### Service Name Structure
```
{host}/{owner}/{repo}?env={environment}
```

Examples:
- `github.com/acme/backend?env=production`
- `gitlab.com/team/frontend?env=staging`
- `local/myproject?env=development`

### Data Storage
- **Service**: Repository identifier with environment
- **Account**: Environment variable name (e.g., `API_KEY`)
- **Password**: Environment variable value (encrypted by OS)

## Platform-Specific Security

### macOS
- Uses Keychain Services API
- Encryption keys protected by Secure Enclave (on supported Macs)
- Access controlled by application signature
- User prompted on first access

### Linux
- Uses Secret Service API (GNOME Keyring/KWallet)
- Encryption tied to user login
- Access control less granular than macOS
- Binary compilation still provides isolation

### Windows
- Uses Windows Credential Manager
- DPAPI encryption tied to user account
- Limited application-level access control
- Binary compilation helps but not as isolated as macOS

## Best Practices

### For Development
1. Use debug builds for testing
2. Ad-hoc sign for local development
3. Keep credentials in development environment only

### For Distribution
1. Always code sign releases
2. Use consistent certificate across versions
3. Document the signing identity
4. Consider notarization for macOS

### For Users
1. Verify binary signatures before trusting
2. Use separate environments (dev/staging/prod)
3. Regularly rotate credentials
4. Monitor keychain access logs

## Threat Model

### Protected Against
- Malicious npm packages reading credentials
- Other Node.js applications accessing lpop data
- Casual credential exposure
- Accidental commits of .env files

### Not Protected Against
- Malware with keychain access permissions
- Root/Administrator access
- Physical access to unlocked machine
- Compromised code signing certificate

## Audit Trail

macOS provides some visibility:
- Keychain Access app shows which apps have access
- Console logs show authorization requests
- Security framework logs access attempts

## Future Improvements

1. **Hardware Key Support**: Integration with YubiKey/FIDO2
2. **Encryption Layer**: Additional app-level encryption
3. **Audit Logging**: Built-in access logging
4. **Team Sharing**: Secure credential sharing mechanisms
5. **Rotation Reminders**: Alert when credentials are old