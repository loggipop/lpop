import type { GitUrl } from 'git-url-parse';
import GitUrlParse from 'git-url-parse';
import { simpleGit } from 'simple-git';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GitPathResolver,
  getServicePrefix,
  isDevelopment,
} from '../src/git-path-resolver';

// Mock simple-git with factory function
vi.mock('simple-git', () => {
  const mockGit = {
    status: vi.fn(),
    getRemotes: vi.fn(),
  };

  return {
    simpleGit: vi.fn(() => mockGit),
  };
});

// Mock git-url-parse
vi.mock('git-url-parse', () => ({
  default: vi.fn(),
}));

describe('GitPathResolver', () => {
  let resolver: GitPathResolver;

  // Get properly typed mocked modules
  const mockedSimpleGit = vi.mocked(simpleGit);
  const mockedGitUrlParse = vi.mocked(GitUrlParse);

  // Helper to get the mock git instance
  const getMockGitInstance = () => {
    const results = mockedSimpleGit.mock.results;
    return results[results.length - 1]?.value;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resolver = new GitPathResolver('/test/dir');
  });

  describe('constructor', () => {
    it('should create instance with custom working directory', () => {
      const _customResolver = new GitPathResolver('/custom/path');
      expect(mockedSimpleGit).toHaveBeenCalledWith('/custom/path');
    });

    it('should use current working directory by default', () => {
      const originalCwd = process.cwd();
      const _defaultResolver = new GitPathResolver();
      expect(mockedSimpleGit).toHaveBeenCalledWith(originalCwd);
    });
  });

  describe('isGitRepository', () => {
    it('should return true when in a git repository', async () => {
      const mockGit = getMockGitInstance();
      mockGit.status.mockResolvedValue({});

      const result = await resolver.isGitRepository();

      expect(mockGit.status).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when not in a git repository', async () => {
      const mockGit = getMockGitInstance();
      mockGit.status.mockRejectedValue(new Error('Not a git repo'));

      const result = await resolver.isGitRepository();

      expect(result).toBe(false);
    });
  });

  describe('getRemoteUrl', () => {
    it('should return fetch URL for origin remote', async () => {
      const mockGit = getMockGitInstance();
      mockGit.getRemotes.mockResolvedValue([
        {
          name: 'origin',
          refs: {
            fetch: 'https://github.com/user/repo.git',
            push: 'https://github.com/user/repo.git',
          },
        },
      ]);

      const result = await resolver.getRemoteUrl();

      expect(mockGit.getRemotes).toHaveBeenCalledWith(true);
      expect(result).toBe('https://github.com/user/repo.git');
    });

    it('should return URL for custom remote name', async () => {
      const mockGit = getMockGitInstance();
      mockGit.getRemotes.mockResolvedValue([
        {
          name: 'upstream',
          refs: {
            fetch: 'https://github.com/org/project.git',
            push: 'https://github.com/org/project.git',
          },
        },
      ]);

      const result = await resolver.getRemoteUrl('upstream');

      expect(result).toBe('https://github.com/org/project.git');
    });

    it('should return null when remote not found', async () => {
      const mockGit = getMockGitInstance();
      mockGit.getRemotes.mockResolvedValue([]);

      const result = await resolver.getRemoteUrl();

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      const mockGit = getMockGitInstance();
      mockGit.getRemotes.mockRejectedValue(new Error('Git error'));

      const result = await resolver.getRemoteUrl();

      expect(result).toBeNull();
    });
  });

  describe('getGitInfo', () => {
    it('should parse git URL and return git info', async () => {
      const mockGit = getMockGitInstance();
      mockGit.getRemotes.mockResolvedValue([
        {
          name: 'origin',
          refs: {
            fetch: 'https://github.com/user/repo.git',
          },
        },
      ]);

      mockedGitUrlParse.mockReturnValue({
        owner: 'user',
        name: 'repo',
        full_name: 'user/repo',
        source: 'github.com',
        ref: '',
        filepath: '',
        filepathtype: '',
        organization: '',
        protocol: 'https',
        resource: 'github.com',
        port: null,
        pathname: '/user/repo',
        search: '',
        hash: '',
        href: 'https://github.com/user/repo.git',
        token: '',
        toString: vi.fn(() => 'https://github.com/user/repo.git'),
      } as unknown as GitUrl);

      const result = await resolver.getGitInfo();

      expect(mockedGitUrlParse).toHaveBeenCalledWith(
        'https://github.com/user/repo.git',
      );
      expect(result).toEqual({
        owner: 'user',
        name: 'repo',
        full_name: 'user/repo',
      });
    });

    it('should return null when no remote URL', async () => {
      const mockGit = getMockGitInstance();
      mockGit.getRemotes.mockResolvedValue([]);

      const result = await resolver.getGitInfo();

      expect(result).toBeNull();
    });

    it('should return null when URL parsing fails', async () => {
      const mockGit = getMockGitInstance();
      mockGit.getRemotes.mockResolvedValue([
        {
          name: 'origin',
          refs: {
            fetch: 'invalid-url',
          },
        },
      ]);

      mockedGitUrlParse.mockImplementation(() => {
        throw new Error('Parse error');
      });

      const result = await resolver.getGitInfo();

      expect(result).toBeNull();
    });
  });

  describe('generateServiceNameAsync', () => {
    it('should generate service name from git info', async () => {
      const mockGit = getMockGitInstance();
      mockGit.getRemotes.mockResolvedValue([
        {
          name: 'origin',
          refs: {
            fetch: 'https://github.com/user/repo.git',
          },
        },
      ]);

      mockedGitUrlParse.mockReturnValue({
        owner: 'user',
        name: 'repo',
        full_name: 'user/repo',
        source: 'github.com',
        ref: '',
        filepath: '',
        filepathtype: '',
        organization: '',
        protocol: 'https',
        resource: 'github.com',
        port: null,
        pathname: '/user/repo',
        search: '',
        hash: '',
        href: 'https://github.com/user/repo.git',
        token: '',
        toString: vi.fn(() => 'https://github.com/user/repo.git'),
      } as unknown as GitUrl);

      const originalIsDev = isDevelopment();
      const expectedPrefix = originalIsDev ? 'lpop-dev://' : 'lpop://';

      const result = await resolver.generateServiceNameAsync();

      expect(result).toBe(`${expectedPrefix}user/repo`);
    });

    it('should use fallback when no git info available', async () => {
      const mockGit = getMockGitInstance();
      mockGit.getRemotes.mockResolvedValue([]);

      const originalIsDev = isDevelopment();
      const expectedPrefix = originalIsDev ? 'lpop-dev://' : 'lpop://';

      const result = await resolver.generateServiceNameAsync();

      expect(result).toBe(`${expectedPrefix}local/dir`);
    });

    it('should handle empty directory name', async () => {
      const mockGit = getMockGitInstance();
      mockGit.getRemotes.mockResolvedValue([]);
      const emptyDirResolver = new GitPathResolver('');

      const originalIsDev = isDevelopment();
      const expectedPrefix = originalIsDev ? 'lpop-dev://' : 'lpop://';

      const result = await emptyDirResolver.generateServiceNameAsync();

      expect(result).toBe(`${expectedPrefix}local/unknown`);
    });
  });

  describe('static methods', () => {
    describe('extractEnvironmentFromService', () => {
      it('should extract environment from service name', () => {
        const result = GitPathResolver.extractEnvironmentFromService(
          'lpop://user/repo?env=production',
        );
        expect(result).toBe('production');
      });

      it('should return null when no environment specified', () => {
        const result =
          GitPathResolver.extractEnvironmentFromService('lpop://user/repo');
        expect(result).toBeNull();
      });
    });

    describe('extractRepoFromService', () => {
      it('should extract repo from service name', () => {
        const result = GitPathResolver.extractRepoFromService(
          'lpop://user/repo?env=production',
        );
        expect(result).toBe('user/repo');
      });

      it('should handle service name without environment', () => {
        const result =
          GitPathResolver.extractRepoFromService('lpop://org/project');
        expect(result).toBe('org/project');
      });
    });
  });
});

describe('isDevelopment', () => {
  const originalArgv = process.argv;
  const originalExecPath = process.execPath;

  beforeEach(() => {
    process.argv = [...originalArgv];
    process.execPath = originalExecPath;
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.execPath = originalExecPath;
  });

  it('should return false when running as compiled binary', () => {
    process.execPath = '/usr/local/bin/lpop';
    expect(isDevelopment()).toBe(false);
  });

  it('should return false when running through node_modules', () => {
    process.argv[1] = '/project/node_modules/.bin/lpop';
    expect(isDevelopment()).toBe(false);
  });

  it('should return true when running from source', () => {
    process.execPath = '/usr/local/bin/bun';
    process.argv[1] = '/project/src/index.ts';
    expect(isDevelopment()).toBe(true);
  });
});

describe('getServicePrefix', () => {
  it('should return development prefix when in development', () => {
    const originalIsDev = isDevelopment();
    const expected = originalIsDev ? 'lpop-dev://' : 'lpop://';
    expect(getServicePrefix()).toBe(expected);
  });
});
