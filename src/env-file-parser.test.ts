import { describe, expect, test, beforeEach, mock } from 'bun:test'
import { EnvFileParser } from './env-file-parser'

// Mock fs modules
const mockReadFile = mock(() => Promise.resolve('KEY1=value1\nKEY2=value2'))
const mockWriteFile = mock(() => Promise.resolve())
const mockExistsSync = mock(() => true)

mock.module('fs/promises', () => ({
  readFile: mockReadFile,
  writeFile: mockWriteFile,
}))

mock.module('fs', () => ({
  existsSync: mockExistsSync,
}))

describe('EnvFileParser', () => {
  beforeEach(() => {
    mockReadFile.mockClear()
    mockWriteFile.mockClear()
    mockExistsSync.mockClear()
  })

  describe('parseFile', () => {
    test('should parse file successfully', async () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFile.mockResolvedValue('KEY1=value1\nKEY2=value2')
      
      const result = await EnvFileParser.parseFile('/test/.env')
      
      expect(mockExistsSync).toHaveBeenCalledWith('/test/.env')
      expect(mockReadFile).toHaveBeenCalledWith('/test/.env', 'utf-8')
      expect(result.entries).toHaveLength(2)
      expect(result.entries[0]).toEqual({ key: 'KEY1', value: 'value1' })
      expect(result.entries[1]).toEqual({ key: 'KEY2', value: 'value2' })
    })

    test('should throw when file not found', async () => {
      mockExistsSync.mockReturnValue(false)
      
      await expect(EnvFileParser.parseFile('/test/.env'))
        .rejects.toThrow('File not found: /test/.env')
    })
  })

  describe('parseContent', () => {
    test('should parse simple variables', () => {
      const content = 'KEY1=value1\nKEY2=value2'
      
      const result = EnvFileParser.parseContent(content)
      
      expect(result.entries).toEqual([
        { key: 'KEY1', value: 'value1' },
        { key: 'KEY2', value: 'value2' },
      ])
      expect(result.comments).toEqual([])
      expect(result.originalContent).toBe(content)
    })

    test('should handle quoted values', () => {
      const content = `
        SIMPLE=value
        DOUBLE_QUOTED="quoted value"
        SINGLE_QUOTED='single quoted'
      `
      
      const result = EnvFileParser.parseContent(content)
      
      expect(result.entries).toEqual([
        { key: 'SIMPLE', value: 'value' },
        { key: 'DOUBLE_QUOTED', value: 'quoted value' },
        { key: 'SINGLE_QUOTED', value: 'single quoted' },
      ])
    })

    test('should parse inline comments', () => {
      const content = 'KEY1=value1 # This is a comment\nKEY2=value2'
      
      const result = EnvFileParser.parseContent(content)
      
      expect(result.entries).toEqual([
        { key: 'KEY1', value: 'value1', comment: '# This is a comment' },
        { key: 'KEY2', value: 'value2' },
      ])
    })

    test('should parse full-line comments', () => {
      const content = '# This is a comment\nKEY1=value1\n# Another comment'
      
      const result = EnvFileParser.parseContent(content)
      
      expect(result.comments).toEqual(['# This is a comment', '# Another comment'])
      expect(result.entries).toEqual([{ key: 'KEY1', value: 'value1' }])
    })

    test('should skip empty lines', () => {
      const content = 'KEY1=value1\n\n\nKEY2=value2'
      
      const result = EnvFileParser.parseContent(content)
      
      expect(result.entries).toEqual([
        { key: 'KEY1', value: 'value1' },
        { key: 'KEY2', value: 'value2' },
      ])
    })

    test('should handle empty values', () => {
      const content = 'EMPTY=\nKEY=value'
      
      const result = EnvFileParser.parseContent(content)
      
      expect(result.entries).toEqual([
        { key: 'EMPTY', value: '' },
        { key: 'KEY', value: 'value' },
      ])
    })
  })

  describe('writeFile', () => {
    test('should write file with entries', async () => {
      const entries = [
        { key: 'KEY1', value: 'value1' },
        { key: 'KEY2', value: 'value2' },
      ]
      
      await EnvFileParser.writeFile('/test/.env', entries)
      
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/test/.env',
        'KEY1=value1\nKEY2=value2\n',
        'utf-8'
      )
    })

    test('should write file with comments', async () => {
      const entries = [{ key: 'KEY1', value: 'value1' }]
      const comments = ['# This is a comment']
      
      await EnvFileParser.writeFile('/test/.env', entries, comments)
      
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/test/.env',
        '# This is a comment\n\nKEY1=value1\n',
        'utf-8'
      )
    })
  })

  describe('generateContent', () => {
    test('should generate content with quotes when needed', () => {
      const entries = [
        { key: 'SIMPLE', value: 'value' },
        { key: 'WITH_SPACE', value: 'has space' },
        { key: 'WITH_HASH', value: 'has#hash' },
        { key: 'EMPTY', value: '' },
      ]
      
      const content = EnvFileParser.generateContent(entries)
      
      expect(content).toBe(
        'SIMPLE=value\n' +
        'WITH_SPACE="has space"\n' +
        'WITH_HASH="has#hash"\n' +
        'EMPTY=""\n'
      )
    })

    test('should include inline comments', () => {
      const entries = [
        { key: 'KEY1', value: 'value1', comment: '# Comment' },
        { key: 'KEY2', value: 'value2' },
      ]
      
      const content = EnvFileParser.generateContent(entries)
      
      expect(content).toBe('KEY1=value1 # Comment\nKEY2=value2\n')
    })

    test('should handle empty entries array', () => {
      const content = EnvFileParser.generateContent([])
      
      expect(content).toBe('')
    })
  })

  describe('fromKeyValuePairs', () => {
    test('should convert object to entries', () => {
      const pairs = {
        KEY1: 'value1',
        KEY2: 'value2',
      }
      
      const entries = EnvFileParser.fromKeyValuePairs(pairs)
      
      expect(entries).toEqual([
        { key: 'KEY1', value: 'value1' },
        { key: 'KEY2', value: 'value2' },
      ])
    })
  })

  describe('toKeyValuePairs', () => {
    test('should convert entries to object', () => {
      const entries = [
        { key: 'KEY1', value: 'value1' },
        { key: 'KEY2', value: 'value2' },
      ]
      
      const pairs = EnvFileParser.toKeyValuePairs(entries)
      
      expect(pairs).toEqual({
        KEY1: 'value1',
        KEY2: 'value2',
      })
    })
  })

  describe('parseVariable', () => {
    test('should parse simple variable', () => {
      const result = EnvFileParser.parseVariable('KEY=value')
      
      expect(result).toEqual({ key: 'KEY', value: 'value' })
    })

    test('should parse quoted variable', () => {
      const result = EnvFileParser.parseVariable('KEY="quoted value"')
      
      expect(result).toEqual({ key: 'KEY', value: 'quoted value' })
    })

    test('should trim whitespace', () => {
      const result = EnvFileParser.parseVariable('  KEY  =  value  ')
      
      expect(result).toEqual({ key: 'KEY', value: 'value' })
    })

    test('should throw on invalid format', () => {
      expect(() => EnvFileParser.parseVariable('invalid'))
        .toThrow('Invalid variable format: invalid. Expected KEY=value')
    })
  })
})