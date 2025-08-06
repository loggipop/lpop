import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test'

// Mock the modules
const mockGit = {
  status: mock(() => Promise.resolve({})),
  getRemotes: mock((): Promise<RemoteWithoutRefs[]> => Promise.resolve([])),
}

mock.module('simple-git', () => ({
  simpleGit: mock(() => mockGit),
}))

const mockGitUrlParse = mock((_url: string) => ({
  owner: 'loggipop',
  name: 'lpop',
  full_name: 'loggipop/lpop',
}))

mock.module('git-url-parse', () => ({
  default: mockGitUrlParse,
}))
import { GitPathResolver, isDevelopment, getServicePrefix } from './git-path-resolver'
import { RemoteWithoutRefs, RemoteWithRefs, simpleGit } from 'simple-git'

describe('GitPathResolver', () => {
  let resolver: GitPathResolver

  beforeEach(() => {
    // Reset all mocks
    mockGit.status.mockClear()
    mockGit.getRemotes.mockClear()
    mockGitUrlParse.mockClear()

    resolver = new GitPathResolver('/test/working/dir')
  })

  describe('isGitRepository', () => {
    test('should return true when git status succeeds', async () => {
      mockGit.status.mockResolvedValue({})

      const result = await resolver.isGitRepository()

      expect(result).toBe(true)
      expect(mockGit.status).toHaveBeenCalled()
    })

    test('should return false when git status fails', async () => {
      mockGit.status.mockRejectedValue(new Error('Not a git repository'))

      const result = await resolver.isGitRepository()

      expect(result).toBe(false)
    })
  })

  describe('getRemoteUrl', () => {
    test('should return remote URL for origin', async () => {
      const remote: RemoteWithRefs = {
        name: 'origin',
        refs: {
          fetch: 'https://github.com/owner/repo.git',
          push: 'https://github.com/owner/repo.git',
        },
      }
      mockGit.getRemotes.mockResolvedValue([remote])

      const result = await resolver.getRemoteUrl()

      expect(result).toBe('https://github.com/owner/repo.git')
      expect(mockGit.getRemotes).toHaveBeenCalledWith(true)
    })

    test('should return null when remote not found', async () => {
      mockGit.getRemotes.mockResolvedValue([])

      const result = await resolver.getRemoteUrl()

      expect(result).toBeNull()
    })

    test('should return null on error', async () => {
      mockGit.getRemotes.mockRejectedValue(new Error('Failed'))

      const result = await resolver.getRemoteUrl()

      expect(result).toBeNull()
    })
  })

  describe('getGitInfo', () => {
    test('should parse git remote URL correctly', async () => {
      const remote: RemoteWithRefs = {
        name: 'origin',
        refs: {
          fetch: 'https://github.com/loggipop/lpop.git',
          push: 'https://github.com/loggipop/lpop.git',
        },
      }
      mockGit.getRemotes.mockResolvedValue([
        remote
      ])

      mockGitUrlParse.mockReturnValue({
        owner: 'loggipop',
        name: 'lpop',
        full_name: 'loggipop/lpop',
      })

      const result = await resolver.getGitInfo()

      expect(result).toEqual({
        owner: 'loggipop',
        name: 'lpop',
        full_name: 'loggipop/lpop',
      })
      expect(mockGitUrlParse).toHaveBeenCalledWith('https://github.com/loggipop/lpop.git')
    })

    test('should return null when no remote URL', async () => {
      mockGit.getRemotes.mockResolvedValue([])

      const result = await resolver.getGitInfo()

      expect(result).toBeNull()
    })

    test('should return null when parsing fails', async () => {
      const remote: RemoteWithRefs = {
        name: 'origin',
        refs: {
          fetch: 'invalid-url',
          push: 'invalid-url',
        },
      }
      mockGit.getRemotes.mockResolvedValue([
        remote
      ])

      mockGitUrlParse.mockImplementation(() => {
        throw new Error('Invalid URL')
      })

      const result = await resolver.getGitInfo()

      expect(result).toBeNull()
    })
  })

  describe('generateServiceNameAsync', () => {
    test('should generate service name from git info', async () => {
      const originalIsDev = isDevelopment()
      const mockGetGitInfo = mock(() => Promise.resolve({
        owner: 'loggipop',
        name: 'lpop',
        full_name: 'loggipop/lpop',
      }))
      resolver.getGitInfo = mockGetGitInfo

      const result = await resolver.generateServiceNameAsync()

      expect(result).toBe(`${originalIsDev ? 'lpop-dev://' : 'lpop://'}loggipop/lpop`)
    })

    test('should fallback to directory name when no git info', async () => {
      const originalIsDev = isDevelopment()
      const mockGetGitInfo = mock(() => Promise.resolve(null))
      resolver.getGitInfo = mockGetGitInfo

      const result = await resolver.generateServiceNameAsync()

      expect(result).toBe(`${originalIsDev ? 'lpop-dev://' : 'lpop://'}local/dir`)
    })

    test('should handle root directory', async () => {
      const originalIsDev = isDevelopment()
      const mockGetGitInfo = mock(() => Promise.resolve(null))
      resolver = new GitPathResolver('/')
      resolver.getGitInfo = mockGetGitInfo

      const result = await resolver.generateServiceNameAsync()

      expect(result).toBe(`${originalIsDev ? 'lpop-dev://' : 'lpop://'}local/unknown`)
    })
  })

  describe('static methods', () => {
    describe('extractEnvironmentFromService', () => {
      test('should extract environment from service name', () => {
        const result = GitPathResolver.extractEnvironmentFromService(
          'lpop://loggipop/lpop?env=production'
        )

        expect(result).toBe('production')
      })

      test('should return null when no environment', () => {
        const result = GitPathResolver.extractEnvironmentFromService(
          'lpop://loggipop/lpop'
        )

        expect(result).toBeNull()
      })
    })

    describe('extractRepoFromService', () => {
      test('should extract repo from service name', () => {
        const result = GitPathResolver.extractRepoFromService(
          'lpop://loggipop/lpop'
        )

        expect(result).toBe('loggipop/lpop')
      })
    })
  })
})

describe('isDevelopment', () => {
  const originalArgv = process.argv
  const originalExecPath = process.execPath

  beforeEach(() => {
    process.argv = [...originalArgv]
    process.execPath = originalExecPath
  })

  afterEach(() => {
    process.argv = originalArgv
    process.execPath = originalExecPath
  })

  test('should return false when running as compiled binary', () => {
    process.execPath = '/usr/local/bin/lpop'

    expect(isDevelopment()).toBe(false)
  })

  test('should return false when running through node_modules', () => {
    process.argv[1] = '/path/to/project/node_modules/lpop/bin/lpop'

    expect(isDevelopment()).toBe(false)
  })

  test('should return true when running from source', () => {
    process.execPath = '/usr/local/bin/bun'
    process.argv[1] = '/path/to/project/src/index.ts'

    expect(isDevelopment()).toBe(true)
  })
})

describe('getServicePrefix', () => {
  test('should return correct prefix based on environment', () => {
    const originalIsDev = isDevelopment()
    const prefix = getServicePrefix()

    expect(prefix).toBe(originalIsDev ? 'lpop-dev://' : 'lpop://')
  })
})