import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { LpopCLI } from '../src/cli';
import {
  asComment,
  asEmpty,
  asVariable,
  mergeWithEnvExample,
  parseFile,
  parseVariable,
  writeFile,
} from '../src/env-file-parser';
import { GitPathResolver, getServicePrefix } from '../src/git-path-resolver';
import { KeychainManager } from '../src/keychain-manager';

// Mock modules
vi.mock('../src/keychain-manager');
vi.mock('../src/git-path-resolver');
vi.mock('node:fs');
vi.mock('node:child_process');
vi.mock('chalk', () => ({
  default: {
    blue: vi.fn((text: string) => text),
    green: vi.fn((text: string) => text),
    yellow: vi.fn((text: string) => text),
    red: vi.fn((text: string) => text),
  },
}));

// Mock specific functions from env-file-parser instead of the entire module
vi.mock('../src/env-file-parser', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../src/env-file-parser')>();
  return {
    ...actual,
    parseFile: vi.fn(),
    parseVariable: vi.fn(),
    writeFile: vi.fn(),
    mergeWithEnvExample: vi.fn(),
  };
});

describe('LpopCLI', () => {
  let cli: LpopCLI;
  let consoleLogSpy: MockInstance;
  let consoleErrorSpy: MockInstance;
  let processExitSpy: MockInstance;

  // Mock instances
  let mockKeychainManager: {
    setEnvironmentVariables: MockInstance;
    getEnvironmentVariables: MockInstance;
    removeEnvironmentVariable: MockInstance;
    clearAllEnvironmentVariables: MockInstance;
    setPassword: MockInstance;
    getPassword: MockInstance;
    deletePassword: MockInstance;
    findServiceCredentials: MockInstance;
    updateEnvironmentVariable: MockInstance;
  };

  let mockGitResolver: {
    generateServiceNameAsync: MockInstance;
    isGitRepository: MockInstance;
    getRemoteUrl: MockInstance;
    getGitInfo: MockInstance;
  };

  // Get properly typed mocked modules
  const MockedKeychainManager = vi.mocked(KeychainManager);
  const MockedGitPathResolver = vi.mocked(GitPathResolver);
  const mockedGetServicePrefix = vi.mocked(getServicePrefix);
  const mockedExistsSync = vi.mocked(existsSync);
  const mockedParseFile = vi.mocked(parseFile);
  const mockedParseVariable = vi.mocked(parseVariable);
  const mockedWriteFile = vi.mocked(writeFile);
  const mockedMergeWithEnvExample = vi.mocked(mergeWithEnvExample);
  const mockedSpawn = vi.mocked(spawn);

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup console mocks
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    // Setup KeychainManager mock
    mockKeychainManager = {
      setEnvironmentVariables: vi.fn(),
      getEnvironmentVariables: vi.fn(),
      removeEnvironmentVariable: vi.fn(),
      clearAllEnvironmentVariables: vi.fn(),
      setPassword: vi.fn(),
      getPassword: vi.fn(),
      deletePassword: vi.fn(),
      findServiceCredentials: vi.fn(),
      updateEnvironmentVariable: vi.fn(),
    };
    MockedKeychainManager.mockImplementation(
      () =>
        mockKeychainManager as unknown as InstanceType<typeof KeychainManager>,
    );

    // Setup GitPathResolver mock
    mockGitResolver = {
      generateServiceNameAsync: vi.fn().mockResolvedValue('lpop://user/repo'),
      isGitRepository: vi.fn(),
      getRemoteUrl: vi.fn(),
      getGitInfo: vi.fn(),
    };
    MockedGitPathResolver.mockImplementation(
      () => mockGitResolver as unknown as InstanceType<typeof GitPathResolver>,
    );

    // Mock getServicePrefix function
    mockedGetServicePrefix.mockReturnValue('lpop://');

    // Mock spawn function with proper typing
    const mockChildProcess = vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
    });
    mockedSpawn.mockImplementation(
      () => mockChildProcess() as unknown as ChildProcess,
    );

    cli = new LpopCLI();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('Smart Command', () => {
    it('should get variables when no input provided', async () => {
      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([
        { key: 'API_KEY', value: 'secret123' },
      ]);

      // Simulate command: lpop
      process.argv = ['node', 'lpop'];
      await cli.run();

      expect(mockKeychainManager.getEnvironmentVariables).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('variables written to .env.local'),
      );
    });

    it('should add variables when file exists', async () => {
      mockedExistsSync.mockReturnValue(true);
      mockedParseFile.mockResolvedValue({
        entries: [asVariable('API_KEY', 'secret123')],
        ignoredCount: 0,
      });

      // Simulate command: lpop .env
      process.argv = ['node', 'lpop', '.env'];
      await cli.run();

      expect(mockKeychainManager.setEnvironmentVariables).toHaveBeenCalledWith([
        { key: 'API_KEY', value: 'secret123' },
      ]);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Added 1 variables'),
      );
    });

    it('should add single variable when input contains equals', async () => {
      mockedParseVariable.mockReturnValue(asVariable('API_KEY', 'secret123'));

      // Simulate command: lpop API_KEY=secret123
      process.argv = ['node', 'lpop', 'API_KEY=secret123'];
      await cli.run();

      expect(mockKeychainManager.setEnvironmentVariables).toHaveBeenCalledWith([
        { key: 'API_KEY', value: 'secret123' },
      ]);
    });

    it('should output to file when input is non-existent path', async () => {
      mockedExistsSync.mockReturnValue(false);
      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([
        { key: 'API_KEY', value: 'secret123' },
      ]);

      // Simulate command: lpop output.env
      process.argv = ['node', 'lpop', 'output.env'];
      await cli.run();

      expect(mockedWriteFile).toHaveBeenCalledWith('output.env', [
        asVariable('API_KEY', 'secret123'),
      ]);
    });

    it('should output to file using smart command', async () => {
      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([
        { key: 'API_KEY', value: 'secret123' },
      ]);

      process.argv = ['node', 'lpop', 'output.env'];
      await cli.run();

      expect(mockedWriteFile).toHaveBeenCalledWith('output.env', [
        asVariable('API_KEY', 'secret123'),
      ]);
    });
  });

  describe('Add Command', () => {
    it('should add variables from file', async () => {
      mockedExistsSync.mockReturnValue(true);
      mockedParseFile.mockResolvedValue({
        entries: [
          asVariable('API_KEY', 'secret123'),
          asVariable('DB_URL', 'postgres://localhost'),
        ],
        ignoredCount: 0,
      });

      process.argv = ['node', 'lpop', 'add', '.env'];
      await cli.run();

      expect(mockKeychainManager.setEnvironmentVariables).toHaveBeenCalledWith([
        { key: 'API_KEY', value: 'secret123' },
        { key: 'DB_URL', value: 'postgres://localhost' },
      ]);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Added 2 variables'),
      );
    });

    it('should add single variable', async () => {
      mockedExistsSync.mockReturnValue(false);

      process.argv = ['node', 'lpop', 'add', 'API_KEY=secret123'];
      await cli.run();

      expect(mockKeychainManager.setEnvironmentVariables).toHaveBeenCalledWith([
        { key: 'API_KEY', value: 'secret123' },
      ]);
      expect(mockKeychainManager.setEnvironmentVariables).toHaveBeenCalledTimes(
        1,
      );
    });

    it('should use custom repo name', async () => {
      mockedExistsSync.mockReturnValue(true);
      mockedParseFile.mockResolvedValue({
        entries: [asVariable('API_KEY', 'secret123')],
        ignoredCount: 0,
      });

      process.argv = ['node', 'lpop', 'add', '.env', '-r', 'custom/repo'];
      await cli.run();

      expect(MockedKeychainManager).toHaveBeenCalledWith(
        expect.stringContaining('custom/repo'),
        undefined,
      );
    });

    it('should use environment option', async () => {
      mockedExistsSync.mockReturnValue(true);
      const resolvedEntries = [asVariable('API_KEY', 'secret123')];
      mockedParseFile.mockResolvedValue({
        entries: resolvedEntries,
        ignoredCount: 0,
      });

      process.argv = ['node', 'lpop', 'add', '.env', '-e', 'production'];
      await cli.run();

      expect(MockedKeychainManager).toHaveBeenCalledWith(
        expect.any(String),
        'production',
      );
    });
  });

  describe('Get Command', () => {
    it('should get all variables', async () => {
      mockedExistsSync.mockReturnValue(false);
      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([
        { key: 'API_KEY', value: 'secret123' },
        { key: 'DB_URL', value: 'postgres://localhost' },
      ]);

      process.argv = ['node', 'lpop', 'get'];
      await cli.run();

      expect(mockKeychainManager.getEnvironmentVariables).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('variables written to .env.local'),
      );
    });

    it('should get specific variable', async () => {
      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([
        { key: 'API_KEY', value: 'secret123' },
        { key: 'DB_URL', value: 'postgres://localhost' },
      ]);

      process.argv = ['node', 'lpop', 'get', 'API_KEY'];
      await cli.run();

      expect(consoleLogSpy).toHaveBeenCalledWith('API_KEY=secret123');
    });

    it('should show message when no variables found', async () => {
      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([]);

      process.argv = ['node', 'lpop', 'get'];
      await cli.run();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('No variables found'),
      );
    });

    it('should show message when specific variable not found', async () => {
      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([
        { key: 'OTHER_KEY', value: 'value' },
      ]);

      process.argv = ['node', 'lpop', 'get', 'API_KEY'];
      await cli.run();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Variable API_KEY not found'),
      );
    });
  });

  describe('Remove Command', () => {
    it('should remove variable successfully', async () => {
      mockKeychainManager.removeEnvironmentVariable.mockResolvedValue(true);

      process.argv = ['node', 'lpop', 'remove', 'API_KEY'];
      await cli.run();

      expect(
        mockKeychainManager.removeEnvironmentVariable,
      ).toHaveBeenCalledWith('API_KEY');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Removed variable API_KEY'),
      );
    });

    it('should show message when variable not found', async () => {
      mockKeychainManager.removeEnvironmentVariable.mockResolvedValue(false);

      process.argv = ['node', 'lpop', 'remove', 'API_KEY'];
      await cli.run();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Variable API_KEY not found'),
      );
    });
  });

  describe('Clear Command', () => {
    it('should show warning without --confirm', async () => {
      process.argv = ['node', 'lpop', 'clear'];
      await cli.run();

      expect(
        mockKeychainManager.clearAllEnvironmentVariables,
      ).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('This will remove ALL'),
      );
    });

    it('should clear with --confirm', async () => {
      process.argv = ['node', 'lpop', 'clear', '--confirm'];
      await cli.run();

      expect(
        mockKeychainManager.clearAllEnvironmentVariables,
      ).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cleared all variables'),
      );
    });
  });

  describe('List Command', () => {
    it('should show limitation message', async () => {
      process.argv = ['node', 'lpop', 'list'];
      await cli.run();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('keychain limitations'),
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in add command', async () => {
      mockedExistsSync.mockReturnValue(true);
      mockedParseFile.mockRejectedValue(new Error('Parse error'));

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

    it('should handle errors in get command', async () => {
      mockKeychainManager.getEnvironmentVariables.mockRejectedValue(
        new Error('Keychain error'),
      );

      process.argv = ['node', 'lpop', 'get'];

      try {
        await cli.run();
      } catch {
        // Expected to throw due to process.exit mock
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Keychain error'),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('Service Name Resolution', () => {
    it('should use git resolver when no repo specified', async () => {
      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([]);

      process.argv = ['node', 'lpop', 'get'];
      await cli.run();

      expect(mockGitResolver.generateServiceNameAsync).toHaveBeenCalled();
      expect(MockedKeychainManager).toHaveBeenCalledWith(
        'lpop://user/repo',
        undefined,
      );
    });

    it('should use custom repo when specified', async () => {
      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([]);

      process.argv = ['node', 'lpop', 'get', '-r', 'custom/repo'];
      await cli.run();

      expect(mockGitResolver.generateServiceNameAsync).not.toHaveBeenCalled();
      expect(MockedKeychainManager).toHaveBeenCalledWith(
        expect.stringContaining('custom/repo'),
        undefined,
      );
    });
  });

  describe('Get Command with .env.example Template', () => {
    it('should use .env.example as template when it exists', async () => {
      mockedExistsSync.mockImplementation(
        (path) => path.toString() === '.env.example',
      );
      const expectedMergedEntries = [
        asComment('# Environment variables template'),
        asEmpty(),
        asVariable('API_KEY', 'secret123', '# API key for external service'),
        asVariable(
          'DATABASE_URL',
          'postgres://localhost:5432/db',
          '# Database connection string',
        ),
        asVariable('MISSING_VAR', '', '# This variable is not in keychain'),
        asEmpty(),
        asComment('# Additional variables from keychain'),
        asVariable('EXTRA_VAR', 'extra_value'),
      ];
      mockedMergeWithEnvExample.mockResolvedValue(expectedMergedEntries);

      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([
        { key: 'API_KEY', value: 'secret123' },
        { key: 'DATABASE_URL', value: 'postgres://localhost:5432/db' },
        { key: 'EXTRA_VAR', value: 'extra_value' },
      ]);

      process.argv = ['node', 'lpop', 'get'];
      await cli.run();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Found .env.example, using as template'),
      );
      expect(mockedMergeWithEnvExample).toHaveBeenCalledWith('.env.example', [
        { key: 'API_KEY', value: 'secret123' },
        { key: 'DATABASE_URL', value: 'postgres://localhost:5432/db' },
        { key: 'EXTRA_VAR', value: 'extra_value' },
      ]);
      expect(mockedWriteFile).toHaveBeenCalledWith(
        '.env.local',
        expectedMergedEntries,
      );
    });

    it('should fall back to standard output when .env.example does not exist', async () => {
      mockedExistsSync.mockReturnValue(false);

      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([
        { key: 'API_KEY', value: 'secret123' },
        { key: 'DATABASE_URL', value: 'postgres://localhost:5432/db' },
        { key: 'EXTRA_VAR', value: 'extra_value' },
      ]);

      process.argv = ['node', 'lpop', 'get'];
      await cli.run();

      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Found .env.example'),
      );
      expect(mockedWriteFile).toHaveBeenCalledWith('.env.local', [
        asVariable('API_KEY', 'secret123'),
        asVariable('DATABASE_URL', 'postgres://localhost:5432/db'),
        asVariable('EXTRA_VAR', 'extra_value'),
      ]);
    });

    it('should handle .env.example parsing errors gracefully', async () => {
      mockedExistsSync.mockImplementation(
        (path) => path.toString() === '.env.example',
      );
      // The mergeWithEnvExample function handles errors internally and returns fallback
      const fallbackEntries = [
        asVariable('API_KEY', 'secret123'),
        asVariable('DATABASE_URL', 'postgres://localhost:5432/db'),
        asVariable('EXTRA_VAR', 'extra_value'),
      ];
      mockedMergeWithEnvExample.mockResolvedValue(fallbackEntries);

      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([
        asVariable('API_KEY', 'secret123'),
        asVariable('DATABASE_URL', 'postgres://localhost:5432/db'),
        asVariable('EXTRA_VAR', 'extra_value'),
      ]);

      process.argv = ['node', 'lpop', 'get'];
      await cli.run();

      expect(mockedMergeWithEnvExample).toHaveBeenCalledWith('.env.example', [
        asVariable('API_KEY', 'secret123'),
        asVariable('DATABASE_URL', 'postgres://localhost:5432/db'),
        asVariable('EXTRA_VAR', 'extra_value'),
      ]);
      expect(mockedWriteFile).toHaveBeenCalledWith(
        '.env.local',
        fallbackEntries,
      );
    });

    it('should sort additional variables alphabetically', async () => {
      mockedExistsSync.mockImplementation(
        (path) => path.toString() === '.env.example',
      );
      const expectedMergedEntries = [
        asVariable('API_KEY', 'secret123', '# API key'),
        asEmpty(),
        asComment('# Additional variables from keychain'),
        asVariable('DATABASE_URL', 'postgres://localhost:5432/db'),
        asVariable('EXTRA_VAR', 'extra_value'),
      ];
      mockedMergeWithEnvExample.mockResolvedValue(expectedMergedEntries);

      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([
        asVariable('API_KEY', 'secret123'),
        asVariable('DATABASE_URL', 'postgres://localhost:5432/db'),
        asVariable('EXTRA_VAR', 'extra_value'),
      ]);

      process.argv = ['node', 'lpop', 'get'];
      await cli.run();

      expect(mockedMergeWithEnvExample).toHaveBeenCalledWith('.env.example', [
        asVariable('API_KEY', 'secret123'),
        asVariable('DATABASE_URL', 'postgres://localhost:5432/db'),
        asVariable('EXTRA_VAR', 'extra_value'),
      ]);
      expect(mockedWriteFile).toHaveBeenCalledWith(
        '.env.local',
        expectedMergedEntries,
      );
    });
  });

  describe('Env Command', () => {
    it('should display variables when no command provided', async () => {
      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([
        { key: 'API_KEY', value: 'secret123' },
        { key: 'DB_URL', value: 'postgres://localhost' },
      ]);

      process.argv = ['node', 'lpop', 'env'];
      await cli.run();

      expect(mockKeychainManager.getEnvironmentVariables).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Environment variables for'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith('API_KEY=secret123');
      expect(consoleLogSpy).toHaveBeenCalledWith('DB_URL=postgres://localhost');
      expect(mockedSpawn).not.toHaveBeenCalled();
    });

    it('should show message when no variables found and no command', async () => {
      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([]);

      process.argv = ['node', 'lpop', 'env'];
      await cli.run();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('No variables found'),
      );
      expect(mockedSpawn).not.toHaveBeenCalled();
    });

    it('should run command with environment variables', async () => {
      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([
        { key: 'API_KEY', value: 'secret123' },
        { key: 'DB_URL', value: 'postgres://localhost' },
      ]);

      process.argv = ['node', 'lpop', 'env', 'npm', 'start'];
      await cli.run();

      expect(mockKeychainManager.getEnvironmentVariables).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Running "npm start" with 2 variables'),
      );
      expect(mockedSpawn).toHaveBeenCalledWith('npm', ['start'], {
        env: expect.objectContaining({
          API_KEY: 'secret123',
          DB_URL: 'postgres://localhost',
        }),
        stdio: 'inherit',
      });
    });

    it('should run command even when no variables found', async () => {
      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([]);

      process.argv = ['node', 'lpop', 'env', 'node', 'server.js'];
      await cli.run();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('No variables found'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Running "node server.js" with 0 variables'),
      );
      expect(mockedSpawn).toHaveBeenCalledWith('node', ['server.js'], {
        env: expect.objectContaining(process.env),
        stdio: 'inherit',
      });
    });

    it('should preserve existing environment variables', async () => {
      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([
        { key: 'API_KEY', value: 'secret123' },
      ]);

      process.argv = ['node', 'lpop', 'env', 'echo', 'test'];
      await cli.run();

      expect(mockedSpawn).toHaveBeenCalledWith('echo', ['test'], {
        env: expect.objectContaining({
          ...process.env,
          API_KEY: 'secret123',
        }),
        stdio: 'inherit',
      });
    });

    it('should handle spawn errors', async () => {
      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([
        { key: 'API_KEY', value: 'secret123' },
      ]);

      const mockErrorProcess = {
        on: vi.fn((event: string, callback: (error: Error) => void) => {
          if (event === 'error') {
            // Immediately call the error callback
            callback(new Error('Command not found'));
          }
          return mockErrorProcess; // Return self to satisfy ChildProcess interface
        }),
      };
      mockedSpawn.mockImplementationOnce(
        () => mockErrorProcess as unknown as ChildProcess,
      );

      process.argv = ['node', 'lpop', 'env', 'nonexistent-command'];

      try {
        await cli.run();
      } catch {
        // Expected to throw due to process.exit mock
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to start command: Command not found'),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should use environment option', async () => {
      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([
        { key: 'API_KEY', value: 'prod-secret' },
      ]);

      process.argv = [
        'node',
        'lpop',
        'env',
        '-e',
        'production',
        'npm',
        'start',
      ];
      await cli.run();

      expect(MockedKeychainManager).toHaveBeenCalledWith(
        expect.any(String),
        'production',
      );
      expect(mockedSpawn).toHaveBeenCalledWith('npm', ['start'], {
        env: expect.objectContaining({
          API_KEY: 'prod-secret',
        }),
        stdio: 'inherit',
      });
    });

    it('should use custom repo option', async () => {
      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([
        { key: 'API_KEY', value: 'secret123' },
      ]);

      process.argv = ['node', 'lpop', 'env', '-r', 'custom/repo', 'bun', 'dev'];
      await cli.run();

      expect(MockedKeychainManager).toHaveBeenCalledWith(
        expect.stringContaining('custom/repo'),
        undefined,
      );
      expect(mockedSpawn).toHaveBeenCalledWith('bun', ['dev'], {
        env: expect.objectContaining({
          API_KEY: 'secret123',
        }),
        stdio: 'inherit',
      });
    });

    it('should handle keychain errors gracefully', async () => {
      mockKeychainManager.getEnvironmentVariables.mockRejectedValue(
        new Error('Keychain access denied'),
      );

      process.argv = ['node', 'lpop', 'env', 'npm', 'start'];

      try {
        await cli.run();
      } catch {
        // Expected to throw due to process.exit mock
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Keychain access denied'),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(mockedSpawn).not.toHaveBeenCalled();
    });
  });

  describe('Env Command with -- Separator', () => {
    it('should run command with -- separator', async () => {
      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([
        { key: 'API_KEY', value: 'secret123' },
        { key: 'DB_URL', value: 'postgres://localhost' },
      ]);

      process.argv = ['node', 'lpop', 'env', '--', 'npm', 'start'];
      await cli.run();

      expect(mockKeychainManager.getEnvironmentVariables).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Running "npm start" with 2 variables'),
      );
      expect(mockedSpawn).toHaveBeenCalledWith('npm', ['start'], {
        env: expect.objectContaining({
          API_KEY: 'secret123',
          DB_URL: 'postgres://localhost',
        }),
        stdio: 'inherit',
      });
    });

    it('should run command with environment option and -- separator', async () => {
      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([
        { key: 'API_KEY', value: 'prod-secret' },
      ]);

      process.argv = [
        'node',
        'lpop',
        'env',
        '--env',
        'production',
        '--',
        'npm',
        'run',
        'build',
      ];
      await cli.run();

      expect(MockedKeychainManager).toHaveBeenCalledWith(
        expect.any(String),
        'production',
      );
      expect(mockedSpawn).toHaveBeenCalledWith('npm', ['run', 'build'], {
        env: expect.objectContaining({
          API_KEY: 'prod-secret',
        }),
        stdio: 'inherit',
      });
    });

    it('should run command with repo option and -- separator', async () => {
      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([
        { key: 'API_KEY', value: 'secret123' },
      ]);

      process.argv = [
        'node',
        'lpop',
        'env',
        '--repo',
        'custom/repo',
        '--',
        'bun',
        'dev',
      ];
      await cli.run();

      expect(MockedKeychainManager).toHaveBeenCalledWith(
        expect.stringContaining('custom/repo'),
        undefined,
      );
      expect(mockedSpawn).toHaveBeenCalledWith('bun', ['dev'], {
        env: expect.objectContaining({
          API_KEY: 'secret123',
        }),
        stdio: 'inherit',
      });
    });

    it('should handle complex commands with multiple arguments after --', async () => {
      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([
        { key: 'NODE_ENV', value: 'development' },
        { key: 'PORT', value: '3000' },
      ]);

      process.argv = [
        'node',
        'lpop',
        'env',
        '--',
        'node',
        'server.js',
        '--port',
        '8080',
        '--verbose',
      ];
      await cli.run();

      expect(mockedSpawn).toHaveBeenCalledWith(
        'node',
        ['server.js', '--port', '8080', '--verbose'],
        {
          env: expect.objectContaining({
            NODE_ENV: 'development',
            PORT: '3000',
          }),
          stdio: 'inherit',
        },
      );
    });

    it('should handle empty command after --', async () => {
      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([
        { key: 'API_KEY', value: 'secret123' },
      ]);

      process.argv = ['node', 'lpop', 'env', '--'];
      await cli.run();

      // When no command is provided after --, should display variables instead of running empty command
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Environment variables for'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith('API_KEY=secret123');
      // Should not call spawn with empty command
      expect(mockedSpawn).not.toHaveBeenCalled();
    });

    it('should work with short option flags and -- separator', async () => {
      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([
        { key: 'API_KEY', value: 'staging-secret' },
      ]);

      process.argv = [
        'node',
        'lpop',
        'env',
        '-e',
        'staging',
        '-r',
        'test/repo',
        '--',
        'python',
        'app.py',
      ];
      await cli.run();

      expect(MockedKeychainManager).toHaveBeenCalledWith(
        expect.stringContaining('test/repo'),
        'staging',
      );
      expect(mockedSpawn).toHaveBeenCalledWith('python', ['app.py'], {
        env: expect.objectContaining({
          API_KEY: 'staging-secret',
        }),
        stdio: 'inherit',
      });
    });
  });
});
