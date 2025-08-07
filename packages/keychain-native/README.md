# @lpop/keychain-native

Native keychain bindings for lpop with enhanced security features, particularly for macOS.

## Features

- Native keychain access using platform-specific APIs
- macOS: Full support for Team ID, Access Groups, and iCloud Keychain sync
- Cross-platform fallback for unsupported systems
- Async/await API
- Built with Rust for performance and safety

## Installation

```bash
cd packages/keychain-native
bun install
bun run build
```

## Building

To build the native module:

```bash
# Install Rust if you haven't already
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Build the module
bun run build

# Build debug version
bun run build:debug
```

## Usage

```javascript
const { Keychain } = require('@lpop/keychain-native');

// Create keychain instance with options
const keychain = new Keychain({
  teamId: 'YOUR_TEAM_ID',        // macOS Team ID for code signing
  accessGroup: 'com.app.shared',  // Share keychain items between apps
  synchronizable: true            // Sync with iCloud Keychain
});

// Store a password
await keychain.setPassword('com.myapp', 'username', 'password123');

// Retrieve a password
const password = await keychain.getPassword('com.myapp', 'username');

// Find all credentials for a service
const credentials = await keychain.findCredentials('com.myapp');

// Delete a password
await keychain.deletePassword('com.myapp', 'username');
```

## Platform Support

- **macOS**: Full support using Security Framework
- **Linux**: Planned (currently uses fallback)
- **Windows**: Planned (currently uses fallback)
- **Other**: In-memory fallback implementation

## Development

Run the test script to verify functionality:

```bash
node test.js
```

## Architecture

The module is structured with a platform abstraction layer:

- `src/lib.rs` - NAPI bindings and main interface
- `src/platform/` - Platform-specific implementations
  - `macos.rs` - macOS Security Framework integration
  - `linux.rs` - Linux Secret Service (planned)
  - `windows.rs` - Windows Credential Manager (planned)
  - `fallback.rs` - In-memory storage for unsupported platforms