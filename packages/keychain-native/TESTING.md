# Testing Guide for Keychain Native Module

This document describes the testing strategy and procedures for the keychain-native module.

## Test Structure

The test suite is organized into several categories:

### 1. Rust Unit Tests
- **Location**: `src/**/*.rs` (inline with source)
- **Purpose**: Test individual Rust components in isolation
- **Run**: `cargo test --lib`

### 2. Rust Integration Tests
- **Location**: `tests/integration_tests.rs`
- **Purpose**: Test the complete Rust API surface
- **Run**: `cargo test --tests`

### 3. TypeScript Tests
- **Location**: `__tests__/*.test.ts`
- **Purpose**: Test the JavaScript/TypeScript API
- **Run**: `bun test`

### 4. Platform-Specific Tests
- **Location**: `__tests__/platform-specific.test.ts`
- **Purpose**: Test platform-specific features (macOS access groups, etc.)
- **Run**: Automatically skipped on unsupported platforms

## Running Tests

### Quick Start
```bash
# Run all tests
bun run test:all

# Run only Rust tests
bun run test:rust

# Run only TypeScript tests
bun test

# Watch mode for TypeScript tests
bun run test:watch
```

### Detailed Commands

#### Rust Tests
```bash
# Unit tests only
cargo test --lib

# Integration tests only
cargo test --tests

# All Rust tests with output
cargo test -- --nocapture

# Specific test
cargo test test_keychain_creation

# With backtrace
RUST_BACKTRACE=1 cargo test
```

#### TypeScript Tests
```bash
# All TypeScript tests
bun test

# Specific test file
bun test __tests__/keychain.test.ts

# Pattern matching
bun test --grep "metadata"

# Watch mode
bun test --watch
```

#### Coverage
```bash
# Generate HTML coverage report
bun run test:coverage

# View report
open coverage/tarpaulin-report.html
```

## Test Categories

### Basic Operations
Tests core functionality:
- Password set/get/delete
- Entry creation and retrieval
- Error handling

### Metadata Support
Tests extended metadata features:
- Labels and comments
- Team ID detection
- Code signing information
- Timestamps

### Find Operations
Tests search functionality:
- Find all entries
- Filter by account prefix
- Filter by environment

### Special Characters
Tests edge cases:
- Unicode passwords
- Emoji support
- JSON strings
- Multi-line passwords
- Empty passwords

### Platform-Specific
Tests platform features:
- macOS access groups
- iCloud Keychain sync
- Team ID detection
- Code signing validation

### Performance
Tests efficiency:
- Batch operations
- Large passwords
- Concurrent access
- Memory usage

### Security
Tests security aspects:
- Environment isolation
- Access group isolation
- Error message sanitization
- Permission handling

## Mock Testing

The test suite includes mock implementations for unit testing:

```typescript
import { MockKeychain, createTestKeychain } from './__tests__/test-utils';

// Create a mock keychain for testing
const keychain = new MockKeychain({
  service: 'com.test.app'
});

// Use like a real keychain
await keychain.setPassword('user', 'pass');
```

## CI/CD Integration

Tests run automatically on:
- Push to main branch
- Pull requests
- Paths: `packages/keychain-native/**`

### CI Matrix
- **OS**: macOS, Ubuntu, Windows
- **Node**: 20, 22
- **Rust**: stable, nightly

### Special CI Tests
- **macOS Signed Build**: Tests code signing features
- **Coverage**: Uploads to Codecov
- **Linting**: Rust format and Clippy

## Debugging Tests

### Enable Debug Logging
```bash
# Rust debug output
RUST_LOG=debug cargo test

# Node debug output
DEBUG=keychain:* bun test
```

### Run Single Test
```typescript
// Use .only to run single test
it.only('should test specific case', async () => {
  // test code
});
```

### Inspect Native Module
```bash
# Check if module is built
ls -la *.node

# Check module exports
node -e "console.log(require('./index.js'))"
```

## Writing New Tests

### Rust Test Template
```rust
#[tokio::test]
async fn test_new_feature() {
    let keychain = create_test_keychain();
    
    // Test setup
    let account = "test_account";
    
    // Test action
    let result = keychain.some_method(account).await;
    
    // Assertions
    assert!(result.is_ok());
}
```

### TypeScript Test Template
```typescript
import { describe, it, expect } from 'bun:test';
import { createTestKeychain, TestCleanup } from './test-utils';

describe('New Feature', () => {
  const cleanup = new TestCleanup();

  afterEach(async () => {
    await cleanup.cleanup();
  });

  it('should do something', async () => {
    const keychain = createTestKeychain();
    cleanup.registerKeychain(keychain);
    
    // Test code
    await keychain.setPassword('test', 'pass');
    
    // Assertions
    expect(await keychain.getPassword('test')).toBe('pass');
  });
});
```

## Known Issues

### macOS Keychain Prompts
- First test run may prompt for keychain access
- Click "Always Allow" to avoid repeated prompts
- CI runs use temporary keychains to avoid this

### Platform Differences
- Some tests are skipped on non-macOS platforms
- Windows/Linux use fallback implementations
- Team ID detection only works on signed macOS builds

### Test Isolation
- Each test should create unique accounts/services
- Use UUID suffixes to ensure uniqueness
- Always clean up in afterEach hooks

## Troubleshooting

### Tests Failing

1. **Module not found**
   ```bash
   bun run build
   ```

2. **Permission denied**
   - Check keychain access permissions
   - Reset keychain access if needed

3. **Timeout errors**
   - Increase test timeout
   - Check for keychain prompts

4. **Platform errors**
   - Verify platform-specific dependencies
   - Check feature flags in Cargo.toml

### Cleanup Failed Tests
```bash
# Remove test keychain entries
security delete-generic-password -s "com.test.lpop.*"

# Reset keychain access
security set-key-partition-list -S apple-tool:,apple: -k "" ~/Library/Keychains/login.keychain
```

## Best Practices

1. **Always use unique identifiers** for test data
2. **Clean up after tests** to avoid pollution
3. **Test both success and failure** cases
4. **Mock external dependencies** when possible
5. **Keep tests focused** on single features
6. **Use descriptive test names** that explain the scenario
7. **Avoid hardcoded delays** - use proper async/await
8. **Test edge cases** and error conditions

## Contributing

When adding new features:
1. Write tests first (TDD approach)
2. Ensure all existing tests pass
3. Add both Rust and TypeScript tests
4. Update this documentation if needed
5. Run the full test suite before submitting PR