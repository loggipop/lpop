import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Keychain, KeychainOptions, KeychainMetadata } from '../index';
import { 
  createTestKeychain, 
  createTestAccount, 
  TestCleanup, 
  PlatformUtils 
} from './test-utils';

describe('Platform-Specific Tests', () => {
  const cleanup = new TestCleanup();

  afterEach(async () => {
    await cleanup.cleanup();
  });

  describe('macOS-specific Features', () => {
    it.skipIf(!PlatformUtils.isMacOS())('should handle access groups', async () => {
      const options: KeychainOptions = {
        service: `com.test.lpop.accessgroup.${Date.now()}`,
        accessGroup: 'TEAM123.com.test.shared',
        environment: 'test',
      };

      const keychain = new Keychain(options);
      cleanup.registerKeychain(keychain);

      const account = createTestAccount('access_group');
      cleanup.registerAccount(account);

      await keychain.setPassword(account, 'shared_password');
      const password = await keychain.getPassword(account);

      expect(password).toBe('shared_password');
    });

    it.skipIf(!PlatformUtils.isMacOS())('should handle synchronizable passwords', async () => {
      const options: KeychainOptions = {
        service: `com.test.lpop.sync.${Date.now()}`,
        synchronizable: true,
        environment: 'test',
      };

      const keychain = new Keychain(options);
      cleanup.registerKeychain(keychain);

      const account = createTestAccount('sync');
      cleanup.registerAccount(account);

      const metadata: KeychainMetadata = {
        label: 'Sync Test',
        synchronizable: true,
      };

      await keychain.setPassword(account, 'sync_password', metadata);
      const entry = await keychain.getEntry(account);

      expect(entry).toBeDefined();
      expect(entry?.password).toBe('sync_password');
      if (entry?.metadata?.synchronizable !== undefined) {
        expect(entry.metadata.synchronizable).toBe(true);
      }
    });

    it.skipIf(!PlatformUtils.isMacOS())('should detect team ID on signed builds', async () => {
      const keychain = createTestKeychain();
      cleanup.registerKeychain(keychain);

      const account = createTestAccount('team_id');
      cleanup.registerAccount(account);

      await keychain.setPassword(account, 'team_password');
      const entry = await keychain.getEntry(account);

      expect(entry).toBeDefined();
      
      // Team ID will only be present if the app is properly signed
      if (process.env.LPOP_TEAM_ID) {
        expect(entry?.metadata?.teamId).toBeDefined();
        expect(typeof entry?.metadata?.teamId).toBe('string');
      }
    });

    it.skipIf(!PlatformUtils.isMacOS())('should handle keychain access prompts', async () => {
      const keychain = createTestKeychain();
      cleanup.registerKeychain(keychain);

      const account = createTestAccount('access_prompt');
      cleanup.registerAccount(account);

      // This test verifies that keychain operations work even when
      // the user might need to approve access
      await keychain.setPassword(account, 'prompt_password');
      
      // Multiple rapid accesses might trigger prompts
      const operations = Array.from({ length: 5 }, async (_, i) => {
        const password = await keychain.getPassword(account);
        expect(password).toBe('prompt_password');
      });

      await Promise.all(operations);
    });

    it.skipIf(!PlatformUtils.isMacOS())('should isolate entries by access group', async () => {
      const baseService = `com.test.lpop.isolation.${Date.now()}`;
      const account = createTestAccount('isolation');
      cleanup.registerAccount(account);

      // Create two keychains with different access groups
      const keychain1 = new Keychain({
        service: baseService,
        accessGroup: 'TEAM123.com.test.group1',
      });
      cleanup.registerKeychain(keychain1);

      const keychain2 = new Keychain({
        service: baseService,
        accessGroup: 'TEAM456.com.test.group2',
      });
      cleanup.registerKeychain(keychain2);

      // Set different passwords
      await keychain1.setPassword(account, 'group1_password');
      await keychain2.setPassword(account, 'group2_password');

      // Verify isolation
      const password1 = await keychain1.getPassword(account);
      const password2 = await keychain2.getPassword(account);

      expect(password1).toBe('group1_password');
      expect(password2).toBe('group2_password');
    });
  });

  describe('Cross-Platform Compatibility', () => {
    it('should work on all platforms without platform-specific options', async () => {
      const keychain = createTestKeychain();
      cleanup.registerKeychain(keychain);

      const account = createTestAccount('cross_platform');
      cleanup.registerAccount(account);

      await keychain.setPassword(account, 'universal_password');
      const password = await keychain.getPassword(account);

      expect(password).toBe('universal_password');
    });

    it('should gracefully ignore unsupported options on non-macOS', async () => {
      if (!PlatformUtils.isMacOS()) {
        const options: KeychainOptions = {
          service: `com.test.lpop.unsupported.${Date.now()}`,
          accessGroup: 'IGNORED_ON_THIS_PLATFORM',
          synchronizable: true,
        };

        // Should not throw
        const keychain = new Keychain(options);
        cleanup.registerKeychain(keychain);

        const account = createTestAccount('unsupported_opts');
        cleanup.registerAccount(account);

        await keychain.setPassword(account, 'test_password');
        const password = await keychain.getPassword(account);

        expect(password).toBe('test_password');
      }
    });
  });

  describe('Performance Tests', () => {
    it('should handle batch operations efficiently', async () => {
      const keychain = createTestKeychain();
      cleanup.registerKeychain(keychain);

      const accounts: string[] = [];
      const batchSize = 100;

      // Measure write performance
      const writeStart = Date.now();
      const writePromises = Array.from({ length: batchSize }, async (_, i) => {
        const account = createTestAccount(`batch_${i}`);
        accounts.push(account);
        cleanup.registerAccount(account);
        await keychain.setPassword(account, `password_${i}`);
      });

      await Promise.all(writePromises);
      const writeTime = Date.now() - writeStart;

      console.log(`Wrote ${batchSize} passwords in ${writeTime}ms`);
      expect(writeTime).toBeLessThan(10000); // Should complete within 10 seconds

      // Measure read performance
      const readStart = Date.now();
      const readPromises = accounts.map(async (account, i) => {
        const password = await keychain.getPassword(account);
        expect(password).toBe(`password_${i}`);
      });

      await Promise.all(readPromises);
      const readTime = Date.now() - readStart;

      console.log(`Read ${batchSize} passwords in ${readTime}ms`);
      expect(readTime).toBeLessThan(5000); // Reads should be faster
    });

    it('should handle large passwords efficiently', async () => {
      const keychain = createTestKeychain();
      cleanup.registerKeychain(keychain);

      const account = createTestAccount('large_password');
      cleanup.registerAccount(account);

      // Test various sizes
      const sizes = [1024, 10240, 102400]; // 1KB, 10KB, 100KB

      for (const size of sizes) {
        const largePassword = 'x'.repeat(size);
        
        const writeStart = Date.now();
        await keychain.setPassword(account, largePassword);
        const writeTime = Date.now() - writeStart;

        const readStart = Date.now();
        const retrieved = await keychain.getPassword(account);
        const readTime = Date.now() - readStart;

        expect(retrieved).toBe(largePassword);
        console.log(`Size ${size}: write=${writeTime}ms, read=${readTime}ms`);
      }
    });
  });

  describe('Security Tests', () => {
    it('should not expose passwords in error messages', async () => {
      const keychain = createTestKeychain();
      cleanup.registerKeychain(keychain);

      const account = createTestAccount('security');
      cleanup.registerAccount(account);

      const sensitivePassword = 'super_secret_password_12345';

      try {
        // Intentionally cause an error by using invalid service name
        const badKeychain = new Keychain({
          service: '', // Invalid
        });
        await badKeychain.setPassword(account, sensitivePassword);
      } catch (error: any) {
        // Error message should not contain the password
        expect(error.message).not.toContain(sensitivePassword);
      }
    });

    it('should properly isolate environments', async () => {
      const baseService = `com.test.lpop.env_isolation.${Date.now()}`;
      const account = createTestAccount('env_isolation');
      cleanup.registerAccount(account);

      const environments = ['development', 'staging', 'production'];
      const keychains = environments.map(env => {
        const kc = new Keychain({
          service: baseService,
          environment: env,
        });
        cleanup.registerKeychain(kc);
        return { env, keychain: kc };
      });

      // Set different passwords for each environment
      for (const { env, keychain } of keychains) {
        await keychain.setPassword(account, `${env}_password`);
      }

      // Verify isolation
      for (const { env, keychain } of keychains) {
        const password = await keychain.getPassword(account);
        expect(password).toBe(`${env}_password`);
      }

      // Verify find operations respect environment
      for (const { env, keychain } of keychains) {
        const entries = await keychain.findEntries();
        expect(entries.length).toBe(1);
        expect(entries[0].password).toBe(`${env}_password`);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid create/delete cycles', async () => {
      const keychain = createTestKeychain();
      cleanup.registerKeychain(keychain);

      const account = createTestAccount('rapid_cycle');
      cleanup.registerAccount(account);

      for (let i = 0; i < 10; i++) {
        await keychain.setPassword(account, `password_${i}`);
        const password = await keychain.getPassword(account);
        expect(password).toBe(`password_${i}`);
        
        const deleted = await keychain.deletePassword(account);
        expect(deleted).toBe(true);
        
        const afterDelete = await keychain.getPassword(account);
        expect(afterDelete).toBeNull();
      }
    });

    it('should handle account names with special characters', async () => {
      const keychain = createTestKeychain();
      cleanup.registerKeychain(keychain);

      const specialAccounts = [
        'user@example.com',
        'user+tag@example.com',
        'user name with spaces',
        'user/with/slashes',
        'user\\with\\backslashes',
        'user:with:colons',
        'user|with|pipes',
      ];

      for (const account of specialAccounts) {
        cleanup.registerAccount(account);
        
        await keychain.setPassword(account, 'test_password');
        const password = await keychain.getPassword(account);
        
        expect(password).toBe('test_password');
        
        await keychain.deletePassword(account);
      }
    });

    it('should handle concurrent access to same account', async () => {
      const keychain = createTestKeychain();
      cleanup.registerKeychain(keychain);

      const account = createTestAccount('concurrent');
      cleanup.registerAccount(account);

      // Set initial password
      await keychain.setPassword(account, 'initial');

      // Concurrent reads and writes
      const operations = Array.from({ length: 20 }, async (_, i) => {
        if (i % 2 === 0) {
          // Read operation
          const password = await keychain.getPassword(account);
          expect(password).toBeTruthy();
        } else {
          // Write operation
          await keychain.setPassword(account, `password_${i}`);
        }
      });

      await Promise.all(operations);

      // Final password should be set
      const finalPassword = await keychain.getPassword(account);
      expect(finalPassword).toBeTruthy();
    });
  });
});