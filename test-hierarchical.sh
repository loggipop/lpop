#!/bin/bash

echo "Testing hierarchical environment variable lookup..."
echo ""

# Clean up any existing test variables
echo "1. Cleaning up existing test variables..."
./lpop clear --env development --confirm
./lpop clear --env production --confirm
./lpop clear --repo-level --confirm

echo ""
echo "2. Setting repo-level variables (shared across all environments)..."
./lpop add DATABASE_HOST=localhost --repo-level
./lpop add API_VERSION=v1 --repo-level
./lpop add LOG_LEVEL=info --repo-level

echo ""
echo "3. Setting development-specific variables (overrides repo-level)..."
./lpop add DATABASE_HOST=dev.example.com --env development
./lpop add DEBUG=true --env development

echo ""
echo "4. Setting production-specific variables (overrides repo-level)..."
./lpop add DATABASE_HOST=prod.example.com --env production
./lpop add DEBUG=false --env production
./lpop add SECRET_KEY=prod-secret-123 --env production

echo ""
echo "5. Getting variables for development environment:"
echo "   (Should show DATABASE_HOST=dev.example.com, API_VERSION=v1, LOG_LEVEL=info, DEBUG=true)"
./lpop get --env development

echo ""
echo "6. Getting variables for production environment:"
echo "   (Should show DATABASE_HOST=prod.example.com, API_VERSION=v1, LOG_LEVEL=info, DEBUG=false, SECRET_KEY=prod-secret-123)"
./lpop get --env production

echo ""
echo "7. Getting variables for staging environment (no env-specific vars):"
echo "   (Should show only repo-level vars: DATABASE_HOST=localhost, API_VERSION=v1, LOG_LEVEL=info)"
./lpop get --env staging

echo ""
echo "Test complete!"