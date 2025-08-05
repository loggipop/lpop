import { describe, expect, test, beforeEach, afterEach, mock, spyOn } from 'bun:test'
import { LpopCLI } from './cli'
import { KeychainManager } from './keychain-manager'
import { GitPathResolver, getServicePrefix } from './git-path-resolver'
import { EnvFileParser, ParsedEnvFile } from './env-file-parser'
import { existsSync } from 'fs'

// Mock modules
const mockKeychainManager = {
  setEnvironmentVariables: mock(() => Promise.resolve()),
  getEnvironmentVariables: mock(() => Promise.resolve([])),
  removeEnvironmentVariable: mock(() => Promise.resolve(true)),
  clearAllEnvironmentVariables: mock(() => Promise.resolve()),
}

const mockGitResolver = {
  generateServiceNameAsync: mock(() => Promise.resolve('lpop://test/repo')),
}

const mockExistsSync = mock(() => false)

mock.module('./keychain-manager', () => ({
  KeychainManager: mock((): KeychainManager => mockKeychainManager as any),
}))

mock.module('./git-path-resolver', () => ({
  GitPathResolver: mock(() => mockGitResolver),
  getServicePrefix: mock(() => 'lpop://'),
  isDevelopment: mock(() => false),
}))

mock.module('./env-file-parser', () => ({
  EnvFileParser: {
    parseFile: mock<typeof EnvFileParser.parseFile>((filePath: string) => Promise.resolve({ entries: [], comments: [], originalContent: '' })),
    parseVariable: mock(() => ({ key: 'KEY1', value: 'value1' })),
    writeFile: mock(() => Promise.resolve()),
  },
}))

mock.module('fs', () => ({
  existsSync: mockExistsSync,
}))

// Mock chalk
mock.module('chalk', () => ({
  default: {
    blue: (text: string) => text,
    green: (text: string) => text,
    yellow: (text: string) => text,
    red: (text: string) => text,
  },
}))

