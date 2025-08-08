import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';

vi.mock('@napi-rs/keyring', () => ({
  Entry: vi.fn(),
  findCredentials: vi.fn()
}));
import { Entry, findCredentials } from '@napi-rs/keyring';
import { PasswordStorage } from '../src/password-storage';

describe('PasswordStorage', () => {
  let manager: PasswordStorage;
  let mockEntry: {
    setPassword: Mock;
    getPassword: Mock;
    deletePassword: Mock;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockEntry = {
      setPassword: vi.fn(),
      getPassword: vi.fn(),
      deletePassword: vi.fn()
    };

    (Entry as unknown as Mock).mockImplementation(() => mockEntry);
    manager = new PasswordStorage('test-service', 'development');
  });

  describe('constructor', () => {
    it('should create instance with service name and environment', () => {
      const mgr = new PasswordStorage('my-service', 'production');
      expect(mgr).toBeDefined();
    });

    it('should create instance without environment', () => {
      const mgr = new PasswordStorage('my-service');
      expect(mgr).toBeDefined();
    });
  });

  describe('setPassword', () => {
    it('should set password with environment suffix', async () => {
      await manager.setPassword('API_KEY', 'secret123');

      expect(Entry).toHaveBeenCalledWith('test-service', 'API_KEY?env=development');
      expect(mockEntry.setPassword).toHaveBeenCalledWith('secret123');
    });

    it('should set password without environment suffix when no environment', async () => {
      const noEnvManager = new PasswordStorage('test-service');
      await noEnvManager.setPassword('API_KEY', 'secret123');

      expect(Entry).toHaveBeenCalledWith('test-service', 'API_KEY');
      expect(mockEntry.setPassword).toHaveBeenCalledWith('secret123');
    });
  });

  describe('getPassword', () => {
    it('should get password successfully', async () => {
      mockEntry.getPassword.mockReturnValue('secret123');

      const result = await manager.getPassword('API_KEY');

      expect(Entry).toHaveBeenCalledWith('test-service', 'API_KEY?env=development');
      expect(mockEntry.getPassword).toHaveBeenCalled();
      expect(result).toBe('secret123');
    });

    it('should return null when password not found', async () => {
      mockEntry.getPassword.mockImplementation(() => {
        throw new Error('Not found');
      });

      const result = await manager.getPassword('MISSING_KEY');

      expect(result).toBeNull();
    });
  });

  describe('deletePassword', () => {
    it('should delete password successfully', async () => {
      mockEntry.deletePassword.mockReturnValue(true);

      const result = await manager.deletePassword('API_KEY');

      expect(Entry).toHaveBeenCalledWith('test-service', 'API_KEY?env=development');
      expect(mockEntry.deletePassword).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when deletion fails', async () => {
      mockEntry.deletePassword.mockImplementation(() => {
        throw new Error('Delete failed');
      });

      const result = await manager.deletePassword('API_KEY');

      expect(result).toBe(false);
    });
  });

  describe('findCredentials', () => {
    it('should prioritize environment-specific credentials', async () => {
      (findCredentials as Mock).mockReturnValue([
        { account: 'API_KEY', password: 'generic-value' },
        { account: 'API_KEY?env=development', password: 'dev-value' },
        { account: 'API_KEY?env=production', password: 'prod-value' },
        { account: 'DB_URL?env=development', password: 'dev-db' }
      ]);

      const result = await manager.findServiceCredentials();

      expect(findCredentials).toHaveBeenCalledWith('test-service');
      expect(result).toEqual([
        { account: 'API_KEY', password: 'dev-value' },
        { account: 'DB_URL', password: 'dev-db' }
      ]);
    });

    it('should use generic credentials when no environment-specific ones exist', async () => {
      (findCredentials as Mock).mockReturnValue([
        { account: 'API_KEY', password: 'generic-value' },
        { account: 'DB_URL?env=production', password: 'prod-db' }
      ]);

      const result = await manager.findServiceCredentials();

      expect(result).toEqual([
        { account: 'API_KEY', password: 'generic-value' }
      ]);
    });

    it('should return empty array when no credentials found', async () => {
      (findCredentials as Mock).mockReturnValue([]);

      const result = await manager.findServiceCredentials();

      expect(result).toEqual([]);
    });

    it('should handle credentials without environment', async () => {
      const noEnvManager = new PasswordStorage('test-service');
      (findCredentials as Mock).mockReturnValue([
        { account: 'API_KEY', password: 'value1' },
        { account: 'DB_URL', password: 'value2' }
      ]);

      const result = await noEnvManager.findServiceCredentials();

      expect(result).toEqual([
        { account: 'API_KEY', password: 'value1' },
        { account: 'DB_URL', password: 'value2' }
      ]);
    });
  });

  describe('setEnvironmentVariables', () => {
    it('should set multiple environment variables', async () => {
      const variables = [
        { key: 'API_KEY', value: 'secret1' },
        { key: 'DB_URL', value: 'postgres://localhost' }
      ];

      await manager.setEnvironmentVariables(variables);

      expect(mockEntry.setPassword).toHaveBeenCalledTimes(2);
      expect(mockEntry.setPassword).toHaveBeenCalledWith('secret1');
      expect(mockEntry.setPassword).toHaveBeenCalledWith('postgres://localhost');
    });

    it('should handle empty array', async () => {
      await manager.setEnvironmentVariables([]);

      expect(mockEntry.setPassword).not.toHaveBeenCalled();
    });
  });

  describe('getEnvironmentVariables', () => {
    it('should return all environment variables', async () => {
      (findCredentials as Mock).mockReturnValue([
        { account: 'API_KEY?env=development', password: 'secret1' },
        { account: 'DB_URL', password: 'postgres://localhost' }
      ]);

      const result = await manager.getEnvironmentVariables();

      expect(result).toEqual([
        { key: 'API_KEY', value: 'secret1' },
        { key: 'DB_URL', value: 'postgres://localhost' }
      ]);
    });

    it('should return empty array when no variables found', async () => {
      (findCredentials as Mock).mockReturnValue([]);

      const result = await manager.getEnvironmentVariables();

      expect(result).toEqual([]);
    });
  });

  describe('removeEnvironmentVariable', () => {
    it('should remove environment variable', async () => {
      mockEntry.deletePassword.mockReturnValue(true);

      const result = await manager.removeEnvironmentVariable('API_KEY');

      expect(mockEntry.deletePassword).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('updateEnvironmentVariable', () => {
    it('should update environment variable', async () => {
      await manager.updateEnvironmentVariable('API_KEY', 'new-secret');

      expect(mockEntry.setPassword).toHaveBeenCalledWith('new-secret');
    });
  });

  describe('clearAllEnvironmentVariables', () => {
    it('should clear all environment variables', async () => {
      (findCredentials as Mock).mockReturnValue([
        { account: 'API_KEY?env=development', password: 'secret1' },
        { account: 'DB_URL', password: 'postgres://localhost' }
      ]);
      mockEntry.deletePassword.mockReturnValue(true);

      await manager.clearAllEnvironmentVariables();

      expect(mockEntry.deletePassword).toHaveBeenCalledTimes(2);
    });

    it('should handle empty credentials list', async () => {
      (findCredentials as Mock).mockReturnValue([]);

      await manager.clearAllEnvironmentVariables();

      expect(mockEntry.deletePassword).not.toHaveBeenCalled();
    });
  });
});