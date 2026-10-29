// 入口 chunk 预算检查（B3）：先 `npm run build`，再 `npm run check:bundle`。
// 入口包 = dist/index.html 里的 module script；只校验它，懒加载 chunk 不设上限。
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const DIST = 'dist'
const MAX_GZIP_KB = 120
// 只应出现在懒加载 chunk 里的库特征串
const FORBIDDEN = ['Konva', 'JSZip']

const html = readFileSync(join(DIST, 'index.html'), 'utf8')
const match = html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/)
if (!match) {
  console.error('check-bundle: entry script not found in dist/index.html')
  process.exit(1)
}
// src 带 base 前缀（/sticker-studio/assets/...），只取 assets/ 之后的部分
const file = join(DIST, match[1].slice(match[1].indexOf('assets/')))
const code = readFileSync(file)
const gzipKb = gzipSync(code).length / 1024
const errors = []

if (gzipKb > MAX_GZIP_KB) errors.push(`entry gzip ${gzipKb.toFixed(1)} KB > ${MAX_GZIP_KB} KB`)
const text = code.toString('utf8')
for (const marker of FORBIDDEN) {
  if (text.includes(marker)) errors.push(`entry contains "${marker}"`)
}

console.log(`check-bundle: ${file} raw ${(code.length / 1024).toFixed(1)} KB / gzip ${gzipKb.toFixed(1)} KB`)
if (errors.length) {
  for (const e of errors) console.error(`  ✗ ${e}`)
  process.exit(1)
}
console.log('  ✓ within budget')
