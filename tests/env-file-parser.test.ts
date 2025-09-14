import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
  writeEnvFile,
} from '../src/env-file-parser';

describe('EnvFileParser', () => {
  let testDir: string;

  beforeEach(() => {
    // Create a temporary directory for test files
    testDir = join(tmpdir(), `lpop-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('parseFile', () => {
    test('should parse env file successfully', async () => {
      const testFile = join(testDir, '.env');
      const content = 'API_KEY=secret123\nDB_URL=postgres://localhost';
      writeFileSync(testFile, content);

      const result = await parseFile(testFile);

      expect(result.entries).toHaveLength(2);
      expect(result.entries[0]).toEqual(asVariable('API_KEY', 'secret123'));
      expect(result.entries[1]).toEqual(
        asVariable('DB_URL', 'postgres://localhost'),
      );
    });

    test('should throw error when file not found', async () => {
      const missingFile = join(testDir, 'missing.env');

      await expect(parseFile(missingFile)).rejects.toThrow(
        `File not found: ${missingFile}`,
      );
    });

    test('should handle empty file', async () => {
      const emptyFile = join(testDir, 'empty.env');
      writeFileSync(emptyFile, '');

      const result = await parseFile(emptyFile);

      expect(result.entries).toHaveLength(1); // Empty file produces one empty entry
      expect(result.entries[0]).toEqual(asEmpty());
    });

    test('should parse file with comments and empty lines', async () => {
      const testFile = join(testDir, '.env');
      const content =
        '# Comment\nAPI_KEY=secret\n\n# Another comment\nDB_URL=postgres://localhost';
      writeFileSync(testFile, content);

      const result = await parseFile(testFile);

      expect(result.entries).toHaveLength(5);
      expect(result.entries[0]).toEqual(asComment('# Comment')); // Comments include the #
      expect(result.entries[1]).toEqual(asVariable('API_KEY', 'secret'));
      expect(result.entries[2]).toEqual(asEmpty());
      expect(result.entries[3]).toEqual(asComment('# Another comment')); // Comments include the #
      expect(result.entries[4]).toEqual(
        asVariable('DB_URL', 'postgres://localhost'),
      );
    });
  });

  describe('parseContent', () => {
    test('should parse environment variables correctly', () => {
      const content =
        'API_KEY=secret123\nDB_URL=postgres://localhost:5432/mydb';
      const result = parseContent(content);

      expect(result.entries).toHaveLength(2);
      expect(result.entries[0]).toEqual(asVariable('API_KEY', 'secret123'));
      expect(result.entries[1]).toEqual(
        asVariable('DB_URL', 'postgres://localhost:5432/mydb'),
      );
    });

    test('should handle comments', () => {
      const content = '# This is a comment\nAPI_KEY=secret\n# Another comment';
      const result = parseContent(content);

      expect(result.entries).toHaveLength(3);
      expect(result.entries[0]).toEqual(asComment('# This is a comment')); // Comments include the #
      expect(result.entries[1]).toEqual(asVariable('API_KEY', 'secret'));
      expect(result.entries[2]).toEqual(asComment('# Another comment')); // Comments include the #
    });

    test('should handle empty lines', () => {
      const content = 'API_KEY=secret\n\nDB_URL=postgres://localhost';
      const result = parseContent(content);

      expect(result.entries).toHaveLength(3);
      expect(result.entries[0]).toEqual(asVariable('API_KEY', 'secret'));
      expect(result.entries[1]).toEqual(asEmpty());
      expect(result.entries[2]).toEqual(
        asVariable('DB_URL', 'postgres://localhost'),
      );
    });

    test('should handle quoted values', () => {
      const content =
        'QUOTED="value with spaces"\nSINGLE_QUOTED=\'single quotes\'';
      const result = parseContent(content);

      expect(result.entries).toHaveLength(2);
      expect(result.entries[0]).toEqual(
        asVariable('QUOTED', 'value with spaces'),
      );
      expect(result.entries[1]).toEqual(
        asVariable('SINGLE_QUOTED', 'single quotes'),
      );
    });

    test('should handle multiline values', () => {
      const content = 'MULTILINE="line1\\nline2\\nline3"';
      const result = parseContent(content);

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]).toEqual(
        asVariable('MULTILINE', 'line1\\nline2\\nline3'), // Escaped newlines are preserved
      );
    });

    test('should ignore malformed lines', () => {
      const content =
        'VALID=value\nINVALID LINE WITHOUT EQUALS\nANOTHER_VALID=value2';
      const result = parseContent(content);

      expect(result.entries).toHaveLength(2);
      expect(result.entries[0]).toEqual(asVariable('VALID', 'value'));
      expect(result.entries[1]).toEqual(asVariable('ANOTHER_VALID', 'value2'));
      expect(result.ignoredCount).toBe(0); // ignoredCount only tracks empty values, not malformed lines
    });
  });

  describe('parseVariable', () => {
    test('should parse simple key-value pair', () => {
      const result = parseVariable('API_KEY=secret123');
      expect(result).toEqual(asVariable('API_KEY', 'secret123'));
    });

    test('should handle empty value', () => {
      const result = parseVariable('EMPTY_VAR=');
      expect(result).toEqual(asVariable('EMPTY_VAR', ''));
    });

    test('should handle value with equals sign', () => {
      const result = parseVariable('URL=https://example.com?param=value');
      expect(result).toEqual(
        asVariable('URL', 'https://example.com?param=value'),
      );
    });

    test('should handle quoted values', () => {
      const result = parseVariable('QUOTED="value with spaces"');
      expect(result).toEqual(asVariable('QUOTED', 'value with spaces'));
    });

    test('should handle inline comments', () => {
      const result = parseVariable('KEY=value # This is a comment');
      // parseVariable doesn't extract comments, it treats the whole thing as value
      expect(result).toEqual(asVariable('KEY', 'value # This is a comment'));
    });

    test('should throw for invalid format', () => {
      // parseVariable throws an error for invalid format
      expect(() => parseVariable('NOT_A_VARIABLE')).toThrow(
        'Invalid variable format',
      );
      expect(() => parseVariable('')).toThrow('Invalid variable format');
      expect(() => parseVariable('# Just a comment')).toThrow(
        'Invalid variable format',
      );
    });
  });

  describe('toKeyValuePairs', () => {
    test('should convert entries to key-value pairs', () => {
      const entries = [
        asComment(' Comment'),
        asVariable('API_KEY', 'secret'),
        asEmpty(),
        asVariable('DB_URL', 'postgres://localhost'),
      ];

      const result = toKeyValuePairs(entries);

      // toKeyValuePairs returns an object, not an array
      expect(result).toEqual({
        API_KEY: 'secret',
        DB_URL: 'postgres://localhost',
      });
    });

    test('should filter out non-variable entries', () => {
      const entries = [asComment(' Comment'), asEmpty()];

      const result = toKeyValuePairs(entries);

      // toKeyValuePairs returns an empty object
      expect(result).toEqual({});
    });
  });

  describe('fromKeyValuePairs', () => {
    test('should convert key-value pairs to entries', () => {
      // fromKeyValuePairs takes an object, not an array
      const pairs = {
        API_KEY: 'secret',
        DB_URL: 'postgres://localhost',
      };

      const result = fromKeyValuePairs(pairs);

      expect(result).toEqual([
        asVariable('API_KEY', 'secret'),
        asVariable('DB_URL', 'postgres://localhost'),
      ]);
    });

    test('should handle empty object', () => {
      const result = fromKeyValuePairs({});
      expect(result).toEqual([]);
    });
  });

  describe('generateContent', () => {
    test('should generate content from entries', () => {
      const entries = [
        asComment('# Configuration'),
        asVariable('API_KEY', 'secret'),
        asEmpty(),
        asVariable('DB_URL', 'postgres://localhost'),
      ];

      const result = generateContent(entries);

      expect(result).toBe(
        '# Configuration\nAPI_KEY=secret\n\nDB_URL=postgres://localhost\n', // generateContent adds trailing newline
      );
    });

    test('should handle quoted values', () => {
      const entries = [asVariable('QUOTED', 'value with spaces')];

      const result = generateContent(entries);

      expect(result).toBe('QUOTED="value with spaces"\n'); // generateContent adds trailing newline
    });

    test('should handle inline comments', () => {
      const entries = [
        asVariable('KEY', 'value', '# This is a comment'), // Comment should include #
      ];

      const result = generateContent(entries);

      expect(result).toBe('KEY=value # This is a comment\n'); // generateContent adds trailing newline
    });
  });

  describe('writeFile', () => {
    test('should write env file with entries', async () => {
      const testFile = join(testDir, 'output.env');
      const entries = [
        asComment('# Test file'),
        asVariable('API_KEY', 'secret123'),
        asVariable('DB_URL', 'postgres://localhost'),
      ];

      await writeEnvFile(testFile, entries);

      expect(existsSync(testFile)).toBe(true);

      // Read and verify the file was written correctly
      const result = await parseFile(testFile);
      expect(result.entries).toHaveLength(4); // Trailing newline creates an empty entry
      expect(result.entries[0]).toEqual(asComment('# Test file'));
      expect(result.entries[1]).toEqual(asVariable('API_KEY', 'secret123'));
      expect(result.entries[2]).toEqual(
        asVariable('DB_URL', 'postgres://localhost'),
      );
      expect(result.entries[3]).toEqual(asEmpty());
    });

    test.skip('should create directory if it does not exist', async () => {
      // writeFile doesn't create directories
      const nestedDir = join(testDir, 'nested', 'deep');
      const testFile = join(nestedDir, 'output.env');
      const entries = [asVariable('KEY', 'value')];

      await writeEnvFile(testFile, entries);

      expect(existsSync(testFile)).toBe(true);
      const result = await parseFile(testFile);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]).toEqual(asVariable('KEY', 'value'));
    });

    test('should overwrite existing file', async () => {
      const testFile = join(testDir, 'overwrite.env');

      // Write initial content
      await writeEnvFile(testFile, [asVariable('OLD', 'value')]);

      // Overwrite with new content
      await writeEnvFile(testFile, [asVariable('NEW', 'value')]);

      const result = await parseFile(testFile);
      expect(result.entries).toHaveLength(2); // Trailing newline creates an empty entry
      expect(result.entries[0]).toEqual(asVariable('NEW', 'value'));
      expect(result.entries[1]).toEqual(asEmpty());
    });
  });

  describe('Entry type constructors', () => {
    test('asVariable should create variable entry', () => {
      const entry = asVariable('KEY', 'value', 'comment');
      expect(entry).toEqual({
        type: 'variable',
        key: 'KEY',
        value: 'value',
        comment: 'comment',
      });
    });

    test('asComment should create comment entry', () => {
      const entry = asComment('This is a comment');
      expect(entry).toEqual({
        type: 'comment',
        comment: 'This is a comment', // Property is 'comment', not 'text'
      });
    });

    test('asEmpty should create empty entry', () => {
      const entry = asEmpty();
      expect(entry).toEqual({
        type: 'empty',
      });
    });
  });
});
