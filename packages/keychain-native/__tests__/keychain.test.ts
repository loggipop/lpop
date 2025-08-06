import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Keychain, KeychainOptions, KeychainMetadata, FindQuery } from '../index';
import { randomUUID } from 'crypto';

describe('Keychain Native Module', () => {
  let keychain: Keychain;
  let testService: string;
  let testAccounts: string[] = [];

  beforeEach(() => {
    testService = `com.test.lpop.${randomUUID()}`;
    const options: KeychainOptions = {
      service: testService,
      environment: 'test',
    };
    keychain = new Keychain(options);
    testAccounts = [];
  });

  afterEach(async () => {
    // Clean up test accounts
    for (const account of testAccounts) {
      try {
        await keychain.deletePassword(account);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  describe('Basic Operations', () => {
    it('should create a keychain instance', () => {
      expect(keychain).toBeDefined();
      expect(keychain).toBeInstanceOf(Keychain);
    });

    it('should set and get a password', async () => {
      const account = `test_${randomUUID()}`;
      testAccounts.push(account);

      await keychain.setPassword(account, 'test_password_123');
      const password = await keychain.getPassword(account);
      
      expect(password).toBe('test_password_123');
    });

    it('should return null for non-existent password', async () => {
      const account = `nonexistent_${randomUUID()}`;
      const password = await keychain.getPassword(account);
      
      expect(password).toBeNull();
    });

    it('should update an existing password', async () => {
      const account = `update_test_${randomUUID()}`;
      testAccounts.push(account);

      await keychain.setPassword(account, 'initial_password');
      await keychain.setPassword(account, 'updated_password');
      
      const password = await keychain.getPassword(account);
      expect(password).toBe('updated_password');
    });

    it('should delete a password', async () => {
      const account = `delete_test_${randomUUID()}`;
      testAccounts.push(account);

      await keychain.setPassword(account, 'password_to_delete');
      const deleted = await keychain.deletePassword(account);
      
      expect(deleted).toBe(true);
      
      const password = await keychain.getPassword(account);
      expect(password).toBeNull();
    });

    it('should return false when deleting non-existent password', async () => {
      const account = `nonexistent_delete_${randomUUID()}`;
      const deleted = await keychain.deletePassword(account);
      
      expect(deleted).toBe(false);
    });
  });

  describe('Metadata Support', () => {
    it('should set password with metadata', async () => {
      const account = `metadata_test_${randomUUID()}`;
      testAccounts.push(account);

      const metadata: KeychainMetadata = {
        label: 'Test Entry',
        comment: 'This is a test comment',
        synchronizable: false,
      };

      await keychain.setPassword(account, 'password_with_meta', metadata);
      const entry = await keychain.getEntry(account);
      
      expect(entry).toBeDefined();
      expect(entry?.password).toBe('password_with_meta');
      expect(entry?.metadata).toBeDefined();
      expect(entry?.metadata?.label).toBe('Test Entry');
      expect(entry?.metadata?.comment).toBe('This is a test comment');
    });

    it('should get entry with full details', async () => {
      const account = `entry_test_${randomUUID()}`;
      testAccounts.push(account);

      await keychain.setPassword(account, 'entry_password');
      const entry = await keychain.getEntry(account);
      
      expect(entry).toBeDefined();
      expect(entry?.service).toBe(testService);
      expect(entry?.account).toBe(account);
      expect(entry?.password).toBe('entry_password');
    });

    it('should return null for non-existent entry', async () => {
      const account = `nonexistent_entry_${randomUUID()}`;
      const entry = await keychain.getEntry(account);
      
      expect(entry).toBeNull();
    });
  });

  describe('Find Operations', () => {
    beforeEach(async () => {
      // Create test entries
      const accounts = [
        `user_alice_${randomUUID()}`,
        `user_bob_${randomUUID()}`,
        `admin_charlie_${randomUUID()}`,
        `admin_david_${randomUUID()}`,
      ];
      
      for (const account of accounts) {
        testAccounts.push(account);
        await keychain.setPassword(account, `password_for_${account}`);
      }
    });

    it('should find all entries', async () => {
      const entries = await keychain.findEntries();
      
      expect(entries).toBeDefined();
      expect(entries.length).toBeGreaterThanOrEqual(4);
    });

    it('should find entries by account prefix', async () => {
      const query: FindQuery = {
        accountPrefix: 'user_',
      };
      
      const entries = await keychain.findEntries(query);
      
      expect(entries).toBeDefined();
      expect(entries.length).toBe(2);
      expect(entries.every(e => e.account.startsWith('user_'))).toBe(true);
    });

    it('should find entries with different prefix', async () => {
      const query: FindQuery = {
        accountPrefix: 'admin_',
      };
      
      const entries = await keychain.findEntries(query);
      
      expect(entries).toBeDefined();
      expect(entries.length).toBe(2);
      expect(entries.every(e => e.account.startsWith('admin_'))).toBe(true);
    });

    it('should return empty array for non-matching prefix', async () => {
      const query: FindQuery = {
        accountPrefix: 'nonexistent_prefix_',
      };
      
      const entries = await keychain.findEntries(query);
      
      expect(entries).toBeDefined();
      expect(entries).toEqual([]);
    });
  });

  describe('Special Characters Handling', () => {
    const specialPasswords = [
      'password with spaces',
      'p@ssw0rd!with#special$chars',
      '密码123', // Unicode characters
      'emoji🔐password🎉',
      '{"json": "password", "with": "quotes"}',
      'multi\nline\npassword',
      'tab\tseparated\tpassword',
      '', // Empty password
    ];

    it.each(specialPasswords)('should handle password: %s', async (password) => {
      const account = `special_${randomUUID()}`;
      testAccounts.push(account);

      await keychain.setPassword(account, password);
      const retrieved = await keychain.getPassword(account);
      
      expect(retrieved).toBe(password);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for invalid options', () => {
      expect(() => {
        new Keychain({ service: '' } as KeychainOptions);
      }).toThrow();
    });

    it('should handle concurrent operations', async () => {
      const operations = [];
      
      for (let i = 0; i < 10; i++) {
        const account = `concurrent_${i}_${randomUUID()}`;
        testAccounts.push(account);
        
        operations.push(
          keychain.setPassword(account, `password_${i}`)
            .then(() => keychain.getPassword(account))
            .then(password => ({ account, password }))
        );
      }
      
      const results = await Promise.all(operations);
      
      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result.password).toBe(`password_${index}`);
      });
    });
  });

  describe('Multiple Keychains', () => {
    it('should isolate entries between different services', async () => {
      const service1 = `com.test.lpop.service1.${randomUUID()}`;
      const service2 = `com.test.lpop.service2.${randomUUID()}`;
      
      const keychain1 = new Keychain({ service: service1 });
      const keychain2 = new Keychain({ service: service2 });
      
      const account = `shared_account_${randomUUID()}`;
      testAccounts.push(account);

      await keychain1.setPassword(account, 'password1');
      await keychain2.setPassword(account, 'password2');
      
      const password1 = await keychain1.getPassword(account);
      const password2 = await keychain2.getPassword(account);
      
      expect(password1).toBe('password1');
      expect(password2).toBe('password2');
      
      // Clean up
      await keychain1.deletePassword(account);
      await keychain2.deletePassword(account);
    });

    it('should isolate entries between different environments', async () => {
      const baseService = `com.test.lpop.env.${randomUUID()}`;
      
      const keychainDev = new Keychain({ 
        service: baseService,
        environment: 'development' 
      });
      
      const keychainProd = new Keychain({ 
        service: baseService,
        environment: 'production' 
      });
      
      const account = `env_account_${randomUUID()}`;
      testAccounts.push(account);

      await keychainDev.setPassword(account, 'dev_password');
      await keychainProd.setPassword(account, 'prod_password');
      
      const devPassword = await keychainDev.getPassword(account);
      const prodPassword = await keychainProd.getPassword(account);
      
      expect(devPassword).toBe('dev_password');
      expect(prodPassword).toBe('prod_password');
      
      // Clean up
      await keychainDev.deletePassword(account);
      await keychainProd.deletePassword(account);
    });
  });

  describe('Platform-specific Features', () => {
    it('should create keychain with access group', () => {
      const options: KeychainOptions = {
        service: `com.test.lpop.${randomUUID()}`,
        accessGroup: 'TEAM123.com.test.shared',
      };
      
      expect(() => new Keychain(options)).not.toThrow();
    });

    it('should create keychain with synchronizable option', () => {
      const options: KeychainOptions = {
        service: `com.test.lpop.${randomUUID()}`,
        synchronizable: true,
      };
      
      expect(() => new Keychain(options)).not.toThrow();
    });

    it('should handle team ID in metadata if available', async () => {
      const account = `team_test_${randomUUID()}`;
      testAccounts.push(account);

      await keychain.setPassword(account, 'team_password');
      const entry = await keychain.getEntry(account);
      
      // Team ID might be available on signed builds
      expect(entry).toBeDefined();
      if (entry?.metadata?.teamId) {
        expect(typeof entry.metadata.teamId).toBe('string');
      }
    });
  });
});