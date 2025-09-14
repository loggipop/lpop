/**
 * Test setup file - loaded as a preload via bunfig.toml
 * Mocks external dependencies that can't be easily tested
 */

import { mock } from 'bun:test';

// Mock @napi-rs/keyring
export const mockEntry = {
  setPassword: mock(),
  getPassword: mock(),
  deletePassword: mock(),
};

export const mockFindCredentials = mock();

mock.module('@napi-rs/keyring', () => ({
  Entry: mockEntry,
  findCredentials: mockFindCredentials,
}));

// Mock simple-git
export const mockGit = {
  init: mock(),
  status: mock(),
  getRemotes: mock(),
  checkIsRepo: mock(),
  revparse: mock(),
};

export const mockSimpleGit = mock(() => mockGit);

mock.module('simple-git', () => ({
  simpleGit: mockSimpleGit,
  default: mockSimpleGit,
}));
