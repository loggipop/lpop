import { Entry, findCredentials, Credential } from '@napi-rs/keyring';

export interface PasswordEntry {
  key: string;
  value: string;
}

/**
 * Password storage that works across platforms using @napi-rs/keyring
 * The library handles platform differences internally (Windows Credential Manager, macOS Keychain, etc.)
 */
export class PasswordStorage {
  constructor(private serviceName: string, private environment?: string) {}

  /**
   * Gets the full account name with environment suffix if specified
   * @param account The base account name
   * @returns The full account name with environment suffix
   */
  private getFullAccountName(account: string): string {
    const envString = this.environment ? `?env=${this.environment}` : '';
    return `${account}${envString}`;
  }

  async setPassword(account: string, password: string): Promise<void> {
    const entry = new Entry(this.serviceName, this.getFullAccountName(account));
    entry.setPassword(password);
  }

  async getPassword(account: string): Promise<string | null> {
    try {
      const entry = new Entry(this.serviceName, this.getFullAccountName(account));
      return entry.getPassword();
    } catch {
      return null;
    }
  }

  async deletePassword(account: string): Promise<boolean> {
    try {
      const entry = new Entry(this.serviceName, this.getFullAccountName(account));
      return entry.deletePassword();
    } catch {
      return false;
    }
  }

  async findCredentials(): Promise<Array<{ account: string; password: string }>> {
    const credentials: Credential[] = findCredentials(this.serviceName);
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
    return Array.from(resultMap.entries()).map(([account, password]) => ({ account, password }));
  }

  async setEnvironmentVariables(variables: PasswordEntry[]): Promise<void> {
    for (const { key, value } of variables) {
      await this.setPassword(key, value);
    }
  }

  async getEnvironmentVariables(): Promise<PasswordEntry[]> {
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
