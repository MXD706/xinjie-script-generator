import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import './App.css'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'

const DEEPSEEK_KEY_STORAGE = 'xinjie_deepseek_key'
const HISTORY_STORAGE = 'xinjie_script_history'
const DRAFT_STORAGE = 'xinjie_draft_v1'

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions'

interface Shot {
  duration: string
  timeRange: string
  visual: string
  voiceover: string
  subtitle: string
  directorNote: string
}

interface Script {
  id: number
  destination: string
  purpose: string
  departure: string
  transport: string
  transportDuration: string
  shootTime: string
  weather: string
  arriveShoot: string
  hotelName: string
  howToHotel: string
  hotelShoot: string
  companions: string
  equipment: string
  keyMessage: string
  requiredShots: string
  extraNotes: string
  contentType: string
  targetDuration: string
  totalDuration: string
  bgm: string
  shootLocation: string
  shots: Shot[]
  directorNotes: string
  createdAt: string
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
}

type EditMode = {
  type: 'meta' | 'shot' | 'directorNotes'
  index?: number
  field?: string
}

interface Draft {
  destination: string
  purpose: string
  departure: string
  transport: string
  transportDuration: string
  shootTime: string
  weather: string
  arriveShoot: string
  hotelName: string
  howToHotel: string
  hotelShoot: string
  companions: string
  equipment: string
  keyMessage: string
  requiredShots: string
  extraNotes: string
  contentType: string
  targetDuration: string
}

const EMPTY_DRAFT: Draft = {
  destination: '', purpose: '', departure: '', transport: '', transportDuration: '',
  shootTime: '', weather: '', arriveShoot: '', hotelName: '', howToHotel: '',
  hotelShoot: '', companions: '', equipment: '', keyMessage: '', requiredShots: '',
  extraNotes: '', contentType: '', targetDuration: '',
}

const CONTENT_TYPES: { key: string; label: string; emoji: string; hint: string }[] = [
  { key: '冲动行动型', label: '冲动行动', emoji: '💥', hint: '做疯狂决定→说走就走→遇到意外→结尾情感升华' },
  { key: '对比发现型', label: '对比发现', emoji: '🔍', hint: '台湾视角看大陆事物→发现差异→被震撼→结尾互动' },
  { key: '情感走心型', label: '情感走心', emoji: '💗', hint: '具体经历→真情实感→两岸情怀→温暖结尾' },
  { key: '体验分享型', label: '体验分享', emoji: '🌟', hint: '亲身尝试→具体感受→推荐理由→种草结尾' },
]

const DURATION_PRESETS = ['28秒', '45秒', '60秒']

function getStoredKey(): string {
  try { return localStorage.getItem(DEEPSEEK_KEY_STORAGE) || '' } catch { return '' }
}
function saveKey(key: string) {
  try { localStorage.setItem(DEEPSEEK_KEY_STORAGE, key) } catch { /* ignore */ }
}
function getHistory(): Script[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_STORAGE) || '[]') } catch { return [] }
}
function saveHistory(scripts: Script[]) {
  try { localStorage.setItem(HISTORY_STORAGE, JSON.stringify(scripts.slice(0, 20))) } catch { /* ignore */ }
}
function getDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE)
    if (!raw) return EMPTY_DRAFT
    return { ...EMPTY_DRAFT, ...JSON.parse(raw) }
  } catch { return EMPTY_DRAFT }
}
function saveDraft(d: Draft) {
  try { localStorage.setItem(DRAFT_STORAGE, JSON.stringify(d)) } catch { /* ignore */ }
}
function clearDraft() {
  try { localStorage.removeItem(DRAFT_STORAGE) } catch { /* ignore */ }
}

const SYSTEM_PROMPT = `你是昕昕，一个在大陆生活的台湾女生，你要以她的语气和风格写抖音视频分镜脚本。

## 昕昕的人设
- 台湾人，台湾创业者，常住大陆（一个月回台湾一次）
- 普通话流利，镜头前表达略不利索，性格外向是社牛
- 真实不做作，口语化，有台湾腔调但不过度
- 不用AI腔（"家人们谁懂啊"、"绝绝子"、"太炸裂了"等）
- 结尾要有温度，要么温暖要么互动

## 开头公式
- 「大家好，我是来自台湾的昕昕✨」
- 「大家好，我是台湾昕昕，今天」
- 「Hi大家，我是昕昕，一个在大陆生活的台湾女生」

## 4种内容类型
1. 冲动行动型：做疯狂决定→说走就走→遇到意外→结尾情感升华
2. 对比发现型：台湾视角看大陆事物→发现差异→被震撼→结尾互动
3. 情感走心型：具体经历→真情实感→两岸情怀→温暖结尾
4. 体验分享型：亲身尝试→具体感受→推荐理由→种草结尾

## 结尾公式
- 情感向：两岸本来就是一家人，想去哪就去哪
- 互动向：你们有没有做过这种冲动的事？评论区告诉我～
- 种草向：真的太值得了，推荐给大家！

## 已知爆款规律
- 车是流量密码：小米YU7三条全部爆或高互动
- "被震撼"模板：重庆、01/18横穿都是这个套路
- 两岸差异话题：稳定有受众
- 香港纯打卡差：1.8%互动率，避开

## 输出格式

总时长：[X] 秒 | 背景音乐：[全程轻快旅行风纯音乐] | 拍摄地点：[具体地点]

| 时长 | 时间段 | 画面内容 | 口播台词（同步播报） | 字幕贴纸 | 摄影师跟拍指令 |
|------|--------|----------|---------------------|----------|---------------|
| X秒 | 0-X秒 | 具体描述，包含人物动作和背景 | 我是昕昕，口播台词... | 关键词提炼 | 具体拍摄指令 |

## 口播台词要求
- 口语化，像跟朋友聊天，不是念稿
- 要有具体时间/数字/地点（如"凌晨2:34到"、"飞了13小时"）
- 不要空洞形容词，要真实感受
- 每句不要太长，控制在10字以内

## 摄影师指令要求
- 明确机位（固定/跟拍/推进/俯拍/航拍）
- 明确景别（特写/近景/中景/半身/全景）
- 画面要求（避开杂乱人群/稳定不抖动/聚焦清晰）

## 注意
- 全片时长控制在28-60秒内
- 表格每行是一个镜头，不要合并多个镜头
- 严格按照用户提供的拍摄信息来写，不自己瞎编
- 表格输出结束后，另起一行以"导演注意事项："开头，写 2-4 条整体建议
`

