import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { exists, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
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
const ensureLpopDirectory = async (): Promise<void> => {
  if (!(await exists(LPOP_DIR))) {
    mkdir(LPOP_DIR, { recursive: true });
  }
};

/**
 * Generates a new ML-KEM768 key pair
 */
export const generatePublicPrivateKeyPair = (): {
  publicKey: string;
  privateKey: string;
} => {
  const keys = ml_kem768.keygen();
  const publicKeyBase58 = bs58.encode(keys.publicKey);
  const privateKeyBase58 = bs58.encode(keys.secretKey);
  return { publicKey: publicKeyBase58, privateKey: privateKeyBase58 };
};

/**
 * Stores device key pair locally with expiration timestamp
 */
export const storeDeviceKey = async (keyPair: {
  publicKey: string;
  privateKey: string;
}) => {
  await ensureLpopDirectory();

  const now = Date.now();
  const deviceKey: DeviceKeyPair = {
    ...keyPair,
    createdAt: now,
    expiresAt: now + KEY_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  };

  await writeFile(DEVICE_KEY_FILE, JSON.stringify(deviceKey, null, 2), 'utf8');
};

/**
 * Retrieves stored device key pair if it exists and hasn't expired
 */
export const getStoredDeviceKey = async (): Promise<DeviceKeyPair | null> => {
  if (!(await exists(DEVICE_KEY_FILE))) {
    return null;
  }

  try {
    const keyData = JSON.parse(
      await readFile(DEVICE_KEY_FILE, 'utf8'),
    ) as DeviceKeyPair;

    // Check if key has expired
    if (Date.now() > keyData.expiresAt) {
      // Remove expired key
      await unlink(DEVICE_KEY_FILE);
      return null;
    }

    return keyData;
  } catch {
    // If file is corrupted, remove it
    await unlink(DEVICE_KEY_FILE);
    return null;
  }
};

/**
 * Gets or generates device key pair, automatically handling expiration
 */
export const getOrCreateDeviceKey = async (): Promise<DeviceKeyPair> => {
  let deviceKey = await getStoredDeviceKey();

  if (!deviceKey) {
    const keyPair = generatePublicPrivateKeyPair();
    await storeDeviceKey(keyPair);
    deviceKey = await getStoredDeviceKey();

    if (!deviceKey) {
      throw new Error('Failed to store or retrieve device key');
    }
  }

  return deviceKey;
};

/**
 * Encrypts data using ML-KEM with the recipient's public key
 */
export const encryptForPublicKey = (
  data: string,
  publicKeyBase58: string,
): EncryptedData => {
  const publicKey = bs58.decode(publicKeyBase58);

  // Generate shared secret using KEM
  const { cipherText, sharedSecret } = ml_kem768.encapsulate(publicKey);

  // Use AES-256-GCM with the shared secret as key
  // Derive a 256-bit key from the shared secret
  const aesKey = sharedSecret.slice(0, 32);

  // Generate a random 12-byte IV for GCM
  const iv = randomBytes(12);

  // Create cipher with AES-256-GCM
  const cipher = createCipheriv('aes-256-gcm', aesKey, iv);

  // Encrypt the data
  const encrypted = Buffer.concat([
    cipher.update(data, 'utf8'),
    cipher.final(),
  ]);

  // Get the authentication tag
  const authTag = cipher.getAuthTag();

  // Combine IV, authTag, and ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted]);

  return {
    encryptedKey: bs58.encode(cipherText),
    ciphertext: bs58.encode(combined),
  };
};

/**
 * Decrypts data using ML-KEM with the local private key
 */
export const decryptWithPrivateKey = (
  encryptedData: EncryptedData,
  privateKeyBase58: string,
): string => {
  const privateKey = bs58.decode(privateKeyBase58);
  const encryptedKey = bs58.decode(encryptedData.encryptedKey);

  // Recover shared secret using KEM
  const sharedSecret = ml_kem768.decapsulate(encryptedKey, privateKey);

  // Derive the same AES key from the shared secret
  const aesKey = sharedSecret.slice(0, 32);

  // Decode and extract components
  const combined = bs58.decode(encryptedData.ciphertext);

  // Extract IV (first 12 bytes), authTag (next 16 bytes), and ciphertext (rest)
  const iv = combined.slice(0, 12);
  const authTag = combined.slice(12, 28);
  const ciphertext = combined.slice(28);

  // Create decipher with AES-256-GCM
  const decipher = createDecipheriv('aes-256-gcm', aesKey, iv);
  decipher.setAuthTag(authTag);

  // Decrypt the data
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
};

/**
 * Removes expired or invalid device keys
 */
export const cleanupExpiredKeys = async (): Promise<boolean> => {
  const deviceKey = await getStoredDeviceKey();
  return deviceKey === null; // Returns true if key was removed/expired
};

/**
 * Gets device key status information
 */
export const getDeviceKeyStatus = async (): Promise<{
  exists: boolean;
  expiresAt?: number;
  daysUntilExpiry?: number;
}> => {
  const deviceKey = await getStoredDeviceKey();

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
