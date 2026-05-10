// DeepSeek API 调用
import type { Script } from './types'

const ENDPOINT = 'https://api.deepseek.com/v1/chat/completions'

export interface StreamCallResult {
  fullText: string
  usage?: Script['usage']
}

export interface StreamCallOpts {
  key: string
  messages: Array<{ role: string; content: string }>
  max_tokens?: number
  temperature?: number
  onDelta: (chunk: string) => void
  signal?: AbortSignal
}

export async function callDeepSeekStream(opts: StreamCallOpts): Promise<StreamCallResult> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${opts.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: opts.messages,
      max_tokens: opts.max_tokens ?? 3000,
      temperature: opts.temperature ?? 0.8,
      stream: true,
      stream_options: { include_usage: true },
    }),
    signal: opts.signal,
  })
  if (!res.ok) {
    let detail = ''
    try { const j = await res.json(); detail = j.error?.message || '' } catch { /* ignore */ }
    throw new Error(detail || `API错误 ${res.status}`)
  }
  if (!res.body) throw new Error('浏览器不支持流式响应')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''
  let usage: Script['usage'] | undefined

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let idx: number
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim()
      buffer = buffer.slice(idx + 1)
      if (!line || !line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (data === '[DONE]') continue
      try {
        const j = JSON.parse(data)
        const delta = j.choices?.[0]?.delta?.content || ''
        if (delta) { fullText += delta; opts.onDelta(delta) }
        if (j.usage) usage = j.usage
      } catch { /* malformed chunk — skip */ }
    }
  }
  return { fullText, usage }
}

// 可重试的调用：429/5xx/网络错时自动重试一次
export async function callWithRetry(opts: StreamCallOpts): Promise<StreamCallResult> {
  try {
    return await callDeepSeekStream(opts)
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err
    const msg = String(err?.message || err)
    const retriable = /429|rate|5\d\d|fetch|network|timeout/i.test(msg)
    if (!retriable) throw err
    return await callDeepSeekStream(opts)
  }
}

// 用 1 个最小请求测试 Key 是否有效
export async function testKey(key: string): Promise<{ ok: boolean; msg: string }> {
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
      }),
    })
    if (res.ok) return { ok: true, msg: 'Key 有效 ✓' }
    if (res.status === 401) return { ok: false, msg: 'Key 无效或已失效' }
    if (res.status === 429) return { ok: false, msg: '请求过于频繁，Key 可能有效但被限流' }
    const j = await res.json().catch(() => ({}))
    return { ok: false, msg: j.error?.message || `HTTP ${res.status}` }
  } catch (e: any) {
    return { ok: false, msg: '网络错误：' + (e.message || e) }
  }
}
