import { existsSync } from 'node:fs';
import { writeFile as fsWriteFile, readFile } from 'node:fs/promises';
import chalk from 'chalk';
import type { KeychainEntry } from './keychain-manager.js';

export type EnvEntry = VariableEntry | CommentEntry | EmptyEntry;

export interface VariableEntry {
  type: 'variable';
  key: string;
  value: string;
  comment?: string;
}

export interface CommentEntry {
  type: 'comment';
  comment: string;
}

export interface EmptyEntry {
  type: 'empty';
}

export interface ParsedEnvFile {
  entries: EnvEntry[];
  ignoredCount: number;
}

export function asComment(comment: string): CommentEntry {
  return { type: 'comment', comment };
}

export function asEmpty(): EmptyEntry {
  return { type: 'empty' };
}

export function asVariable(
  key: string,
  value: string,
  comment?: string,
): VariableEntry {
  if (!comment) {
    return { type: 'variable', key, value };
  }
  return { type: 'variable', key, value, comment };
}

export async function parseFile(filePath: string): Promise<ParsedEnvFile> {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = await readFile(filePath, 'utf-8');
  return parseContent(content);
}

/**
 * Extracts value and comment from a variable assignment value part.
 * A comment starts with # only when preceded by whitespace and not inside quotes.
 * @param valuePart - The part after the equals sign in a variable assignment
 * @returns Object containing the extracted value and comment
 */
function extractValueAndComment(valuePart: string): {
  value: string;
  comment: string;
} {
  let value = valuePart;
  let comment = '';

  // First, check if the value starts with a hash (empty value with comment)
  if (value.startsWith('#')) {
    comment = value;
    value = '';
  } else {
    // Find the first # that's not inside quotes
    let inQuotes = false;
    let quoteChar = '';
    let commentStart = -1;

    for (let i = 0; i < value.length; i++) {
      const char = value[i];

      if (char === '"' || char === "'") {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          // Check for escaped quote
          if (i === 0 || value[i - 1] !== '\\') {
            inQuotes = false;
            quoteChar = '';
          }
        }
      } else if (char === '#' && !inQuotes) {
        // Found a # that's not inside quotes
        // Check if it's preceded by whitespace
        if (i === 0 || /\s/.test(value[i - 1])) {
          commentStart = i;
          break;
        }
      }
    }

    if (commentStart !== -1) {
      comment = value.substring(commentStart);
      value = value.substring(0, commentStart).trim();
    }
  }

  return { value, comment };
}

export function parseContent(content: string): ParsedEnvFile {
  // ensure unix line endings to support better matching of values and comments.
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const entries: EnvEntry[] = [];
  let ignoredCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const variableMatch = line.match(/^([^=]+?)=(.*)$/);

    if (!trimmed) {
      // Skip empty lines
      entries.push(asEmpty());
    } else if (trimmed.startsWith('#')) {
      // Handle full-line comments
      entries.push(asComment(trimmed));
    } else if (variableMatch) {
      // Handle variable assignments
      const [, keyPart, valuePart] = variableMatch;
      const key = keyPart.trim();
      const value = valuePart.trim();
      const { value: extractedValue, comment } = extractValueAndComment(value);
      const variableEntry = asVariable(
        key,
        removeQuotes(extractedValue),
        comment,
      );
      entries.push(variableEntry);
      if (!variableEntry.value) {
        ignoredCount++;
      }
    }
  }

  return { entries, ignoredCount };
}

export async function writeFile(
  filePath: string,
  entries: EnvEntry[],
): Promise<void> {
  const content = generateContent(entries);
  await fsWriteFile(filePath, content, 'utf-8');
}

