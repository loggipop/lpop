# Testing

This project uses Bun's built-in test runner for testing.

## Running Tests

To run the test suite:

```bash
# Run all tests once
bun test

# Run tests in watch mode
bun test --watch

# Run tests with coverage
bun test --coverage
```

## Test Structure

- `src/keychain-manager.test.ts` - Tests for keychain operations
- `src/git-path-resolver.test.ts` - Tests for git repository detection and service name generation
- `src/env-file-parser.test.ts` - Tests for .env file parsing and generation
- `src/cli.test.ts` - Tests for CLI commands and options

## Writing Tests

Tests are written using Bun's test API. The key functions are:

- `describe()` - Group related tests
- `test()` or `it()` - Define individual tests
- `expect()` - Make assertions
- `beforeEach()` / `afterEach()` - Setup and teardown
- `mock()` - Create mock functions
- `mock.module()` - Mock entire modules

Example test:

```typescript
import { describe, expect, test, mock } from 'bun:test'

describe('MyModule', () => {
  test('should do something', () => {
    const mockFn = mock(() => 'mocked value')
    expect(mockFn()).toBe('mocked value')
    expect(mockFn).toHaveBeenCalled()
  })
})
```

## Mocking Modules

Bun provides a `mock.module()` function to mock entire modules:

```typescript
mock.module('fs', () => ({
  readFileSync: mock(() => 'file contents'),
}))
```

## Test Coverage

Run tests with coverage to see which parts of the code are tested:

```bash
bun test --coverage
```

This will generate a coverage report showing the percentage of code covered by tests.