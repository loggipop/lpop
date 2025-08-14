import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EnvFileParser } from '../src/env-file-parser';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';

vi.mock('fs/promises');
vi.mock('fs');

describe('EnvFileParser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseFile', () => {
    it('should parse env file successfully', async () => {
      const mockContent = 'API_KEY=secret123\nDB_URL=postgres://localhost';
      (existsSync as any).mockReturnValue(true);
      (readFile as any).mockResolvedValue(mockContent);

      const result = await EnvFileParser.parseFile('/path/to/.env');

      expect(existsSync).toHaveBeenCalledWith('/path/to/.env');
      expect(readFile).toHaveBeenCalledWith('/path/to/.env', 'utf-8');
      expect(result.entries).toHaveLength(2);
      expect(result.entries[0]).toEqual({
        type: 'variable',
        key: 'API_KEY',
        value: 'secret123',
        comment: undefined,
      });
    });

    it('should throw error when file not found', async () => {
      (existsSync as any).mockReturnValue(false);

      await expect(EnvFileParser.parseFile('/missing/.env')).rejects.toThrow('File not found: /missing/.env');
    });
  });

  describe('parseContent', () => {
    it('should parse simple variables', () => {
      const content = 'API_KEY=secret123\nDB_URL=postgres://localhost';

      const result = EnvFileParser.parseContent(content);

      expect(result.entries).toHaveLength(2);
      expect(result.entries[0]).toEqual({
        type: 'variable',
        key: 'API_KEY',
        value: 'secret123',
        comment: undefined,
      });
      expect(result.entries[1]).toEqual({
        type: 'variable',
        key: 'DB_URL',
        value: 'postgres://localhost',
        comment: undefined,
      });
    });

    it('should handle quoted values', () => {
      const content = `
        SINGLE_QUOTES='value with spaces'
        DOUBLE_QUOTES="another value"
        NO_QUOTES=simple_value
      `;

      const result = EnvFileParser.parseContent(content);

      expect((result.entries[0] as any).value).toBe('value with spaces');
      expect((result.entries[1] as any).value).toBe('another value');
      expect((result.entries[2] as any).value).toBe('simple_value');
    });

    it('should handle inline comments', () => {
      const content = 'API_KEY=secret123 # Production API key';

      const result = EnvFileParser.parseContent(content);

      expect(result.entries[0]).toEqual({
        type: 'variable',
        key: 'API_KEY',
        value: 'secret123',
        comment: '# Production API key',
      });
    });

    it('should handle full-line comments', () => {
      const content = `# This is a comment
# Another comment
API_KEY=secret123`;

      const result = EnvFileParser.parseContent(content);

      expect(result.comments).toEqual(['# This is a comment', '# Another comment']);
      expect(result.entries).toHaveLength(1);
    });

    it('should skip empty lines', () => {
      const content = `API_KEY=secret123

DB_URL=postgres://localhost`;

      const result = EnvFileParser.parseContent(content);

      expect(result.entries).toHaveLength(2);
    });

    it('should preserve original content', () => {
      const content = 'API_KEY=secret123';

      const result = EnvFileParser.parseContent(content);

      expect(result.originalContent).toBe(content);
    });

    it('should handle empty values', () => {
      const content = 'EMPTY_VAR=';

      const result = EnvFileParser.parseContent(content);

      expect(result.entries).toHaveLength(1);
      expect((result.entries[0] as any).key).toBe('EMPTY_VAR');
      expect((result.entries[0] as any).value).toBe('');
    });

    it('should include ignoredCount property', () => {
      const content = 'EMPTY_VAR=\nFILLED_VAR=value';

      const result = EnvFileParser.parseContent(content);

      expect(result.ignoredCount).toBe(1);
    });

    it('should handle values with equals signs', () => {
      const content = 'CONNECTION=user=admin;pass=secret';

      const result = EnvFileParser.parseContent(content);

      expect((result.entries[0] as any).value).toBe('user=admin;pass=secret');
    });
  });

  describe('writeFile', () => {
    it('should write env file with entries', async () => {
      const entries = [
        { type: 'variable' as const, key: 'API_KEY', value: 'secret123' },
        { type: 'variable' as const, key: 'DB_URL', value: 'postgres://localhost' },
      ];

      await EnvFileParser.writeFile('/path/to/.env', entries);

      expect(writeFile).toHaveBeenCalledWith(
        '/path/to/.env',
        'API_KEY=secret123\nDB_URL=postgres://localhost\n',
        'utf-8'
      );
    });

    it('should write env file with comments', async () => {
      const entries = [{ type: 'variable' as const, key: 'API_KEY', value: 'secret123' }];
      const comments = ['# Production environment'];

      await EnvFileParser.writeFile('/path/to/.env', entries, comments);

      expect(writeFile).toHaveBeenCalledWith(
        '/path/to/.env',
        '# Production environment\n\nAPI_KEY=secret123\n',
        'utf-8'
      );
    });
  });

  describe('generateContent', () => {
    it('should generate content with entries', () => {
      const entries = [
        { type: 'variable' as const, key: 'API_KEY', value: 'secret123' },
        { type: 'variable' as const, key: 'DB_URL', value: 'postgres://localhost' },
      ];

      const content = EnvFileParser.generateContent(entries);

      expect(content).toBe('API_KEY=secret123\nDB_URL=postgres://localhost\n');
    });

    it('should add quotes to values with spaces', () => {
      const entries = [{ type: 'variable' as const, key: 'MESSAGE', value: 'Hello World' }];

      const content = EnvFileParser.generateContent(entries);

      expect(content).toBe('MESSAGE="Hello World"\n');
    });

    it('should include inline comments', () => {
      const entries = [{ type: 'variable' as const, key: 'API_KEY', value: 'secret123', comment: '# Production key' }];

      const content = EnvFileParser.generateContent(entries);

      expect(content).toBe('API_KEY=secret123 # Production key\n');
    });

    it('should handle empty entries array', () => {
      const content = EnvFileParser.generateContent([]);

      expect(content).toBe('');
    });

    it('should quote empty values', () => {
      const entries = [{ type: 'variable' as const, key: 'EMPTY', value: '' }];

      const content = EnvFileParser.generateContent(entries);

      expect(content).toBe('EMPTY=""\n');
    });

    it('should quote values with special characters', () => {
      const entries = [
        { type: 'variable' as const, key: 'PATH', value: '/usr/bin:$PATH' },
        { type: 'variable' as const, key: 'HASH', value: 'value#comment' },
        { type: 'variable' as const, key: 'QUOTE', value: "it's" },
      ];

      const content = EnvFileParser.generateContent(entries);

      expect(content).toContain('PATH="/usr/bin:$PATH"');
      expect(content).toContain('HASH="value#comment"');
      expect(content).toContain('QUOTE="it\'s"');
    });

    it('should handle comment entries', () => {
      const entries = [
        { type: 'comment' as const, comment: '# This is a comment' },
        { type: 'variable' as const, key: 'API_KEY', value: 'secret123' },
      ];

      const content = EnvFileParser.generateContent(entries);

      expect(content).toBe('# This is a comment\nAPI_KEY=secret123\n');
    });

    it('should handle empty entries', () => {
      const entries = [{ type: 'empty' as const }, { type: 'variable' as const, key: 'API_KEY', value: 'secret123' }];

      const content = EnvFileParser.generateContent(entries);

      expect(content).toBe('\nAPI_KEY=secret123\n');
    });
  });

  describe('fromKeyValuePairs', () => {
    it('should convert object to entries', () => {
      const pairs = {
        API_KEY: 'secret123',
        DB_URL: 'postgres://localhost',
      };

      const entries = EnvFileParser.fromKeyValuePairs(pairs);

      expect(entries).toEqual([
        { type: 'variable', key: 'API_KEY', value: 'secret123' },
        { type: 'variable', key: 'DB_URL', value: 'postgres://localhost' },
      ]);
    });

    it('should handle empty object', () => {
      const entries = EnvFileParser.fromKeyValuePairs({});

      expect(entries).toEqual([]);
    });
  });

  describe('toKeyValuePairs', () => {
    it('should convert entries to object', () => {
      const entries = [
        { type: 'variable' as const, key: 'API_KEY', value: 'secret123' },
        { type: 'variable' as const, key: 'DB_URL', value: 'postgres://localhost' },
      ];

      const pairs = EnvFileParser.toKeyValuePairs(entries);

      expect(pairs).toEqual({
        API_KEY: 'secret123',
        DB_URL: 'postgres://localhost',
      });
    });

    it('should handle empty entries', () => {
      const pairs = EnvFileParser.toKeyValuePairs([]);

      expect(pairs).toEqual({});
    });

    it('should ignore comments in conversion', () => {
      const entries = [
        { type: 'comment' as const, comment: '# This is a comment' },
        { type: 'variable' as const, key: 'API_KEY', value: 'secret123' },
        { type: 'empty' as const },
      ];

      const pairs = EnvFileParser.toKeyValuePairs(entries);

      expect(pairs).toEqual({
        API_KEY: 'secret123',
      });
    });
  });

  describe('parseVariable', () => {
    it('should parse simple variable', () => {
      const result = EnvFileParser.parseVariable('API_KEY=secret123');

      expect(result).toEqual({
        type: 'variable',
        key: 'API_KEY',
        value: 'secret123',
      });
    });

    it('should handle quoted values', () => {
      const result = EnvFileParser.parseVariable('MESSAGE="Hello World"');

      expect(result).toEqual({
        type: 'variable',
        key: 'MESSAGE',
        value: 'Hello World',
      });
    });

    it('should handle values with equals signs', () => {
      const result = EnvFileParser.parseVariable('CONNECTION=user=admin;pass=secret');

      expect(result).toEqual({
        type: 'variable',
        key: 'CONNECTION',
        value: 'user=admin;pass=secret',
      });
    });

    it('should trim whitespace', () => {
      const result = EnvFileParser.parseVariable('  KEY  =  value  ');

      expect(result).toEqual({
        type: 'variable',
        key: 'KEY',
        value: 'value',
      });
    });

    it('should throw error for invalid format', () => {
      expect(() => EnvFileParser.parseVariable('invalid')).toThrow(
        'Invalid variable format: invalid. Expected KEY=value'
      );
    });

    it('should handle empty values', () => {
      const result = EnvFileParser.parseVariable('EMPTY=');

      expect(result).toEqual({
        type: 'variable',
        key: 'EMPTY',
        value: '',
      });
    });
  });
});
