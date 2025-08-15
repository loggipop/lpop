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
vi.mock('../src/env-file-parser');
vi.mock('node:fs');
vi.mock('chalk', () => ({
  default: {
    blue: vi.fn((text: string) => text),
    green: vi.fn((text: string) => text),
    yellow: vi.fn((text: string) => text),
    red: vi.fn((text: string) => text),
  },
}));

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
        entries: [{ type: 'variable', key: 'API_KEY', value: 'secret123' }],
        comments: [],
        originalContent: 'API_KEY=secret123\n',
        ignoredCount: 0,
        structure: { lines: [] },
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
      mockedParseVariable.mockReturnValue({
        type: 'variable',
        key: 'API_KEY',
        value: 'secret123',
      });

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
        { type: 'variable', key: 'API_KEY', value: 'secret123' },
      ]);
    });

    it('should output to file using smart command', async () => {
      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([
        { key: 'API_KEY', value: 'secret123' },
      ]);

      process.argv = ['node', 'lpop', 'output.env'];
      await cli.run();

      expect(mockedWriteFile).toHaveBeenCalledWith('output.env', [
        { type: 'variable', key: 'API_KEY', value: 'secret123' },
      ]);
    });
  });

  describe('Add Command', () => {
    it('should add variables from file', async () => {
      mockedExistsSync.mockReturnValue(true);
      mockedParseFile.mockResolvedValue({
        entries: [
          { type: 'variable', key: 'API_KEY', value: 'secret123' },
          { type: 'variable', key: 'DB_URL', value: 'postgres://localhost' },
        ],
        comments: [],
        originalContent: 'API_KEY=secret123\nDB_URL=postgres://localhost\n',
        ignoredCount: 0,
        structure: { lines: [] },
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
        entries: [{ type: 'variable', key: 'API_KEY', value: 'secret123' }],
        comments: [],
        originalContent: 'API_KEY=secret123\n',
        ignoredCount: 0,
        structure: { lines: [] },
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
      mockedParseFile.mockResolvedValue({
        entries: [{ type: 'variable', key: 'API_KEY', value: 'secret123' }],
        comments: [],
        originalContent: 'API_KEY=secret123\n',
        ignoredCount: 0,
        structure: { lines: [] },
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
        {
          type: 'comment' as const,
          comment: '# Environment variables template',
        },
        { type: 'empty' as const },
        {
          type: 'variable' as const,
          key: 'API_KEY',
          value: 'secret123',
          comment: '# API key for external service',
        },
        {
          type: 'variable' as const,
          key: 'DATABASE_URL',
          value: 'postgres://localhost:5432/db',
          comment: '# Database connection string',
        },
        {
          type: 'variable' as const,
          key: 'MISSING_VAR',
          value: '',
          comment: '# This variable is not in keychain',
        },
        { type: 'empty' as const },
        {
          type: 'comment' as const,
          comment: '# Additional variables from keychain',
        },
        { type: 'variable' as const, key: 'EXTRA_VAR', value: 'extra_value' },
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
        { type: 'variable', key: 'API_KEY', value: 'secret123' },
        {
          type: 'variable',
          key: 'DATABASE_URL',
          value: 'postgres://localhost:5432/db',
        },
        { type: 'variable', key: 'EXTRA_VAR', value: 'extra_value' },
      ]);
    });

    it('should handle .env.example parsing errors gracefully', async () => {
      mockedExistsSync.mockImplementation(
        (path) => path.toString() === '.env.example',
      );
      // The mergeWithEnvExample function handles errors internally and returns fallback
      const fallbackEntries = [
        { type: 'variable' as const, key: 'API_KEY', value: 'secret123' },
        {
          type: 'variable' as const,
          key: 'DATABASE_URL',
          value: 'postgres://localhost:5432/db',
        },
        { type: 'variable' as const, key: 'EXTRA_VAR', value: 'extra_value' },
      ];
      mockedMergeWithEnvExample.mockResolvedValue(fallbackEntries);

      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([
        { key: 'API_KEY', value: 'secret123' },
        { key: 'DATABASE_URL', value: 'postgres://localhost:5432/db' },
        { key: 'EXTRA_VAR', value: 'extra_value' },
      ]);

      process.argv = ['node', 'lpop', 'get'];
      await cli.run();

      expect(mockedMergeWithEnvExample).toHaveBeenCalledWith('.env.example', [
        { key: 'API_KEY', value: 'secret123' },
        { key: 'DATABASE_URL', value: 'postgres://localhost:5432/db' },
        { key: 'EXTRA_VAR', value: 'extra_value' },
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
        {
          type: 'variable' as const,
          key: 'API_KEY',
          value: 'secret123',
          comment: '# API key',
        },
        { type: 'empty' as const },
        {
          type: 'comment' as const,
          comment: '# Additional variables from keychain',
        },
        {
          type: 'variable' as const,
          key: 'DATABASE_URL',
          value: 'postgres://localhost:5432/db',
        },
        { type: 'variable' as const, key: 'EXTRA_VAR', value: 'extra_value' },
      ];
      mockedMergeWithEnvExample.mockResolvedValue(expectedMergedEntries);

      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([
        { key: 'API_KEY', value: 'secret123' },
        { key: 'DATABASE_URL', value: 'postgres://localhost:5432/db' },
        { key: 'EXTRA_VAR', value: 'extra_value' },
      ]);

      process.argv = ['node', 'lpop', 'get'];
      await cli.run();

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
  });
});
