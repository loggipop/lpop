import { describe, expect, test, beforeEach, mock } from 'bun:test'
import { KeychainManager } from './keychain-manager'
import { Entry, findCredentials, Credential } from '@napi-rs/keyring';


// Mock the @napi-rs/keyring module
const mockEntry = {
  setPassword: mock(() => { }),
  getPassword: mock(() => 'test-value'),
  deletePassword: mock(() => true),
}

const mockFindCredentials = mock<typeof findCredentials>((service: string, target?: string | undefined | null): Credential[] => [])

mock.module('@napi-rs/keyring', () => ({
  Entry: mock(() => mockEntry),
  findCredentials: mockFindCredentials,
}))

describe('KeychainManager', () => {
  let manager: KeychainManager

  beforeEach(() => {
    // Reset all mocks
    mockEntry.setPassword.mockClear()
    mockEntry.getPassword.mockClear()
    mockEntry.deletePassword.mockClear()
    mockFindCredentials.mockClear()
    mockFindCredentials.mockReturnValue([])

    manager = new KeychainManager('test-service', 'development')
  })

  describe('setPassword', () => {
    test('should set password with environment suffix', async () => {
      await manager.setPassword('TEST_KEY', 'test-value')

      expect(mockEntry.setPassword).toHaveBeenCalledWith('test-value')
    })

    test('should set password without environment suffix when no environment', async () => {
      manager = new KeychainManager('test-service')
      await manager.setPassword('TEST_KEY', 'test-value')

      expect(mockEntry.setPassword).toHaveBeenCalledWith('test-value')
    })
  })

  describe('getPassword', () => {
    test('should get password successfully', async () => {
      mockEntry.getPassword.mockReturnValue('test-value')

      const result = await manager.getPassword('TEST_KEY')

      expect(mockEntry.getPassword).toHaveBeenCalled()
      expect(result).toBe('test-value')
    })

    test('should return null on error', async () => {
      mockEntry.getPassword.mockImplementation(() => {
        throw new Error('Not found')
      })

      const result = await manager.getPassword('TEST_KEY')

      expect(result).toBeNull()
    })
  })

  describe('deletePassword', () => {
    test('should delete password successfully', async () => {
      mockEntry.deletePassword.mockReturnValue(true)

      const result = await manager.deletePassword('TEST_KEY')

      expect(mockEntry.deletePassword).toHaveBeenCalled()
      expect(result).toBe(true)
    })

    test('should return false on error', async () => {
      mockEntry.deletePassword.mockImplementation(() => {
        throw new Error('Not found')
      })

      const result = await manager.deletePassword('TEST_KEY')

      expect(result).toBe(false)
    })
  })

  describe('findCredentials', () => {
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
      manager = new KeychainManager('test-service')
      mockFindCredentials.mockReturnValue([
        { account: 'KEY1', password: 'generic-value' },
        { account: 'KEY1?env=development', password: 'dev-value' },
        { account: 'KEY2', password: 'generic-only' },
      ])

      const result = await manager.findCredentials()

      expect(result).toEqual([
        { account: 'KEY1', password: 'generic-value' },
        { account: 'KEY2', password: 'generic-only' },
      ])
    })
  })

  describe('setEnvironmentVariables', () => {
    test('should set multiple environment variables', async () => {
      const variables = [
        { key: 'KEY1', value: 'value1' },
        { key: 'KEY2', value: 'value2' },
      ]

      await manager.setEnvironmentVariables(variables)

      expect(mockEntry.setPassword).toHaveBeenCalledTimes(2)
      expect(mockEntry.setPassword).toHaveBeenNthCalledWith(1, 'value1')
      expect(mockEntry.setPassword).toHaveBeenNthCalledWith(2, 'value2')
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
      mockEntry.deletePassword.mockReturnValue(true)

      await manager.clearAllEnvironmentVariables()

      expect(mockEntry.deletePassword).toHaveBeenCalledTimes(2)
    })
  })
})