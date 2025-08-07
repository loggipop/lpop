import { describe, expect, test, beforeEach, vi } from 'vitest'

// Mock the module - this gets hoisted
vi.mock('@napi-rs/keyring')

// Import after mocking
import { KeychainManager } from './keychain-manager'
import { Entry, findCredentials } from '@napi-rs/keyring'

// Create mocked functions
const MockedEntry = vi.mocked(Entry)
const mockedFindCredentials = vi.mocked(findCredentials)

describe('KeychainManager', () => {
  let manager: KeychainManager
  let mockSetPassword: any
  let mockGetPassword: any
  let mockDeletePassword: any

  beforeEach(() => {
    // Clear all mock calls
    vi.clearAllMocks()

    // Set up mock functions
    mockSetPassword = vi.fn()
    mockGetPassword = vi.fn(() => 'test-value')
    mockDeletePassword = vi.fn(() => true)

    // Mock Entry constructor
    MockedEntry.mockImplementation((_service: string, _account: string) => ({
      setPassword: mockSetPassword,
      getPassword: mockGetPassword,
      deletePassword: mockDeletePassword,
    } as any))

    // Mock findCredentials
    mockedFindCredentials.mockReturnValue([])

    // Create new manager instance
    manager = new KeychainManager('test-service', 'development')
  })

  test('should set password with environment suffix', async () => {
    await manager.setPassword('TEST_KEY', 'test-value')

    expect(MockedEntry).toHaveBeenCalledWith('test-service', 'TEST_KEY?env=development')
    expect(mockSetPassword).toHaveBeenCalledWith('test-value')
  })

  test('should set password without environment suffix when no environment', async () => {
    const noEnvManager = new KeychainManager('test-service')
    await noEnvManager.setPassword('TEST_KEY', 'test-value')

    expect(MockedEntry).toHaveBeenCalledWith('test-service', 'TEST_KEY')
    expect(mockSetPassword).toHaveBeenCalledWith('test-value')
  })

  test('should get password successfully', async () => {
    mockGetPassword.mockReturnValue('test-value')

    const result = await manager.getPassword('TEST_KEY')

    expect(MockedEntry).toHaveBeenCalledWith('test-service', 'TEST_KEY?env=development')
    expect(mockGetPassword).toHaveBeenCalled()
    expect(result).toBe('test-value')
  })

  test('should return null on error', async () => {
    mockGetPassword.mockImplementation(() => {
      throw new Error('Not found')
    })

    const result = await manager.getPassword('TEST_KEY')

    expect(result).toBeNull()
  })

  test('should delete password successfully', async () => {
    mockDeletePassword.mockReturnValue(true)

    const result = await manager.deletePassword('TEST_KEY')

    expect(MockedEntry).toHaveBeenCalledWith('test-service', 'TEST_KEY?env=development')
    expect(mockDeletePassword).toHaveBeenCalled()
    expect(result).toBe(true)
  })

  test('should return false on error', async () => {
    mockDeletePassword.mockImplementation(() => {
      throw new Error('Not found')
    })

    const result = await manager.deletePassword('TEST_KEY')

    expect(result).toBe(false)
  })

  test('should prioritize environment-specific credentials', async () => {
    mockedFindCredentials.mockReturnValue([
      { account: 'KEY1', password: 'generic-value' },
      { account: 'KEY1?env=development', password: 'dev-value' },
      { account: 'KEY1?env=production', password: 'prod-value' },
      { account: 'KEY2?env=development', password: 'dev-only' },
      { account: 'KEY3', password: 'generic-only' },
    ])

    const result = await manager.findServiceCredentials()

    expect(mockedFindCredentials).toHaveBeenCalledWith('test-service')
    expect(result).toEqual([
      { account: 'KEY1', password: 'dev-value' },
      { account: 'KEY2', password: 'dev-only' },
      { account: 'KEY3', password: 'generic-only' },
    ])
  })

  test('should return all generic credentials when no environment specified', async () => {
    const noEnvManager = new KeychainManager('test-service')
    mockedFindCredentials.mockReturnValue([
      { account: 'KEY1', password: 'generic-value' },
      { account: 'KEY1?env=development', password: 'dev-value' },
      { account: 'KEY2', password: 'generic-only' },
    ])

    const result = await noEnvManager.findServiceCredentials()

    expect(result).toEqual([
      { account: 'KEY1', password: 'generic-value' },
      { account: 'KEY2', password: 'generic-only' },
    ])
  })

  describe('setEnvironmentVariables', () => {
    test('should set multiple environment variables', async () => {
      const variables = [
        { key: 'KEY1', value: 'value1' },
        { key: 'KEY2', value: 'value2' },
      ]

      await manager.setEnvironmentVariables(variables)

      expect(mockSetPassword).toHaveBeenCalledTimes(2)
      expect(mockSetPassword).toHaveBeenNthCalledWith(1, 'value1')
      expect(mockSetPassword).toHaveBeenNthCalledWith(2, 'value2')
    })
  })

  describe('getEnvironmentVariables', () => {
    test('should return all environment variables', async () => {
      mockedFindCredentials.mockReturnValue([
        { account: 'KEY1?env=development', password: 'value1' },
        { account: 'KEY2?env=development', password: 'value2' },
      ])

      const result = await manager.getEnvironmentVariables()

      expect(result).toEqual([
        { key: 'KEY1', value: 'value1' },
        { key: 'KEY2', value: 'value2' },
      ])
    })
  })

  describe('clearAllEnvironmentVariables', () => {
    test('should delete all environment variables', async () => {
      mockedFindCredentials.mockReturnValue([
        { account: 'KEY1?env=development', password: 'value1' },
        { account: 'KEY2?env=development', password: 'value2' },
      ])
      mockDeletePassword.mockReturnValue(true)

      await manager.clearAllEnvironmentVariables()

      expect(mockDeletePassword).toHaveBeenCalledTimes(2)
    })
  })
})