#!/bin/bash

set -e

echo "Building native keychain module..."

# Change to the native module directory
cd packages/keychain-native

# Install dependencies
echo "Installing dependencies..."
bun install

# Check if Rust is installed
if ! command -v cargo &> /dev/null; then
    echo "Rust is not installed. Please install Rust first:"
    echo "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
fi

# Build the native module
echo "Building native module..."
npm run build

echo "Native module built successfully!"

# Run tests if requested
if [ "$1" = "--test" ]; then
    echo "Running tests..."
    node test.js
fi