// @ts-ignore - Native module doesn't have TypeScript definitions in node_modules yet
const { Keychain: NativeKeychain } = require('../packages/keychain-native/index.js');
import type { KeychainEntry } from './keychain-manager.js';

export interface KeychainOptions {
  teamId?: string;
  accessGroup?: string;
  synchronizable?: boolean;
}

/**
 * Adapter to use the native keychain module with enhanced macOS features
 */
export class NativeKeychainAdapter {
  private keychain: NativeKeychain;

  constructor(options?: KeychainOptions) {
    this.keychain = new NativeKeychain(options);
  }

  async setPassword(service: string, account: string, password: string): Promise<void> {
    await this.keychain.setPassword(service, account, password);
  }

  async getPassword(service: string, account: string): Promise<string | null> {
    return await this.keychain.getPassword(service, account);
  }

  async deletePassword(service: string, account: string): Promise<boolean> {
    return await this.keychain.deletePassword(service, account);
  }

  async findCredentials(service: string): Promise<Array<{ account: string; password: string }>> {
    const entries = await this.keychain.findCredentials(service);
    return entries.map(entry => ({
      account: entry.account,
      password: entry.password
    }));
  }

  async setEnvironmentVariables(service: string, variables: KeychainEntry[]): Promise<void> {
    for (const { key, value } of variables) {
      await this.setPassword(service, key, value);
    }
  }

  async getEnvironmentVariables(service: string): Promise<KeychainEntry[]> {
    const credentials = await this.findCredentials(service);
    return credentials.map(({ account, password }) => ({
      key: account,
      value: password,
    }));
  }
}