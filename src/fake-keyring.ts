export interface Credential {
  account: string;
  password: string;
}

// In-memory storage for testing
const storage = new Map<string, Map<string, string>>();

export class Entry {
  constructor(private service: string, private account: string) {}

  setPassword(password: string): void {
    if (!storage.has(this.service)) {
      storage.set(this.service, new Map());
    }
    storage.get(this.service)!.set(this.account, password);
  }

  getPassword(): string {
    const serviceStorage = storage.get(this.service);
    if (!serviceStorage) {
      throw new Error('Service not found');
    }
    const password = serviceStorage.get(this.account);
    if (!password) {
      throw new Error('Account not found');
    }
    return password;
  }

  deletePassword(): boolean {
    const serviceStorage = storage.get(this.service);
    if (!serviceStorage) {
      return false;
    }
    return serviceStorage.delete(this.account);
  }
}

export function findCredentials(service: string): Credential[] {
  const serviceStorage = storage.get(service);
  if (!serviceStorage) {
    return [];
  }
  
  const credentials: Credential[] = [];
  for (const [account, password] of serviceStorage.entries()) {
    credentials.push({ account, password });
  }
  return credentials;
}

// Helper function to clear storage (for testing)
export function clearStorage(): void {
  storage.clear();
}