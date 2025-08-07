import { describe, expect, test, beforeEach } from 'vitest'
import { MemoryKeychainManager } from './memory-keychain-manager'
import { clearStorage } from './fake-keyring'

// This test file uses the REAL fake-keyring module, not mocks
// to verify the difference in behavior

describe('MemoryKeychainManager WITHOUT MOCKS', () => {
  let manager: MemoryKeychainManager

  beforeEach(() => {
    // Clear the in-memory storage
    clearStorage()
    manager = new MemoryKeychainManager('test-service', 'development')
  })

  test('Real module: getPassword returns null for non-existent key', async () => {
    // With real module, this should return null since nothing was stored
    const result = await manager.getPassword('NONEXISTENT_KEY')
    expect(result).toBeNull()
  })

  test('Real module: findCredentials returns empty array initially', async () => {
    // With real module, storage starts empty
    const result = await manager.findCredentials()
    expect(result).toEqual([])
  })

  test('Real module: can actually store and retrieve data', async () => {
    // With real module, we can store and retrieve
    await manager.setPassword('REAL_KEY', 'REAL_VALUE')
    const result = await manager.getPassword('REAL_KEY')
    expect(result).toBe('REAL_VALUE')
  })

  test('Real module: findCredentials returns stored data', async () => {
    await manager.setPassword('KEY1', 'VALUE1')
    await manager.setPassword('KEY2', 'VALUE2')
    
    const result = await manager.findCredentials()
    expect(result).toHaveLength(2)
    expect(result.find(c => c.account === 'KEY1')?.password).toBe('VALUE1')
    expect(result.find(c => c.account === 'KEY2')?.password).toBe('VALUE2')
  })
})