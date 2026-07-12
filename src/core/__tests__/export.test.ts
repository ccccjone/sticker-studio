import { describe, expect, test } from 'vitest'
import { buildManifest } from '../export'

describe('buildManifest', () => {
  test('produces parseable JSON with all fields', () => {
    const json = buildManifest({
      format: 'png',
      width: 1024,
      height: 1024,
      transparent: true,
      files: [
        { originalName: 'happy.jpg', exportName: 'happy.png', status: 'success' },
        { originalName: 'sad.jpg', exportName: 'sad.png', status: 'failed' },
      ],
    })
    const parsed = JSON.parse(json)
    expect(parsed.format).toBe('png')
    expect(parsed.width).toBe(1024)
    expect(parsed.transparent).toBe(true)
    expect(parsed.files).toHaveLength(2)
    expect(parsed.files[0]).toEqual({
      originalName: 'happy.jpg',
      exportName: 'happy.png',
      status: 'success',
    })
    expect(new Date(parsed.exportedAt).getTime()).not.toBeNaN()
  })
})
