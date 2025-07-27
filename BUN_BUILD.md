# Bun Binary Build Guide

This document explains how to build `lpop` as a standalone binary using Bun.

## Prerequisites

1. **Install Bun**:

   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. **Reload your shell**:
   ```bash
   source ~/.zshrc  # or source ~/.bashrc
   ```

## Building the Binary

### Quick Build

```bash
pnpm build
```

This will:

- Clean previous builds
- Compile the TypeScript code with Bun
- Create a standalone binary named `lpop`
- Make it executable
- Place it in the project root

### Manual Build

If you prefer to build manually:

```bash
# Clean previous builds
rm -rf dist/ && rm -f lpop

# Build the binary
bun build src/index.ts --target=bun --compile --minify

# Rename and make executable
mv index lpop
chmod +x lpop
```

## Using the Binary

After building, you can:

```bash
# Run directly
./lpop --help

# Copy to PATH for global access
sudo cp lpop /usr/local/bin/
lpop --help

# Test functionality
./lpop list
./lpop --version
```

## Binary Characteristics

- **Size**: ~57MB (includes all dependencies)
- **Dependencies**: None required - completely self-contained
- **Platform**: macOS (ARM64/Intel)
- **Runtime**: No Node.js or Bun required

## Advantages of Bun Build

1. **Fast compilation** - Bun is significantly faster than traditional Node.js builds
2. **Smaller binaries** - More efficient bundling and tree-shaking
3. **Better optimization** - Advanced minification and dead code elimination
4. **Cross-platform** - Can target multiple platforms from macOS
5. **Self-contained** - No external runtime dependencies

## Troubleshooting

### Build Errors

If you encounter build errors:

1. **Ensure Bun is installed**:

   ```bash
   bun --version
   ```

2. **Clean and rebuild**:

   ```bash
   pnpm build
   ```

3. **Check dependencies**:
   ```bash
   bun install
   ```

### Runtime Errors

If the binary doesn't run:

1. **Check permissions**:

   ```bash
   chmod +x lpop
   ```

2. **Verify binary integrity**:

   ```bash
   file lpop
   ```

3. **Test with verbose output**:
   ```bash
   ./lpop --help
   ```

## Distribution

The binary can be distributed by:

1. **Direct copy**: Copy the `lpop` file to target systems
2. **Package managers**: Create packages for different platforms
3. **GitHub releases**: Upload as release assets

## Development Workflow

For development with binary builds:

```bash
# Development
pnpm dev

# Build and test binary
pnpm build
./lpop --help
```
