// 仅凭文件头字节读取图片尺寸(PNG / JPEG / WebP),不解码像素。
// 纯函数:任何截断 / 越界 / 非图片输入都返回 null,不抛异常。

export interface ImageSize {
  width: number
  height: number
}

/** width/height 为编码尺寸(未应用 EXIF 旋转);orientation 为 EXIF 方向 1-8。 */
export interface ImageInfo extends ImageSize {
  orientation: number
}

const u16be = (b: Uint8Array, o: number) => (b[o] << 8) | b[o + 1]
const u16le = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8)
const u24le = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16)
const u32be = (b: Uint8Array, o: number) =>
  ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0
const u32le = (b: Uint8Array, o: number) =>
  (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0

const matches = (b: Uint8Array, o: number, sig: readonly number[]) =>
  o + sig.length <= b.length && sig.every((v, i) => b[o + i] === v)
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0))

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function size(width: number, height: number): ImageSize | null {
  return width > 0 && height > 0 ? { width, height } : null
}

function readPng(b: Uint8Array): ImageSize | null {
  if (b.length < 24) return null
  return size(u32be(b, 16), u32be(b, 20))
}

function isSof(m: number) {
  return m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc
}

/** 从 APP1 段数据区(p..end)解析 EXIF Orientation;任何越界 / 损坏返回 1。 */
function readExifOrientation(b: Uint8Array, p: number, end: number): number {
  try {
    if (!matches(b, p, [...ascii('Exif'), 0, 0])) return 1
    const t = p + 6 // TIFF 头
    if (t + 8 > end) return 1
    const little = b[t] === 0x49 && b[t + 1] === 0x49
    if (!little && !(b[t] === 0x4d && b[t + 1] === 0x4d)) return 1
    const r16 = little ? u16le : u16be
    const r32 = little ? u32le : u32be
    if (r16(b, t + 2) !== 0x2a) return 1
    const ifd = t + r32(b, t + 4)
    if (ifd + 2 > end) return 1
    const count = r16(b, ifd)
    for (let i = 0; i < count; i++) {
      const e = ifd + 2 + i * 12
      if (e + 12 > end) return 1
      if (r16(b, e) === 0x0112) {
        if (r16(b, e + 2) !== 3) return 1
        const v = r16(b, e + 8)
        return v >= 1 && v <= 8 ? v : 1
      }
    }
    return 1
  } catch {
    return 1
  }
}

function readJpeg(b: Uint8Array): ImageInfo | null {
  let p = 2
  let orientation = 1
  while (p < b.length) {
    if (b[p] !== 0xff) return null
    while (p < b.length && b[p] === 0xff) p++ // 填充
    if (p >= b.length) return null
    const m = b[p++]
    if (m === 0xd9 || m === 0xda) return null // EOI / SOS 前未找到
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd7) || m === 0x00) continue // 无长度段
    if (p + 2 > b.length) return null
    const len = u16be(b, p)
    if (len < 2) return null
    if (m === 0xe1 && orientation === 1) {
      orientation = readExifOrientation(b, p + 2, Math.min(p + len, b.length))
    }
    if (isSof(m)) {
      if (p + 7 > b.length) return null
      const s = size(u16be(b, p + 5), u16be(b, p + 3))
      return s && { ...s, orientation }
    }
    p += len
  }
  return null
}

function readWebp(b: Uint8Array): ImageSize | null {
  if (!matches(b, 8, ascii('WEBP'))) return null
  const d = 20 // 首个 chunk 数据起点
  if (b.length < d) return null
  if (matches(b, 12, ascii('VP8 '))) {
    if (b.length < d + 10 || !matches(b, d + 3, [0x9d, 0x01, 0x2a])) return null
    return size(u16le(b, d + 6) & 0x3fff, u16le(b, d + 8) & 0x3fff)
  }
  if (matches(b, 12, ascii('VP8L'))) {
    if (b.length < d + 5 || b[d] !== 0x2f) return null
    const bits = u32le(b, d + 1)
    return size((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1)
  }
  if (matches(b, 12, ascii('VP8X'))) {
    if (b.length < d + 10) return null
    return size(u24le(b, d + 4) + 1, u24le(b, d + 7) + 1)
  }
  return null
}

export function readImageInfo(bytes: Uint8Array): ImageInfo | null {
  try {
    if (matches(bytes, 0, PNG_SIG)) {
      const r = readPng(bytes)
      return r && { ...r, orientation: 1 }
    }
    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) return readJpeg(bytes)
    if (matches(bytes, 0, ascii('RIFF'))) {
      const r = readWebp(bytes)
      return r && { ...r, orientation: 1 }
    }
    return null
  } catch {
    return null
  }
}

/** 显示方向尺寸:JPEG EXIF 方向 5-8 时宽高对调(createImageBitmap 的 resize 发生在旋转之后)。 */
export function readImageSize(bytes: Uint8Array): ImageSize | null {
  const info = readImageInfo(bytes)
  if (!info) return null
  return info.orientation >= 5 ? { width: info.height, height: info.width } : { width: info.width, height: info.height }
}