const DEST_MAX = 100
const PURPOSE_MAX = 200

function CounterHint({ value, max }: { value: string; max: number }) {
  const len = value.length
  const cls = len > max ? 'over' : len > max * 0.85 ? 'warn' : ''
  return <span className={`field-counter ${cls}`}>{len}/{max}</span>
}

// ——————————— 解析 ———————————

function parseShots(text: string): Shot[] {
  const shots: Shot[] = []
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('总时长') || /^\|\s*时长/.test(t)) continue
    if (t.startsWith('导演') || t.startsWith('注意') || t.startsWith('摄影师注意')) break
    if (!t.startsWith('|')) continue
    // markdown 分隔行 |------|
    if (/^\|[\s\-|:]+\|$/.test(t)) continue
    const cells = t.split('|').map(c => c.trim()).slice(1, -1)
    if (cells.length === 0) continue
    // 宽容：不足 6 列补空，超过 6 列只取前 6
    while (cells.length < 6) cells.push('')
    shots.push({
      duration: cells[0] || '',
      timeRange: cells[1] || '',
      visual: cells[2] || '',
      voiceover: cells[3] || '',
      subtitle: cells[4] || '',
      directorNote: cells[5] || '',
    })
  }
  return shots
}

function parseMeta(text: string, fallbackLocation: string) {
  const total = text.match(/总时长[：:]\s*(\d+)\s*秒/)
  const bgm = text.match(/背景音乐[：:]\s*([^|\n]+)/)
  const loc = text.match(/拍摄地点[：:]\s*([^|\n]+)/)
  return {
    totalDuration: total ? total[1] + ' 秒' : '30 秒',
    bgm: bgm ? bgm[1].trim() : '全程轻快旅行风纯音乐',
    shootLocation: loc ? loc[1].trim() : fallbackLocation,
  }
}

function parseDirectorNotes(text: string): string {
  const lines = text.split('\n')
  const notes: string[] = []
  let capture = false
  for (const line of lines) {
    const t = line.trim()
    if (t.includes('导演注意事项') || t.includes('摄影师注意事项')) { capture = true; continue }
    if (!capture) continue
    if (t.startsWith('|')) continue
    if (!t) continue
    notes.push(t.replace(/^[-*·]\s*/, ''))
  }
  return notes.join('\n')
}

// ——————————— 分享链接（URL <-> JSON） ———————————

function encodeShare(script: Script): string {
  const minimal = {
    d: script.destination, p: script.purpose, td: script.totalDuration,
    b: script.bgm, l: script.shootLocation,
    s: script.shots.map(s => [s.duration, s.timeRange, s.visual, s.voiceover, s.subtitle, s.directorNote]),
    n: script.directorNotes,
    ct: script.contentType,
  }
  const json = JSON.stringify(minimal)
  // UTF-8 safe base64
  const utf8 = new TextEncoder().encode(json)
  let bin = ''
  for (const b of utf8) bin += String.fromCharCode(b)
  const b64 = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return b64
}

function decodeShare(s: string): Script | null {
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : ''
    const bin = atob(b64 + pad)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    const json = new TextDecoder().decode(bytes)
    const m = JSON.parse(json)
    if (!m || !Array.isArray(m.s)) return null
    return {
      id: Date.now(),
      destination: m.d || '', purpose: m.p || '',
      departure: '', transport: '', transportDuration: '', shootTime: '', weather: '',
      arriveShoot: '', hotelName: '', howToHotel: '', hotelShoot: '',
      companions: '', equipment: '', keyMessage: '', requiredShots: '', extraNotes: '',
      contentType: m.ct || '', targetDuration: '',
      totalDuration: m.td || '30 秒',
      bgm: m.b || '全程轻快旅行风纯音乐',
      shootLocation: m.l || m.d || '',
      shots: (m.s as string[][]).map((a) => ({
        duration: a[0] || '', timeRange: a[1] || '', visual: a[2] || '',
        voiceover: a[3] || '', subtitle: a[4] || '', directorNote: a[5] || '',
      })),
      directorNotes: m.n || '',
      createdAt: new Date().toLocaleString('zh-CN'),
    }
  } catch { return null }
}

// ——————————— DeepSeek（流式） ———————————