export function generateContent(entries: EnvEntry[]): string {
  const lines: string[] = [];
  for (const entry of entries) {
    if (entry.type === 'comment') {
      lines.push(entry.comment);
    } else if (entry.type === 'empty') {
      lines.push('');
    } else if (entry.type === 'variable') {
      let value = needsQuotes(entry.value) ? `"${entry.value}"` : entry.value;
      value = value || '';
      const comment = entry.comment ? ` ${entry.comment}` : '';
      lines.push(`${entry.key}=${value}${comment}`);
    }
  }
  return lines.join('\n') + (lines.length > 0 ? '\n' : '');
}

function removeQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function needsQuotes(value: string): boolean {
  if (value === '') {
    return false;
  }
  // Quote if contains spaces, special characters, or is empty
  return /[\s#"'$`\\]/.test(value);
}

export function fromKeyValuePairs(
  pairs: Record<string, string>,
): VariableEntry[] {
  return Object.entries(pairs).map(([key, value]) => ({
    type: 'variable',
    key,
    value,
  }));
}

export function toKeyValuePairs(entries: EnvEntry[]): Record<string, string> {
  return entries.reduce(
    (acc, entry) => {
      if (entry.type === 'variable') {
        acc[entry.key] = entry.value;
      }
      return acc;
    },
    {} as Record<string, string>,
  );
}

export function parseVariable(variableString: string): VariableEntry {
  const match = variableString.match(/^([^=]+?)=(.*)$/);
  if (!match) {
    throw new Error(
      `Invalid variable format: ${variableString}. Expected KEY=value`,
    );
  }

  const [, key, value] = match;
  return asVariable(key.trim(), removeQuotes(value.trim()));
}

/**
 * Merges keychain variables with .env.example template
 * @param envExamplePath - Path to .env.example file
 * @param keychainVariables - Variables from keychain
 * @returns Merged environment entries
 */
export async function mergeWithEnvExample(
  envExamplePath: string,
  keychainVariables: KeychainEntry[],
): Promise<EnvEntry[]> {
  try {
    // Parse .env.example to get template structure
    const template = await parseFile(envExamplePath);
    const keychainMap = new Map(keychainVariables.map((v) => [v.key, v.value]));

    const mergedEntries: EnvEntry[] = [];
    const usedKeys = new Set<string>();

    // Process template entries to maintain exact layout
    for (const entry of template.entries) {
      if (entry.type === 'comment') {
        mergedEntries.push(entry);
      } else if (entry.type === 'empty') {
        mergedEntries.push(entry);
      } else if (entry.type === 'variable') {
        const keychainValue = keychainMap.get(entry.key);

        if (keychainValue !== undefined) {
          // Variable exists in keychain, use the actual value
          mergedEntries.push(
            asVariable(entry.key, keychainValue, entry.comment),
          );
          usedKeys.add(entry.key);
        } else {
          // Variable not in keychain, keep template entry as-is (empty value)
          mergedEntries.push(entry);
        }
      }
    }

    // Add remaining keychain variables not in template (sorted alphabetically)
    const remainingVariables = keychainVariables
      .filter((v) => !usedKeys.has(v.key))
      .sort((a, b) => a.key.localeCompare(b.key));

    if (remainingVariables.length > 0) {
      // Add a separator entry with empty key and comment to create a visual separator
      if (mergedEntries.length > 0) {
        mergedEntries.push(asEmpty());
        mergedEntries.push(asComment('# Additional variables from keychain'));
      }

      // Convert KeychainEntry to VariableEntry
      const remainingVariableEntries: VariableEntry[] = remainingVariables.map(
        (v) => asVariable(v.key, v.value),
      );
      mergedEntries.push(...remainingVariableEntries);
    }

    return mergedEntries;
  } catch (error) {
    // In case the .env.example no longer exists or other filesystem errors then we fallback to not using the template.
    console.log(
      chalk.yellow(
        `Warning: Could not parse .env.example: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
    console.log(chalk.yellow('Falling back to standard output format'));
    // Convert KeychainEntry to VariableEntry for fallback
    return keychainVariables.map((v) => asVariable(v.key, v.value));
  }
}
