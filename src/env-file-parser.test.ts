import { describe, expect, test, beforeEach, vi } from 'vitest'

// Mock the modules - these get hoisted
vi.mock('fs/promises')
vi.mock('fs')

import { EnvFileParser } from './env-file-parser'
import { readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'

// Create mocked functions
const mockedReadFile = vi.mocked(readFile)
const mockedWriteFile = vi.mocked(writeFile)
const mockedExistsSync = vi.mocked(existsSync)

describe('EnvFileParser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Set default mock implementations
    mockedReadFile.mockResolvedValue('KEY1=value1\nKEY2=value2')
    mockedWriteFile.mockResolvedValue(undefined)
    mockedExistsSync.mockReturnValue(true)
  })

  describe('parseFile', () => {
    test('should parse file successfully', async () => {
      mockedExistsSync.mockReturnValue(true)
      mockedReadFile.mockResolvedValue('KEY1=value1\nKEY2=value2')

      const result = await EnvFileParser.parseFile('test.env')

      expect(mockedExistsSync).toHaveBeenCalledWith('test.env')
      expect(mockedReadFile).toHaveBeenCalledWith('test.env', 'utf-8')
      expect(result.entries).toEqual([
        { key: 'KEY1', value: 'value1' },
        { key: 'KEY2', value: 'value2' },
      ])
    })

    test('should throw error if file does not exist', async () => {
      mockedExistsSync.mockReturnValue(false)

      await expect(EnvFileParser.parseFile('nonexistent.env')).rejects.toThrow('File not found: nonexistent.env')
    })

    test('should preserve comments', async () => {
      mockedReadFile.mockResolvedValue('# Comment\nKEY1=value1\n# Another comment\nKEY2=value2')

      const result = await EnvFileParser.parseFile('test.env')

      expect(result.comments).toEqual(['# Comment', '# Another comment'])
    })

    test('should handle empty lines', async () => {
      mockedReadFile.mockResolvedValue('KEY1=value1\n\nKEY2=value2\n\n')

      const result = await EnvFileParser.parseFile('test.env')

      expect(result.entries).toEqual([
        { key: 'KEY1', value: 'value1' },
        { key: 'KEY2', value: 'value2' },
      ])
    })

    test('should handle values with equals signs', async () => {
      mockedReadFile.mockResolvedValue('KEY1=value=with=equals')

      const result = await EnvFileParser.parseFile('test.env')

      expect(result.entries).toEqual([
        { key: 'KEY1', value: 'value=with=equals' },
      ])
    })

    test('should handle quoted values', async () => {
      mockedReadFile.mockResolvedValue('KEY1="quoted value"\nKEY2=\'single quoted\'')

      const result = await EnvFileParser.parseFile('test.env')

      expect(result.entries).toEqual([
        { key: 'KEY1', value: 'quoted value' },
        { key: 'KEY2', value: 'single quoted' },
      ])
    })
  })

  describe('parseVariable', () => {
    test('should parse variable with equals sign', () => {
      const result = EnvFileParser.parseVariable('KEY=value')
      expect(result).toEqual({ key: 'KEY', value: 'value' })
    })

    test('should parse variable with value containing equals', () => {
      const result = EnvFileParser.parseVariable('KEY=value=with=equals')
      expect(result).toEqual({ key: 'KEY', value: 'value=with=equals' })
    })

    test('should return null for invalid input', () => {
      expect(EnvFileParser.parseVariable('invalid')).toBeNull()
      expect(EnvFileParser.parseVariable('')).toBeNull()
      expect(EnvFileParser.parseVariable('=')).toBeNull()
    })

    test('should handle quoted values', () => {
      expect(EnvFileParser.parseVariable('KEY="quoted"')).toEqual({ key: 'KEY', value: 'quoted' })
      expect(EnvFileParser.parseVariable('KEY=\'single\'')).toEqual({ key: 'KEY', value: 'single' })
    })
  })

  describe('writeFile', () => {
    test('should write entries to file', async () => {
      const entries = [
        { key: 'KEY1', value: 'value1' },
        { key: 'KEY2', value: 'value2' },
      ]

      await EnvFileParser.writeFile('output.env', entries)

      expect(mockedWriteFile).toHaveBeenCalledWith('output.env', 'KEY1=value1\nKEY2=value2\n', 'utf-8')
    })

    test('should quote values with special characters', async () => {
      const entries = [
        { key: 'KEY1', value: 'value with spaces' },
        { key: 'KEY2', value: 'value\nwith\nnewlines' },
      ]

      await EnvFileParser.writeFile('output.env', entries)

      expect(mockedWriteFile).toHaveBeenCalledWith('output.env', 'KEY1="value with spaces"\nKEY2="value\\nwith\\nnewlines"\n', 'utf-8')
    })

    test('should handle empty values', async () => {
      const entries = [
        { key: 'KEY1', value: '' },
      ]

      await EnvFileParser.writeFile('output.env', entries)

      expect(mockedWriteFile).toHaveBeenCalledWith('output.env', 'KEY1=\n', 'utf-8')
    })
  })
})