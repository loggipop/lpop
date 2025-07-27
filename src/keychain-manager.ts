import { Entry, findCredentials, Credential } from '@napi-rs/keyring';

export interface KeychainEntry {
  key: string;
  value: string;
}

export class KeychainManager {
  private static readonly ACCOUNT_NAME = 'value';
  
  constructor(private baseServiceName: string) {}

  private getEntry(serviceName: string): Entry {
    return new Entry(serviceName, KeychainManager.ACCOUNT_NAME);
  }

  async setPassword(serviceName: string, password: string): Promise<void> {
    const entry = this.getEntry(serviceName);
    entry.setPassword(password);
  }

  async getPassword(serviceName: string): Promise<string | null> {
    try {
      const entry = this.getEntry(serviceName);
      return entry.getPassword();
    } catch {
      return null;
    }
  }

  async deletePassword(serviceName: string): Promise<boolean> {
    try {
      const entry = this.getEntry(serviceName);
      return entry.deletePassword();
    } catch {
      return false;
    }
  }

  async findCredentials(): Promise<Array<{ account: string; password: string }>> {
    try {
      const credentials: Credential[] = findCredentials(this.baseServiceName);
      return credentials.map(({ account, password }) => ({ account, password }));
    } catch {
      return [];
    }
  }

  async setEnvironmentVariable(serviceName: string, value: string): Promise<void> {
    await this.setPassword(serviceName, value);
  }

  async getEnvironmentVariable(serviceName: string): Promise<string | null> {
    return await this.getPassword(serviceName);
  }

  async getEnvironmentVariableWithFallback(specificServiceName: string): Promise<{ value: string | null; source: string }> {
    // Try specific service name first (with env/branch)
    let value = await this.getPassword(specificServiceName);
    if (value !== null) {
      return { value, source: specificServiceName };
    }

    // Fall back to universal service name (no query params)
    const universalServiceName = this.stripQueryParams(specificServiceName);
    if (universalServiceName !== specificServiceName) {
      value = await this.getPassword(universalServiceName);
      if (value !== null) {
        return { value, source: universalServiceName };
      }
    }

    return { value: null, source: 'not found' };
  }

  private stripQueryParams(serviceName: string): string {
    return serviceName.split('?')[0];
  }

  async removeEnvironmentVariable(serviceName: string): Promise<boolean> {
    return await this.deletePassword(serviceName);
  }

  async removeEnvironmentVariableWithFallback(specificServiceName: string): Promise<{ removed: boolean; source: string }> {
    // Try specific service name first (with env/branch)
    let removed = await this.deletePassword(specificServiceName);
    if (removed) {
      return { removed: true, source: specificServiceName };
    }

    // Fall back to universal service name (no query params)
    const universalServiceName = this.stripQueryParams(specificServiceName);
    if (universalServiceName !== specificServiceName) {
      removed = await this.deletePassword(universalServiceName);
      if (removed) {
        return { removed: true, source: universalServiceName };
      }
    }

    return { removed: false, source: 'not found' };
  }

  async updateEnvironmentVariable(serviceName: string, value: string): Promise<void> {
    await this.setPassword(serviceName, value);
  }

  // Note: This method now requires external logic to find all variable service names
  // for a given base service pattern since variables are stored in separate services
  async clearEnvironmentVariable(serviceName: string): Promise<boolean> {
    return await this.deletePassword(serviceName);
  }
}