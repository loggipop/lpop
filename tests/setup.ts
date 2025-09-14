import { webcrypto } from 'node:crypto';
import { afterAll, beforeAll, vi } from 'vitest';

// Polyfill crypto.getRandomValues for tests
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto as unknown as Crypto;
}

beforeAll(() => {
  // Mock console methods to avoid noise in tests
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  vi.restoreAllMocks();
});
