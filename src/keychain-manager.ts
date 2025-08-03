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
   * When an environment is specified in the KeychainManager constructor, the method first looks
   * for environment-specific credentials matching that environment. If none are found, it falls
   * back to the generic credential for that account.
   *
   * @returns Promise resolving to an array of credential objects with account names (without env suffix) and passwords
   */
  async findCredentials(): Promise<Array<{ account: string; password: string }>> {
    try {
      const credentials: Credential[] = findCredentials(this.serviceName);

      // Group credentials by base account name (without env suffix)
      const accountGroups = new Map<
        string,
        Array<{ account: string; password: string; isEnvSpecific: boolean; env?: string }>
      >();

      for (const { account, password } of credentials) {
        const envMatch = account.match(/^(.+)\?env=(.+)$/);

        if (envMatch) {
          // Environment-specific account
          const baseAccount = envMatch[1];
          const env = envMatch[2];
          const group = accountGroups.get(baseAccount) || [];
          group.push({ account, password, isEnvSpecific: true, env });
          accountGroups.set(baseAccount, group);
        } else {
          // Generic account (no env suffix)
          const group = accountGroups.get(account) || [];
          group.push({ account, password, isEnvSpecific: false });
          accountGroups.set(account, group);
        }
      }

      // Process each group to prioritize environment-specific values
      const result: Array<{ account: string; password: string }> = [];

      for (const [baseAccount, group] of accountGroups) {
        if (this.environment) {
          // Look for environment-specific credential first
          const envSpecific = group.find((item) => item.isEnvSpecific && item.env === this.environment);

          if (envSpecific) {
            // Use environment-specific value
            result.push({ account: baseAccount, password: envSpecific.password });
            continue;
          }
        }

        // Fall back to generic account (no env suffix)
        const generic = group.find((item) => !item.isEnvSpecific);
        if (generic) {
          result.push({ account: baseAccount, password: generic.password });
        }
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
