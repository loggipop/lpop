# lpop (Rust Version)

A secure CLI tool for managing environment variables in the system keychain, rewritten in Rust for better security and performance.

## Key Benefits of Rust Version

- **Native binary** - Each lpop installation has its own keychain identity
- **Better security** - Only the lpop binary can access its keychain entries
- **No dependencies** - Single binary, no Node.js required
- **Faster startup** - ~10ms vs ~100ms for Node.js
- **Smaller size** - ~5MB binary vs Node.js + dependencies

## Installation

### From source
```bash
cargo install --path .
```

### Via npm (coming soon)
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

## Current Limitations

The Rust `keyring` crate has some limitations compared to the Node.js version:
- Cannot list all stored credentials (platform limitation)
- Would need to track keys separately or use platform-specific APIs

## Security

Each lpop binary has its own identity in the system keychain. Other applications (including Node.js or other lpop installations) cannot access your stored variables.