async function callDeepSeekStream(opts: {
  key: string
  messages: Array<{ role: string; content: string }>
  max_tokens?: number
  temperature?: number
  onDelta: (chunk: string) => void
  signal?: AbortSignal
}): Promise<{ fullText: string; usage?: Script['usage'] }> {
  const res = await fetch(DEEPSEEK_ENDPOINT, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${opts.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: opts.messages,
      max_tokens: opts.max_tokens ?? 2500,
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

// ——————————— 组件 ———————————

export default function App() {
  const [key, setKey] = useState(getStoredKey)
  const [loading, setLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [result, setResult] = useState<Script | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string>('')
  const [history, setHistory] = useState<Script[]>(getHistory)
  const [showKeyInput, setShowKeyInput] = useState(false)
  const [tempKey, setTempKey] = useState(getStoredKey())
  const [editMode, setEditMode] = useState<EditMode | null>(null)
  const [editValue, setEditValue] = useState('')
  const [rawText, setRawText] = useState('')
  const [formOpen, setFormOpen] = useState(true)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [imgPreview, setImgPreview] = useState<string>('')
  const [regeneratingIdx, setRegeneratingIdx] = useState<number | null>(null)
  const resultRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : ''
  const isWechat = /micromessenger/.test(ua)
  const isMobile = /iphone|ipad|ipod|android|mobile/.test(ua)

  // —— 表单字段（从 draft 恢复） ——
  const initialDraft = useMemo(getDraft, [])
  const [destination, setDestination] = useState(initialDraft.destination)
  const [purpose, setPurpose] = useState(initialDraft.purpose)
  const [departure, setDeparture] = useState(initialDraft.departure)
  const [transport, setTransport] = useState(initialDraft.transport)
  const [transportDuration, setTransportDuration] = useState(initialDraft.transportDuration)
  const [shootTime, setShootTime] = useState(initialDraft.shootTime)
  const [weather, setWeather] = useState(initialDraft.weather)
  const [arriveShoot, setArriveShoot] = useState(initialDraft.arriveShoot)
  const [hotelName, setHotelName] = useState(initialDraft.hotelName)
  const [howToHotel, setHowToHotel] = useState(initialDraft.howToHotel)
  const [hotelShoot, setHotelShoot] = useState(initialDraft.hotelShoot)
  const [companions, setCompanions] = useState(initialDraft.companions)
  const [equipment, setEquipment] = useState(initialDraft.equipment)
  const [keyMessage, setKeyMessage] = useState(initialDraft.keyMessage)
  const [requiredShots, setRequiredShots] = useState(initialDraft.requiredShots)
  const [extraNotes, setExtraNotes] = useState(initialDraft.extraNotes)
  const [contentType, setContentType] = useState(initialDraft.contentType)
  const [targetDuration, setTargetDuration] = useState(initialDraft.targetDuration)

  const currentDraft = useMemo<Draft>(() => ({
    destination, purpose, departure, transport, transportDuration, shootTime,
    weather, arriveShoot, hotelName, howToHotel, hotelShoot, companions,
    equipment, keyMessage, requiredShots, extraNotes, contentType, targetDuration,
  }), [destination, purpose, departure, transport, transportDuration, shootTime,
      weather, arriveShoot, hotelName, howToHotel, hotelShoot, companions,
      equipment, keyMessage, requiredShots, extraNotes, contentType, targetDuration])

  // 表单改动清错 + debounce 保存草稿
  useEffect(() => {
    if (error) setError('')
    const t = setTimeout(() => saveDraft(currentDraft), 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDraft])

  // 分享链接解析
  useEffect(() => {
    const h = window.location.hash
    const m = /^#share=(.+)$/.exec(h)
    if (m) {
      const s = decodeShare(m[1])
      if (s) {
        setResult(s)
        // 清掉 URL 里的 hash，避免刷新重复注入
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSaveKey = () => { saveKey(tempKey); setKey(tempKey); setShowKeyInput(false) }

  const buildUserPrompt = () => `帮我写一条关于「${destination}」的抖音视频分镜脚本。

## 拍摄信息
- 目的地：${destination}
- 去干什么：${purpose}
- 出发地：${departure || '由你根据目的地判断'}
- 交通方式：${transport || '由你根据距离判断'}
- 交通时长：${transportDuration || '由你估算'}
- 拍摄时间：${shootTime || '由你判断最佳时段'}
- 天气：${weather || '未知，假设好天气'}
- 到达后怎么拍：${arriveShoot || '由你设计'}
- 住哪个酒店：${hotelName || '由你推荐'}
- 怎么去酒店：${howToHotel || '由你设计'}
- 酒店拍什么：${hotelShoot || '由你设计'}
- 同行人：${companions || '假设一个人'}
- 拍摄设备：${equipment || '手机拍摄'}
- 视频重点：${keyMessage || '体验感/被震撼/冲动决定（由你判断最合适的）'}
- 内容类型：${contentType || '由你根据拍摄信息判断最合适的'}
- 目标时长：${targetDuration || '由你判断，28-60 秒内'}
- 必须要有的镜头：${requiredShots || '无特别要求'}
- 额外补充：${extraNotes || '无'}

严格按照上述信息来写，不要自己瞎编乱造。${targetDuration ? `全片总时长严格控制在 ${targetDuration} 左右。` : ''}`

  const generateScript = useCallback(async () => {
    if (!key) { setShowKeyInput(true); return }
    if (!destination.trim()) { setError('请填写目的地'); return }
    if (!purpose.trim()) { setError('请填写去干什么'); return }
    if (destination.length > DEST_MAX) { setError(`目的地不能超过${DEST_MAX}字`); return }
    if (purpose.length > PURPOSE_MAX) { setError(`去干什么不能超过${PURPOSE_MAX}字`); return }

    setLoading(true)
    setError('')
    setResult(null)
    setRawText('')
    setStreamingText('')

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt() },
    ]

    const run = async () => {
      const ctl = new AbortController()
      abortRef.current = ctl
      return callDeepSeekStream({
        key, messages, signal: ctl.signal,
        onDelta: (chunk) => setStreamingText(prev => prev + chunk),
      })
    }

    let fullText = ''
    let usage: Script['usage']
    try {
      const r = await run()
      fullText = r.fullText
      usage = r.usage
    } catch (err: any) {
      // 网络/偶发错误：自动重试一次
      const msg = String(err?.message || err)
      const retriable = err?.name === 'AbortError' ? false
        : /429|rate|5\d\d|fetch|network|timeout/i.test(msg)
      if (retriable) {
        setStreamingText('')
        try {
          const r = await run()
          fullText = r.fullText
          usage = r.usage
        } catch (err2: any) {
          finalizeError(err2)
          return
        }
      } else {
        finalizeError(err)
        return
      }
    }

    try {
      if (!fullText.includes('|')) throw new Error('生成格式不对，请重试')
      const meta = parseMeta(fullText, destination)
      const shots = parseShots(fullText)
      if (shots.length === 0) {
        setRawText(fullText)
        throw new Error('未能解析出镜头，已显示原始输出')
      }
      const script: Script = {
        id: Date.now(),
        destination: destination.trim(), purpose: purpose.trim(), departure: departure.trim(),
        transport: transport.trim(), transportDuration: transportDuration.trim(),
        shootTime: shootTime.trim(), weather: weather.trim(), arriveShoot: arriveShoot.trim(),
        hotelName: hotelName.trim(), howToHotel: howToHotel.trim(), hotelShoot: hotelShoot.trim(),
        companions: companions.trim(), equipment: equipment.trim(), keyMessage: keyMessage.trim(),
        requiredShots: requiredShots.trim(), extraNotes: extraNotes.trim(),
        contentType, targetDuration,
        ...meta, shots, directorNotes: parseDirectorNotes(fullText),
        createdAt: new Date().toLocaleString('zh-CN'),
        usage,
      }
      setResult(script)
      setStreamingText('')
      const newHistory = [script, ...history].slice(0, 20)
      setHistory(newHistory)
      saveHistory(newHistory)
    } catch (err: any) {
      finalizeError(err)
    } finally {
      setLoading(false)
      abortRef.current = null
    }

    function finalizeError(err: any) {
      const msg = err?.message || ''
      if (err?.name === 'AbortError') { setError('已取消'); return }
      if (/401|Unauthorized/.test(msg)) setError('API Key 无效，请检查')
      else if (/429|rate/i.test(msg)) setError('请求过于频繁，请稍后再试')
      else if (/fetch|network|网络/i.test(msg)) setError('网络连接失败，请检查网络')
      else setError(msg || '生成失败，请重试')
      setLoading(false)
    }
  }, [key, destination, purpose, departure, transport, transportDuration, shootTime, weather, arriveShoot, hotelName, howToHotel, hotelShoot, companions, equipment, keyMessage, requiredShots, extraNotes, contentType, targetDuration, history])

  const cancelGenerate = () => { abortRef.current?.abort() }

  // —— 镜头增删排序 ——
  const updateShot = (i: number, field: keyof Shot, val: string) => {
    if (!result) return
    const updated = { ...result, shots: result.shots.map((s, j) => j === i ? { ...s, [field]: val } : s) }
    persistScript(updated)
  }
  const insertShotAfter = (i: number) => {
    if (!result) return
    const blank: Shot = { duration: '3秒', timeRange: '', visual: '', voiceover: '', subtitle: '', directorNote: '' }
    const next = [...result.shots.slice(0, i + 1), blank, ...result.shots.slice(i + 1)]
    persistScript({ ...result, shots: next })
  }
  const deleteShot = (i: number) => {
    if (!result) return
    if (result.shots.length <= 1) return
    persistScript({ ...result, shots: result.shots.filter((_, j) => j !== i) })
  }
  const moveShot = (i: number, dir: -1 | 1) => {
    if (!result) return
    const j = i + dir
    if (j < 0 || j >= result.shots.length) return
    const next = [...result.shots]
    ;[next[i], next[j]] = [next[j], next[i]]
    persistScript({ ...result, shots: next })
  }

  const persistScript = (updated: Script) => {
    setResult(updated)
    const newHistory = history.map(s => s.id === updated.id ? updated : s)
    saveHistory(newHistory)
    setHistory(newHistory)
  }

  const updateMeta = (field: string, val: string) => {
    if (!result) return
    persistScript({ ...result, [field]: val } as Script)
  }

  // —— 单镜头重生 ——
  const regenerateShot = async (i: number) => {
    if (!result || !key) { if (!key) setShowKeyInput(true); return }
    setRegeneratingIdx(i)
    setError('')
    try {
      const ctx = result.shots.map((s, j) =>
        `${j === i ? '【需要重写】' : ''}镜头${j + 1}：${s.timeRange} | 画面：${s.visual} | 口播：${s.voiceover} | 字幕：${s.subtitle} | 指令：${s.directorNote}`
      ).join('\n')
      const prompt = `以下是「${result.destination}」的分镜脚本，请只重写【需要重写】那一个镜头，保持与前后镜头的衔接。

${ctx}

只输出一行 markdown 表格（| 时长 | 时间段 | 画面内容 | 口播台词 | 字幕贴纸 | 摄影师跟拍指令 |），不要任何其他文字。`
      const ctl = new AbortController()
      abortRef.current = ctl
      const { fullText } = await callDeepSeekStream({
        key,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: prompt }],
        max_tokens: 400, temperature: 0.85, signal: ctl.signal,
        onDelta: () => { /* ignore partial for single shot */ },
      })
      const shots = parseShots(fullText)
      if (shots.length === 0) throw new Error('重写失败，请重试')
      const next = [...result.shots]
      next[i] = shots[0]
      persistScript({ ...result, shots: next })
    } catch (err: any) {
      setError(err?.message || '单镜头重写失败')
    } finally {
      setRegeneratingIdx(null)
      abortRef.current = null
    }
  }

  // —— 导出 ——
  const renderToCanvas = async () => {
    if (!result || !resultRef.current) return null
    const node = resultRef.current
    node.classList.add('pdf-export')
    await new Promise(r => setTimeout(r, 60))
    try {
      const canvas = await html2canvas(node, {
        scale: isMobile ? 1.5 : 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        windowWidth: Math.max(node.scrollWidth, 1000),
      })
      return canvas
    } finally {
      node.classList.remove('pdf-export')
    }
  }

  const downloadImage = async () => {
    if (!result) return
    setPdfLoading(true)
    try {
      const canvas = await renderToCanvas()
      if (!canvas) return
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
      if (isWechat) { setImgPreview(dataUrl); return }
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `昕昕分镜_${result.destination}.jpg`
      document.body.appendChild(link); link.click(); document.body.removeChild(link)
    } catch (err: any) {
      alert('图片生成失败：' + (err?.message || '未知错误'))
    } finally { setPdfLoading(false) }
  }

  const downloadPDF = async () => {
    if (!result || !resultRef.current) return
    if (isWechat) { await downloadImage(); return }
    setPdfLoading(true)
    try {
      const canvas = await renderToCanvas()
      if (!canvas) return
      const imgData = canvas.toDataURL('image/jpeg', 0.92)
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 8
      const imgWidth = pageWidth - margin * 2
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      if (imgHeight <= pageHeight - margin * 2) {
        pdf.addImage(imgData, 'JPEG', margin, margin, imgWidth, imgHeight)
      } else {
        const pxPerMm = canvas.width / imgWidth
        const pageContentHeightPx = (pageHeight - margin * 2) * pxPerMm
        let renderedHeight = 0
        let pageIndex = 0
        while (renderedHeight < canvas.height) {
          const sliceHeight = Math.min(pageContentHeightPx, canvas.height - renderedHeight)
          const pageCanvas = document.createElement('canvas')
          pageCanvas.width = canvas.width
          pageCanvas.height = sliceHeight
          const ctx = pageCanvas.getContext('2d')!
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
          ctx.drawImage(canvas, 0, renderedHeight, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight)
          const pageImg = pageCanvas.toDataURL('image/jpeg', 0.92)
          if (pageIndex > 0) pdf.addPage()
          pdf.addImage(pageImg, 'JPEG', margin, margin, imgWidth, sliceHeight / pxPerMm)
          renderedHeight += sliceHeight
          pageIndex++
        }
      }

      if (isMobile) {
        const dataUrl = pdf.output('dataurlstring')
        const w = window.open()
        if (w) {
          w.document.write(`<title>昕昕分镜_${result.destination}.pdf</title><iframe src="${dataUrl}" frameborder="0" style="border:0;width:100%;height:100vh" allowfullscreen></iframe>`)
        } else {
          const dataUrl2 = canvas.toDataURL('image/jpeg', 0.92)
          setImgPreview(dataUrl2)
        }
        return
      }

      const blob = pdf.output('blob')
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `昕昕分镜_${result.destination}.pdf`
      document.body.appendChild(link); link.click(); document.body.removeChild(link)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err: any) {
      alert('PDF 生成失败：' + (err?.message || '未知错误') + '\n请用「复制全部」或保存长图')
    } finally { setPdfLoading(false) }
  }

  const toMarkdown = (s: Script): string => {
    let text = `# ${s.destination} · ${s.purpose}\n\n`
    text += `- 总时长：${s.totalDuration}\n- 背景音乐：${s.bgm}\n- 拍摄地点：${s.shootLocation}\n`
    if (s.contentType) text += `- 内容类型：${s.contentType}\n`
    text += `\n| # | 时长 | 时间段 | 画面内容 | 口播台词（同步播报） | 字幕贴纸 | 摄影师跟拍指令 |\n`
    text += `|---|------|--------|----------|----------------------|----------|----------------|\n`
    s.shots.forEach((shot, i) => {
      const esc = (v: string) => v.replace(/\|/g, '\\|').replace(/\n/g, ' ')
      text += `| ${i + 1} | ${esc(shot.duration)} | ${esc(shot.timeRange)} | ${esc(shot.visual)} | ${esc(shot.voiceover)} | ${esc(shot.subtitle)} | ${esc(shot.directorNote)} |\n`
    })
    if (s.directorNotes) text += `\n## 导演注意事项\n\n${s.directorNotes}\n`
    return text
  }

  const copyAll = () => {
    if (!result) return
    navigator.clipboard.writeText(toMarkdown(result)).then(() => flashCopied('all'))
  }

  const copyShot = (i: number) => {
    if (!result) return
    const s = result.shots[i]
    const text = `镜头${i + 1}（${s.duration}，${s.timeRange}）
画面：${s.visual}
口播：${s.voiceover}
字幕：${s.subtitle}
指令：${s.directorNote}`
    navigator.clipboard.writeText(text).then(() => flashCopied('shot-' + i))
  }

  const downloadMarkdown = () => {
    if (!result) return
    const md = toMarkdown(result)
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `昕昕分镜_${result.destination}.md`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const shareLink = () => {
    if (!result) return
    const hash = encodeShare(result)
    const url = `${window.location.origin}${window.location.pathname}#share=${hash}`
    navigator.clipboard.writeText(url).then(() => flashCopied('share'))
  }

  const flashCopied = (key: string) => {
    setCopied(key)
    setTimeout(() => setCopied(''), 2000)
  }

  // —— 克隆脚本到表单 ——
  const cloneToForm = (s: Script) => {
    setDestination(s.destination); setPurpose(s.purpose)
    setDeparture(s.departure); setTransport(s.transport); setTransportDuration(s.transportDuration)
    setShootTime(s.shootTime); setWeather(s.weather); setArriveShoot(s.arriveShoot)
    setHotelName(s.hotelName); setHowToHotel(s.howToHotel); setHotelShoot(s.hotelShoot)
    setCompanions(s.companions); setEquipment(s.equipment); setKeyMessage(s.keyMessage)
    setRequiredShots(s.requiredShots); setExtraNotes(s.extraNotes)
    setContentType(s.contentType || ''); setTargetDuration(s.targetDuration || '')
    setResult(null); setRawText(''); setFormOpen(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const resetForm = () => {
    setDestination(''); setPurpose(''); setDeparture(''); setTransport(''); setTransportDuration('')
    setShootTime(''); setWeather(''); setArriveShoot(''); setHotelName(''); setHowToHotel('')
    setHotelShoot(''); setCompanions(''); setEquipment(''); setKeyMessage(''); setRequiredShots('')
    setExtraNotes(''); setContentType(''); setTargetDuration('')
    clearDraft()
  }

  // —— 编辑辅助 ——
  const isMetaEditing = (f: string) => editMode?.type === 'meta' && editMode?.field === f
  const isShotEditing = (i: number, f: string) => editMode?.type === 'shot' && editMode?.index === i && editMode?.field === f
  const isNotesEditing = () => editMode?.type === 'directorNotes'

  const startMetaEdit = (f: string) => { if (!result) return; setEditMode({ type: 'meta', field: f }); setEditValue((result as any)[f]) }
  const startShotEdit = (i: number, f: keyof Shot) => { if (!result) return; setEditMode({ type: 'shot', index: i, field: f }); setEditValue(result.shots[i][f]) }
  const startNotesEdit = () => { if (!result) return; setEditMode({ type: 'directorNotes' }); setEditValue(result.directorNotes) }

  const saveEdit = () => {
    if (!editMode) return
    if (editMode.type === 'meta') updateMeta(editMode.field!, editValue)
    else if (editMode.type === 'shot' && editMode.index !== undefined) updateShot(editMode.index, editMode.field as keyof Shot, editValue)
    else if (editMode.type === 'directorNotes') updateMeta('directorNotes', editValue)
    setEditMode(null); setEditValue('')
  }

  return (
    <div className="container">
      <header className="header">
        <span className="badge"><span className="dot"></span>昕昕 · 抖音分镜脚本生成器</span>
        <h1>🎬 一句话生成爆款分镜</h1>
        <p className="subtitle">填真实拍摄信息 → AI 一键产出可拍摄的分镜表 · 流式生成 · 支持 PDF / 长图 / Markdown</p>
        <div className="header-actions">
          {!key && <button className="key-btn" onClick={() => setShowKeyInput(true)}>🔑 设置 API Key</button>}
          {key && <button className="key-btn small set" onClick={() => setShowKeyInput(true)}>Key 已配置 · 更换</button>}
        </div>
      </header>

      {showKeyInput && (
        <div className="modal-overlay" onClick={() => setShowKeyInput(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>🔑 设置 DeepSeek API Key</h3>
            <p>Key 仅存储在你本地浏览器，不会上传任何服务器。还没有 Key？去 <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noreferrer">platform.deepseek.com</a> 申请。</p>
            <input type="password" value={tempKey} onChange={e => setTempKey(e.target.value)} placeholder="sk-..." className="key-input"
              onKeyDown={e => e.key === 'Enter' && handleSaveKey()} />
            <div className="modal-actions">
              <button onClick={() => setShowKeyInput(false)}>取消</button>
              <button className="primary" onClick={handleSaveKey}>保存</button>
            </div>
          </div>
        </div>
      )}

      {imgPreview && (
        <div className="modal-overlay img-preview-overlay" onClick={() => setImgPreview('')}>
          <div className="img-preview-box" onClick={e => e.stopPropagation()}>
            <div className="img-preview-tip">
              {isWechat ? '👇 长按图片 → 保存到相册' : '右键图片 → 另存为'}
            </div>
            <img src={imgPreview} alt="分镜长图" className="img-preview-img" />
            <button className="img-preview-close" onClick={() => setImgPreview('')}>关闭</button>
          </div>
        </div>
      )}

      <main className="main">
        {/* —— 表单 —— */}
        <div className="form-card glass-card">
          <div className="form-toggle" onClick={() => setFormOpen(!formOpen)}>
            <h2>📋 拍摄信息<span className="form-hint">填得越细，生成越准</span></h2>
            <span className="toggle-icon">{formOpen ? '▲ 收起' : '▼ 展开'}</span>
          </div>

          {formOpen && (
            <div className="form-body">
              {/* 基础信息 */}
              <div className="form-section">
                <div className="form-section-title">
                  <span className="icon">📍</span>基础信息<span className="desc">必填，决定脚本方向</span>
                </div>
                <div className="form-row">
                  <div className="form-field required">
                    <label>目的地</label>
                    <input type="text" value={destination} onChange={e => setDestination(e.target.value)} placeholder="比如：西班牙巴塞罗那" maxLength={DEST_MAX} />
                    <CounterHint value={destination} max={DEST_MAX} />
                  </div>
                  <div className="form-field required">
                    <label>去干什么</label>
                    <input type="text" value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="比如：看小米汽车展厅" maxLength={PURPOSE_MAX} />
                    <CounterHint value={purpose} max={PURPOSE_MAX} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-field">
                    <label>同行人</label>
                    <select value={companions} onChange={e => setCompanions(e.target.value)} className="form-select">
                      <option value="">选择同行人</option>
                      <option value="一个人">一个人</option>
                      <option value="摄影师跟拍">摄影师跟拍</option>
                      <option value="朋友一起">朋友一起</option>
                      <option value="家人一起">家人一起</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label>拍摄设备</label>
                    <select value={equipment} onChange={e => setEquipment(e.target.value)} className="form-select">
                      <option value="">选择设备</option>
                      <option value="手机">手机</option>
                      <option value="相机">相机</option>
                      <option value="手机+稳定器">手机+稳定器</option>
                      <option value="相机+摄影师">相机+摄影师</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 交通安排 */}
              <div className="form-section">
                <div className="form-section-title">
                  <span className="icon">🚗</span>交通安排<span className="desc">影响开头节奏和真实感</span>
                </div>
                <div className="form-row">
                  <div className="form-field">
                    <label>出发地</label>
                    <input type="text" value={departure} onChange={e => setDeparture(e.target.value)} placeholder="比如：台湾家里 / 深圳" />
                  </div>
                  <div className="form-field">
                    <label>交通方式</label>
                    <input type="text" value={transport} onChange={e => setTransport(e.target.value)} placeholder="比如：飞马德里再火车" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-field">
                    <label>交通时长</label>
                    <input type="text" value={transportDuration} onChange={e => setTransportDuration(e.target.value)} placeholder="比如：飞13小时 + 转机3小时" />
                  </div>
                  <div className="form-field">
                    <label>拍摄时间</label>
                    <select value={shootTime} onChange={e => setShootTime(e.target.value)} className="form-select">
                      <option value="">选择时段</option>
                      <option value="清晨/上午">清晨 / 上午</option>
                      <option value="中午/下午">中午 / 下午</option>
                      <option value="傍晚/黄金时段">傍晚 / 黄金时段</option>
                      <option value="晚上">晚上</option>
                      <option value="全天">全天</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label>天气</label>
                    <select value={weather} onChange={e => setWeather(e.target.value)} className="form-select">
                      <option value="">选择天气</option>
                      <option value="晴天">☀️ 晴天</option>
                      <option value="阴天">☁️ 阴天</option>
                      <option value="雨天">🌧 雨天</option>
                      <option value="雪天">❄️ 雪天</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 住宿安排 */}
              <div className="form-section">
                <div className="form-section-title">
                  <span className="icon">🏨</span>住宿安排<span className="desc">提供更多场景细节</span>
                </div>
                <div className="form-row">
                  <div className="form-field">
                    <label>住哪个酒店</label>
                    <input type="text" value={hotelName} onChange={e => setHotelName(e.target.value)} placeholder="比如：巴塞罗那 W 酒店" />
                  </div>
                  <div className="form-field">
                    <label>怎么去酒店</label>
                    <input type="text" value={howToHotel} onChange={e => setHowToHotel(e.target.value)} placeholder="比如：打车去，路上拍街景" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-field full">
                    <label>酒店拍什么</label>
                    <input type="text" value={hotelShoot} onChange={e => setHotelShoot(e.target.value)} placeholder="比如：拍房间窗外海景、大堂环境、酒店早餐" />
                  </div>
                </div>
              </div>

              {/* 创作要点 */}
              <div className="form-section">
                <div className="form-section-title">
                  <span className="icon">🎬</span>创作要点<span className="desc">决定爆款方向</span>
                </div>

                <div className="form-row chip-row">
                  <label className="chip-label">内容类型</label>
                  <div className="chips">
                    {CONTENT_TYPES.map(t => (
                      <button
                        type="button"
                        key={t.key}
                        className={`chip ${contentType === t.key ? 'active' : ''}`}
                        onClick={() => setContentType(contentType === t.key ? '' : t.key)}
                        title={t.hint}
                      >
                        <span className="chip-emoji">{t.emoji}</span>{t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-row chip-row">
                  <label className="chip-label">目标时长</label>
                  <div className="chips">
                    {DURATION_PRESETS.map(d => (
                      <button
                        type="button"
                        key={d}
                        className={`chip ${targetDuration === d ? 'active' : ''}`}
                        onClick={() => setTargetDuration(targetDuration === d ? '' : d)}
                      >{d}</button>
                    ))}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label>视频重点</label>
                    <select value={keyMessage} onChange={e => setKeyMessage(e.target.value)} className="form-select">
                      <option value="">由 AI 判断</option>
                      <option value="体验感">体验感</option>
                      <option value="被震撼">被震撼</option>
                      <option value="冲动决定">冲动决定</option>
                      <option value="两岸差异">两岸差异</option>
                      <option value="美食探店">美食探店</option>
                      <option value="人文情怀">人文情怀</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label>到达后怎么拍</label>
                    <input type="text" value={arriveShoot} onChange={e => setArriveShoot(e.target.value)} placeholder="比如：先到标志建筑，再逛市集" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field full">
                    <label>必须要有的镜头</label>
                    <input type="text" value={requiredShots} onChange={e => setRequiredShots(e.target.value)} placeholder="比如：跟当地人聊天、拍夕阳、拍美食" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field full">
                    <label>额外补充</label>
                    <textarea value={extraNotes} onChange={e => setExtraNotes(e.target.value)} placeholder="任何想告诉 AI 的额外信息" rows={2} />
                  </div>
                </div>
              </div>

              {error && <div className="error-banner">⚠️ {error}</div>}

              <div className="form-footer">
                <button className="reset-btn" type="button" onClick={resetForm} disabled={loading}>↺ 清空</button>
                {loading ? (
                  <button className="generate-btn cancel" type="button" onClick={cancelGenerate}>
                    ✕ 取消生成
                  </button>
                ) : (
                  <button className="generate-btn" type="button" onClick={generateScript}>
                    ✨ 生成分镜脚本
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* —— 流式输出预览 —— */}
        {loading && streamingText && !result && (
          <div className="streaming-card glass-card">
            <div className="streaming-header">
              <span className="pulse-dot"></span>AI 正在生成中…
            </div>
            <pre className="streaming-text">{streamingText}</pre>
          </div>
        )}

        {loading && !streamingText && (
          <div className="loading-hint">⏳ 正在连接 DeepSeek…</div>
        )}

        {/* —— 结果 —— */}
        {result && (
          <div className="result-card glass-card" ref={resultRef}>
            <div className="result-header">
              <div className="result-header-left">
                <h2>🎬 分镜脚本</h2>
                <span className="result-count">{result.shots.length} 个镜头</span>
              </div>
              <div className="result-actions">
                <button className="action-btn" onClick={copyAll}>{copied === 'all' ? '✓ 已复制' : '📋 复制 MD'}</button>
                <button className="action-btn" onClick={downloadMarkdown}>📝 MD 文件</button>
                <button className="action-btn" onClick={shareLink}>{copied === 'share' ? '✓ 链接已复制' : '🔗 分享'}</button>
                <button className="action-btn" disabled={pdfLoading} onClick={isWechat ? downloadImage : downloadPDF}>
                  {pdfLoading ? '⏳ 生成中...' : isWechat ? '🖼 保存长图' : isMobile ? '📄 PDF 预览' : '📄 PDF'}
                </button>
                <button className="action-btn" onClick={() => cloneToForm(result)}>📄 克隆</button>
                <button className="action-btn danger" onClick={() => {
                  const newHistory = history.filter(s => s.id !== result.id)
                  setHistory(newHistory); saveHistory(newHistory); setResult(null); setRawText('')
                }}>🗑️ 删除</button>
              </div>
            </div>

            {isWechat && (
              <div className="wechat-tip">
                💡 微信不支持直接下载文件，请点「保存长图」生成图片后<b>长按保存到相册</b>，或点右上角「···」用浏览器打开。
              </div>
            )}

            <div className="info-summary">
              <span>📍 {result.destination}</span>
              <span>🎯 {result.purpose}</span>
              {result.contentType && <span>🎭 {result.contentType}</span>}
              {result.hotelName && <span>🏨 {result.hotelName}</span>}
              {result.shootTime && <span>⏰ {result.shootTime}</span>}
              {result.weather && <span>🌤 {result.weather}</span>}
            </div>

            <div className="meta-row">
              <div className="meta-item" onClick={() => !editMode && startMetaEdit('totalDuration')}>
                <span className="meta-label">⏱ 总时长</span>
                {isMetaEditing('totalDuration') ? (
                  <input className="meta-input" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEdit()} onBlur={saveEdit} autoFocus />
                ) : (<span className="meta-value">{result.totalDuration}</span>)}
              </div>
              <div className="meta-item" onClick={() => !editMode && startMetaEdit('bgm')}>
                <span className="meta-label">🎵 背景音乐</span>
                {isMetaEditing('bgm') ? (
                  <input className="meta-input" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEdit()} onBlur={saveEdit} autoFocus />
                ) : (<span className="meta-value">{result.bgm}</span>)}
              </div>
              <div className="meta-item" onClick={() => !editMode && startMetaEdit('shootLocation')}>
                <span className="meta-label">📌 拍摄地点</span>
                {isMetaEditing('shootLocation') ? (
                  <input className="meta-input" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEdit()} onBlur={saveEdit} autoFocus />
                ) : (<span className="meta-value">{result.shootLocation}</span>)}
              </div>
            </div>

            <div className="shots-table">
              <div className="table-header">
                <span>#</span><span>时长</span><span>时间段</span><span>画面内容</span><span>口播台词</span><span>字幕</span><span>摄影师指令</span><span>操作</span>
              </div>
              {result.shots.map((shot, i) => (
                <div key={i} className={`table-row ${regeneratingIdx === i ? 'regen' : ''}`}>
                  <div className="cell cell-num cell-sm"><span className="num-badge">{i + 1}</span></div>
                  <div className="cell cell-sm" onClick={() => !editMode && startShotEdit(i, 'duration')}>
                    {isShotEditing(i, 'duration') ? (
                      <textarea className="cell-input" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && e.ctrlKey && saveEdit()} onBlur={saveEdit} rows={2} autoFocus />
                    ) : (<span className="cell-text editable">{shot.duration}</span>)}
                  </div>
                  <div className="cell cell-sm" onClick={() => !editMode && startShotEdit(i, 'timeRange')}>
                    {isShotEditing(i, 'timeRange') ? (
                      <textarea className="cell-input" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && e.ctrlKey && saveEdit()} onBlur={saveEdit} rows={2} autoFocus />
                    ) : (<span className="cell-text editable">{shot.timeRange}</span>)}
                  </div>
                  <div className="cell" onClick={() => !editMode && startShotEdit(i, 'visual')}>
                    {isShotEditing(i, 'visual') ? (
                      <textarea className="cell-input" value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} rows={3} autoFocus />
                    ) : (<span className="cell-text editable">{shot.visual}</span>)}
                  </div>
                  <div className="cell" onClick={() => !editMode && startShotEdit(i, 'voiceover')}>
                    {isShotEditing(i, 'voiceover') ? (
                      <textarea className="cell-input" value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} rows={3} autoFocus />
                    ) : (<span className="cell-text editable voiceover">{shot.voiceover}</span>)}
                  </div>
                  <div className="cell cell-sm" onClick={() => !editMode && startShotEdit(i, 'subtitle')}>
                    {isShotEditing(i, 'subtitle') ? (
                      <textarea className="cell-input" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && e.ctrlKey && saveEdit()} onBlur={saveEdit} rows={2} autoFocus />
                    ) : (<span className="cell-text editable">{shot.subtitle}</span>)}
                  </div>
                  <div className="cell" onClick={() => !editMode && startShotEdit(i, 'directorNote')}>
                    {isShotEditing(i, 'directorNote') ? (
                      <textarea className="cell-input" value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} rows={3} autoFocus />
                    ) : (<span className="cell-text editable">{shot.directorNote}</span>)}
                  </div>
                  <div className="cell cell-ops">
                    <button className="op-btn" title="上移" onClick={e => { e.stopPropagation(); moveShot(i, -1) }} disabled={i === 0}>↑</button>
                    <button className="op-btn" title="下移" onClick={e => { e.stopPropagation(); moveShot(i, 1) }} disabled={i === result.shots.length - 1}>↓</button>
                    <button className="op-btn" title="在后面插入" onClick={e => { e.stopPropagation(); insertShotAfter(i) }}>＋</button>
                    <button className="op-btn" title="复制此镜头" onClick={e => { e.stopPropagation(); copyShot(i) }}>{copied === 'shot-' + i ? '✓' : '⧉'}</button>
                    <button className="op-btn regen-btn" title="AI 重写此镜头" onClick={e => { e.stopPropagation(); regenerateShot(i) }} disabled={regeneratingIdx !== null}>
                      {regeneratingIdx === i ? '⏳' : '🔁'}
                    </button>
                    <button className="op-btn danger" title="删除" onClick={e => { e.stopPropagation(); deleteShot(i) }} disabled={result.shots.length <= 1}>×</button>
                  </div>
                </div>
              ))}
              <div className="table-footer">
                <button className="add-shot-btn" onClick={() => result.shots.length && insertShotAfter(result.shots.length - 1)}>
                  ＋ 在末尾加一个镜头
                </button>
              </div>
            </div>

            <div className="director-section" onClick={() => !editMode && !isNotesEditing() && startNotesEdit()}>
              <h3>📋 导演注意事项 <span className="edit-inline-hint">点击编辑</span></h3>
              {isNotesEditing() ? (
                <textarea className="director-input" value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} rows={4} autoFocus />
              ) : (
                <pre className="director-text">{result.directorNotes || '（暂无，点击添加）'}</pre>
              )}
            </div>

            {result.usage && (
              <div className="usage-hint">
                📊 本次用量 · 提示 {result.usage.prompt_tokens ?? '-'} tokens · 输出 {result.usage.completion_tokens ?? '-'} tokens · 总计 {result.usage.total_tokens ?? '-'} tokens
              </div>
            )}

            <p className="edit-hint">💡 点击任意单元格编辑 · 右侧按钮可增删、移动、复制或让 AI 重写单个镜头</p>
          </div>
        )}

        {rawText && !result && (
          <div className="raw-text-card glass-card">
            <h3>原始输出（解析失败）</h3>
            <pre className="raw-text">{rawText}</pre>
            <p className="error">{error || '格式解析失败，请重试'}</p>
          </div>
        )}

        {history.length > 0 && !result && !loading && (
          <div className="history-section">
            <h3>📜 历史记录<span className="history-count">{history.length}</span></h3>
            <div className="history-list">
              {history.map(script => (
                <div key={script.id} className="history-item">
                  <div className="history-icon" onClick={() => { setResult(script); setRawText('') }}>🎬</div>
                  <div className="history-text" onClick={() => { setResult(script); setRawText('') }}>
                    <span className="history-dest">{script.destination} — {script.purpose}</span>
                    <span className="history-date">{script.createdAt}</span>
                  </div>
                  <button className="history-clone" title="克隆参数到表单" onClick={(e) => { e.stopPropagation(); cloneToForm(script) }}>📄</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {history.length === 0 && !result && !rawText && !loading && (
          <div className="empty-state">
            <span className="emoji">✨</span>
            <h3>还没有生成过脚本</h3>
            <p>填写上方拍摄信息，点击「生成分镜脚本」<br />让 AI 替你写出可直接拍摄的爆款分镜表</p>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>昕昕分镜脚本生成器 · 数据仅存储在你的浏览器，不上传任何服务器</p>
        <div className="footer-links">
          <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noreferrer">获取 API Key</a>
          <a href="https://github.com/MXD706/xinjie-script-generator" target="_blank" rel="noreferrer">GitHub</a>
        </div>
      </footer>
    </div>
  )
}
