import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest'

// Mock the modules - these get hoisted
vi.mock('simple-git')
vi.mock('git-url-parse')

import { GitPathResolver, isDevelopment, getServicePrefix } from './git-path-resolver'
import { RemoteWithoutRefs, RemoteWithRefs, simpleGit } from 'simple-git'
import GitUrlParse from 'git-url-parse'

// Create mocked functions
const mockedSimpleGit = vi.mocked(simpleGit)
const mockedGitUrlParse = vi.mocked(GitUrlParse)

describe('GitPathResolver', () => {
  let resolver: GitPathResolver
  let mockGit: any

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Set up git mock
    mockGit = {
      status: vi.fn(() => Promise.resolve({})),
      getRemotes: vi.fn((): Promise<RemoteWithoutRefs[]> => Promise.resolve([])),
    }

    mockedSimpleGit.mockReturnValue(mockGit)
    
    // Set up GitUrlParse mock
    mockedGitUrlParse.mockReturnValue({
      owner: 'loggipop',
      name: 'lpop',
      full_name: 'loggipop/lpop',
    } as any)

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
      expect(mockGit.status).toHaveBeenCalled()
    })
  })

  describe('getRemoteUrl', () => {
    test('should return origin remote URL', async () => {
      const remotes: RemoteWithoutRefs[] = [
        { name: 'origin', refs: { fetch: 'https://github.com/loggipop/lpop.git', push: 'https://github.com/loggipop/lpop.git' } },
        { name: 'upstream', refs: { fetch: 'https://github.com/upstream/repo.git', push: 'https://github.com/upstream/repo.git' } },
      ]
      mockGit.getRemotes.mockResolvedValue(remotes)

      const result = await resolver.getRemoteUrl()

      expect(result).toBe('https://github.com/loggipop/lpop.git')
      expect(mockGit.getRemotes).toHaveBeenCalledWith(true)
    })

    test('should return first remote URL when no origin', async () => {
      const remotes: RemoteWithoutRefs[] = [
        { name: 'upstream', refs: { fetch: 'https://github.com/upstream/repo.git', push: 'https://github.com/upstream/repo.git' } },
        { name: 'fork', refs: { fetch: 'https://github.com/fork/repo.git', push: 'https://github.com/fork/repo.git' } },
      ]
      mockGit.getRemotes.mockResolvedValue(remotes)

      const result = await resolver.getRemoteUrl()

      expect(result).toBe('https://github.com/upstream/repo.git')
    })

    test('should return null when no remotes', async () => {
      mockGit.getRemotes.mockResolvedValue([])

      const result = await resolver.getRemoteUrl()

      expect(result).toBeNull()
    })
  })

  describe('generateServiceNameFromRemote', () => {
    test('should generate service name from GitHub URL', () => {
      const result = resolver.generateServiceNameFromRemote('https://github.com/loggipop/lpop.git')

      expect(mockedGitUrlParse).toHaveBeenCalledWith('https://github.com/loggipop/lpop.git')
      expect(result).toBe('lpop://github.com/loggipop/lpop')
    })

    test('should use fallback for invalid URL', () => {
      mockedGitUrlParse.mockImplementation(() => {
        throw new Error('Invalid URL')
      })

      const result = resolver.generateServiceNameFromRemote('invalid-url')

      expect(result).toBe('lpop://local/test')
    })
  })

  describe('generateServiceNameAsync', () => {
    test('should generate service name from git repository', async () => {
      mockGit.status.mockResolvedValue({})
      mockGit.getRemotes.mockResolvedValue([
        { name: 'origin', refs: { fetch: 'https://github.com/loggipop/lpop.git', push: 'https://github.com/loggipop/lpop.git' } },
      ])

      const result = await resolver.generateServiceNameAsync()

      expect(result).toBe('lpop://github.com/loggipop/lpop')
    })

    test('should use local fallback when not a git repository', async () => {
      mockGit.status.mockRejectedValue(new Error('Not a git repository'))

      const result = await resolver.generateServiceNameAsync()

      expect(result).toBe('lpop://local/test')
    })

    test('should use local fallback when no remotes', async () => {
      mockGit.status.mockResolvedValue({})
      mockGit.getRemotes.mockResolvedValue([])

      const result = await resolver.generateServiceNameAsync()

      expect(result).toBe('lpop://local/test')
    })
  })

  describe('helper functions', () => {
    let originalEnv: NodeJS.ProcessEnv

    beforeEach(() => {
      originalEnv = process.env
      process.env = { ...originalEnv }
    })

    afterEach(() => {
      process.env = originalEnv
    })

    test('isDevelopment should detect development environment', () => {
      process.env.NODE_ENV = 'development'
      expect(isDevelopment()).toBe(true)

      process.env.NODE_ENV = 'production'
      expect(isDevelopment()).toBe(false)

      delete process.env.NODE_ENV
      expect(isDevelopment()).toBe(false)
    })

    test('getServicePrefix should return correct prefix', () => {
      process.env.NODE_ENV = 'development'
      expect(getServicePrefix()).toBe('lpop-dev://')

      process.env.NODE_ENV = 'production'
      expect(getServicePrefix()).toBe('lpop://')
    })
  })
})