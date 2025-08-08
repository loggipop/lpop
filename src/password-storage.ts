import { Entry, findCredentials, type Credential } from '@napi-rs/keyring';

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
  async findServiceCredentials(): Promise<Array<{ account: string; password: string }>> {
    const credentials: Credential[] = findCredentials(this.serviceName);

    // Create a record as it's more efficient than a map in this case
    const credentialObj: Record<string, string> = {};

    for (const { account, password } of credentials) {
      const envMatch = account.match(/^(.+)\?env=(.+)$/);

      if (envMatch) {
        // Environment-specific account
        const baseAccount = envMatch[1];
        const env = envMatch[2];

        // Only add if it matches our target environment
        if (this.environment && env === this.environment) {
          credentialObj[baseAccount] = password;
        }
      } else {
        // Generic account (no env suffix) - only add if not already set by environment-specific
        if (!credentialObj[account]) {
          credentialObj[account] = password;
        }
      }
    }

    // Convert map to array format
    return Object.entries(credentialObj).map(([account, password]) => ({ account, password }));

  }

  async setEnvironmentVariables(variables: PasswordEntry[]): Promise<void> {
    for (const { key, value } of variables) {
      await this.setPassword(key, value);
    }
  }

  async getEnvironmentVariables(): Promise<PasswordEntry[]> {
    const credentials = await this.findServiceCredentials();
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
    const credentials = await this.findServiceCredentials();
    for (const { account } of credentials) {
      await this.deletePassword(account);
    }
  }
}
