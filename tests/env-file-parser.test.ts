import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  asComment,
  asEmpty,
  asVariable,
  fromKeyValuePairs,
  generateContent,
  parseContent,
  parseFile,
  parseVariable,
  toKeyValuePairs,
  writeFile as writeEnvFile,
} from '../src/env-file-parser';

vi.mock('node:fs/promises');
vi.mock('node:fs');

describe('EnvFileParser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseFile', () => {
    it('should parse env file successfully', async () => {
      const mockContent = 'API_KEY=secret123\nDB_URL=postgres://localhost';
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(mockContent);

      const result = await parseFile('/path/to/.env');

      expect(existsSync).toHaveBeenCalledWith('/path/to/.env');
      expect(readFile).toHaveBeenCalledWith('/path/to/.env', 'utf-8');
      expect(result.entries).toHaveLength(2);
      expect(result.entries[0]).toEqual(asVariable('API_KEY', 'secret123'));
    });

    it('should throw error when file not found', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      await expect(parseFile('/missing/.env')).rejects.toThrow(
        'File not found: /missing/.env',
      );
    });
  });

  describe('parseContent', () => {
    it('should parse simple variables', () => {
      const content = 'API_KEY=secret123\nDB_URL=postgres://localhost';

      const result = parseContent(content);

      expect(result.entries).toHaveLength(2);
      expect(result.entries[0]).toEqual(asVariable('API_KEY', 'secret123'));
      expect(result.entries[1]).toEqual(
        asVariable('DB_URL', 'postgres://localhost'),
      );
    });

    it('should handle quoted values', () => {
      const content = `SINGLE_QUOTES='value with spaces'
        DOUBLE_QUOTES="another value"
        NO_QUOTES=simple_value`;

      const result = parseContent(content);

      expect(result.entries[0]).toEqual(
        asVariable('SINGLE_QUOTES', 'value with spaces'),
      );
      expect(result.entries[1]).toEqual(
        asVariable('DOUBLE_QUOTES', 'another value'),
      );
      expect(result.entries[2]).toEqual(
        asVariable('NO_QUOTES', 'simple_value'),
      );
    });

    it('should handle inline comments', () => {
      const content = 'API_KEY=secret123 # Production API key';

      const result = parseContent(content);

      expect(result.entries[0]).toEqual(
        asVariable('API_KEY', 'secret123', '# Production API key'),
      );
    });

    it('should handle inline comments with different line endings (Windows vs Unix)', () => {
      // Test with Windows line endings
      const windowsContent =
        'API_KEY=secret123 # Production API key\r\nDB_URL=postgres://localhost # Database URL';

      // Test with Unix line endings
      const unixContent =
        'API_KEY=secret123 # Production API key\nDB_URL=postgres://localhost # Database URL';

      const windowsResult = parseContent(windowsContent);
      const unixResult = parseContent(unixContent);

      // Both should produce the same result regardless of line endings
      expect(windowsResult.entries).toHaveLength(2);
      expect(unixResult.entries).toHaveLength(2);

      expect(unixResult.entries[0]).toEqual(
        asVariable('API_KEY', 'secret123', '# Production API key'),
      );
      expect(windowsResult.entries[0]).toEqual(unixResult.entries[0]);
    });

    it('should handle inline comments with spaces before comment', () => {
      const content = 'API_KEY=secret123  # Production API key';

      const result = parseContent(content);

      expect(result.entries[0]).toEqual(
        asVariable('API_KEY', 'secret123', '# Production API key'),
      );
    });

    it('should handle inline comments with tabs before comment', () => {
      const content = 'API_KEY=secret123\t# Production API key';

      const result = parseContent(content);

      expect(result.entries[0]).toEqual(
        asVariable('API_KEY', 'secret123', '# Production API key'),
      );
    });

    it('should handle inline comments with mixed whitespace', () => {
      const content = 'API_KEY=secret123 \t # Production API key';

      const result = parseContent(content);

      expect(result.entries[0]).toEqual(
        asVariable('API_KEY', 'secret123', '# Production API key'),
      );
    });

    it('should handle values that contain hash symbols', () => {
      const content = 'HASH_VALUE=value#with#hashes # This is a comment';

      const result = parseContent(content);

      expect(result.entries[0]).toEqual(
        asVariable('HASH_VALUE', 'value#with#hashes', '# This is a comment'),
      );
    });

    it('should handle hash symbols in values without comments', () => {
      const content = 'HASH_VALUE=value#with#hashes';

      const result = parseContent(content);

      expect(result.entries[0]).toEqual(
        asVariable('HASH_VALUE', 'value#with#hashes'),
      );
    });

    it('should handle hash symbols in quoted values', () => {
      const content = 'HASH_VALUE="value#with#hashes" # This is a comment';

      const result = parseContent(content);

      expect(result.entries[0]).toEqual(
        asVariable('HASH_VALUE', 'value#with#hashes', '# This is a comment'),
      );
    });

    it('should handle hash symbols in quoted values without comments', () => {
      const content = 'HASH_VALUE="value#with#hashes"';

      const result = parseContent(content);

      expect(result.entries[0]).toEqual(
        asVariable('HASH_VALUE', 'value#with#hashes'),
      );
    });

    it('should handle quoted values with inline comments', () => {
      const content = 'MESSAGE="Hello World" # Greeting message';

      const result = parseContent(content);

      expect(result.entries[0]).toEqual(
        asVariable('MESSAGE', 'Hello World', '# Greeting message'),
      );
    });

    it('should handle full-line comments', () => {
      const content = `# This is a comment
# Another comment
API_KEY=secret123`;

      const result = parseContent(content);
      expect(result.entries).toHaveLength(3);
    });

    it('should skip empty lines', () => {
      const content = `API_KEY=secret123

DB_URL=postgres://localhost`;

      const result = parseContent(content);

      expect(result.entries).toHaveLength(3);
      expect(result.entries[1]).toEqual(asEmpty());
    });

    it('should handle empty values', () => {
      const content = 'EMPTY_VAR=';

      const result = parseContent(content);

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]).toEqual(asVariable('EMPTY_VAR', ''));
    });

    it('should handle empty values with comments', () => {
      const content = 'EMPTY_VAR= # This is a comment';

      const result = parseContent(content);

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]).toEqual(
        asVariable('EMPTY_VAR', '', '# This is a comment'),
      );
    });

    it('should include ignoredCount property', () => {
      const content = 'EMPTY_VAR=\nFILLED_VAR=value';

      const result = parseContent(content);

      expect(result.ignoredCount).toBe(1);
    });

    it('should handle values with equals signs', () => {
      const content = 'CONNECTION=user=admin;pass=secret';

      const result = parseContent(content);

      expect(result.entries[0]).toEqual(
        asVariable('CONNECTION', 'user=admin;pass=secret'),
      );
    });

    describe('hash character handling', () => {
      it('should treat # as part of value when not preceded by whitespace', () => {
        const content = 'KEY=value#hash';

        const result = parseContent(content);

        expect(result.entries[0]).toEqual(asVariable('KEY', 'value#hash'));
      });

      it('should treat # as comment when preceded by whitespace', () => {
        const content = 'KEY=value # This is a comment';

        const result = parseContent(content);

        expect(result.entries[0]).toEqual(
          asVariable('KEY', 'value', '# This is a comment'),
        );
      });

      it('should preserve # characters within double quotes', () => {
        const content = 'KEY="value#with#hashes" # Real comment';

        const result = parseContent(content);

        expect(result.entries[0]).toEqual(
          asVariable('KEY', 'value#with#hashes', '# Real comment'),
        );
      });

      it('should preserve # characters within single quotes', () => {
        const content = "KEY='value#with#hashes' # Real comment";

        const result = parseContent(content);

        expect(result.entries[0]).toEqual(
          asVariable('KEY', 'value#with#hashes', '# Real comment'),
        );
      });

      it('should handle # characters in quoted values without comments', () => {
        const content = 'KEY="value#with#hashes"';

        const result = parseContent(content);

        expect(result.entries[0]).toEqual(
          asVariable('KEY', 'value#with#hashes'),
        );
      });

      it('should handle # characters in unquoted values without comments', () => {
        const content = 'KEY=value#hash';

        const result = parseContent(content);

        expect(result.entries[0]).toEqual(asVariable('KEY', 'value#hash'));
      });

      it('should handle mixed # characters in and outside quotes', () => {
        const content = 'KEY="value#inside" # outside comment';

        const result = parseContent(content);

        expect(result.entries[0]).toEqual(
          asVariable('KEY', 'value#inside', '# outside comment'),
        );
      });

      it('should handle escaped quotes within quoted values', () => {
        const content = 'KEY="value\\"with#hash" # comment';

        const result = parseContent(content);

        expect(result.entries[0]).toEqual(
          asVariable('KEY', 'value\\"with#hash', '# comment'),
        );
      });

      it('should handle complex quoted values with # characters', () => {
        const content =
          'KEY="path/to/file#with#hashes.txt" # File path with hashes';

        const result = parseContent(content);

        expect(result.entries[0]).toEqual(
          asVariable(
            'KEY',
            'path/to/file#with#hashes.txt',
            '# File path with hashes',
          ),
        );
      });

      it('should handle multiple variables with # characters in different contexts', () => {
        const content = `QUOTED="value#with#hashes" # Quoted value with hashes
          UNQUOTED=value#hash # Unquoted value with hash
          PLAIN=simple_value # Plain value
          HASH_ONLY=#hash # Hash at start`;

        const result = parseContent(content);

        expect(result.entries).toHaveLength(4);
        expect(result.entries[0]).toEqual(
          asVariable(
            'QUOTED',
            'value#with#hashes',
            '# Quoted value with hashes',
          ),
        );
        expect(result.entries[1]).toEqual(
          asVariable('UNQUOTED', 'value#hash', '# Unquoted value with hash'),
        );
        expect(result.entries[2]).toEqual(
          asVariable('PLAIN', 'simple_value', '# Plain value'),
        );
        expect(result.entries[3]).toEqual(
          asVariable('HASH_ONLY', '', '#hash # Hash at start'),
        );
      });

      it('should handle the specific case from code review: unquoted value with hash', () => {
        const content = 'KEY=value#hash #comment';

        const result = parseContent(content);

        expect(result.entries[0]).toEqual(
          asVariable('KEY', 'value#hash', '#comment'),
        );
      });

      it('should handle the specific case from code review: quoted value with hash', () => {
        const content = 'KEY="value#with#hashes" # Real comment';

        const result = parseContent(content);

        expect(result.entries[0]).toEqual(
          asVariable('KEY', 'value#with#hashes', '# Real comment'),
        );
      });

      it('should demonstrate the bug: # inside quotes should not be treated as comment', () => {
        const content = 'KEY="value # with # hashes" # Real comment';

        const result = parseContent(content);

        expect(result.entries[0]).toEqual(
          asVariable('KEY', 'value # with # hashes', '# Real comment'),
        );
      });

      it('should handle the exact code review examples correctly', () => {
        const content = `# Code review test cases
          KEY1="value#with#hashes" # Real comment
          KEY2=value#hash #comment`;

        const result = parseContent(content);

        expect(result.entries).toHaveLength(3);

        // Case 1: KEY="value#with#hashes" # Real comment
        expect(result.entries[0]).toEqual(
          asComment('# Code review test cases'),
        );
        expect(result.entries[1]).toEqual(
          asVariable('KEY1', 'value#with#hashes', '# Real comment'),
        );
        // Case 2: KEY=value#hash #comment
        expect(result.entries[2]).toEqual(
          asVariable('KEY2', 'value#hash', '#comment'),
        );
      });
    });
  });

  describe('writeFile', () => {
    it('should write env file with entries', async () => {
      const entries = [
        asVariable('API_KEY', 'secret123'),
        asVariable('DB_URL', 'postgres://localhost'),
      ];

      await writeEnvFile('/path/to/.env', entries);

      expect(writeFile).toHaveBeenCalledWith(
        '/path/to/.env',
        'API_KEY=secret123\nDB_URL=postgres://localhost\n',
        'utf-8',
      );
    });
  });

  describe('generateContent', () => {
    it('should generate content with entries', () => {
      const entries = [
        asVariable('API_KEY', 'secret123'),
        asVariable('DB_URL', 'postgres://localhost'),
      ];

      const content = generateContent(entries);

      expect(content).toBe('API_KEY=secret123\nDB_URL=postgres://localhost\n');
    });

    it('should add quotes to values with spaces', () => {
      const entries = [asVariable('MESSAGE', 'Hello World')];

      const content = generateContent(entries);

      expect(content).toBe('MESSAGE="Hello World"\n');
    });

    it('should include inline comments', () => {
      const entries = [asVariable('API_KEY', 'secret123', '# Production key')];

      const content = generateContent(entries);

      expect(content).toBe('API_KEY=secret123 # Production key\n');
    });

    it('should handle empty entries array', () => {
      const content = generateContent([]);

      expect(content).toBe('');
    });

    it('should quote empty values', () => {
      const entries = [asVariable('EMPTY', '')];

      const content = generateContent(entries);

      expect(content).toBe('EMPTY=\n');
    });

    it('should handle empty values with comments', () => {
      const entries = [asVariable('EMPTY', '', '# This is a comment')];

      const content = generateContent(entries);

      expect(content).toBe('EMPTY= # This is a comment\n');
    });

    it('should quote values with special characters', () => {
      const entries = [
        asVariable('PATH', '/usr/bin:$PATH'),
        asVariable('HASH', 'value#comment'),
        asVariable('QUOTE', "it's"),
      ];

      const content = generateContent(entries);

      expect(content).toContain('PATH="/usr/bin:$PATH"');
      expect(content).toContain('HASH="value#comment"');
      expect(content).toContain('QUOTE="it\'s"');
    });

    it('should handle comment entries', () => {
      const entries = [
        asComment('# This is a comment'),
        asVariable('API_KEY', 'secret123'),
      ];

      const content = generateContent(entries);

      expect(content).toBe('# This is a comment\nAPI_KEY=secret123\n');
    });

    it('should handle empty entries', () => {
      const entries = [asEmpty(), asVariable('API_KEY', 'secret123')];

      const content = generateContent(entries);

      expect(content).toBe('\nAPI_KEY=secret123\n');
    });
  });

  describe('fromKeyValuePairs', () => {
    it('should convert object to entries', () => {
      const pairs = {
        API_KEY: 'secret123',
        DB_URL: 'postgres://localhost',
      };

      const entries = fromKeyValuePairs(pairs);

      expect(entries).toEqual([
        asVariable('API_KEY', 'secret123'),
        asVariable('DB_URL', 'postgres://localhost'),
      ]);
    });

    it('should handle empty object', () => {
      const entries = fromKeyValuePairs({});

      expect(entries).toEqual([]);
    });
  });

  describe('toKeyValuePairs', () => {
    it('should convert entries to object', () => {
      const entries = [
        asVariable('API_KEY', 'secret123'),
        asVariable('DB_URL', 'postgres://localhost'),
      ];

      const pairs = toKeyValuePairs(entries);

      expect(pairs).toEqual({
        API_KEY: 'secret123',
        DB_URL: 'postgres://localhost',
      });
    });

    it('should handle empty entries', () => {
      const pairs = toKeyValuePairs([]);

      expect(pairs).toEqual({});
    });

    it('should ignore comments in conversion', () => {
      const entries = [
        asComment('# This is a comment'),
        asVariable('API_KEY', 'secret123'),
        asEmpty(),
      ];

      const pairs = toKeyValuePairs(entries);

      expect(pairs).toEqual({
        API_KEY: 'secret123',
      });
    });
  });

  describe('parseVariable', () => {
    it('should parse simple variable', () => {
      const result = parseVariable('API_KEY=secret123');

      expect(result).toEqual(asVariable('API_KEY', 'secret123'));
    });

    it('should handle quoted values', () => {
      const result = parseVariable('MESSAGE="Hello World"');

      expect(result).toEqual(asVariable('MESSAGE', 'Hello World'));
    });

    it('should handle values with equals signs', () => {
      const result = parseVariable('CONNECTION=user=admin;pass=secret');

      expect(result).toEqual(
        asVariable('CONNECTION', 'user=admin;pass=secret'),
      );
    });

    it('should trim whitespace', () => {
      const result = parseVariable('  KEY  =  value  ');

      expect(result).toEqual(asVariable('KEY', 'value'));
    });

    it('should throw error for invalid format', () => {
      expect(() => parseVariable('invalid')).toThrow(
        'Invalid variable format: invalid. Expected KEY=value',
      );
    });

    it('should handle empty values', () => {
      const result = parseVariable('EMPTY=');

      expect(result).toEqual(asVariable('EMPTY', ''));
    });
  });
});
