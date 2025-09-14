import { beforeEach, describe, expect, test } from 'bun:test';
import { KeychainManager } from '../src/keychain-manager';
import { mockEntry, mockFindCredentials } from './setup';

describe('KeychainManager', () => {
  let manager: KeychainManager;

  beforeEach(() => {
    // Reset all mocks
    mockEntry.setPassword.mockReset();
    mockEntry.getPassword.mockReset();
    mockEntry.deletePassword.mockReset();
    mockFindCredentials.mockReset();

    manager = new KeychainManager('test-service', 'development');
  });

  describe('constructor', () => {
    test('should create instance with service name and environment', () => {
      const mgr = new KeychainManager('my-service', 'production');
      expect(mgr).toBeDefined();
    });

    test('should create instance without environment', () => {
      const mgr = new KeychainManager('my-service');
      expect(mgr).toBeDefined();
    });
  });

  describe('setPassword', () => {
    test('should set password with environment suffix', async () => {
      await manager.setPassword('API_KEY', 'secret123');

      expect(mockEntry.setPassword).toHaveBeenCalledWith('secret123');
    });

    test('should set password without environment suffix when no environment', async () => {
      const noEnvManager = new KeychainManager('test-service');
      await noEnvManager.setPassword('API_KEY', 'secret123');

      expect(mockEntry.setPassword).toHaveBeenCalledWith('secret123');
    });
  });

  describe('getPassword', () => {
    test('should get password successfully', async () => {
      mockEntry.getPassword.mockReturnValue('secret123');

      const result = await manager.getPassword('API_KEY');

      expect(mockEntry.getPassword).toHaveBeenCalled();
      expect(result).toBe('secret123');
    });

    test('should return null when password not found', async () => {
      mockEntry.getPassword.mockImplementation(() => {
        throw new Error('Not found');
      });

      const result = await manager.getPassword('MISSING_KEY');

      expect(result).toBeNull();
    });
  });

  describe('deletePassword', () => {
    test('should delete password successfully', async () => {
      mockEntry.deletePassword.mockReturnValue(true);

      const result = await manager.deletePassword('API_KEY');

      expect(mockEntry.deletePassword).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    test('should return false when deletion fails', async () => {
      mockEntry.deletePassword.mockImplementation(() => {
        throw new Error('Delete failed');
      });

      const result = await manager.deletePassword('API_KEY');

      expect(result).toBe(false);
    });
  });

  describe('findCredentials', () => {
    test('should prioritize environment-specific credentials', async () => {
      mockFindCredentials.mockReturnValue([
        { account: 'API_KEY', password: 'generic-value' },
        { account: 'API_KEY?env=development', password: 'dev-value' },
        { account: 'API_KEY?env=production', password: 'prod-value' },
        { account: 'DB_URL?env=development', password: 'dev-db' },
      ]);

      const result = await manager.findServiceCredentials();

      expect(mockFindCredentials).toHaveBeenCalledWith('test-service');
      expect(result).toEqual([
        { account: 'API_KEY', password: 'dev-value' },
        { account: 'DB_URL', password: 'dev-db' },
      ]);
    });

    test('should use generic credentials when no environment-specific ones exist', async () => {
      mockFindCredentials.mockReturnValue([
        { account: 'API_KEY', password: 'generic-value' },
        { account: 'DB_URL?env=production', password: 'prod-db' },
      ]);

      const result = await manager.findServiceCredentials();

      expect(result).toEqual([
        { account: 'API_KEY', password: 'generic-value' },
      ]);
    });

    test('should return empty array when no credentials found', async () => {
      mockFindCredentials.mockReturnValue([]);

      const result = await manager.findServiceCredentials();

      expect(result).toEqual([]);
    });

    test('should handle credentials without environment', async () => {
      const noEnvManager = new KeychainManager('test-service');
      mockFindCredentials.mockReturnValue([
        { account: 'API_KEY', password: 'value1' },
        { account: 'DB_URL', password: 'value2' },
      ]);

      const result = await noEnvManager.findServiceCredentials();

      expect(result).toEqual([
        { account: 'API_KEY', password: 'value1' },
        { account: 'DB_URL', password: 'value2' },
      ]);
    });
  });

  describe('setEnvironmentVariables', () => {
    test('should set multiple environment variables', async () => {
      const variables = [
        { key: 'API_KEY', value: 'secret1' },
        { key: 'DB_URL', value: 'postgres://localhost' },
      ];

      await manager.setEnvironmentVariables(variables);

      expect(mockEntry.setPassword).toHaveBeenCalledTimes(2);
      expect(mockEntry.setPassword).toHaveBeenCalledWith('secret1');
      expect(mockEntry.setPassword).toHaveBeenCalledWith(
        'postgres://localhost',
      );
    });

    test('should handle empty array', async () => {
      await manager.setEnvironmentVariables([]);

      expect(mockEntry.setPassword).not.toHaveBeenCalled();
    });
  });

  describe('getEnvironmentVariables', () => {
    test('should return all environment variables', async () => {
      mockFindCredentials.mockReturnValue([
        { account: 'API_KEY?env=development', password: 'secret1' },
        { account: 'DB_URL', password: 'postgres://localhost' },
      ]);

      const result = await manager.getEnvironmentVariables();

      expect(result).toEqual([
        { key: 'API_KEY', value: 'secret1' },
        { key: 'DB_URL', value: 'postgres://localhost' },
      ]);
    });

    test('should return empty array when no variables found', async () => {
      mockFindCredentials.mockReturnValue([]);

      const result = await manager.getEnvironmentVariables();

      expect(result).toEqual([]);
    });
  });

  describe('removeEnvironmentVariable', () => {
    test('should remove environment variable', async () => {
      mockEntry.deletePassword.mockReturnValue(true);

      const result = await manager.removeEnvironmentVariable('API_KEY');

      expect(mockEntry.deletePassword).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('updateEnvironmentVariable', () => {
    test('should update environment variable', async () => {
      await manager.updateEnvironmentVariable('API_KEY', 'new-secret');

      expect(mockEntry.setPassword).toHaveBeenCalledWith('new-secret');
    });
  });

  describe('clearAllEnvironmentVariables', () => {
    test('should clear all environment variables', async () => {
      mockFindCredentials.mockReturnValue([
        { account: 'API_KEY?env=development', password: 'secret1' },
        { account: 'DB_URL', password: 'postgres://localhost' },
      ]);
      mockEntry.deletePassword.mockReturnValue(true);

      await manager.clearAllEnvironmentVariables();

      expect(mockEntry.deletePassword).toHaveBeenCalledTimes(2);
    });

    test('should handle empty credentials list', async () => {
      mockFindCredentials.mockReturnValue([]);

      await manager.clearAllEnvironmentVariables();

      expect(mockEntry.deletePassword).not.toHaveBeenCalled();
    });
  });
});
