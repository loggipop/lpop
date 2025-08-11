#!/bin/bash

# Local script for building, signing, and notarizing lpop binaries
# This script replicates the GitHub Actions workflow for local testing
set -e

echo "🔨 Building, signing, and notarizing lpop binaries locally..."

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ This script only works on macOS for code signing and notarization"
    exit 1
fi

# Load environment variables from .env file if it exists
if [ -f ".env" ]; then
    echo "📄 Loading environment variables from .env file..."
    export $(cat .env | grep -E '^[A-Z_]+=.+' | xargs)
else
    echo "💡 No .env file found, using existing environment variables"
fi

# Check for required environment variables
if [ -z "$APPLE_ID" ] || [ -z "$APPLE_APP_PASSWORD" ] || [ -z "$APPLE_TEAM_ID" ]; then
    echo "❌ Required environment variables not set:"
    echo "   APPLE_ID - Your Apple ID email"
    echo "   APPLE_APP_PASSWORD - App-specific password from Apple"
    echo "   APPLE_TEAM_ID - Your Apple Developer Team ID (e.g., 634M4C7ZKX)"
    echo ""
    echo "You can either:"
    echo "1. Create a .env file with these variables:"
    echo "   APPLE_ID=your.apple.id@email.com"
    echo "   APPLE_APP_PASSWORD=your-app-specific-password"
    echo "   APPLE_TEAM_ID=634M4C7ZKX"
    echo ""
    echo "2. Or export them manually:"
    echo "   export APPLE_ID='your.apple.id@email.com'"
    echo "   export APPLE_APP_PASSWORD='your-app-specific-password'"
    echo "   export APPLE_TEAM_ID='634M4C7ZKX'"
    echo "   ./scripts/build-sign-notarize.sh"
    exit 1
fi

# Check if Developer ID Application certificate is available
if ! security find-identity -v -p codesigning | grep -q "Developer ID Application"; then
    echo "❌ No 'Developer ID Application' certificate found in keychain"
    echo "   Please install your Apple Developer certificate in Keychain Access"
    exit 1
fi

# Clean and prepare
echo "🧹 Cleaning previous builds..."
rm -rf dist/
mkdir -p dist

# Build macOS binaries
echo "🏗️  Building macOS binaries..."
bun build src/index.ts --target=bun-darwin-x64 --compile --minify --outfile=dist/lpop-darwin-x64
bun build src/index.ts --target=bun-darwin-arm64 --compile --minify --outfile=dist/lpop-darwin-arm64

# Sign the binaries with hardened runtime and entitlements (required for notarization)
echo "✍️  Signing binaries with Developer ID Application certificate..."
echo "📋 Applying hardened runtime and entitlements for notarization compatibility"
codesign --force --options runtime --entitlements scripts/entitlements.plist --sign "Developer ID Application" dist/lpop-darwin-x64
codesign --force --options runtime --entitlements scripts/entitlements.plist --sign "Developer ID Application" dist/lpop-darwin-arm64

# Verify signatures
echo "🔍 Verifying signatures..."
codesign --verify --verbose dist/lpop-darwin-x64
codesign --verify --verbose dist/lpop-darwin-arm64
echo "✅ Signatures verified successfully"

# Create zip files for notarization
echo "📦 Creating zip files for notarization..."
zip -j dist/lpop-darwin-x64.zip dist/lpop-darwin-x64
zip -j dist/lpop-darwin-arm64.zip dist/lpop-darwin-arm64

# Submit for notarization
echo "🍎 Submitting darwin-x64 for notarization..."
xcrun notarytool submit dist/lpop-darwin-x64.zip \
    --apple-id "$APPLE_ID" \
    --password "$APPLE_APP_PASSWORD" \
    --team-id "$APPLE_TEAM_ID" \
    --wait

echo "🍎 Submitting darwin-arm64 for notarization..."
xcrun notarytool submit dist/lpop-darwin-arm64.zip \
    --apple-id "$APPLE_ID" \
    --password "$APPLE_APP_PASSWORD" \
    --team-id "$APPLE_TEAM_ID" \
    --wait

# Clean up zip files
rm dist/lpop-darwin-x64.zip dist/lpop-darwin-arm64.zip

echo ""
echo "✅ Build, sign, and notarization complete!"
echo ""
echo "📁 Signed and notarized binaries:"
echo "   ./dist/lpop-darwin-x64"
echo "   ./dist/lpop-darwin-arm64"
echo ""
echo "🧪 Test the iCloud keychain functionality:"
echo "   ./dist/lpop-darwin-x64 'TEST_KEY=hello icloud'"
echo "   ./dist/lpop-darwin-x64 get"
echo ""
echo "💡 The signed binaries should now work with iCloud Keychain sync!"