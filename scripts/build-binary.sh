#!/bin/bash

# Build script for creating lpop binaries for multiple operating systems using Bun
set -e

echo "🔨 Building lpop binaries for multiple platforms with Bun..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/
rm -f lpop lpop-*

# Create dist directory for binaries
mkdir -p dist

# Build targets: platform-architecture
declare -a targets=(
    "linux-x64"
    "linux-arm64"
    "darwin-x64"
    "darwin-arm64"
    "windows-x64"
)

echo "📦 Building binaries for multiple platforms..."

for target in "${targets[@]}"; do
    echo "🏗️  Building for $target..."
    
    # Extract platform and architecture
    platform=$(echo $target | cut -d'-' -f1)
    arch=$(echo $target | cut -d'-' -f2)
    
    # Set the target for Bun build
    if [ "$platform" = "windows" ]; then
        binary_name="lpop-$target.exe"
    else
        binary_name="lpop-$target"
    fi
    
    # Build the binary for the specific target
    bun build src/index.ts --target=bun-$platform-$arch --compile --minify --outfile=dist/$binary_name
    
    echo "✅ Built $binary_name"
done

# Build for current platform as default 'lpop' binary
echo "🏗️  Building default binary for current platform..."
bun build src/index.ts --target=bun --compile --minify --outfile=lpop

# Make binaries executable (except Windows)
echo "🔧 Making binaries executable..."
chmod +x lpop
chmod +x dist/lpop-linux-* dist/lpop-darwin-* 2>/dev/null || true

echo ""
echo "✅ All binaries build complete!"
echo "📁 Binary locations:"
echo "   ./lpop (current platform)"
echo "   ./dist/lpop-linux-x64"
echo "   ./dist/lpop-linux-arm64"
echo "   ./dist/lpop-darwin-x64"
echo "   ./dist/lpop-darwin-arm64"
echo "   ./dist/lpop-windows-x64.exe"
echo ""
echo "🚀 You can now run:"
echo "   ./lpop --help" 