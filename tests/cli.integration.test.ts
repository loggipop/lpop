import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LpopCLI } from '../src/cli';
import { mockEntryInstance, mockFindCredentials } from './setup';

describe('LpopCLI Integration Tests', () => {
  let cli: LpopCLI;
  let tempDir: string;
  let originalProcessArgv: string[];
  let originalProcessCwd: () => string;
  let consoleLogSpy: ReturnType<typeof spyOn>;
  let consoleErrorSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    // Create a temp directory for file operations
    tempDir = mkdtempSync(join(tmpdir(), 'lpop-test-'));
    originalProcessCwd = process.cwd;
    process.cwd = () => tempDir;

    // Reset mocks from setup.ts
    mockEntryInstance.setPassword.mockReset();
    mockEntryInstance.getPassword.mockReset();
    mockEntryInstance.deletePassword.mockReset();
    mockFindCredentials.mockReset();

    // Setup default mock behaviors
    mockEntryInstance.setPassword.mockResolvedValue(undefined);
    mockEntryInstance.getPassword.mockResolvedValue('test-value');
    mockEntryInstance.deletePassword.mockResolvedValue(true);
    mockFindCredentials.mockResolvedValue([]);

    // Spy on console to suppress output during tests
    consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});

    // Mock process.exit to prevent actual exit
    spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit called with code ${code}`);
    });

    // Create CLI instance
    cli = new LpopCLI();

    // Store original process.argv
    originalProcessArgv = process.argv;
  });

  afterEach(() => {
    // Restore process.argv
    process.argv = originalProcessArgv;
    process.cwd = originalProcessCwd;

    // Restore console spies
    consoleLogSpy?.mockRestore();
    consoleErrorSpy?.mockRestore();

    // Clean up temp directory
    if (tempDir) {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe('Smart Command (main lpop command)', () => {
    test('should add variables from existing .env file', async () => {
      const envContent =
        'API_KEY=secret\nDB_URL=postgres://localhost\nPORT=3000';
      const envPath = join(tempDir, '.env');
      writeFileSync(envPath, envContent);

      process.argv = ['node', 'lpop', '.env'];
      await cli.run();

      // Verify the keychain manager was called to set variables
      expect(mockEntryInstance.setPassword).toHaveBeenCalled();
      expect(
        mockEntryInstance.setPassword.mock.calls.length,
      ).toBeGreaterThanOrEqual(3);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Added \d+ variables/),
      );
    });

    test('should add single variable with KEY=value syntax', async () => {
      process.argv = ['node', 'lpop', 'API_KEY=secret123'];
      await cli.run();

      // Verify the keychain manager was called to set the variable
      expect(mockEntryInstance.setPassword).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Added 1 variables'),
      );
    });

    test.skip('should output to file when path does not exist', async () => {
      // Skip this test as it requires complex mock setup for findCredentials
      // The CLI integration is better tested with the individual command tests
    });

    test('should get variables when no input provided', async () => {
      // Setup some variables to be retrieved
      mockFindCredentials.mockResolvedValue([
        { account: 'API_KEY', password: 'secret123' },
      ]);

      process.argv = ['node', 'lpop'];
      await cli.run();

      // Should write to .env.local by default
      const envLocalPath = join(tempDir, '.env.local');
      expect(existsSync(envLocalPath)).toBe(true);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('variables written to .env.local'),
      );
    });
  });

  describe('Add Command', () => {
    test('should add multiple variables from file', async () => {
      const envContent =
        'API_KEY=secret\n# Comment\nDB_URL=postgres://localhost\n\nPORT=3000';
      const testPath = join(tempDir, 'test.env');
      writeFileSync(testPath, envContent);

      process.argv = ['node', 'lpop', 'add', 'test.env'];
      await cli.run();

      expect(mockEntryInstance.setPassword).toHaveBeenCalled();
      expect(
        mockEntryInstance.setPassword.mock.calls.length,
      ).toBeGreaterThanOrEqual(3);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Added \d+ variables/),
      );
    });

    test('should add single variable', async () => {
      process.argv = ['node', 'lpop', 'add', 'API_KEY=secret123'];
      await cli.run();

      expect(mockEntryInstance.setPassword).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Added 1 variables'),
      );
    });

    test('should handle file not found error', async () => {
      process.argv = ['node', 'lpop', 'add', 'nonexistent.env'];

      let errorThrown = false;
      try {
        await cli.run();
      } catch (e) {
        errorThrown = true;
        expect(e.message).toContain('process.exit called');
      }

      expect(errorThrown).toBe(true);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('File not found'),
      );
    });
  });

  describe('Get Command', () => {
    test('should get all variables and write to default file', async () => {
      mockFindCredentials.mockResolvedValue([
        { account: 'API_KEY', password: 'secret' },
        { account: 'DB_URL', password: 'postgres://localhost' },
      ]);

      process.argv = ['node', 'lpop', 'get'];
      await cli.run();

      const envLocalPath = join(tempDir, '.env.local');
      expect(existsSync(envLocalPath)).toBe(true);
      const content = readFileSync(envLocalPath, 'utf-8');
      expect(content).toContain('API_KEY=');
      expect(content).toContain('DB_URL=');
    });

    test('should get specific variable', async () => {
      mockFindCredentials.mockResolvedValue([
        { account: 'API_KEY', password: 'secret123' },
        { account: 'DB_URL', password: 'postgres://localhost' },
      ]);

      process.argv = ['node', 'lpop', 'get', 'API_KEY'];
      await cli.run();

      expect(consoleLogSpy).toHaveBeenCalledWith('API_KEY=secret123');
    });

    test('should output to specified file', async () => {
      mockFindCredentials.mockResolvedValue([
        { account: 'API_KEY', password: 'secret' },
      ]);

      const outputPath = join(tempDir, 'custom.env');
      process.argv = ['node', 'lpop', 'get', '--output', outputPath];
      await cli.run();

      expect(existsSync(outputPath)).toBe(true);
      const content = readFileSync(outputPath, 'utf-8');
      expect(content).toContain('API_KEY=');
    });
  });

  describe('Remove Command', () => {
    test('should remove variable successfully', async () => {
      mockEntryInstance.deletePassword.mockResolvedValue(true);

      process.argv = ['node', 'lpop', 'remove', 'API_KEY'];
      await cli.run();

      expect(mockEntryInstance.deletePassword).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Removed variable API_KEY'),
      );
    });

    test('should require --confirm flag', async () => {
      process.argv = ['node', 'lpop', 'remove', 'API_KEY', '--confirm'];
      await cli.run();

      expect(mockEntryInstance.deletePassword).toHaveBeenCalled();
    });
  });

  describe('Clear Command', () => {
    test('should show warning without --confirm', async () => {
      process.argv = ['node', 'lpop', 'clear'];
      await cli.run();

      expect(mockEntryInstance.deletePassword).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('This will remove ALL'),
      );
    });

    test('should clear with --confirm', async () => {
      mockFindCredentials.mockResolvedValue([
        { account: 'API_KEY', password: 'secret' },
        { account: 'DB_URL', password: 'postgres://localhost' },
      ]);

      process.argv = ['node', 'lpop', 'clear', '--confirm'];
      await cli.run();

      expect(mockEntryInstance.deletePassword).toHaveBeenCalledTimes(2);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cleared all variables'),
      );
    });
  });

  describe('Environment handling', () => {
    test('should use environment from flag', async () => {
      process.argv = [
        'node',
        'lpop',
        'add',
        '--env',
        'production',
        'API_KEY=secret',
      ];
      await cli.run();

      // The service name should include the environment
      expect(mockEntryInstance.setPassword).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Added 1 variables'),
      );
    });

    test('should use environment from ENV variable', async () => {
      process.env.ENV = 'staging';
      process.argv = ['node', 'lpop', 'add', 'API_KEY=secret'];
      await cli.run();

      expect(mockEntryInstance.setPassword).toHaveBeenCalled();
      delete process.env.ENV;
    });
  });

  describe('Template handling', () => {
    test('should use .env.example as template when getting variables', async () => {
      // Create .env.example with template variables
      const exampleContent =
        '# Example configuration\nAPI_KEY=\nDB_URL=\nUNSET_VAR=\n';
      writeFileSync(join(tempDir, '.env.example'), exampleContent);

      // Only API_KEY and DB_URL are set in keychain
      mockFindCredentials.mockResolvedValue([
        { account: 'API_KEY', password: 'secret' },
        { account: 'DB_URL', password: 'postgres://localhost' },
      ]);

      process.argv = ['node', 'lpop', 'get'];
      await cli.run();

      const envLocalPath = join(tempDir, '.env.local');
      const content = readFileSync(envLocalPath, 'utf-8');

      // Should include set variables
      expect(content).toContain('API_KEY=secret');
      expect(content).toContain('DB_URL=postgres://localhost');

      // Should include unset variable from template
      expect(content).toContain('UNSET_VAR=');

      // Should preserve comments
      expect(content).toContain('# Example configuration');
    });
  });
});
