#!/bin/bash

# Build script for creating lpop binary using Bun
set -e

echo "🔨 Building lpop binary with Bun..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/
rm -f lpop

# Build the binary
echo "📦 Building binary..."
bun build src/index.ts --target=bun --compile --minify

# Rename the binary to 'lpop'
echo "🏷️  Renaming binary..."
mv index lpop

# Make it executable
echo "🔧 Making binary executable..."
chmod +x lpop

echo "✅ Binary build complete!"
echo "📁 Binary location: ./lpop"
echo ""
echo "🚀 You can now run:"
echo "   ./lpop --help" 