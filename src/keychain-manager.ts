import { Entry, findCredentials, Credential } from '@napi-rs/keyring';

export interface KeychainEntry {
  key: string;
  value: string;
}

export class KeychainManager {
  constructor(private serviceName: string, private environment?: string) {}

  private getFullAccountName(account: string): string {
    const envString = this.environment ? `?env=${this.environment}` : '';
    return `${account}${envString}`;
  }

  private getEntry(account: string): Entry {
    return new Entry(this.serviceName, this.getFullAccountName(account));
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

  /**
   * Retrieves credentials from the keychain, prioritizing environment-specific values over generic ones.
   *
   * This method handles account names in two formats:
   * - Environment-specific: `<account>?env=<environment>` (e.g., "myapp?env=prod")
   * - Generic: `<account>` (e.g., "myapp")
   *
   * The method processes credentials in a single pass:
   * 1. Environment-specific credentials matching the target environment are added/replace existing values
   * 2. Generic credentials (without env suffix) are added only if no environment-specific value exists
   *
   * @returns Promise resolving to an array of credential objects with account names (without env suffix) and passwords
   */
  async findCredentials(): Promise<Array<{ account: string; password: string }>> {
    try {
      const credentials: Credential[] = findCredentials(this.serviceName);

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
      const result: Array<{ account: string; password: string }> = [];
      for (const [account, password] of resultMap) {
        result.push({ account, password });
      }

      return result;
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
