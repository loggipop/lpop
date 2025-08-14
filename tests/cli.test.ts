import { describe, it, expect, beforeEach, vi, Mock, afterEach, MockInstance } from 'vitest';
import { LpopCLI } from '../src/cli';
import { KeychainManager } from '../src/keychain-manager';
import { GitPathResolver } from '../src/git-path-resolver';
import { EnvFileParser } from '../src/env-file-parser';
import { existsSync } from 'fs';
import chalk from 'chalk';

vi.mock('../src/keychain-manager');
vi.mock('../src/git-path-resolver');
vi.mock('../src/env-file-parser', () => ({
  EnvFileParser: {
    parseFile: vi.fn(),
    parseVariable: vi.fn(),
    writeFile: vi.fn(),
    mergeWithEnvExample: vi.fn(),
  },
}));
vi.mock('fs');
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
  let mockKeychainManager: {
    setEnvironmentVariables: Mock;
    getEnvironmentVariables: Mock;
    removeEnvironmentVariable: Mock;
    clearAllEnvironmentVariables: Mock;
  };
  let mockGitResolver: {
    generateServiceNameAsync: Mock;
  };
  let consoleLogSpy: MockInstance;
  let consoleErrorSpy: MockInstance;
  let processExitSpy: MockInstance;

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
    };
    (KeychainManager as any).mockImplementation(() => mockKeychainManager);

    // Setup GitPathResolver mock
    mockGitResolver = {
      generateServiceNameAsync: vi.fn().mockResolvedValue('lpop://user/repo'),
    };
    (GitPathResolver as any).mockImplementation(() => mockGitResolver);

    cli = new LpopCLI();
  });

  afterEach(() => {
    // Clear all mocks after each test to prevent state leakage
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('Smart Command', () => {
    it('should get variables when no input provided', async () => {
      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([{ key: 'API_KEY', value: 'secret123' }]);

      // Simulate command: lpop
      process.argv = ['node', 'lpop'];
      await cli.run();

      expect(mockKeychainManager.getEnvironmentVariables).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('variables written to .env.local'));
    });

    it('should add variables when file exists', async () => {
      (existsSync as any).mockReturnValue(true);
      (EnvFileParser.parseFile as any).mockResolvedValue({
        entries: [{ type: 'variable', key: 'API_KEY', value: 'secret123' }],
      });

      // Simulate command: lpop .env
      process.argv = ['node', 'lpop', '.env'];
      await cli.run();

      expect(mockKeychainManager.setEnvironmentVariables).toHaveBeenCalledWith([
        { key: 'API_KEY', value: 'secret123' },
      ]);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Added 1 variables'));
    });

    it('should add single variable when input contains equals', async () => {
      (EnvFileParser.parseVariable as any).mockReturnValue({
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
      (existsSync as any).mockReturnValue(false);
      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([{ key: 'API_KEY', value: 'secret123' }]);

      // Simulate command: lpop output.env
      process.argv = ['node', 'lpop', 'output.env'];
      await cli.run();

      expect(EnvFileParser.writeFile).toHaveBeenCalledWith('output.env', [
        { type: 'variable', key: 'API_KEY', value: 'secret123' },
      ]);
    });

    it('should output to file using smart command', async () => {
      // Reset the mock for this specific test
      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([{ key: 'API_KEY', value: 'secret123' }]);

      process.argv = ['node', 'lpop', 'output.env'];
      await cli.run();

      expect(EnvFileParser.writeFile).toHaveBeenCalledWith('output.env', [
        { type: 'variable', key: 'API_KEY', value: 'secret123' },
      ]);
    });
  });

  describe('Add Command', () => {
    beforeEach(() => {
      // Clear any previous mock calls
      mockKeychainManager.setEnvironmentVariables.mockClear();
    });

    it('should add variables from file', async () => {
      (existsSync as any).mockReturnValue(true);
      (EnvFileParser.parseFile as any).mockResolvedValue({
        entries: [
          { type: 'variable', key: 'API_KEY', value: 'secret123' },
          { type: 'variable', key: 'DB_URL', value: 'postgres://localhost' },
        ],
      });

      process.argv = ['node', 'lpop', 'add', '.env'];
      await cli.run();

      expect(mockKeychainManager.setEnvironmentVariables).toHaveBeenCalledWith([
        { key: 'API_KEY', value: 'secret123' },
        { key: 'DB_URL', value: 'postgres://localhost' },
      ]);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Added 2 variables'));
    });

    it('should add single variable', async () => {
      (existsSync as any).mockReturnValue(false);

      process.argv = ['node', 'lpop', 'add', 'API_KEY=secret123'];
      await cli.run();

      expect(mockKeychainManager.setEnvironmentVariables).toHaveBeenCalledWith([
        { key: 'API_KEY', value: 'secret123' },
      ]);
      expect(mockKeychainManager.setEnvironmentVariables).toHaveBeenCalledTimes(1);
    });

    it('should use custom repo name', async () => {
      (existsSync as any).mockReturnValue(true);
      (EnvFileParser.parseFile as any).mockResolvedValue({
        entries: [{ type: 'variable', key: 'API_KEY', value: 'secret123' }],
      });

      process.argv = ['node', 'lpop', 'add', '.env', '-r', 'custom/repo'];
      await cli.run();

      expect(KeychainManager).toHaveBeenCalledWith(expect.stringContaining('custom/repo'), undefined);
    });

    it('should use environment option', async () => {
      (existsSync as any).mockReturnValue(true);
      (EnvFileParser.parseFile as any).mockResolvedValue({
        entries: [{ type: 'variable', key: 'API_KEY', value: 'secret123' }],
      });

      process.argv = ['node', 'lpop', 'add', '.env', '-e', 'production'];
      await cli.run();

      expect(KeychainManager).toHaveBeenCalledWith(expect.any(String), 'production');
    });
  });

  describe('Get Command', () => {
    beforeEach(() => {
      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([
        { key: 'API_KEY', value: 'secret123' },
        { key: 'DB_URL', value: 'postgres://localhost' },
      ]);
    });

    afterEach(() => {
      mockKeychainManager.getEnvironmentVariables.mockClear();
    });

    it('should get all variables', async () => {
      (existsSync as any).mockReturnValue(false);
      process.argv = ['node', 'lpop', 'get'];
      await cli.run();

      expect(mockKeychainManager.getEnvironmentVariables).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('variables written to .env.local'));
    });

    it('should get specific variable', async () => {
      process.argv = ['node', 'lpop', 'get', 'API_KEY'];
      await cli.run();

      expect(consoleLogSpy).toHaveBeenCalledWith('API_KEY=secret123');
    });

    it('should show message when no variables found', async () => {
      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([]);

      process.argv = ['node', 'lpop', 'get'];
      await cli.run();

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No variables found'));
    });

    it('should show message when specific variable not found', async () => {
      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([{ key: 'OTHER_KEY', value: 'value' }]);

      process.argv = ['node', 'lpop', 'get', 'API_KEY'];
      await cli.run();

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Variable API_KEY not found'));
    });
  });

  describe('Remove Command', () => {
    it('should remove variable successfully', async () => {
      mockKeychainManager.removeEnvironmentVariable.mockResolvedValue(true);

      process.argv = ['node', 'lpop', 'remove', 'API_KEY'];
      await cli.run();

      expect(mockKeychainManager.removeEnvironmentVariable).toHaveBeenCalledWith('API_KEY');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Removed variable API_KEY'));
    });

    it('should show message when variable not found', async () => {
      mockKeychainManager.removeEnvironmentVariable.mockResolvedValue(false);

      process.argv = ['node', 'lpop', 'remove', 'API_KEY'];
      await cli.run();

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Variable API_KEY not found'));
    });
  });

  describe('Clear Command', () => {
    it('should show warning without --confirm', async () => {
      process.argv = ['node', 'lpop', 'clear'];
      await cli.run();

      expect(mockKeychainManager.clearAllEnvironmentVariables).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('This will remove ALL'));
    });

    it('should clear with --confirm', async () => {
      process.argv = ['node', 'lpop', 'clear', '--confirm'];
      await cli.run();

      expect(mockKeychainManager.clearAllEnvironmentVariables).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Cleared all variables'));
    });
  });

  describe('List Command', () => {
    it('should show limitation message', async () => {
      process.argv = ['node', 'lpop', 'list'];
      await cli.run();

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('keychain limitations'));
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in add command', async () => {
      (existsSync as any).mockReturnValue(true);
      (EnvFileParser.parseFile as any).mockRejectedValue(new Error('Parse error'));

      process.argv = ['node', 'lpop', 'add', '.env'];

      try {
        await cli.run();
      } catch (error) {
        // Expected to throw due to process.exit mock
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Parse error'));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle errors in get command', async () => {
      mockKeychainManager.getEnvironmentVariables.mockRejectedValue(new Error('Keychain error'));

      process.argv = ['node', 'lpop', 'get'];

      try {
        await cli.run();
      } catch (error) {
        // Expected to throw due to process.exit mock
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Keychain error'));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('Service Name Resolution', () => {
    it('should use git resolver when no repo specified', async () => {
      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([]);

      process.argv = ['node', 'lpop', 'get'];
      await cli.run();

      expect(mockGitResolver.generateServiceNameAsync).toHaveBeenCalled();
      expect(KeychainManager).toHaveBeenCalledWith('lpop://user/repo', undefined);
    });

    it('should use custom repo when specified', async () => {
      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([]);

      process.argv = ['node', 'lpop', 'get', '-r', 'custom/repo'];
      await cli.run();

      expect(mockGitResolver.generateServiceNameAsync).not.toHaveBeenCalled();
      expect(KeychainManager).toHaveBeenCalledWith(expect.stringContaining('custom/repo'), undefined);
    });
  });

  describe('Get Command with .env.example Template', () => {
    beforeEach(() => {
      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([
        { key: 'API_KEY', value: 'secret123' },
        { key: 'DATABASE_URL', value: 'postgres://localhost:5432/db' },
        { key: 'EXTRA_VAR', value: 'extra_value' },
      ]);
    });

    it('should use .env.example as template when it exists', async () => {
      (existsSync as any).mockImplementation((path: string) => path === '.env.example');
      const expectedMergedEntries = [
        { type: 'comment', comment: '# Environment variables template' },
        { type: 'empty' },
        { type: 'variable', key: 'API_KEY', value: 'secret123', comment: '# API key for external service' },
        {
          type: 'variable',
          key: 'DATABASE_URL',
          value: 'postgres://localhost:5432/db',
          comment: '# Database connection string',
        },
        { type: 'variable', key: 'MISSING_VAR', value: '', comment: '# This variable is not in keychain' },
        { type: 'empty' },
        { type: 'comment', comment: '# Additional variables from keychain' },
        { type: 'variable', key: 'EXTRA_VAR', value: 'extra_value' },
      ];
      (EnvFileParser.mergeWithEnvExample as any).mockResolvedValue(expectedMergedEntries);

      process.argv = ['node', 'lpop', 'get'];
      await cli.run();

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Found .env.example, using as template'));
      expect(EnvFileParser.mergeWithEnvExample).toHaveBeenCalledWith('.env.example', [
        { key: 'API_KEY', value: 'secret123' },
        { key: 'DATABASE_URL', value: 'postgres://localhost:5432/db' },
        { key: 'EXTRA_VAR', value: 'extra_value' },
      ]);
      expect(EnvFileParser.writeFile).toHaveBeenCalledWith('.env.local', expectedMergedEntries);
    });

    it('should fall back to standard output when .env.example does not exist', async () => {
      (existsSync as any).mockReturnValue(false);

      process.argv = ['node', 'lpop', 'get'];
      await cli.run();

      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('Found .env.example'));
      expect(EnvFileParser.writeFile).toHaveBeenCalledWith('.env.local', [
        { type: 'variable', key: 'API_KEY', value: 'secret123' },
        { type: 'variable', key: 'DATABASE_URL', value: 'postgres://localhost:5432/db' },
        { type: 'variable', key: 'EXTRA_VAR', value: 'extra_value' },
      ]);
    });

    it('should handle .env.example parsing errors gracefully', async () => {
      (existsSync as any).mockImplementation((path: string) => path === '.env.example');
      // The mergeWithEnvExample function handles errors internally and returns fallback
      const fallbackEntries = [
        { type: 'variable', key: 'API_KEY', value: 'secret123' },
        { type: 'variable', key: 'DATABASE_URL', value: 'postgres://localhost:5432/db' },
        { type: 'variable', key: 'EXTRA_VAR', value: 'extra_value' },
      ];
      (EnvFileParser.mergeWithEnvExample as any).mockResolvedValue(fallbackEntries);

      process.argv = ['node', 'lpop', 'get'];
      await cli.run();

      expect(EnvFileParser.mergeWithEnvExample).toHaveBeenCalledWith('.env.example', [
        { key: 'API_KEY', value: 'secret123' },
        { key: 'DATABASE_URL', value: 'postgres://localhost:5432/db' },
        { key: 'EXTRA_VAR', value: 'extra_value' },
      ]);
      expect(EnvFileParser.writeFile).toHaveBeenCalledWith('.env.local', fallbackEntries);
    });

    it('should sort additional variables alphabetically', async () => {
      (existsSync as any).mockImplementation((path: string) => path === '.env.example');
      const expectedMergedEntries = [
        { type: 'variable', key: 'API_KEY', value: 'secret123', comment: '# API key' },
        { type: 'empty' },
        { type: 'comment', comment: '# Additional variables from keychain' },
        { type: 'variable', key: 'DATABASE_URL', value: 'postgres://localhost:5432/db' },
        { type: 'variable', key: 'EXTRA_VAR', value: 'extra_value' },
      ];
      (EnvFileParser.mergeWithEnvExample as any).mockResolvedValue(expectedMergedEntries);

      process.argv = ['node', 'lpop', 'get'];
      await cli.run();

      expect(EnvFileParser.mergeWithEnvExample).toHaveBeenCalledWith('.env.example', [
        { key: 'API_KEY', value: 'secret123' },
        { key: 'DATABASE_URL', value: 'postgres://localhost:5432/db' },
        { key: 'EXTRA_VAR', value: 'extra_value' },
      ]);
      expect(EnvFileParser.writeFile).toHaveBeenCalledWith('.env.local', expectedMergedEntries);
    });
  });
});
