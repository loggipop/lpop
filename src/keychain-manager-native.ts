// @ts-ignore - Native module doesn't have TypeScript definitions in node_modules yet
const { Keychain: NativeKeychain } = require('../packages/keychain-native/index.js');

export interface KeychainOptions {
  teamId?: string;
  accessGroup?: string;
  synchronizable?: boolean;
}

export interface KeychainEntry {
  key: string;
  value: string;
}

/**
 * Enhanced KeychainManager using the native module with macOS security features
 */
export class NativeKeychainManager {
  private nativeKeychain: NativeKeychain;
  private serviceName: string;
  private environment?: string;

  constructor(
    serviceName: string, 
    environment?: string,
    options?: KeychainOptions
  ) {
    this.serviceName = serviceName;
    this.environment = environment;
    
    // Initialize native keychain with enhanced options
    this.nativeKeychain = new NativeKeychain(options || {
      // Default options for lpop
      teamId: process.env.LPOP_TEAM_ID,
      accessGroup: process.env.LPOP_ACCESS_GROUP || 'com.lpop.shared',
      synchronizable: false
    });
  }

  private getFullAccountName(account: string): string {
    const envString = this.environment ? `?env=${this.environment}` : '';
    return `${account}${envString}`;
  }

  async setPassword(account: string, password: string): Promise<void> {
    await this.nativeKeychain.setPassword(
      this.serviceName,
      this.getFullAccountName(account),
      password
    );
  }

  async getPassword(account: string): Promise<string | null> {
    return await this.nativeKeychain.getPassword(
      this.serviceName,
      this.getFullAccountName(account)
    );
  }

  async deletePassword(account: string): Promise<boolean> {
    return await this.nativeKeychain.deletePassword(
      this.serviceName,
      this.getFullAccountName(account)
    );
  }

  /**
   * Retrieves credentials from the keychain, prioritizing environment-specific values
   */
  async findCredentials(): Promise<Array<{ account: string; password: string }>> {
    const credentials = await this.nativeKeychain.findCredentials(this.serviceName);
    
    // Build output map directly, prioritizing environment-specific values
    const resultMap = new Map<string, string>();

    for (const { account, password } of credentials) {
      const envMatch = account.match(/^(.+)\?env=(.+)$/);

      if (envMatch) {
        // Environment-specific account
        const baseAccount = envMatch[1];
        const env = envMatch[2];

        // Only add if it matches our target environment
        if (this.environment && env === this.environment) {
          resultMap.set(baseAccount, password);
        }
      } else {
        // Generic account (no env suffix) - only add if not already set by environment-specific
        if (!resultMap.has(account)) {
          resultMap.set(account, password);
        }
      }
    }

    // Convert map to array format
    return Array.from(resultMap.entries()).map(([account, password]) => ({ 
      account, 
      password 
    }));
  }

  async setEnvironmentVariables(variables: KeychainEntry[]): Promise<void> {
    for (const { key, value } of variables) {
      await this.setPassword(key, value);
    }
  }

  async getEnvironmentVariables(): Promise<KeychainEntry[]> {
    const credentials = await this.findCredentials();
    return credentials.map(({ account, password }) => ({
      key: account,
      value: password,
    }));
  }

  async removeEnvironmentVariable(key: string): Promise<boolean> {
    return await this.deletePassword(key);
  }

  async updateEnvironmentVariable(key: string, value: string): Promise<void> {
    await this.setPassword(key, value);
  }

  async clearAllEnvironmentVariables(): Promise<void> {
    const credentials = await this.findCredentials();
    for (const { account } of credentials) {
      await this.deletePassword(account);
    }
  }
}