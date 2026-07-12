import { describe, expect, test } from 'vitest'
import { editedName, rowColName, sequenceName, zipName } from '../naming'

describe('sequenceName', () => {
  test('pads to 2 digits for small totals', () => {
    expect(sequenceName('sticker', 3, 16)).toBe('sticker-03')
  })
  test('pads to 3 digits when total is 100+', () => {
    expect(sequenceName('mood', 7, 120)).toBe('mood-007')
  })
  test('accepts chinese prefixes', () => {
    expect(sequenceName('开心', 1, 4)).toBe('开心-01')
  })
})

describe('rowColName', () => {
  test('formats row and column', () => {
    expect(rowColName('sticker', 1, 2)).toBe('sticker-r1-c2')
  })
})

describe('editedName', () => {
  test('appends -edited before nothing (extension is added by exporter)', () => {
    expect(editedName('happy.jpg')).toBe('happy-edited')
  })
  test('keeps inner dots', () => {
    expect(editedName('a.b.png')).toBe('a.b-edited')
  })
  test('handles files without extension', () => {
    expect(editedName('portrait')).toBe('portrait-edited')
  })
})

describe('zipName', () => {
  test('embeds the date', () => {
    expect(zipName(new Date('2026-07-11T12:00:00'))).toBe('sticker-studio-export-2026-07-11.zip')
  })
})
