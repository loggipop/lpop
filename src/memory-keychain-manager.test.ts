import { describe, expect, test, beforeEach, mock } from 'bun:test'

// Set up mocks before any imports
const mockSetPassword = mock(() => { })
const mockGetPassword = mock(() => 'test-value')
const mockDeletePassword = mock(() => true)
const mockFindCredentials = mock((_service: string): any[] => [])

// Mock the Entry constructor
const MockEntry = mock((_service: string, _account: string) => ({
  setPassword: mockSetPassword,
  getPassword: mockGetPassword,
  deletePassword: mockDeletePassword,
}))

// Mock the module
mock.module('./fake-keyring', () => ({
  Entry: MockEntry,
  findCredentials: mockFindCredentials,
}))

// Import after mocking
import { MemoryKeychainManager } from './memory-keychain-manager'

describe('MemoryKeychainManager', () => {
  let manager: MemoryKeychainManager

  beforeEach(() => {
    // Clear all mock calls
    mockSetPassword.mockClear()
    mockGetPassword.mockClear()
    mockDeletePassword.mockClear()
    mockFindCredentials.mockClear()
    MockEntry.mockClear()
    
    // Reset mock return values
    mockGetPassword.mockReturnValue('test-value')
    mockDeletePassword.mockReturnValue(true)
    mockFindCredentials.mockReturnValue([])
    
    // Create new manager instance
    manager = new MemoryKeychainManager('test-service', 'development')
  })

  test('should set password with environment suffix', async () => {
    await manager.setPassword('TEST_KEY', 'test-value')

    expect(MockEntry).toHaveBeenCalledWith('test-service', 'TEST_KEY?env=development')
    expect(mockSetPassword).toHaveBeenCalledWith('test-value')
  })

  test('should set password without environment suffix when no environment', async () => {
    const noEnvManager = new MemoryKeychainManager('test-service')
    await noEnvManager.setPassword('TEST_KEY', 'test-value')

    expect(MockEntry).toHaveBeenCalledWith('test-service', 'TEST_KEY')
    expect(mockSetPassword).toHaveBeenCalledWith('test-value')
  })

  test('should get password successfully', async () => {
    mockGetPassword.mockReturnValue('test-value')

    const result = await manager.getPassword('TEST_KEY')

    expect(MockEntry).toHaveBeenCalledWith('test-service', 'TEST_KEY?env=development')
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

    expect(MockEntry).toHaveBeenCalledWith('test-service', 'TEST_KEY?env=development')
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
    mockFindCredentials.mockReturnValue([
      { account: 'KEY1', password: 'generic-value' },
      { account: 'KEY1?env=development', password: 'dev-value' },
      { account: 'KEY1?env=production', password: 'prod-value' },
      { account: 'KEY2?env=development', password: 'dev-only' },
      { account: 'KEY3', password: 'generic-only' },
    ])

    const result = await manager.findCredentials()

    expect(mockFindCredentials).toHaveBeenCalledWith('test-service')
    expect(result).toEqual([
      { account: 'KEY1', password: 'dev-value' },
      { account: 'KEY2', password: 'dev-only' },
      { account: 'KEY3', password: 'generic-only' },
    ])
  })

  test('should return all generic credentials when no environment specified', async () => {
    const noEnvManager = new MemoryKeychainManager('test-service')
    mockFindCredentials.mockReturnValue([
      { account: 'KEY1', password: 'generic-value' },
      { account: 'KEY1?env=development', password: 'dev-value' },
      { account: 'KEY2', password: 'generic-only' },
    ])

    const result = await noEnvManager.findCredentials()

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
      mockFindCredentials.mockReturnValue([
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
      mockFindCredentials.mockReturnValue([
        { account: 'KEY1?env=development', password: 'value1' },
        { account: 'KEY2?env=development', password: 'value2' },
      ])
      mockDeletePassword.mockReturnValue(true)

      await manager.clearAllEnvironmentVariables()

      expect(mockDeletePassword).toHaveBeenCalledTimes(2)
    })
  })
})