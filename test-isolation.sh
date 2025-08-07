#!/bin/bash

echo "Testing mocked version in isolation:"
bun test src/memory-keychain-manager.test.ts

echo -e "\n\nTesting non-mocked version in isolation:"
bun test src/memory-keychain-manager-nomock.test.ts

echo -e "\n\nTesting both together:"
bun test src/memory-keychain-manager.test.ts src/memory-keychain-manager-nomock.test.ts

echo -e "\n\nTesting in reverse order:"
bun test src/memory-keychain-manager-nomock.test.ts src/memory-keychain-manager.test.ts