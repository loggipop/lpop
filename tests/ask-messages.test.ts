import { describe, expect, it } from 'vitest';
import { formatAskMessage, getRandomAskMessage } from '../src/ask-messages.js';

describe('ask-messages', () => {
  describe('getRandomAskMessage', () => {
    it('should return a string', () => {
      const message = getRandomAskMessage();
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    });

    it('should return different messages on multiple calls', () => {
      const messages = new Set();

      for (let i = 0; i < 50; i++) {
        messages.add(getRandomAskMessage());
      }

      expect(messages.size).toBeGreaterThan(1);
    });

    it('should return messages with personality (contain emojis)', () => {
      const message = getRandomAskMessage();
      const emojiRegex =
        /[\u{1F300}-\u{1F6FF}]|[\u{1F900}-\u{1F9FF}]|[\u{2600}-\u{27FF}]/u;
      expect(emojiRegex.test(message)).toBe(true);
    });
  });

  describe('formatAskMessage', () => {
    const mockPublicKey = 'test123PublicKey';
    const mockServiceName = 'user/repo';

    it('should format message with public key and service name', () => {
      const message = formatAskMessage(mockPublicKey, mockServiceName);

      expect(message).toContain(mockPublicKey);
      expect(message).toContain(mockServiceName);
      expect(message).toContain('lpop give');
      expect(message).toContain('Repository:');
    });

    it('should include environment when provided', () => {
      const environment = 'production';
      const message = formatAskMessage(
        mockPublicKey,
        mockServiceName,
        environment,
      );

      expect(message).toContain(`[${environment}]`);
    });

    it('should not include environment section when not provided', () => {
      const message = formatAskMessage(mockPublicKey, mockServiceName);

      expect(message).not.toContain('[');
      expect(message).not.toContain(']');
    });

    it('should contain plain text command without formatting', () => {
      const message = formatAskMessage(mockPublicKey, mockServiceName);

      expect(message).toContain('lpop give');
      expect(message).not.toContain('`');
      expect(message).not.toContain('```');
    });

    it('should have proper structure with line breaks', () => {
      const message = formatAskMessage(mockPublicKey, mockServiceName);
      const lines = message.split('\n');

      expect(lines.length).toBeGreaterThan(3);
      expect(lines.find((line) => line.includes('lpop give'))).toBeTruthy();
    });
  });
});
