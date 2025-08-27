import { existsSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import bs58 from 'bs58';
import { afterEach, describe, expect, it } from 'vitest';
import {
  decryptWithPrivateKey,
  encryptForPublicKey,
  generatePublicPrivateKeyPair,
} from '../src/quantum-keys.js';

const LPOP_DIR = join(homedir(), '.lpop');

describe('Quantum Keys', () => {
  afterEach(() => {
    // Clean up any keys created during testing
    if (existsSync(LPOP_DIR)) {
      rmSync(LPOP_DIR, { recursive: true, force: true });
    }
  });

  describe('generatePublicPrivateKeyPair', () => {
    it('should generate a valid ML-KEM key pair with base58 encoding', async () => {
      const keyPair = await generatePublicPrivateKeyPair();

      expect(keyPair).toHaveProperty('publicKey');
      expect(keyPair).toHaveProperty('privateKey');
      expect(typeof keyPair.publicKey).toBe('string');
      expect(typeof keyPair.privateKey).toBe('string');

      // Base58 encoded keys should be shorter than hex
      expect(keyPair.publicKey.length).toBeGreaterThan(1000);
      expect(keyPair.publicKey.length).toBeLessThan(2000);
      expect(keyPair.privateKey.length).toBeGreaterThan(3000);
      expect(keyPair.privateKey.length).toBeLessThan(4000);

      // Should not contain characters not in base58 alphabet
      expect(keyPair.publicKey).toMatch(
        /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/,
      );
      expect(keyPair.privateKey).toMatch(
        /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/,
      );
    });

    it('should generate different key pairs on each call', async () => {
      const keyPair1 = await generatePublicPrivateKeyPair();
      const keyPair2 = await generatePublicPrivateKeyPair();

      expect(keyPair1.publicKey).not.toBe(keyPair2.publicKey);
      expect(keyPair1.privateKey).not.toBe(keyPair2.privateKey);
    });
  });

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt data successfully', async () => {
      await generatePublicPrivateKeyPair();
      const recipientKeys = await generatePublicPrivateKeyPair();
      const originalData = JSON.stringify({
        DATABASE_URL: 'postgres://user:pass@localhost:5432/mydb',
        API_KEY: 'secret-api-key-12345',
        NODE_ENV: 'production',
      });

      const encrypted = await encryptForPublicKey(
        originalData,
        recipientKeys.publicKey,
      );

      expect(encrypted).toHaveProperty('encryptedKey');
      expect(encrypted).toHaveProperty('ciphertext');
      expect(typeof encrypted.encryptedKey).toBe('string');
      expect(typeof encrypted.ciphertext).toBe('string');

      // Should be base58 encoded
      expect(encrypted.encryptedKey).toMatch(
        /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/,
      );
      expect(encrypted.ciphertext).toMatch(
        /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/,
      );

      const decrypted = await decryptWithPrivateKey(
        encrypted,
        recipientKeys.privateKey,
      );
      expect(decrypted).toBe(originalData);
    });

    it('should fail to decrypt with wrong private key', async () => {
      const recipientKeys = await generatePublicPrivateKeyPair();
      const wrongKeys = await generatePublicPrivateKeyPair();
      const originalData = 'secret message';

      const encrypted = await encryptForPublicKey(
        originalData,
        recipientKeys.publicKey,
      );

      // With AES-GCM, decryption with wrong key should throw authentication error
      await expect(
        decryptWithPrivateKey(encrypted, wrongKeys.privateKey),
      ).rejects.toThrow('Unsupported state or unable to authenticate data');
    });

    it('should handle empty string data', async () => {
      const keys = await generatePublicPrivateKeyPair();
      const originalData = '';

      const encrypted = await encryptForPublicKey(originalData, keys.publicKey);
      const decrypted = await decryptWithPrivateKey(encrypted, keys.privateKey);

      expect(decrypted).toBe(originalData);
    });

    it('should handle large data', async () => {
      const keys = await generatePublicPrivateKeyPair();
      const originalData = 'a'.repeat(10000); // 10KB of data

      const encrypted = await encryptForPublicKey(originalData, keys.publicKey);
      const decrypted = await decryptWithPrivateKey(encrypted, keys.privateKey);

      expect(decrypted).toBe(originalData);
    });
  });

  describe('base58 encoding validation', () => {
    it('should only contain valid base58 characters', async () => {
      const keyPair = await generatePublicPrivateKeyPair();

      // Base58 alphabet (Bitcoin): 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
      const base58Regex =
        /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;

      expect(keyPair.publicKey).toMatch(base58Regex);
      expect(keyPair.privateKey).toMatch(base58Regex);
    });

    it('should be significantly shorter than hex encoding', async () => {
      const keyPair = await generatePublicPrivateKeyPair();

      // Base58 should be ~32% shorter than hex for ML-KEM keys
      expect(keyPair.publicKey.length).toBeLessThan(2000); // vs 2368 for hex
      expect(keyPair.privateKey.length).toBeLessThan(4000); // vs 4800 for hex
      expect(keyPair.publicKey.length).toBeGreaterThan(1500);
      expect(keyPair.privateKey.length).toBeGreaterThan(3000);
    });
  });

  describe('security improvements', () => {
    it('should generate unique ciphertexts for the same plaintext (IV randomization)', async () => {
      const keys = await generatePublicPrivateKeyPair();
      const originalData = 'sensitive data that should be protected';

      const encrypted1 = await encryptForPublicKey(
        originalData,
        keys.publicKey,
      );
      const encrypted2 = await encryptForPublicKey(
        originalData,
        keys.publicKey,
      );

      // Same plaintext should produce different ciphertexts due to random IV
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);

      // Both should decrypt to the same value
      const decrypted1 = await decryptWithPrivateKey(
        encrypted1,
        keys.privateKey,
      );
      const decrypted2 = await decryptWithPrivateKey(
        encrypted2,
        keys.privateKey,
      );
      expect(decrypted1).toBe(originalData);
      expect(decrypted2).toBe(originalData);
    });

    it('should detect tampered ciphertext', async () => {
      const keys = await generatePublicPrivateKeyPair();
      const originalData = 'integrity protected data';

      const encrypted = await encryptForPublicKey(originalData, keys.publicKey);

      // Tamper with the ciphertext
      const tamperedCiphertext = bs58.decode(encrypted.ciphertext);
      tamperedCiphertext[tamperedCiphertext.length - 1] ^= 0xff; // Flip last byte
      encrypted.ciphertext = bs58.encode(tamperedCiphertext);

      // Should fail authentication due to tampered data
      await expect(
        decryptWithPrivateKey(encrypted, keys.privateKey),
      ).rejects.toThrow('Unsupported state or unable to authenticate data');
    });

    it('should handle special characters and unicode correctly', async () => {
      const keys = await generatePublicPrivateKeyPair();
      const originalData = '🔐 Encryption with émojis and spëcial çhars: €£¥';

      const encrypted = await encryptForPublicKey(originalData, keys.publicKey);
      const decrypted = await decryptWithPrivateKey(encrypted, keys.privateKey);

      expect(decrypted).toBe(originalData);
    });

    it('should protect against authentication tag manipulation', async () => {
      const keys = await generatePublicPrivateKeyPair();
      const originalData = 'auth tag protected';

      const encrypted = await encryptForPublicKey(originalData, keys.publicKey);

      // Tamper with the auth tag (bytes 12-28 in the combined buffer)
      const tamperedCiphertext = bs58.decode(encrypted.ciphertext);
      tamperedCiphertext[15] ^= 0x01; // Flip a bit in the auth tag
      encrypted.ciphertext = bs58.encode(tamperedCiphertext);

      // Should fail authentication
      await expect(
        decryptWithPrivateKey(encrypted, keys.privateKey),
      ).rejects.toThrow('Unsupported state or unable to authenticate data');
    });
  });
});
