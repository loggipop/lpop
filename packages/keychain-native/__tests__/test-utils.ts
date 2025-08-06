import { Keychain, KeychainOptions, KeychainEntry, KeychainMetadata, FindQuery } from '../index';
import { randomUUID } from 'crypto';

/**
 * Creates a test keychain instance with a unique service name
 */
export function createTestKeychain(options?: Partial<KeychainOptions>): Keychain {
  const defaultOptions: KeychainOptions = {
    service: `com.test.lpop.${randomUUID()}`,
    environment: 'test',
    ...options,
  };
  
  return new Keychain(defaultOptions);
}

/**
 * Creates a unique test account name
 */
export function createTestAccount(prefix: string = 'test'): string {
  return `${prefix}_${randomUUID()}`;
}

/**
 * Mock keychain implementation for unit testing
 */
export class MockKeychain implements Keychain {
  private storage: Map<string, string> = new Map();
  private metadata: Map<string, KeychainMetadata> = new Map();
  public readonly options: KeychainOptions;
  
  constructor(options: KeychainOptions) {
    this.options = options;
  }

  async setPassword(account: string, password: string, metadata?: KeychainMetadata): Promise<void> {
    const key = this.getKey(account);
    this.storage.set(key, password);
    if (metadata) {
      this.metadata.set(key, metadata);
    }
  }

  async getPassword(account: string): Promise<string | null> {
    const key = this.getKey(account);
    return this.storage.get(key) || null;
  }

  async deletePassword(account: string): Promise<boolean> {
    const key = this.getKey(account);
    this.metadata.delete(key);
    return this.storage.delete(key);
  }

  async getEntry(account: string): Promise<KeychainEntry | null> {
    const key = this.getKey(account);
    const password = this.storage.get(key);
    
    if (!password) {
      return null;
    }

    return {
      service: this.options.service,
      account,
      password,
      metadata: this.metadata.get(key),
    };
  }

  async findEntries(query?: FindQuery): Promise<KeychainEntry[]> {
    const entries: KeychainEntry[] = [];
    
    for (const [key, password] of this.storage.entries()) {
      const account = this.extractAccount(key);
      
      if (query?.accountPrefix && !account.startsWith(query.accountPrefix)) {
        continue;
      }
      
      entries.push({
        service: this.options.service,
        account,
        password,
        metadata: this.metadata.get(key),
      });
    }
    
    return entries;
  }

  private getKey(account: string): string {
    const service = this.options.environment 
      ? `${this.options.service}?env=${this.options.environment}`
      : this.options.service;
    return `${service}::${account}`;
  }

  private extractAccount(key: string): string {
    const parts = key.split('::');
    return parts[parts.length - 1];
  }

  // Test helper methods
  clear(): void {
    this.storage.clear();
    this.metadata.clear();
  }

  size(): number {
    return this.storage.size;
  }
}

/**
 * Test data generator
 */
export class TestDataGenerator {
  static createMetadata(overrides?: Partial<KeychainMetadata>): KeychainMetadata {
    return {
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      label: 'Test Entry',
      comment: 'Test comment',
      synchronizable: false,
      ...overrides,
    };
  }

  static createMultipleAccounts(prefix: string, count: number): string[] {
    return Array.from({ length: count }, (_, i) => 
      `${prefix}_${i}_${randomUUID()}`
    );
  }

  static createPasswordVariations(): string[] {
    return [
      'simple_password',
      'p@ssw0rd!with#special$chars',
      'password with spaces',
      '密码123', // Unicode
      'emoji🔐password🎉',
      '{"json": "password"}',
      'multi\nline\npassword',
      '', // Empty password
      'a'.repeat(1000), // Long password
    ];
  }
}

/**
 * Test cleanup helper
 */
export class TestCleanup {
  private accounts: Set<string> = new Set();
  private keychains: Keychain[] = [];

  registerAccount(account: string): void {
    this.accounts.add(account);
  }

  registerKeychain(keychain: Keychain): void {
    this.keychains.push(keychain);
  }

  async cleanup(): Promise<void> {
    const cleanupPromises: Promise<void>[] = [];

    for (const keychain of this.keychains) {
      for (const account of this.accounts) {
        cleanupPromises.push(
          keychain.deletePassword(account)
            .then(() => {})
            .catch(() => {}) // Ignore errors during cleanup
        );
      }
    }

    await Promise.all(cleanupPromises);
    this.accounts.clear();
    this.keychains = [];
  }
}

/**
 * Platform detection utilities
 */
export const PlatformUtils = {
  isMacOS(): boolean {
    return process.platform === 'darwin';
  },
  
  isWindows(): boolean {
    return process.platform === 'win32';
  },
  
  isLinux(): boolean {
    return process.platform === 'linux';
  },
  
  skipIfNotMacOS(testFn: () => void | Promise<void>) {
    if (!this.isMacOS()) {
      return () => {
        console.log('Skipping test - not on macOS');
      };
    }
    return testFn;
  },
};

/**
 * Assertion helpers
 */
export const AssertionHelpers = {
  async assertPasswordRoundTrip(
    keychain: Keychain,
    account: string,
    password: string
  ): Promise<void> {
    await keychain.setPassword(account, password);
    const retrieved = await keychain.getPassword(account);
    
    if (retrieved !== password) {
      throw new Error(`Password mismatch: expected "${password}", got "${retrieved}"`);
    }
  },

  async assertEntryEquals(
    actual: KeychainEntry | null,
    expected: Partial<KeychainEntry>
  ): Promise<void> {
    if (!actual) {
      throw new Error('Entry is null');
    }

    if (expected.service && actual.service !== expected.service) {
      throw new Error(`Service mismatch: expected "${expected.service}", got "${actual.service}"`);
    }

    if (expected.account && actual.account !== expected.account) {
      throw new Error(`Account mismatch: expected "${expected.account}", got "${actual.account}"`);
    }

    if (expected.password && actual.password !== expected.password) {
      throw new Error(`Password mismatch: expected "${expected.password}", got "${actual.password}"`);
    }
  },
};