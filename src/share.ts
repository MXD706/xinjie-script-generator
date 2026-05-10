// 分享链接：gzip 压缩 + base64url + 二维码
import type { Script } from './types'

// 用 CompressionStream 压缩（浏览器原生支持）
async function gzipCompress(str: string): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined') {
    // 退化：不压缩，直接转 Uint8Array
    return new TextEncoder().encode(str)
  }
  const stream = new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'))
  const buf = await new Response(stream).arrayBuffer()
  return new Uint8Array(buf)
}

async function gzipDecompress(bytes: Uint8Array): Promise<string> {
  if (typeof DecompressionStream === 'undefined') {
    return new TextDecoder().decode(bytes)
  }
  // 老浏览器上 compression 不存在时我们就是原文，直接 decode
  // 但如果新浏览器收到的是压缩过的，就要解压
  try {
    // BlobPart requires a proper BufferSource; build a typed array view from the bytes
    const stream = new Blob([bytes.buffer as ArrayBuffer]).stream().pipeThrough(new DecompressionStream('gzip'))
    const buf = await new Response(stream).arrayBuffer()
    return new TextDecoder().decode(buf)
  } catch {
    return new TextDecoder().decode(bytes)
  }
}

function u8ToB64url(u8: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlToU8(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : ''
  const bin = atob(b64 + pad)
  const u8 = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
  return u8
}

// 最小脚本格式：只保留显示必要字段
function compactScript(s: Script) {
  return {
    v: 2,  // version
    m: s.mode,
    t: s.title, st: s.subtitle,
    td: s.totalDuration, b: s.bgm, l: s.shootLocation,
    sh: s.shots.map(x => [x.duration, x.timeRange, x.visual, x.voiceover, x.subtitle, x.directorNote]),
    n: s.directorNotes,
    p: s.publish ? [s.publish.titles, s.publish.caption, s.publish.hashtags, s.publish.coverText, s.publish.coverShotIndex] : null,
  }
}

function expandScript(c: any): Script | null {
  if (!c || !Array.isArray(c.sh)) return null
  return {
    id: Date.now(),
    mode: c.m || 'travel',
    createdAt: new Date().toLocaleString('zh-CN'),
    title: c.t || '', subtitle: c.st || '',
    totalDuration: c.td || '30 秒',
    bgm: c.b || '', shootLocation: c.l || '',
    formData: {},
    shots: (c.sh as string[][]).map(a => ({
      duration: a[0] || '', timeRange: a[1] || '', visual: a[2] || '',
      voiceover: a[3] || '', subtitle: a[4] || '', directorNote: a[5] || '',
    })),
    directorNotes: c.n || '',
    publish: c.p ? { titles: c.p[0] || [], caption: c.p[1] || '', hashtags: c.p[2] || [], coverText: c.p[3] || '', coverShotIndex: typeof c.p[4] === 'number' ? c.p[4] : -1 } : undefined,
  }
}

export async function encodeShare(s: Script): Promise<string> {
  const json = JSON.stringify(compactScript(s))
  const compressed = await gzipCompress(json)
  // prefix 'g' to mark gzip; 'r' for raw (fallback)
  const prefix = typeof CompressionStream !== 'undefined' ? 'g' : 'r'
  return prefix + u8ToB64url(compressed)
}

export async function decodeShare(s: string): Promise<Script | null> {
  try {
    const prefix = s[0]
    const body = s.slice(1)
    const bytes = b64urlToU8(body)
    const json = prefix === 'g' ? await gzipDecompress(bytes) : new TextDecoder().decode(bytes)
    const c = JSON.parse(json)
    return expandScript(c)
  } catch {
    // 兼容 v1 无 prefix 格式
    try {
      const bytes = b64urlToU8(s)
      const json = new TextDecoder().decode(bytes)
      return expandScript(JSON.parse(json))
    } catch {
      return null
    }
  }
}

// —— 二维码 —— 用纯前端小库（避免外部依赖）: 手写一个简化版太复杂，用 api 生成
// 采用开源无依赖方案：渲染一个 <img> 指向本地绘制的 canvas
// 为避免再引入依赖，使用 Google Chart API 的替代——但 CSP 里我们只允许 self，所以改用内联 SVG
// 简化：使用 qrcode-generator 级别的最小 QR 编码。这里采用"文本 + 复制"作为主要体验，
// 二维码通过 Canvas 生成（无需外部 lib 时，用一个最小化的 QR 实现太长，因此暂用文本回退）。
// 我们提供一个 API：如果浏览器有原生 Barcode API 就用，否则就把 URL 让用户复制。
export function canMakeQR(): boolean {
  // BarcodeDetector 是实验性 API，暂不强依赖
  return typeof window !== 'undefined' && 'BarcodeDetector' in window
}
