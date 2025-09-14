import { beforeEach, describe, expect, test } from 'bun:test';
import {
  GitPathResolver,
  getServicePrefix,
  isDevelopment,
} from '../src/git-path-resolver';
import { mockGit, mockSimpleGit } from './setup';

describe('GitPathResolver', () => {
  let resolver: GitPathResolver;

  beforeEach(() => {
    // Reset all mocks
    mockGit.init.mockReset();
    mockGit.status.mockReset();
    mockGit.getRemotes.mockReset();
    mockGit.checkIsRepo.mockReset();
    mockGit.revparse.mockReset();
    mockSimpleGit.mockReset();

    // Setup the mock to return the mockGit instance
    mockSimpleGit.mockReturnValue(mockGit);
    resolver = new GitPathResolver('/test/dir');
  });

  describe('constructor', () => {
    test('should create instance with custom working directory', () => {
      new GitPathResolver('/custom/path');
      expect(mockSimpleGit).toHaveBeenCalledWith('/custom/path');
    });

    test('should use current working directory by default', () => {
      const originalCwd = process.cwd();
      new GitPathResolver();
      expect(mockSimpleGit).toHaveBeenCalledWith(originalCwd);
    });
  });

  describe('isGitRepository', () => {
    test('should return true when in a git repository', async () => {
      mockGit.status.mockResolvedValue({});

      const result = await resolver.isGitRepository();

      expect(result).toBe(true);
      expect(mockGit.status).toHaveBeenCalled();
    });

    test('should return false when not in a git repository', async () => {
      mockGit.status.mockRejectedValue(new Error('Not a git repo'));

      const result = await resolver.isGitRepository();

      expect(result).toBe(false);
    });

    test('should return false on error', async () => {
      mockGit.status.mockRejectedValue(new Error('Git error'));

      const result = await resolver.isGitRepository();

      expect(result).toBe(false);
    });
  });

  describe('getRemoteUrl', () => {
    test('should return fetch URL for origin remote', async () => {
      const mockRemotes = [
        {
          name: 'origin',
          refs: {
            fetch: 'https://github.com/user/repo.git',
            push: 'https://github.com/user/repo.git',
          },
        },
      ];
      mockGit.getRemotes.mockResolvedValue(mockRemotes);

      const result = await resolver.getRemoteUrl();

      expect(result).toBe('https://github.com/user/repo.git');
      expect(mockGit.getRemotes).toHaveBeenCalledWith(true);
    });

    test('should return URL for custom remote name', async () => {
      const mockRemotes = [
        {
          name: 'upstream',
          refs: {
            fetch: 'https://github.com/upstream/repo.git',
            push: 'https://github.com/upstream/repo.git',
          },
        },
      ];
      mockGit.getRemotes.mockResolvedValue(mockRemotes);

      const result = await resolver.getRemoteUrl('upstream');

      expect(result).toBe('https://github.com/upstream/repo.git');
    });

    test('should return null when remote not found', async () => {
      mockGit.getRemotes.mockResolvedValue([]);

      const result = await resolver.getRemoteUrl();

      expect(result).toBeNull();
    });

    test('should return null on error', async () => {
      mockGit.getRemotes.mockRejectedValue(new Error('Git error'));

      const result = await resolver.getRemoteUrl();

      expect(result).toBeNull();
    });
  });

  describe('getGitInfo', () => {
    test('should parse git URL and return git info', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);
      mockGit.getRemotes.mockResolvedValue([
        {
          name: 'origin',
          refs: {
            fetch: 'https://github.com/testuser/testrepo.git',
            push: 'https://github.com/testuser/testrepo.git',
          },
        },
      ]);

      const result = await resolver.getGitInfo();

      expect(result).toEqual({
        owner: 'testuser',
        name: 'testrepo',
        full_name: 'testuser/testrepo',
      });
    });

    test('should handle SSH URLs', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);
      mockGit.getRemotes.mockResolvedValue([
        {
          name: 'origin',
          refs: {
            fetch: 'git@github.com:testuser/testrepo.git',
            push: 'git@github.com:testuser/testrepo.git',
          },
        },
      ]);

      const result = await resolver.getGitInfo();

      expect(result).toEqual({
        owner: 'testuser',
        name: 'testrepo',
        full_name: 'testuser/testrepo',
      });
    });

    test('should handle missing git remote', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);
      mockGit.getRemotes.mockResolvedValue([]);

      const result = await resolver.getGitInfo();

      expect(result).toBeNull();
    });

    test('should handle non-git directory', async () => {
      mockGit.checkIsRepo.mockResolvedValue(false);

      const result = await resolver.getGitInfo();

      expect(result).toBeNull();
    });
  });

  describe('generateServiceNameAsync', () => {
    test('should generate service name from git info', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);
      mockGit.getRemotes.mockResolvedValue([
        {
          name: 'origin',
          refs: {
            fetch: 'https://github.com/testuser/testrepo.git',
            push: 'https://github.com/testuser/testrepo.git',
          },
        },
      ]);

      const result = await resolver.generateServiceNameAsync();

      expect(result).toBe('lpop-dev://testuser/testrepo');
    });

    test('should generate service name (no env parameter)', async () => {
      // Note: generateServiceNameAsync doesn't take parameters in the actual implementation
      mockGit.checkIsRepo.mockResolvedValue(true);
      mockGit.getRemotes.mockResolvedValue([
        {
          name: 'origin',
          refs: {
            fetch: 'https://github.com/testuser/testrepo.git',
            push: 'https://github.com/testuser/testrepo.git',
          },
        },
      ]);

      const result = await resolver.generateServiceNameAsync();

      expect(result).toBe('lpop-dev://testuser/testrepo');
    });

    test('should use lpop:// prefix in production', async () => {
      // Mock isDevelopment to return false
      const originalExecPath = process.execPath;
      Object.defineProperty(process, 'execPath', {
        value: '/usr/local/bin/lpop',
        writable: true,
        configurable: true,
      });

      mockGit.checkIsRepo.mockResolvedValue(true);
      mockGit.getRemotes.mockResolvedValue([
        {
          name: 'origin',
          refs: {
            fetch: 'https://github.com/testuser/testrepo.git',
            push: 'https://github.com/testuser/testrepo.git',
          },
        },
      ]);

      const prodResolver = new GitPathResolver('/test/dir');
      const result = await prodResolver.generateServiceNameAsync();

      expect(result).toBe('lpop://testuser/testrepo');

      // Restore
      Object.defineProperty(process, 'execPath', {
        value: originalExecPath,
        writable: true,
        configurable: true,
      });
    });

    test('should fallback to local directory for non-git repo', async () => {
      mockGit.checkIsRepo.mockResolvedValue(false);
      mockGit.getRemotes.mockResolvedValue([]);

      const result = await resolver.generateServiceNameAsync();

      // Should use directory name as fallback with lpop-dev:// prefix
      expect(result).toBe('lpop-dev://local/dir');
    });

    test('should handle no git remotes', async () => {
      mockGit.checkIsRepo.mockResolvedValue(true);
      mockGit.getRemotes.mockResolvedValue([]);

      const result = await resolver.generateServiceNameAsync();

      // Falls back to local directory when no remotes
      expect(result).toBe('lpop-dev://local/dir');
    });
  });

  describe('getServicePrefix', () => {
    test('should return correct prefix based on NODE_ENV', () => {
      const originalEnv = process.env.NODE_ENV;

      process.env.NODE_ENV = 'development';
      expect(getServicePrefix()).toBe('lpop-dev://');

      // getServicePrefix uses isDevelopment() which checks process.execPath, not NODE_ENV
      // This test should use different approach
      const originalExecPath = process.execPath;
      Object.defineProperty(process, 'execPath', {
        value: '/usr/local/bin/lpop',
        writable: true,
        configurable: true,
      });
      expect(getServicePrefix()).toBe('lpop://');
      Object.defineProperty(process, 'execPath', {
        value: originalExecPath,
        writable: true,
        configurable: true,
      });

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('isDevelopment', () => {
    test('should correctly identify development environment', () => {
      const originalArgv = process.argv;
      const originalExecPath = process.execPath;

      // Test when running with bun/node from source
      process.argv = ['node', '/path/to/src/index.ts'];
      expect(isDevelopment()).toBe(true);

      // Test when running as compiled binary
      Object.defineProperty(process, 'execPath', {
        value: '/usr/local/bin/lpop',
        writable: true,
        configurable: true,
      });
      expect(isDevelopment()).toBe(false);

      // Test when running through node_modules
      Object.defineProperty(process, 'execPath', {
        value: '/usr/local/bin/node',
        writable: true,
        configurable: true,
      });
      process.argv = [
        'node',
        '/path/node_modules/@loggipop/lpop/dist/index.js',
      ];
      expect(isDevelopment()).toBe(false);

      // Restore original values
      process.argv = originalArgv;
      Object.defineProperty(process, 'execPath', {
        value: originalExecPath,
        writable: true,
        configurable: true,
      });
    });
  });
});