describe('LpopCLI', () => {
  let cli: LpopCLI
  let originalConsoleLog: typeof console.log
  let originalConsoleError: typeof console.error
  let originalProcessExit: typeof process.exit

  beforeEach(() => {
    // Reset process.argv
    process.argv = ['node', 'lpop']

    // Mock console
    originalConsoleLog = console.log
    originalConsoleError = console.error
    console.log = mock(() => { })
    console.error = mock(() => { })

    // Mock process.exit
    originalProcessExit = process.exit
    process.exit = mock(() => { }) as any

    // Reset all mocks
    mockKeychainManager.setEnvironmentVariables.mockClear()
    mockKeychainManager.getEnvironmentVariables.mockClear()
    mockKeychainManager.removeEnvironmentVariable.mockClear()
    mockKeychainManager.clearAllEnvironmentVariables.mockClear()
    mockGitResolver.generateServiceNameAsync.mockClear()
    mockExistsSync.mockClear()
  })

  afterEach(() => {
    console.log = originalConsoleLog
    console.error = originalConsoleError
    process.exit = originalProcessExit
  })

  describe('smart command', () => {
    test('should handle get when no input provided', async () => {
      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([
        { key: 'KEY1', value: 'value1' },
      ])

      process.argv = ['node', 'lpop']
      cli = new LpopCLI()
      await cli.run()

      expect(mockKeychainManager.getEnvironmentVariables).toHaveBeenCalled()
      expect(console.log).toHaveBeenCalledWith('KEY1=value1')
    })

    test('should handle add when file exists', async () => {
      mockExistsSync.mockReturnValue(true)
      EnvFileParser.parseFile = mock<typeof EnvFileParser.parseFile>((filePath: string): Promise<ParsedEnvFile> => Promise.resolve({
        entries: [{ key: 'KEY1', value: 'value1' }],
        comments: [],
        originalContent: '',
      }))

      process.argv = ['node', 'lpop', '.env']
      cli = new LpopCLI()
      await cli.run()

      expect(console.log).toHaveBeenCalledWith('File .env found, adding/updating variables...')
      expect(mockKeychainManager.setEnvironmentVariables).toHaveBeenCalled()
    })

    test('should handle add when input contains equals', async () => {
      mockExistsSync.mockReturnValue(false)
      EnvFileParser.parseVariable = mock(() => ({
        key: 'KEY1',
        value: 'value1',
      }))

      process.argv = ['node', 'lpop', 'KEY1=value1']
      cli = new LpopCLI()
      await cli.run()

      expect(console.log).toHaveBeenCalledWith('Variable assignment detected, adding/updating...')
      expect(mockKeychainManager.setEnvironmentVariables).toHaveBeenCalled()
    })
  })

  describe('add command', () => {
    test('should add variables from file', async () => {
      mockExistsSync.mockReturnValue(true)
      EnvFileParser.parseFile = mock(() => Promise.resolve({
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

      expect(EnvFileParser.parseFile).toHaveBeenCalledWith('.env')
      expect(mockKeychainManager.setEnvironmentVariables).toHaveBeenCalledWith([
        { key: 'KEY1', value: 'value1' },
        { key: 'KEY2', value: 'value2' },
      ])
      expect(console.log).toHaveBeenCalledWith('✓ Added 2 variables to lpop://test/repo')
    })

    test('should add single variable', async () => {
      mockExistsSync.mockReturnValue(false)
      EnvFileParser.parseVariable = mock(() => ({
        key: 'KEY1',
        value: 'value1',
      }))

      process.argv = ['node', 'lpop', 'add', 'KEY1=value1']
      cli = new LpopCLI()
      await cli.run()

      expect(EnvFileParser.parseVariable).toHaveBeenCalledWith('KEY1=value1')
      expect(mockKeychainManager.setEnvironmentVariables).toHaveBeenCalledWith([
        { key: 'KEY1', value: 'value1' },
      ])
    })
  })

  describe('get command', () => {
    test('should get all variables', async () => {
      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([
        { key: 'KEY1', value: 'value1' },
        { key: 'KEY2', value: 'value2' },
      ])

      process.argv = ['node', 'lpop', 'get']
      cli = new LpopCLI()
      await cli.run()

      expect(console.log).toHaveBeenCalledWith('Environment variables for lpop://test/repo:')
      expect(console.log).toHaveBeenCalledWith('KEY1=value1')
      expect(console.log).toHaveBeenCalledWith('KEY2=value2')
    })

    test('should get specific variable', async () => {
      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([
        { key: 'KEY1', value: 'value1' },
        { key: 'KEY2', value: 'value2' },
      ])

      process.argv = ['node', 'lpop', 'get', 'KEY1']
      cli = new LpopCLI()
      await cli.run()

      expect(console.log).toHaveBeenCalledWith('KEY1=value1')
    })

    test('should show message when no variables found', async () => {
      mockKeychainManager.getEnvironmentVariables.mockResolvedValue([])

      process.argv = ['node', 'lpop', 'get']
      cli = new LpopCLI()
      await cli.run()

      expect(console.log).toHaveBeenCalledWith('No variables found for lpop://test/repo')
    })
  })

  describe('remove command', () => {
    test('should remove variable successfully', async () => {
      mockKeychainManager.removeEnvironmentVariable.mockResolvedValue(true)

      process.argv = ['node', 'lpop', 'remove', 'KEY1']
      cli = new LpopCLI()
      await cli.run()

      expect(mockKeychainManager.removeEnvironmentVariable).toHaveBeenCalledWith('KEY1')
      expect(console.log).toHaveBeenCalledWith('✓ Removed variable KEY1 from lpop://test/repo')
    })

    test('should show message when variable not found', async () => {
      mockKeychainManager.removeEnvironmentVariable.mockResolvedValue(false)

      process.argv = ['node', 'lpop', 'remove', 'KEY1']
      cli = new LpopCLI()
      await cli.run()

      expect(console.log).toHaveBeenCalledWith('Variable KEY1 not found in lpop://test/repo')
    })
  })

  describe('clear command', () => {
    test('should show warning without confirm flag', async () => {
      process.argv = ['node', 'lpop', 'clear']
      cli = new LpopCLI()
      await cli.run()

      expect(console.log).toHaveBeenCalledWith('This will remove ALL environment variables for lpop://test/repo')
      expect(console.log).toHaveBeenCalledWith('Use --confirm to skip this warning')
      expect(mockKeychainManager.clearAllEnvironmentVariables).not.toHaveBeenCalled()
    })

    test('should clear all variables with confirm flag', async () => {
      process.argv = ['node', 'lpop', 'clear', '--confirm']
      cli = new LpopCLI()
      await cli.run()

      expect(mockKeychainManager.clearAllEnvironmentVariables).toHaveBeenCalled()
      expect(console.log).toHaveBeenCalledWith('✓ Cleared all variables for lpop://test/repo')
    })
  })

  describe('list command', () => {
    test('should show limitation message', async () => {
      process.argv = ['node', 'lpop', 'list']
      cli = new LpopCLI()
      await cli.run()

      expect(console.log).toHaveBeenCalledWith('Listing stored repositories:')
      expect(console.log).toHaveBeenCalledWith('Note: Due to keychain limitations, this requires knowing service names.')
    })
  })

  describe('error handling', () => {
    test('should handle errors gracefully', async () => {
      mockKeychainManager.getEnvironmentVariables.mockRejectedValue(new Error('Test error'))

      process.argv = ['node', 'lpop', 'get']
      cli = new LpopCLI()
      await cli.run()

      expect(console.error).toHaveBeenCalledWith('Error getting variables: Test error')
      expect(process.exit).toHaveBeenCalledWith(1)
    })
  })
})