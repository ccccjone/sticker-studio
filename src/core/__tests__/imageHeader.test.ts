import { describe, expect, test } from 'vitest'
import { readImageInfo, readImageSize } from '../imageHeader'

const u32be = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]
const u16be = (n: number) => [(n >> 8) & 255, n & 255]
const u16le = (n: number) => [n & 255, (n >> 8) & 255]
const u24le = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255]
const u32le = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255]
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0))
const bytes = (...parts: number[][]) => new Uint8Array(parts.flat())

function png(w: number, h: number) {
  return bytes(
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    u32be(13),
    ascii('IHDR'),
    u32be(w),
    u32be(h),
    [8, 6, 0, 0, 0],
  )
}

function sof(marker: number, w: number, h: number) {
  return [0xff, marker, ...u16be(17), 8, ...u16be(h), ...u16be(w), 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]
}

function jpeg(...segments: number[][]) {
  return bytes([0xff, 0xd8], ...segments)
}

function riff(chunk: string, data: number[]) {
  const body = [...ascii('WEBP'), ...ascii(chunk), ...u32le(data.length), ...data]
  return bytes(ascii('RIFF'), u32le(body.length), body)
}

describe('readImageSize PNG', () => {
  test('读取宽高', () => {
    expect(readImageSize(png(1234, 5678))).toEqual({ width: 1234, height: 5678 })
  })
  test('截断返回 null', () => {
    expect(readImageSize(png(10, 10).slice(0, 20))).toBeNull()
  })
})

describe('readImageSize JPEG', () => {
  test('baseline SOF0', () => {
    expect(readImageSize(jpeg(sof(0xc0, 640, 480)))).toEqual({ width: 640, height: 480 })
  })
  test('SOF 前有长 APP1(EXIF) 段', () => {
    const payload = new Array(5000).fill(0x45)
    const app1 = [0xff, 0xe1, ...u16be(payload.length + 2), ...payload]
    expect(readImageSize(jpeg(app1, sof(0xc0, 4000, 3000)))).toEqual({ width: 4000, height: 3000 })
  })
  test('填充 0xFF 与无长度段', () => {
    expect(readImageSize(jpeg([0xff, 0xff, 0xff, 0xd0], [0xff, 0x01], sof(0xc0, 7, 9)))).toEqual({
      width: 7,
      height: 9,
    })
  })
  test('progressive SOF2', () => {
    expect(readImageSize(jpeg(sof(0xc2, 800, 600)))).toEqual({ width: 800, height: 600 })
  })
  test('跳过 DHT(C4) 不当作 SOF', () => {
    const dht = [0xff, 0xc4, ...u16be(4), 0, 0]
    expect(readImageSize(jpeg(dht, sof(0xc0, 11, 22)))).toEqual({ width: 11, height: 22 })
  })
  test('截断返回 null', () => {
    expect(readImageSize(jpeg(sof(0xc0, 640, 480)).slice(0, 8))).toBeNull()
  })
  test('SOS 前未找到 SOF 返回 null', () => {
    expect(readImageSize(jpeg([0xff, 0xda, ...u16be(2)]))).toBeNull()
  })
})

describe('readImageSize WebP', () => {
  test('VP8 有损', () => {
    const data = [0, 0, 0, 0x9d, 0x01, 0x2a, ...u16le(320), ...u16le(200)]
    // 3 字节帧标签 + 起始码 9D 01 2A,宽高从数据偏移 6 起
    expect(readImageSize(riff('VP8 ', data))).toEqual({ width: 320, height: 200 })
  })
  test('VP8 高 2 位 scale 被屏蔽', () => {
    const data = [0, 0, 0, 0x9d, 0x01, 0x2a, ...u16le(320 | 0x4000), ...u16le(200 | 0xc000)]
    expect(readImageSize(riff('VP8 ', data))).toEqual({ width: 320, height: 200 })
  })
  test('VP8L 无损', () => {
    const bits = (300 - 1) | ((150 - 1) << 14)
    expect(readImageSize(riff('VP8L', [0x2f, ...u32le(bits)]))).toEqual({ width: 300, height: 150 })
  })
  test('VP8X 扩展', () => {
    const data = [0, 0, 0, 0, ...u24le(4095), ...u24le(2047)]
    expect(readImageSize(riff('VP8X', data))).toEqual({ width: 4096, height: 2048 })
  })
  test('截断返回 null', () => {
    expect(readImageSize(riff('VP8X', [0, 0, 0, 0, 1]))).toBeNull()
  })
})

describe('readImageSize 非法输入', () => {
  test('空数组', () => {
    expect(readImageSize(new Uint8Array(0))).toBeNull()
  })
  test('随机字节不抛异常', () => {
    let seed = 12345
    for (let i = 0; i < 200; i++) {
      const arr = new Uint8Array(64)
      for (let j = 0; j < arr.length; j++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff
        arr[j] = seed >> 16
      }
      expect(() => readImageSize(arr)).not.toThrow()
    }
  })
  test('随机头部伪装的截断数据不抛异常', () => {
    for (const full of [png(1, 1), jpeg(sof(0xc0, 1, 1)), riff('VP8L', [0x2f, 0, 0, 0, 0])]) {
      for (let n = 0; n < full.length; n++) {
        expect(() => readImageSize(full.slice(0, n))).not.toThrow()
      }
    }
  })
})

function exifApp1(orientation: number, order: 'MM' | 'II', opts: { truncate?: number } = {}) {
  const w16 = order === 'MM' ? u16be : u16le
  const w32 = order === 'MM' ? u32be : u32le
  const tiff = [
    ...ascii(order),
    ...w16(0x2a),
    ...w32(8),
    ...w16(1), // 1 entry
    ...w16(0x0112),
    ...w16(3),
    ...w32(1),
    ...w16(orientation),
    0,
    0,
    ...w32(0),
  ]
  // truncate 截断 EXIF 载荷本身,但保持 JPEG 段长度自洽(模拟损坏的 EXIF 而非损坏的 JPEG)
  const full = [...ascii('Exif'), 0, 0, ...tiff]
  const payload = opts.truncate !== undefined ? full.slice(0, opts.truncate) : full
  return [0xff, 0xe1, ...u16be(payload.length + 2), ...payload]
}

describe('readImageSize: EXIF orientation (display-oriented size)', () => {
  for (const order of ['MM', 'II'] as const) {
    test(`orientation 6 and 8 swap width/height (${order})`, () => {
      for (const o of [5, 6, 7, 8]) {
        expect(readImageSize(jpeg(exifApp1(o, order), sof(0xc0, 400, 200)))).toEqual({ width: 200, height: 400 })
      }
      expect(readImageInfo(jpeg(exifApp1(6, order), sof(0xc0, 400, 200)))).toEqual({
        width: 400,
        height: 200,
        orientation: 6,
      })
    })
    test(`orientation 1-4 keep size (${order})`, () => {
      for (const o of [1, 2, 3, 4]) {
        expect(readImageSize(jpeg(exifApp1(o, order), sof(0xc0, 400, 200)))).toEqual({ width: 400, height: 200 })
      }
    })
  }
  test('truncated / corrupt EXIF is treated as orientation 1 without throwing', () => {
    for (const cut of [0, 4, 8, 12, 14, 20, 24]) {
      expect(readImageSize(jpeg(exifApp1(6, 'MM', { truncate: cut }), sof(0xc0, 400, 200)))).toEqual({
        width: 400,
        height: 200,
      })
    }
  })
})
