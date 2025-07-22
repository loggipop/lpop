import { Entry, findCredentials, Credential } from '@napi-rs/keyring';

export interface KeychainEntry {
  key: string;
  value: string;
}

export class KeychainManager {
  constructor(private serviceName: string) {}

  private getEntry(account: string): Entry {
    return new Entry(this.serviceName, account);
  }

  async setPassword(account: string, password: string): Promise<void> {
    const entry = this.getEntry(account);
    entry.setPassword(password);
  }

  async getPassword(account: string): Promise<string | null> {
    try {
      const entry = this.getEntry(account);
      return entry.getPassword();
    } catch {
      return null;
    }
  }

  async deletePassword(account: string): Promise<boolean> {
    try {
      const entry = this.getEntry(account);
      return entry.deletePassword();
    } catch {
      return false;
    }
  }

  async findCredentials(): Promise<Array<{ account: string; password: string }>> {
    try {
      const credentials: Credential[] = findCredentials(this.serviceName);
      return credentials.map(({ account, password }) => ({ account, password }));
    } catch {
      return [];
    }
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
      value: password
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