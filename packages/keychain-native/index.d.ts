export interface KeychainEntry {
  service: string;
  account: string;
  password: string;
}

export interface KeychainOptions {
  /**
   * Team ID for macOS code signing (e.g., "ABC123XYZ")
   */
  teamId?: string;
  /**
   * Access group for sharing between apps
   */
  accessGroup?: string;
  /**
   * Whether to synchronize with iCloud Keychain
   */
  synchronizable?: boolean;
}

export class Keychain {
  constructor(options?: KeychainOptions);
  
  /**
   * Set a password in the keychain
   */
  setPassword(service: string, account: string, password: string): Promise<void>;
  
  /**
   * Get a password from the keychain
   */
  getPassword(service: string, account: string): Promise<string | null>;
  
  /**
   * Delete a password from the keychain
   */
  deletePassword(service: string, account: string): Promise<boolean>;
  
  /**
   * Find all credentials for a given service
   */
  findCredentials(service: string): Promise<KeychainEntry[]>;
  
  /**
   * Find all credentials for a given account
   */
  findByAccount(account: string): Promise<KeychainEntry[]>;
}