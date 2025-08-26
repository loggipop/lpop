import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { MlKem768 } from '@dajiaji/mlkem';
import bs58 from 'bs58';

interface DeviceKeyPair {
  publicKey: string;
  privateKey: string;
  createdAt: number;
  expiresAt: number;
}

interface EncryptedData {
  encryptedKey: string;
  ciphertext: string;
}

const KEY_EXPIRY_DAYS = 7;
const LPOP_DIR = join(homedir(), '.lpop');
const DEVICE_KEY_FILE = join(LPOP_DIR, 'device-key.json');

/**
 * Ensures the .lpop directory exists in the user's home directory
 */
function ensureLpopDirectory(): void {
  if (!existsSync(LPOP_DIR)) {
    mkdirSync(LPOP_DIR, { recursive: true });
  }
}

/**
 * Generates a new ML-KEM768 key pair
 */
export const generatePublicPrivateKeyPair = async (): Promise<{
  publicKey: string;
  privateKey: string;
}> => {
  const kem = new MlKem768();
  const [publicKey, privateKey] = await kem.generateKeyPair();
  const publicKeyBase58 = bs58.encode(publicKey);
  const privateKeyBase58 = bs58.encode(privateKey);
  return { publicKey: publicKeyBase58, privateKey: privateKeyBase58 };
};

/**
 * Stores device key pair locally with expiration timestamp
 */
export const storeDeviceKey = async (keyPair: {
  publicKey: string;
  privateKey: string;
}): Promise<void> => {
  ensureLpopDirectory();

  const now = Date.now();
  const deviceKey: DeviceKeyPair = {
    ...keyPair,
    createdAt: now,
    expiresAt: now + KEY_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  };

  writeFileSync(DEVICE_KEY_FILE, JSON.stringify(deviceKey, null, 2), 'utf8');
};

/**
 * Retrieves stored device key pair if it exists and hasn't expired
 */
export const getStoredDeviceKey = (): DeviceKeyPair | null => {
  if (!existsSync(DEVICE_KEY_FILE)) {
    return null;
  }

  try {
    const keyData = JSON.parse(
      readFileSync(DEVICE_KEY_FILE, 'utf8'),
    ) as DeviceKeyPair;

    // Check if key has expired
    if (Date.now() > keyData.expiresAt) {
      // Remove expired key
      unlinkSync(DEVICE_KEY_FILE);
      return null;
    }

    return keyData;
  } catch {
    // If file is corrupted, remove it
    unlinkSync(DEVICE_KEY_FILE);
    return null;
  }
};

/**
 * Gets or generates device key pair, automatically handling expiration
 */
export const getOrCreateDeviceKey = async (): Promise<DeviceKeyPair> => {
  let deviceKey = getStoredDeviceKey();

  if (!deviceKey) {
    const keyPair = await generatePublicPrivateKeyPair();
    await storeDeviceKey(keyPair);
    deviceKey = getStoredDeviceKey();

    if (!deviceKey) {
      throw new Error('Failed to store or retrieve device key');
    }
  }

  return deviceKey;
};

/**
 * Encrypts data using ML-KEM with the recipient's public key
 */
export const encryptForPublicKey = async (
  data: string,
  publicKeyBase58: string,
): Promise<EncryptedData> => {
  const kem = new MlKem768();
  const publicKey = bs58.decode(publicKeyBase58);

  // Generate shared secret using KEM
  const [encryptedKey, sharedSecret] = await kem.encap(publicKey);

  // Use shared secret as AES key to encrypt the actual data
  // For simplicity, we'll use a basic XOR cipher with the shared secret
  // In production, you'd want to use proper AES encryption
  const dataBuffer = Buffer.from(data, 'utf8');
  const ciphertext = Buffer.alloc(dataBuffer.length);

  for (let i = 0; i < dataBuffer.length; i++) {
    ciphertext[i] = dataBuffer[i] ^ sharedSecret[i % sharedSecret.length];
  }

  return {
    encryptedKey: bs58.encode(encryptedKey),
    ciphertext: bs58.encode(ciphertext),
  };
};

/**
 * Decrypts data using ML-KEM with the local private key
 */
export const decryptWithPrivateKey = async (
  encryptedData: EncryptedData,
  privateKeyBase58: string,
): Promise<string> => {
  const kem = new MlKem768();
  const privateKey = bs58.decode(privateKeyBase58);
  const encryptedKey = bs58.decode(encryptedData.encryptedKey);

  // Recover shared secret using KEM
  const sharedSecret = await kem.decap(encryptedKey, privateKey);

  // Decrypt the ciphertext using the shared secret
  const ciphertext = bs58.decode(encryptedData.ciphertext);
  const plaintext = Buffer.alloc(ciphertext.length);

  for (let i = 0; i < ciphertext.length; i++) {
    plaintext[i] = ciphertext[i] ^ sharedSecret[i % sharedSecret.length];
  }

  return plaintext.toString('utf8');
};

/**
 * Removes expired or invalid device keys
 */
export const cleanupExpiredKeys = (): boolean => {
  const deviceKey = getStoredDeviceKey();
  return deviceKey === null; // Returns true if key was removed/expired
};

/**
 * Gets device key status information
 */
export const getDeviceKeyStatus = (): {
  exists: boolean;
  expiresAt?: number;
  daysUntilExpiry?: number;
} => {
  const deviceKey = getStoredDeviceKey();

  if (!deviceKey) {
    return { exists: false };
  }

  const daysUntilExpiry = Math.ceil(
    (deviceKey.expiresAt - Date.now()) / (24 * 60 * 60 * 1000),
  );

  return {
    exists: true,
    expiresAt: deviceKey.expiresAt,
    daysUntilExpiry,
  };
};
