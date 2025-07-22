# Rust Migration Guide

## Background

This document captures the decision to migrate lpop from TypeScript to Rust, addressing security concerns with Node.js-based keychain access.

## The Security Issue

When using the TypeScript version with `@napi-rs/keyring`:
- macOS Keychain sees all Node.js processes as the "node" application
- Any Node.js script can access lpop's stored credentials
- No way to restrict access to just lpop

## Why Rust?

1. **Native Binary Identity**: Each Rust binary has its own keychain identity
2. **Better Security**: Only the lpop binary can access its credentials
3. **Performance**: ~10ms startup vs ~100ms for Node.js
4. **Distribution**: Single ~5MB binary vs Node.js + dependencies
5. **Cross-platform**: Works on macOS, Linux, and Windows

## Code Signing for Updates

### The Update Problem
Without code signing, each new lpop build is seen as a different application by macOS, meaning:
- Loss of access to previously stored credentials
- Users must re-authorize and re-enter all variables

### Solution: Code Signing

#### Option 1: Self-Signed Certificate (Free)
```bash
# Create certificate in Keychain Access, then:
codesign --sign "lpop-cert" target/release/lpop
```

#### Option 2: Apple Developer Certificate ($99/year)
```bash
codesign --sign "Developer ID Application: Your Name" target/release/lpop
```

#### Option 3: Ad-hoc Signing (Quick but not persistent)
```bash
codesign --sign - target/release/lpop
```

### Recommendation
Use consistent code signing for all releases to maintain keychain access across updates.

## Cross-Platform Considerations

### macOS
- Uses Keychain Services
- Code signing provides best experience
- Binary identity crucial for security

### Windows
- Uses Windows Credential Manager
- Access based on user context
- Binary compilation helps but doesn't fully isolate

### Linux
- Uses Secret Service API (GNOME Keyring/KWallet)
- Similar to Windows - user-based access
- Binary provides some isolation

## npm Distribution

Even though lpop is now a Rust binary, it can still be distributed via npm:

```json
{
  "name": "lpop",
  "bin": {
    "lpop": "./bin/lpop"
  },
  "scripts": {
    "postinstall": "node install.js"
  }
}
```

The install script downloads the appropriate binary for the user's platform.

## Migration Steps for Users

1. Install the new Rust version
2. If not code-signed, re-authorize keychain access
3. Existing stored credentials remain accessible (if properly signed)

## Current Limitations

- The Rust `keyring` crate cannot list all stored credentials
- Would need platform-specific APIs or separate key tracking
- This affects the `lpop list` functionality

## Future Enhancements

1. Implement key tracking for full list functionality
2. Add encryption layer for additional security
3. Create GitHub Actions for automated cross-platform builds
4. Set up proper code signing in CI/CD pipeline