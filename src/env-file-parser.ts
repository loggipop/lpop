import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';

export interface EnvEntry {
  key: string;
  value: string;
  comment?: string;
}

export interface ParsedEnvFile {
  entries: EnvEntry[];
  comments: string[];
  originalContent: string;
}

export class EnvFileParser {
  static async parseFile(filePath: string): Promise<ParsedEnvFile> {
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = await readFile(filePath, 'utf-8');
    return this.parseContent(content);
  }

  static parseContent(content: string): ParsedEnvFile {
    const lines = content.split('\n');
    const entries: EnvEntry[] = [];
    const comments: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines
      if (!trimmed) continue;

      // Handle full-line comments
      if (trimmed.startsWith('#')) {
        comments.push(trimmed);
        continue;
      }

      // Handle variable assignments
      const match = line.match(/^([^=]+?)=(.*)$/);
      if (match) {
        const [, keyPart, valuePart] = match;
        const key = keyPart.trim();
        
        // Extract inline comment if present
        const valueMatch = valuePart.match(/^(.*?)(\s*#.*)?$/);
        const value = valueMatch ? valueMatch[1].trim() : valuePart.trim();
        const comment = valueMatch && valueMatch[2] ? valueMatch[2].trim() : undefined;

        // Remove quotes if present
        const cleanValue = this.removeQuotes(value);

        entries.push({
          key,
          value: cleanValue,
          comment
        });
      }
    }

    return {
      entries,
      comments,
      originalContent: content
    };
  }

  static async writeFile(filePath: string, entries: EnvEntry[], comments: string[] = []): Promise<void> {
    const content = this.generateContent(entries, comments);
    await writeFile(filePath, content, 'utf-8');
  }

  static generateContent(entries: EnvEntry[], comments: string[] = []): string {
    const lines: string[] = [];

    // Add standalone comments at the top
    for (const comment of comments) {
      lines.push(comment);
    }

    if (comments.length > 0 && entries.length > 0) {
      lines.push(''); // Empty line after comments
    }

    // Add environment variables
    for (const { key, value, comment } of entries) {
      const quotedValue = this.needsQuotes(value) ? `"${value}"` : value;
      const line = comment 
        ? `${key}=${quotedValue} ${comment}`
        : `${key}=${quotedValue}`;
      lines.push(line);
    }

    return lines.join('\n') + (lines.length > 0 ? '\n' : '');
  }

  private static removeQuotes(value: string): string {
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }
    return value;
  }

  private static needsQuotes(value: string): boolean {
    // Quote if contains spaces, special characters, or is empty
    return /[\s#"'$`\\]/.test(value) || value === '';
  }

  static fromKeyValuePairs(pairs: Record<string, string>): EnvEntry[] {
    return Object.entries(pairs).map(([key, value]) => ({
      key,
      value
    }));
  }

  static toKeyValuePairs(entries: EnvEntry[]): Record<string, string> {
    return entries.reduce((acc, { key, value }) => {
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);
  }

  static parseVariable(variableString: string): EnvEntry {
    const match = variableString.match(/^([^=]+?)=(.*)$/);
    if (!match) {
      throw new Error(`Invalid variable format: ${variableString}. Expected KEY=value`);
    }

    const [, key, value] = match;
    return {
      key: key.trim(),
      value: this.removeQuotes(value.trim())
    };
  }
}