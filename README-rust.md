# lpop (Rust Version)

A secure CLI tool for managing environment variables in the system keychain, rewritten in Rust for better security and performance.

## ⚠️ IMPORTANT: macOS Compatibility Issue

**The Rust version currently has a critical bug on macOS** where credentials cannot be retrieved across different program invocations. This is due to a limitation in the `keyring` crate (v3.6.2) where:

- Setting a value works within the same process
- Getting that value in a new process always fails with "NoEntry"
- This makes the tool unusable for its intended purpose

See `docs/keyring-issue.md` for technical details.

## Current Status

✅ **What works:**
- All code compiles and tests pass
- CLI interface is fully implemented
- Within a single process, all operations work

❌ **What doesn't work:**
- Retrieving previously stored credentials (the main use case)
- Any cross-process keychain access on macOS

## Alternatives

1. **Use the TypeScript version** - It works correctly despite the security limitations
2. **Wait for keyring crate fix** - Track issue at [keyring-rs repo]
3. **Use platform-specific implementation** - Directly use macOS Security Framework

## Key Benefits (When Working)

- **Native binary** - Each lpop installation has its own keychain identity
- **Better security** - Only the lpop binary can access its keychain entries
- **No dependencies** - Single binary, no Node.js required
- **Faster startup** - ~10ms vs ~100ms for Node.js
- **Smaller size** - ~5MB binary vs Node.js + dependencies

## Installation

### From source (for testing only)
```bash
cargo install --path .
```

### Via npm (not yet available)
```bash
npm install -g lpop
```

## Usage

Same CLI interface as the TypeScript version:

```bash
# Get all variables for current repo
lpop

# Set from .env file
lpop .env

# Set single variable
lpop API_KEY=secret123

# Get single variable  
lpop API_KEY

# Restore to file
lpop path/to/.env.local

# Use different environment
lpop -e production .env.prod

# Explicit commands
lpop get KEY
lpop set KEY VALUE
lpop delete KEY
lpop list
```

## Building

```bash
# Debug build
cargo build

# Release build (optimized)
cargo build --release

# Run directly
cargo run -- [args]

# Run tests
cargo test
```

## Cross-Platform Builds

```bash
# macOS ARM64
cargo build --release --target aarch64-apple-darwin

# macOS x64
cargo build --release --target x86_64-apple-darwin

# Linux x64
cargo build --release --target x86_64-unknown-linux-gnu

# Windows x64
cargo build --release --target x86_64-pc-windows-msvc
```

## Known Issues

1. **macOS Keychain Persistence** - The main blocker. Credentials set by the tool cannot be retrieved in subsequent invocations.
2. **Cannot list credentials** - The keyring crate doesn't support enumerating stored credentials.

## Security

Each lpop binary has its own identity in the system keychain. Other applications (including Node.js or other lpop installations) cannot access your stored variables.

However, due to the persistence bug, this security benefit cannot currently be realized on macOS.