import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import * as fs from 'node:fs';
import clipboard from 'clipboardy';
import { LpopCLI } from '../src/cli';
import * as envParser from '../src/env-file-parser';
import { asVariable } from '../src/env-file-parser';
import { GitPathResolver } from '../src/git-path-resolver';
import { KeychainManager } from '../src/keychain-manager';
import * as quantumKeys from '../src/quantum-keys';
import { mockEntryInstance, mockFindCredentials, mockGit } from './setup';

describe('LpopCLI', () => {
  let cli: LpopCLI;
  let consoleLogSpy: ReturnType<typeof spyOn>;
  let consoleErrorSpy: ReturnType<typeof spyOn>;
  let processExitSpy: ReturnType<typeof spyOn>;
  let existsSyncSpy: ReturnType<typeof spyOn>;
  let parseFileSpy: ReturnType<typeof spyOn>;
  let writeEnvFileSpy: ReturnType<typeof spyOn>;
  let clipboardWriteSpy: ReturnType<typeof spyOn>;
  let getOrCreateDeviceKeySpy: ReturnType<typeof spyOn>;
  let encryptForPublicKeySpy: ReturnType<typeof spyOn>;
  let decryptWithPrivateKeySpy: ReturnType<typeof spyOn>;
  let keychainManagerSpy: ReturnType<typeof spyOn>;
  let gitResolverSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    // Reset mocks from setup.ts
    mockEntryInstance.setPassword.mockReset();
    mockEntryInstance.getPassword.mockReset();
    mockEntryInstance.deletePassword.mockReset();
    mockFindCredentials.mockReset();
    mockGit.checkIsRepo.mockReset();
    mockGit.revparse.mockReset();
    mockGit.getRemotes.mockReset();
    mockGit.init.mockReset();
    mockGit.status.mockReset();

    // Setup default mock behaviors for keyring
    mockEntryInstance.setPassword.mockResolvedValue(undefined);
    mockEntryInstance.getPassword.mockResolvedValue('test-value');
    mockEntryInstance.deletePassword.mockResolvedValue(true);
    mockFindCredentials.mockResolvedValue([]);

    // Setup git mocks
    mockGit.checkIsRepo.mockResolvedValue(true);
    mockGit.revparse.mockResolvedValue('main');
    mockGit.getRemotes.mockResolvedValue([
      { name: 'origin', refs: { push: 'https://github.com/user/repo.git' } },
    ]);

    // Spy on console methods
    consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    // Spy on fs methods
    existsSyncSpy = spyOn(fs, 'existsSync');

    // Spy on env-file-parser methods
    parseFileSpy = spyOn(envParser, 'parseFile');
    writeEnvFileSpy = spyOn(envParser, 'writeEnvFile');

    // Spy on clipboard
    clipboardWriteSpy = spyOn(clipboard, 'write').mockResolvedValue(undefined);

    // Spy on quantum-keys methods
    getOrCreateDeviceKeySpy = spyOn(
      quantumKeys,
      'getOrCreateDeviceKey',
    ).mockResolvedValue({
      publicKey: 'test-public-key',
      privateKey: 'test-private-key',
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });
    encryptForPublicKeySpy = spyOn(
      quantumKeys,
      'encryptForPublicKey',
    ).mockReturnValue({
      encryptedKey: 'encrypted-key-blob',
      ciphertext: 'encrypted-data-blob',
    });
    decryptWithPrivateKeySpy = spyOn(quantumKeys, 'decryptWithPrivateKey');

    // Spy on KeychainManager methods
    keychainManagerSpy = {
      setEnvironmentVariables: spyOn(
        KeychainManager.prototype,
        'setEnvironmentVariables',
      ).mockResolvedValue(undefined),
      getEnvironmentVariables: spyOn(
        KeychainManager.prototype,
        'getEnvironmentVariables',
      ).mockResolvedValue([]),
      removeEnvironmentVariable: spyOn(
        KeychainManager.prototype,
        'removeEnvironmentVariable',
      ).mockResolvedValue(true),
      updateEnvironmentVariable: spyOn(
        KeychainManager.prototype,
        'updateEnvironmentVariable',
      ).mockResolvedValue(undefined),
      clearAllEnvironmentVariables: spyOn(
        KeychainManager.prototype,
        'clearAllEnvironmentVariables',
      ).mockResolvedValue(undefined),
    };

    // Spy on GitPathResolver methods
    gitResolverSpy = {
      generateServiceNameAsync: spyOn(
        GitPathResolver.prototype,
        'generateServiceNameAsync',
      ).mockResolvedValue('lpop://user/repo'),
      getGitInfo: spyOn(
        GitPathResolver.prototype,
        'getGitInfo',
      ).mockResolvedValue({
        full_name: 'user/repo',
        owner: 'user',
        name: 'repo',
      }),
    };

    // Create CLI instance
    cli = new LpopCLI();
  });

  afterEach(() => {
    // Restore all spies
    consoleLogSpy?.mockRestore();
    consoleErrorSpy?.mockRestore();
    processExitSpy?.mockRestore();
    existsSyncSpy?.mockRestore();
    parseFileSpy?.mockRestore();
    writeEnvFileSpy?.mockRestore();
    clipboardWriteSpy?.mockRestore();
    getOrCreateDeviceKeySpy?.mockRestore();
    encryptForPublicKeySpy?.mockRestore();
    decryptWithPrivateKeySpy?.mockRestore();
    keychainManagerSpy.setEnvironmentVariables?.mockRestore();
    keychainManagerSpy.getEnvironmentVariables?.mockRestore();
    keychainManagerSpy.removeEnvironmentVariable?.mockRestore();
    keychainManagerSpy.updateEnvironmentVariable?.mockRestore();
    keychainManagerSpy.clearAllEnvironmentVariables?.mockRestore();
    gitResolverSpy.generateServiceNameAsync?.mockRestore();
    gitResolverSpy.getGitInfo?.mockRestore();
  });

  describe('Smart Command', () => {
    test('should get variables when no input provided', async () => {
      keychainManagerSpy.getEnvironmentVariables.mockResolvedValue([
        { key: 'API_KEY', value: 'secret123' },
      ]);

      // Simulate command: lpop
      process.argv = ['node', 'lpop'];
      await cli.run();

      expect(keychainManagerSpy.getEnvironmentVariables).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('variables written to .env.local'),
      );
    });

    test('should add variables when file exists', async () => {
      existsSyncSpy.mockReturnValue(true);
      parseFileSpy.mockResolvedValue({
        entries: [asVariable('API_KEY', 'secret123')],
        ignoredCount: 0,
      });

      // Simulate command: lpop .env
      process.argv = ['node', 'lpop', '.env'];
      await cli.run();

      expect(keychainManagerSpy.setEnvironmentVariables).toHaveBeenCalledWith([
        { key: 'API_KEY', value: 'secret123' },
      ]);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Added 1 variables'),
      );
    });

    test('should add single variable when input contains equals', async () => {
      // Simulate command: lpop API_KEY=secret123
      process.argv = ['node', 'lpop', 'API_KEY=secret123'];
      await cli.run();

      expect(keychainManagerSpy.setEnvironmentVariables).toHaveBeenCalledWith([
        { key: 'API_KEY', value: 'secret123' },
      ]);
    });

    test('should output to file when input is non-existent path', async () => {
      existsSyncSpy.mockReturnValue(false);
      keychainManagerSpy.getEnvironmentVariables.mockResolvedValue([
        { key: 'API_KEY', value: 'secret123' },
      ]);

      // Simulate command: lpop output.env
      process.argv = ['node', 'lpop', 'output.env'];
      await cli.run();

      expect(writeEnvFileSpy).toHaveBeenCalledWith('output.env', [
        asVariable('API_KEY', 'secret123'),
      ]);
    });
  });

  describe('Add Command', () => {
    test('should add variables from file', async () => {
      existsSyncSpy.mockReturnValue(true);
      parseFileSpy.mockResolvedValue({
        entries: [
          asVariable('API_KEY', 'secret123'),
          asVariable('DB_URL', 'postgres://localhost'),
        ],
        ignoredCount: 0,
      });

      process.argv = ['node', 'lpop', 'add', '.env'];
      await cli.run();

      expect(keychainManagerSpy.setEnvironmentVariables).toHaveBeenCalledWith([
        { key: 'API_KEY', value: 'secret123' },
        { key: 'DB_URL', value: 'postgres://localhost' },
      ]);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Added 2 variables'),
      );
    });

    test('should add single variable', async () => {
      existsSyncSpy.mockReturnValue(false);

      process.argv = ['node', 'lpop', 'add', 'API_KEY=secret123'];
      await cli.run();

      expect(keychainManagerSpy.setEnvironmentVariables).toHaveBeenCalledWith([
        { key: 'API_KEY', value: 'secret123' },
      ]);
    });
  });

  describe('Get Command', () => {
    test('should get all variables', async () => {
      existsSyncSpy.mockReturnValue(false);
      keychainManagerSpy.getEnvironmentVariables.mockResolvedValue([
        { key: 'API_KEY', value: 'secret123' },
        { key: 'DB_URL', value: 'postgres://localhost' },
      ]);

      process.argv = ['node', 'lpop', 'get'];
      await cli.run();

      expect(keychainManagerSpy.getEnvironmentVariables).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('variables written to .env.local'),
      );
    });

    test('should get specific variable', async () => {
      keychainManagerSpy.getEnvironmentVariables.mockResolvedValue([
        { key: 'API_KEY', value: 'secret123' },
        { key: 'DB_URL', value: 'postgres://localhost' },
      ]);

      process.argv = ['node', 'lpop', 'get', 'API_KEY'];
      await cli.run();

      expect(consoleLogSpy).toHaveBeenCalledWith('API_KEY=secret123');
    });
  });

  describe('Remove Command', () => {
    test('should remove variable successfully', async () => {
      keychainManagerSpy.removeEnvironmentVariable.mockResolvedValue(true);

      process.argv = ['node', 'lpop', 'remove', 'API_KEY'];
      await cli.run();

      expect(keychainManagerSpy.removeEnvironmentVariable).toHaveBeenCalledWith(
        'API_KEY',
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Removed variable API_KEY'),
      );
    });
  });

  describe('Clear Command', () => {
    test('should show warning without --confirm', async () => {
      process.argv = ['node', 'lpop', 'clear'];
      await cli.run();

      expect(
        keychainManagerSpy.clearAllEnvironmentVariables,
      ).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('This will remove ALL'),
      );
    });

    test('should clear with --confirm', async () => {
      process.argv = ['node', 'lpop', 'clear', '--confirm'];
      await cli.run();

      expect(
        keychainManagerSpy.clearAllEnvironmentVariables,
      ).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cleared all variables'),
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle errors in add command', async () => {
      existsSyncSpy.mockReturnValue(true);
      parseFileSpy.mockRejectedValue(new Error('Parse error'));

      process.argv = ['node', 'lpop', 'add', '.env'];

      try {
        await cli.run();
      } catch {
        // Expected to throw due to process.exit mock
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Parse error'),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('ask command', () => {
    beforeEach(() => {
      // Mock the git resolver to return a service name containing "test-service"
      gitResolverSpy.generateServiceNameAsync.mockResolvedValue(
        'github.com/user/test-service',
      );

      // Mock getGitInfo to return git info with test-service in the name
      gitResolverSpy.getGitInfo.mockResolvedValue({
        full_name: 'user/test-service',
        owner: 'user',
        name: 'test-service',
      });

      getOrCreateDeviceKeySpy.mockReturnValue({
        publicKey: 'test-public-key-123',
        privateKey: 'test-private-key-456',
        createdAt: Date.now(),
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      });

      clipboardWriteSpy.mockResolvedValue(undefined);
    });

    test('should generate ask message and copy to clipboard', async () => {
      process.argv = ['node', 'lpop', 'ask'];
      await cli.run();

      expect(getOrCreateDeviceKeySpy).toHaveBeenCalled();
      expect(clipboardWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('test-public-key-123'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Message copied to clipboard'),
      );
    });
  });

  describe('give command', () => {
    beforeEach(() => {
      gitResolverSpy.generateServiceNameAsync.mockResolvedValue(
        'github.com/user/test-repo',
      );

      keychainManagerSpy.getEnvironmentVariables.mockResolvedValue([
        { key: 'API_KEY', value: 'secret123' },
        { key: 'DB_URL', value: 'postgres://localhost:5432/mydb' },
      ]);

      encryptForPublicKeySpy.mockReturnValue({
        encryptedKey: 'encrypted-key-blob',
        ciphertext: 'encrypted-data-blob',
      });

      clipboardWriteSpy.mockResolvedValue(undefined);
    });

    test('should encrypt variables and generate give message', async () => {
      process.argv = ['node', 'lpop', 'give', 'recipient-public-key-123'];
      await cli.run();

      expect(keychainManagerSpy.getEnvironmentVariables).toHaveBeenCalled();
      expect(encryptForPublicKeySpy).toHaveBeenCalledWith(
        JSON.stringify({
          API_KEY: 'secret123',
          DB_URL: 'postgres://localhost:5432/mydb',
        }),
        'recipient-public-key-123',
      );

      const expectedEncryptedBlob = JSON.stringify({
        encryptedKey: 'encrypted-key-blob',
        ciphertext: 'encrypted-data-blob',
      });

      const expectedMessage = `Okey dokey, here's a mystery blob with the new variables. Add them locally with:

npx @loggipop/lpop receive ${expectedEncryptedBlob}

(copied to clipboard)`;

      expect(clipboardWriteSpy).toHaveBeenCalledWith(expectedMessage);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Encrypted variables and copied message to clipboard',
        ),
      );
    });
  });

  describe('receive command', () => {
    beforeEach(() => {
      gitResolverSpy.generateServiceNameAsync.mockResolvedValue(
        'github.com/user/test-repo',
      );

      getOrCreateDeviceKeySpy.mockReturnValue({
        publicKey: 'my-public-key-123',
        privateKey: 'my-private-key-456',
        createdAt: Date.now(),
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      });

      decryptWithPrivateKeySpy.mockReturnValue(
        JSON.stringify({
          API_KEY: 'secret123',
          DB_URL: 'postgres://localhost:5432/mydb',
          NODE_ENV: 'production',
        }),
      );

      keychainManagerSpy.setEnvironmentVariables.mockResolvedValue(undefined);
    });

    test('should decrypt and store received variables', async () => {
      const encryptedData = JSON.stringify({
        encryptedKey: 'encrypted-key-blob',
        ciphertext: 'encrypted-data-blob',
      });

      process.argv = ['node', 'lpop', 'receive', encryptedData];
      await cli.run();

      expect(getOrCreateDeviceKeySpy).toHaveBeenCalled();
      expect(decryptWithPrivateKeySpy).toHaveBeenCalledWith(
        {
          encryptedKey: 'encrypted-key-blob',
          ciphertext: 'encrypted-data-blob',
        },
        'my-private-key-456',
      );

      expect(keychainManagerSpy.setEnvironmentVariables).toHaveBeenCalledWith([
        { key: 'API_KEY', value: 'secret123' },
        { key: 'DB_URL', value: 'postgres://localhost:5432/mydb' },
        { key: 'NODE_ENV', value: 'production' },
      ]);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Received and stored 3 variables'),
      );
    });
  });
});
