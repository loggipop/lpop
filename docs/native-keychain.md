# Native Keychain Module

The native keychain module provides enhanced security features for lpop, particularly on macOS where it supports Team ID, Access Groups, and iCloud Keychain synchronization.

## Features

- **Native Platform Integration**: Direct access to platform keychain APIs
- **macOS Security**: Support for Team ID, Access Groups, and code signing
- **Cross-Platform**: Fallback support for Linux and Windows (planned)
- **Async/Await API**: Modern asynchronous interface
- **Performance**: Built with Rust for optimal performance

## Building the Module

1. Install Rust if you haven't already:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. Build the native module:
   ```bash
   ./scripts/build-native.sh
   ```

3. Run tests to verify:
   ```bash
   ./scripts/build-native.sh --test
   ```

## Configuration

### Environment Variables

- `LPOP_TEAM_ID` - Your Apple Developer Team ID (e.g., "ABC123XYZ")
- `LPOP_ACCESS_GROUP` - Access group for sharing between apps
- `LPOP_SYNC` - Set to "true" to enable iCloud Keychain sync

### Programmatic Configuration

```typescript
import { NativeKeychainManager } from './src/keychain-manager-native.js';

const keychain = new NativeKeychainManager(
  'com.example.service',
  'production',
  {
    teamId: 'ABC123XYZ',
    accessGroup: 'com.example.shared',
    synchronizable: true
  }
);
```

## macOS Code Signing

To use Team ID and Access Groups on macOS, your application must be code signed with proper entitlements:

1. Create an entitlements file:
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
   <dict>
       <key>keychain-access-groups</key>
       <array>
           <string>$(AppIdentifierPrefix)com.example.shared</string>
       </array>
   </dict>
   </plist>
   ```

2. Sign your application:
   ```bash
   codesign --entitlements entitlements.plist -s "Developer ID Application: Your Name (TEAMID)" your-app
   ```

## Usage Examples

### Basic Usage

```typescript
// Use existing @napi-rs/keyring
import { KeychainManager } from './src/keychain-manager.js';

// Use native module with enhanced features
import { NativeKeychainManager } from './src/keychain-manager-native.js';

// Both have the same API
const keychain = new NativeKeychainManager('service', 'environment');
await keychain.setPassword('KEY', 'value');
```

### With Team ID (macOS)

```typescript
const keychain = new NativeKeychainManager(
  'com.example.app',
  'production',
  { teamId: process.env.LPOP_TEAM_ID }
);
```

### Shared Access Group (macOS)

```typescript
// App A
const keychainA = new NativeKeychainManager(
  'shared.service',
  'production',
  {
    teamId: 'ABC123XYZ',
    accessGroup: 'com.company.shared'
  }
);
await keychainA.setPassword('SHARED_KEY', 'shared_value');

// App B (same team and access group)
const keychainB = new NativeKeychainManager(
  'shared.service',
  'production',
  {
    teamId: 'ABC123XYZ',
    accessGroup: 'com.company.shared'
  }
);
const value = await keychainB.getPassword('SHARED_KEY'); // Returns 'shared_value'
```

## Migration Guide

To migrate from `@napi-rs/keyring` to the native module:

1. Replace imports:
   ```typescript
   // Before
   import { KeychainManager } from './keychain-manager.js';
   
   // After
   import { NativeKeychainManager as KeychainManager } from './keychain-manager-native.js';
   ```

2. Add configuration if needed:
   ```typescript
   // Before
   const keychain = new KeychainManager(service, environment);
   
   // After (with enhanced features)
   const keychain = new KeychainManager(service, environment, {
     teamId: process.env.LPOP_TEAM_ID,
     accessGroup: process.env.LPOP_ACCESS_GROUP
   });
   ```

## Platform Support

### macOS
- Full support for all features
- Requires code signing for Team ID and Access Groups
- Optional iCloud Keychain synchronization

### Linux (Planned)
- Will use Secret Service API
- No Team ID or Access Group support
- Basic password storage functionality

### Windows (Planned)
- Will use Windows Credential Manager
- No Team ID or Access Group support
- Basic password storage functionality

### Other Platforms
- Falls back to in-memory storage
- Useful for testing and development
- Data is not persisted

## Security Considerations

1. **Team ID**: Ensures only your applications can access the keychain items
2. **Access Groups**: Allow controlled sharing between your applications
3. **Code Signing**: Required on macOS for enhanced security features
4. **Synchronization**: Use with caution - synced items are stored in iCloud

## Troubleshooting

### Build Errors

If you encounter build errors:

1. Ensure Rust is installed and up to date
2. Check that all dependencies are installed
3. On macOS, ensure Xcode Command Line Tools are installed

### Runtime Errors

1. **Access Denied**: Check code signing and entitlements
2. **Team ID Not Working**: Verify the Team ID matches your certificate
3. **Module Not Found**: Ensure the native module is built

### Testing

Run the test suite:
```bash
cd packages/keychain-native
node test.js
```

Run the integration example:
```bash
bun run examples/use-native-keychain.ts
```