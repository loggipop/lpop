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
  comments: string[];
  originalContent: string;
  ignoredCount: number;
  structure: FileStructure;
}

export interface FileStructure {
  lines: StructureLine[];
}

export interface StructureLine {
  type: 'comment' | 'variable' | 'empty';
  content?: string;
  entry?: EnvEntry;
  originalIndex: number;
}

export async function parseFile(filePath: string): Promise<ParsedEnvFile> {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = await readFile(filePath, 'utf-8');
  return parseContent(content);
}

export function parseContent(content: string): ParsedEnvFile {
  // ensure unix line endings to support better matching of values and comments.
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const entries: EnvEntry[] = [];
  const comments: string[] = [];
  const structure: StructureLine[] = [];
  let ignoredCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Handle empty lines
    if (!trimmed) {
      structure.push({
        type: 'empty',
        originalIndex: i,
      });
      continue;
    }

    // Handle full-line comments
    if (trimmed.startsWith('#')) {
      comments.push(trimmed);
      structure.push({
        type: 'comment',
        content: trimmed,
        originalIndex: i,
      });
      continue;
    }

    // Handle variable assignments
    const match = line.match(/^([^=]+?)=(.*)$/);
    if (match) {
      const [, keyPart, valuePart] = match;
      const key = keyPart.trim();

      // Extract inline comment if present
      // A comment starts with # only when preceded by whitespace and not inside quotes
      let value = valuePart.trim();
      let comment = '';

      // Check if there's a comment (hash at the beginning i.e. no value set OR preceded by whitespace i.e. there's a value set)
      const commentMatch = value.match(/^#(.*)$|(\s+)#(.*)$/);
      if (commentMatch) {
        if (commentMatch[1]) {
          // Hash at the beginning: value is empty, comment is everything after #
          value = '';
          comment = `#${commentMatch[1]}`;
        } else {
          // Hash preceded by whitespace
          value = value.substring(0, commentMatch.index).trim();
          comment = `#${commentMatch[3]}`;
        }
      }

      // Remove quotes if present
      const cleanValue = removeQuotes(value);

      // Create the entry
      const entry: VariableEntry = {
        type: 'variable',
        key,
        value: cleanValue,
        comment,
      };

      // Always add the entry, but count empty values as ignored
      entries.push(entry);

      // Add to structure
      structure.push({
        type: 'variable',
        entry,
        originalIndex: i,
      });

      // Count entries with empty values for reporting
      if (!cleanValue) {
        ignoredCount++;
      }
    }
  }

  return {
    entries,
    comments,
    originalContent: content,
    ignoredCount,
    structure: { lines: structure },
  };
}

export async function writeFile(
  filePath: string,
  entries: EnvEntry[],
  comments: string[] = [],
): Promise<void> {
  const content = generateContent(entries, comments);
  await fsWriteFile(filePath, content, 'utf-8');
}

export function generateContent(
  entries: EnvEntry[],
  comments: string[] = [],
): string {
  const lines: string[] = [];

  // Add standalone comments at the top
  for (const comment of comments) {
    lines.push(comment);
  }

  if (comments.length > 0 && entries.length > 0) {
    lines.push(''); // Empty line after comments
  }

  // Add environment variables
  for (const entry of entries) {
    switch (entry.type) {
      case 'comment':
        lines.push(entry.comment);
        break;
      case 'empty':
        lines.push(''); // Empty line
        break;
      case 'variable': {
        let value = needsQuotes(entry.value) ? `"${entry.value}"` : entry.value;
        value = value || '';
        const comment = entry.comment ? ` ${entry.comment}` : '';
        lines.push(`${entry.key}=${value}${comment}`);
        break;
      }
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
  return {
    type: 'variable',
    key: key.trim(),
    value: removeQuotes(value.trim()),
  };
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

    // Process template structure to maintain exact layout
    for (const structureLine of template.structure.lines) {
      if (structureLine.type === 'comment') {
        // Add standalone comments
        mergedEntries.push({
          type: 'comment',
          comment: structureLine.content ?? '',
        });
      } else if (structureLine.type === 'empty') {
        // Add empty lines
        mergedEntries.push({
          type: 'empty',
        });
      } else if (
        structureLine.type === 'variable' &&
        structureLine.entry &&
        structureLine.entry.type === 'variable'
      ) {
        const templateEntry = structureLine.entry as VariableEntry;
        const keychainValue = keychainMap.get(templateEntry.key);

        if (keychainValue !== undefined) {
          // Variable exists in keychain, use the actual value
          mergedEntries.push({
            type: 'variable',
            key: templateEntry.key,
            value: keychainValue,
            comment: templateEntry.comment,
          });
          usedKeys.add(templateEntry.key);
        } else {
          // Variable not in keychain, keep template entry as-is (empty value)
          mergedEntries.push(templateEntry);
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
        mergedEntries.push({
          type: 'empty',
        });
        mergedEntries.push({
          type: 'comment',
          comment: '# Additional variables from keychain',
        });
      }

      // Convert KeychainEntry to VariableEntry
      const remainingVariableEntries: VariableEntry[] = remainingVariables.map(
        (v) => ({
          type: 'variable',
          key: v.key,
          value: v.value,
        }),
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
    return keychainVariables.map((v) => ({
      type: 'variable',
      key: v.key,
      value: v.value,
    }));
  }
}
