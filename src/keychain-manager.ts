import { Entry, findCredentials, Credential } from '@napi-rs/keyring';

export interface KeychainEntry {
  key: string;
  value: string;
}

export class KeychainManager {
  constructor(private serviceName: string, private repoServiceName?: string) {}

  static createWithHierarchy(envServiceName: string, repoServiceName: string): KeychainManager {
    return new KeychainManager(envServiceName, repoServiceName);
  }

  static createRepoLevel(repoServiceName: string): KeychainManager {
    return new KeychainManager(repoServiceName);
  }

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
    const envVariables = credentials.map(({ account, password }) => ({
      key: account,
      value: password
    }));

    // If we have a repo service name, get repo-level variables and merge
    if (this.repoServiceName && this.repoServiceName !== this.serviceName) {
      const repoVariables = await this.getRepoLevelVariables();
      return this.mergeVariables(repoVariables, envVariables);
    }

    return envVariables;
  }

  private async getRepoLevelVariables(): Promise<KeychainEntry[]> {
    if (!this.repoServiceName) return [];
    
    try {
      const credentials: Credential[] = findCredentials(this.repoServiceName);
      return credentials.map(({ account, password }) => ({
        key: account,
        value: password
      }));
    } catch {
      return [];
    }
  }

  private mergeVariables(repoVars: KeychainEntry[], envVars: KeychainEntry[]): KeychainEntry[] {
    // Create a map from repo variables
    const variableMap = new Map<string, string>();
    
    // Add repo-level variables first
    for (const { key, value } of repoVars) {
      variableMap.set(key, value);
    }
    
    // Override with environment-specific variables
    for (const { key, value } of envVars) {
      variableMap.set(key, value);
    }
    
    // Convert back to array
    return Array.from(variableMap.entries()).map(([key, value]) => ({ key, value }));
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