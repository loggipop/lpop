import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest'

// Mock the modules - these get hoisted
vi.mock('./keychain-manager')
vi.mock('./git-path-resolver')
vi.mock('./env-file-parser')
vi.mock('fs')
vi.mock('chalk', () => ({
  default: {
    blue: (text: string) => text,
    green: (text: string) => text,
    yellow: (text: string) => text,
    red: (text: string) => text,
  },
}))

import { LpopCLI } from './cli'
import { KeychainEntry, KeychainManager } from './keychain-manager'
import { GitPathResolver, getServicePrefix } from './git-path-resolver'
import { EnvFileParser, ParsedEnvFile } from './env-file-parser'
import { existsSync } from 'fs'

// Create mocked functions
const mockedExistsSync = vi.mocked(existsSync)
const mockedKeychainManager = vi.mocked(KeychainManager)
const mockedGitPathResolver = vi.mocked(GitPathResolver)
const mockedEnvFileParser = vi.mocked(EnvFileParser)
const mockedGetServicePrefix = vi.mocked(getServicePrefix)

describe('LpopCLI', () => {
  let cli: LpopCLI
  let originalConsoleLog: typeof console.log
  let originalConsoleError: typeof console.error
  let originalProcessExit: typeof process.exit
  let mockKeychainInstance: any
  let mockGitResolverInstance: any

  beforeEach(() => {
    // Reset process.argv
    process.argv = ['node', 'lpop']

    // Mock console
    originalConsoleLog = console.log
    originalConsoleError = console.error
    console.log = vi.fn()
    console.error = vi.fn()

    // Mock process.exit
    originalProcessExit = process.exit
    process.exit = vi.fn() as any

    // Reset all mocks
    vi.clearAllMocks()

    // Set up mock instances
    mockKeychainInstance = {
      setEnvironmentVariables: vi.fn(() => Promise.resolve()),
      getEnvironmentVariables: vi.fn(() => Promise.resolve([])),
      removeEnvironmentVariable: vi.fn(() => Promise.resolve(true)),
      clearAllEnvironmentVariables: vi.fn(() => Promise.resolve()),
    }

    mockGitResolverInstance = {
      generateServiceNameAsync: vi.fn(() => Promise.resolve('lpop://test/repo')),
    }

    // Configure mocks
    mockedKeychainManager.mockReturnValue(mockKeychainInstance)
    mockedGitPathResolver.mockReturnValue(mockGitResolverInstance)
    mockedGetServicePrefix.mockReturnValue('lpop://')
    mockedExistsSync.mockReturnValue(false)

    // Configure EnvFileParser static methods
    mockedEnvFileParser.parseFile = vi.fn(() => Promise.resolve({ 
      entries: [], 
      comments: [], 
      originalContent: '' 
    }))
    mockedEnvFileParser.parseVariable = vi.fn(() => ({ 
      key: 'KEY1', 
      value: 'value1' 
    }))
    mockedEnvFileParser.writeFile = vi.fn(() => Promise.resolve())
  })

  afterEach(() => {
    console.log = originalConsoleLog
    console.error = originalConsoleError
    process.exit = originalProcessExit
  })

  describe('smart command', () => {
    test('should handle get when no input provided', async () => {
      mockKeychainInstance.getEnvironmentVariables.mockResolvedValue([
        { key: 'KEY1', value: 'value1' },
      ])

      process.argv = ['node', 'lpop']
      cli = new LpopCLI()
      await cli.run()

      expect(mockKeychainInstance.getEnvironmentVariables).toHaveBeenCalled()
      expect(console.log).toHaveBeenCalledWith('KEY1=value1')
    })

    test('should handle add when file exists', async () => {
      mockedExistsSync.mockReturnValue(true)
      mockedEnvFileParser.parseFile = vi.fn(() => Promise.resolve({
        entries: [{ key: 'KEY1', value: 'value1' }],
        comments: [],
        originalContent: '',
      }))

      process.argv = ['node', 'lpop', '.env']
      cli = new LpopCLI()
      await cli.run()

      expect(console.log).toHaveBeenCalledWith('File .env found, adding/updating variables...')
      expect(mockKeychainInstance.setEnvironmentVariables).toHaveBeenCalled()
    })

    test('should handle add when input contains equals', async () => {
      mockedExistsSync.mockReturnValue(false)
      mockedEnvFileParser.parseVariable = vi.fn(() => ({
        key: 'KEY1',
        value: 'value1',
      }))

      process.argv = ['node', 'lpop', 'KEY1=value1']
      cli = new LpopCLI()
      await cli.run()

      expect(console.log).toHaveBeenCalledWith('Variable assignment detected, adding/updating...')
      expect(mockKeychainInstance.setEnvironmentVariables).toHaveBeenCalled()
    })
  })

  describe('add command', () => {
    test('should add variables from file', async () => {
      mockedExistsSync.mockReturnValue(true)
      mockedEnvFileParser.parseFile = vi.fn(() => Promise.resolve({
        entries: [
          { key: 'KEY1', value: 'value1' },
          { key: 'KEY2', value: 'value2' },
        ],
        comments: [],
        originalContent: '',
      }))

      process.argv = ['node', 'lpop', 'add', '.env']
      cli = new LpopCLI()
      await cli.run()

      expect(mockedEnvFileParser.parseFile).toHaveBeenCalledWith('.env')
      expect(mockKeychainInstance.setEnvironmentVariables).toHaveBeenCalledWith([
        { key: 'KEY1', value: 'value1' },
        { key: 'KEY2', value: 'value2' },
      ])
    })

    test('should add single variable', async () => {
      mockedEnvFileParser.parseVariable = vi.fn(() => ({
        key: 'KEY1',
        value: 'value1',
      }))

      process.argv = ['node', 'lpop', 'add', 'KEY1=value1']
      cli = new LpopCLI()
      await cli.run()

      expect(mockKeychainInstance.setEnvironmentVariables).toHaveBeenCalledWith([
        { key: 'KEY1', value: 'value1' },
      ])
    })
  })

  describe('get command', () => {
    test('should get all variables', async () => {
      mockKeychainInstance.getEnvironmentVariables.mockResolvedValue([
        { key: 'KEY1', value: 'value1' },
        { key: 'KEY2', value: 'value2' },
      ])

      process.argv = ['node', 'lpop', 'get']
      cli = new LpopCLI()
      await cli.run()

      expect(console.log).toHaveBeenCalledWith('KEY1=value1')
      expect(console.log).toHaveBeenCalledWith('KEY2=value2')
    })

    test('should handle environment option', async () => {
      process.argv = ['node', 'lpop', 'get', '-e', 'production']
      cli = new LpopCLI()
      await cli.run()

      expect(mockedKeychainManager).toHaveBeenCalledWith('lpop://test/repo', 'production')
    })
  })

  describe('remove command', () => {
    test('should remove variable', async () => {
      mockKeychainInstance.removeEnvironmentVariable.mockResolvedValue(true)

      process.argv = ['node', 'lpop', 'remove', 'KEY1']
      cli = new LpopCLI()
      await cli.run()

      expect(mockKeychainInstance.removeEnvironmentVariable).toHaveBeenCalledWith('KEY1')
      expect(console.log).toHaveBeenCalledWith('Variable KEY1 removed successfully!')
    })

    test('should handle removal failure', async () => {
      mockKeychainInstance.removeEnvironmentVariable.mockResolvedValue(false)

      process.argv = ['node', 'lpop', 'remove', 'KEY1']
      cli = new LpopCLI()
      await cli.run()

      expect(console.log).toHaveBeenCalledWith('Variable KEY1 not found.')
    })
  })

  describe('clear command', () => {
    test('should clear all variables', async () => {
      process.argv = ['node', 'lpop', 'clear']
      cli = new LpopCLI()
      await cli.run()

      expect(mockKeychainInstance.clearAllEnvironmentVariables).toHaveBeenCalled()
      expect(console.log).toHaveBeenCalledWith('All variables cleared successfully!')
    })
  })

  describe('restore command', () => {
    test('should restore variables to .env file', async () => {
      mockKeychainInstance.getEnvironmentVariables.mockResolvedValue([
        { key: 'KEY1', value: 'value1' },
        { key: 'KEY2', value: 'value2' },
      ])

      process.argv = ['node', 'lpop', 'restore', '.env']
      cli = new LpopCLI()
      await cli.run()

      expect(mockedEnvFileParser.writeFile).toHaveBeenCalledWith('.env', [
        { key: 'KEY1', value: 'value1' },
        { key: 'KEY2', value: 'value2' },
      ])
      expect(console.log).toHaveBeenCalledWith('Variables restored to .env successfully!')
    })
  })
})