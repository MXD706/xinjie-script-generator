import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import './App.css'
import type { Script, Shot, SceneMode, Draft, Settings, EditMode } from './types'
import { SCENES, SCENE_LIST, getScene, buildUserPrompt, buildRegenShotPrompt } from './templates'
import { callWithRetry, callDeepSeekStream, testKey } from './deepseek'
import { parseShots, parseMeta, parseDirectorNotes, parsePublishKit, voiceoverWarning, totalDurationWarning } from './parser'
import { toMarkdown, toSRT, toShootingList, mergeVoiceover, downloadText, renderToCanvas, exportPDF } from './exporters'
import { scanScript } from './sensitive'
import { encodeShare, decodeShare } from './share'
import {
  loadKey, saveKey, loadSettings, saveSettings,
  loadHistory, saveHistory, loadDraft, saveDraft, clearDraft,
  exportBackup, importBackup,
} from './storage'
import { Teleprompter } from './components/Teleprompter'
import { UpdatePrompt } from './components/UpdatePrompt'
import { CommandPalette, type Command, SCENE_LABELS } from './components/CommandPalette'

const MAX_UNDO = 50

export default function App() {
  // —— 核心状态 ——
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [mode, setModeState] = useState<SceneMode>(() => {
    const d = loadDraft()
    return d?.mode || 'travel'
  })
  const [key, setKey] = useState(loadKey)
  const [tempKey, setTempKey] = useState('')
  const [keyTestResult, setKeyTestResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [keyTesting, setKeyTesting] = useState(false)

  const [contentType, setContentType] = useState('')
  const [targetDuration, setTargetDuration] = useState('')
  const [formData, setFormData] = useState<Record<string, string>>({})

  const [loading, setLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [streamingShotCount, setStreamingShotCount] = useState(0)
  const [result, setResult] = useState<Script | null>(null)
  const [error, setError] = useState('')
  const [rawText, setRawText] = useState('')
  const [copied, setCopied] = useState('')

  const [history, setHistory] = useState<Script[]>(loadHistory)
  const [historyQuery, setHistoryQuery] = useState('')

  // UI
  const [showKeyInput, setShowKeyInput] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showTopicLibrary, setShowTopicLibrary] = useState(false)
  const [showPalette, setShowPalette] = useState(false)
  const [showTeleprompter, setShowTeleprompter] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [formOpen, setFormOpen] = useState(true)
  const [editModeOn, setEditModeOn] = useState(false)
  const [editing, setEditing] = useState<EditMode>(null)
  const [editValue, setEditValue] = useState('')
  const [regenIdx, setRegenIdx] = useState<number | null>(null)
  const [imgPreview, setImgPreview] = useState('')
  const [pdfLoading, setPdfLoading] = useState(false)

  // Undo/Redo
  const undoStack = useRef<Script[]>([])
  const redoStack = useRef<Script[]>([])

  const resultRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : ''
  const isWechat = /micromessenger/.test(ua)
  const isMobile = /iphone|ipad|ipod|android|mobile/.test(ua)

  const scene = getScene(mode)

  // 手机默认折叠表单
  useEffect(() => {
    if (isMobile) setFormOpen(false)
  }, [isMobile])

  // 切换主题
  useEffect(() => {
    const apply = (t: 'dark' | 'light') => document.documentElement.setAttribute('data-theme', t)
    if (settings.theme === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: light)')
      const upd = () => apply(mq.matches ? 'light' : 'dark')
      upd()
      mq.addEventListener('change', upd)
      return () => mq.removeEventListener('change', upd)
    } else {
      apply(settings.theme)
    }
  }, [settings.theme])

  // 切模式时恢复该模式的草稿
  const setMode = (m: SceneMode) => {
    setModeState(m)
    const d = loadDraft(m)
    if (d) {
      setFormData(d.formData || {})
      setContentType(d.contentType || '')
      setTargetDuration(d.targetDuration || '')
    } else {
      setFormData({})
      setContentType('')
      setTargetDuration('')
    }
  }

  // 初次加载：恢复当前模式的草稿
  useEffect(() => {
    const d = loadDraft()
    if (d) {
      setFormData(d.formData || {})
      setContentType(d.contentType || '')
      setTargetDuration(d.targetDuration || '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 表单变化：debounce 保存草稿 + 清错
  useEffect(() => {
    if (error) setError('')
    const t = setTimeout(() => {
      const d: Draft = { mode, contentType, targetDuration, formData }
      saveDraft(d, settings.incognito)
    }, 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, contentType, targetDuration, formData])

  // 分享链接解析
  useEffect(() => {
    const h = window.location.hash
    const m = /^#share=(.+)$/.exec(h)
    if (m) {
      decodeShare(m[1]).then(s => {
        if (s) {
          setResult(s)
          window.history.replaceState(null, '', window.location.pathname + window.location.search)
        }
      })
    }
  }, [])

  // 全局快捷键
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cmd = e.metaKey || e.ctrlKey
      if (cmd && e.key === 'k') { e.preventDefault(); setShowPalette(s => !s) }
      else if (cmd && e.key === 'Enter') {
        if (!loading && !showPalette) { e.preventDefault(); generateScript() }
      }
      else if (cmd && e.key === 's' && result) {
        e.preventDefault(); downloadMarkdown()
      }
      else if (cmd && e.key === 'z' && !e.shiftKey && result) {
        e.preventDefault(); undo()
      }
      else if (cmd && (e.key === 'Z' || (e.shiftKey && e.key === 'z')) && result) {
        e.preventDefault(); redo()
      }
      else if (e.key === 'Escape') {
        if (showPalette) setShowPalette(false)
        else if (showTopicLibrary) setShowTopicLibrary(false)
        else if (showShareModal) setShowShareModal(false)
        else if (showSettings) setShowSettings(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, result, showPalette, showTopicLibrary, showShareModal, showSettings])

  // —— 表单字段更新 ——
  const updateField = (k: string, v: string) => setFormData(prev => ({ ...prev, [k]: v }))

  // —— Key 相关 ——
  const handleSaveKey = () => {
    saveKey(tempKey); setKey(tempKey); setShowKeyInput(false); setKeyTestResult(null)
  }
  const handleTestKey = async () => {
    if (!tempKey.trim()) { setKeyTestResult({ ok: false, msg: '请先填入 Key' }); return }
    setKeyTesting(true); setKeyTestResult(null)
    const r = await testKey(tempKey.trim())
    setKeyTesting(false)
    setKeyTestResult(r)
  }

  // —— 生成脚本 ——
  const generateScript = useCallback(async () => {
    if (!key) { setShowKeyInput(true); return }

    // 校验必填字段
    for (const f of scene.fields) {
      if (f.required && !(formData[f.key] || '').trim()) {
        setError(`请填写：${f.label}`)
        return
      }
    }

    setLoading(true); setError(''); setResult(null); setRawText('')
    setStreamingText(''); setStreamingShotCount(0)
    undoStack.current = []; redoStack.current = []

    const systemPrompt = settings.customSystemPrompts[mode] || scene.systemPrompt
    const userPrompt = buildUserPrompt(mode, formData, contentType, targetDuration)
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]

    const ctl = new AbortController()
    abortRef.current = ctl

    let fullText = ''
    let usage: Script['usage']
    try {
      const r = await callWithRetry({
        key, messages, signal: ctl.signal,
        onDelta: (chunk) => {
          setStreamingText(prev => {
            const next = prev + chunk
            // 实时统计已解析出的镜头数
            const matches = next.match(/^\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|[\s]*$/gm)
            if (matches) setStreamingShotCount(matches.length - 1)   // 减去表头
            return next
          })
        },
      })
      fullText = r.fullText
      usage = r.usage
    } catch (err: any) {
      const msg = err?.message || ''
      if (err?.name === 'AbortError') setError('已取消')
      else if (/401|Unauthorized/.test(msg)) setError('API Key 无效，请检查')
      else if (/429|rate/i.test(msg)) setError('请求过于频繁，请稍后再试')
      else if (/fetch|network|网络/i.test(msg)) setError('网络连接失败，请检查网络')
      else setError(msg || '生成失败，请重试')
      setLoading(false); abortRef.current = null
      return
    }

    try {
      if (!fullText.includes('|')) throw new Error('生成格式不对，请重试')
      const title = (formData.destination || formData.topic || formData.title || '').trim()
      const meta = parseMeta(fullText, title)
      const shots = parseShots(fullText)
      if (shots.length === 0) {
        setRawText(fullText)
        throw new Error('未能解析出镜头，已显示原始输出')
      }
      const publish = settings.showPublishKit ? parsePublishKit(fullText) : undefined

      const script: Script = {
        id: Date.now(),
        mode,
        createdAt: new Date().toLocaleString('zh-CN'),
        title,
        subtitle: (formData.purpose || formData.viewpoint || formData.mood || '').trim(),
        totalDuration: meta.totalDuration,
        bgm: meta.bgm,
        shootLocation: meta.shootLocation,
        formData: { ...formData },
        shots,
        directorNotes: parseDirectorNotes(fullText),
        publish,
        usage,
      }
      setResult(script)
      setStreamingText(''); setStreamingShotCount(0)
      const newHistory = [script, ...history]
      setHistory(newHistory)
      saveHistory(newHistory, settings.incognito)
    } catch (err: any) {
      setError(err?.message || '解析失败')
    } finally {
      setLoading(false); abortRef.current = null
    }
  }, [key, mode, contentType, targetDuration, formData, history, scene, settings])

  const cancelGenerate = () => { abortRef.current?.abort() }

  // —— 整体重生 ——
  const regenerateFull = () => { if (!loading) generateScript() }

  // —— 再短 / 再长 ——
  const adjustLength = async (hint: string) => {
    if (!result || loading || !key) return
    setLoading(true); setError('')

    const systemPrompt = settings.customSystemPrompts[mode] || scene.systemPrompt
    const userPrompt = buildUserPrompt(mode, formData, contentType, targetDuration) +
      `\n\n已有一版脚本：\n${toMarkdownForPrompt(result.shots)}\n\n` + hint
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]

    const ctl = new AbortController()
    abortRef.current = ctl
    setStreamingText('')

    try {
      const r = await callWithRetry({
        key, messages, signal: ctl.signal,
        onDelta: (chunk) => setStreamingText(prev => prev + chunk),
      })
      const meta = parseMeta(r.fullText, result.shootLocation)
      const shots = parseShots(r.fullText)
      if (shots.length === 0) throw new Error('重新生成失败，请再试一次')
      const publish = settings.showPublishKit ? parsePublishKit(r.fullText) : result.publish
      pushUndo(result)
      setResult({
        ...result,
        totalDuration: meta.totalDuration, bgm: meta.bgm, shootLocation: meta.shootLocation,
        shots, directorNotes: parseDirectorNotes(r.fullText) || result.directorNotes,
        publish, usage: r.usage,
      })
      setStreamingText('')
    } catch (err: any) {
      if (err?.name !== 'AbortError') setError(err.message || '调整失败')
    } finally {
      setLoading(false); abortRef.current = null
    }
  }

  // —— 单镜头重生 ——
  const regenerateShot = async (i: number) => {
    if (!result || !key || regenIdx !== null) return
    setRegenIdx(i); setError('')
    try {
      const ctl = new AbortController()
      const messages = [
        { role: 'system', content: settings.customSystemPrompts[mode] || scene.systemPrompt },
        { role: 'user', content: buildRegenShotPrompt(mode, formData, i, result.shots[i]) },
      ]
      const r = await callDeepSeekStream({
        key, messages, signal: ctl.signal, onDelta: () => {}, max_tokens: 600,
      })
      const shots = parseShots(r.fullText)
      if (shots.length === 0) throw new Error('重写失败，请再试')
      pushUndo(result)
      const newShots = [...result.shots]
      newShots[i] = { ...shots[0], done: result.shots[i].done }
      setResult({ ...result, shots: newShots })
    } catch (err: any) {
      if (err?.name !== 'AbortError') setError(err.message || '重写失败')
    } finally {
      setRegenIdx(null)
    }
  }

  // —— 镜头操作 ——
  const updateShot = (i: number, field: keyof Shot, val: string | boolean) => {
    if (!result) return
    pushUndo(result)
    const shots = result.shots.map((s, j) => j === i ? { ...s, [field]: val } : s)
    persistResult({ ...result, shots })
  }
  const moveShot = (i: number, dir: -1 | 1) => {
    if (!result) return
    const j = i + dir
    if (j < 0 || j >= result.shots.length) return
    pushUndo(result)
    const shots = [...result.shots]
    ;[shots[i], shots[j]] = [shots[j], shots[i]]
    persistResult({ ...result, shots })
  }
  const insertShotAfter = (i: number) => {
    if (!result) return
    pushUndo(result)
    const newShot: Shot = { duration: '3秒', timeRange: '—', visual: '', voiceover: '', subtitle: '', directorNote: '' }
    const shots = [...result.shots.slice(0, i + 1), newShot, ...result.shots.slice(i + 1)]
    persistResult({ ...result, shots })
  }
  const deleteShot = (i: number) => {
    if (!result || result.shots.length <= 1) return
    pushUndo(result)
    const shots = result.shots.filter((_, j) => j !== i)
    persistResult({ ...result, shots })
  }
  const toggleShotDone = (i: number) => {
    if (!result) return
    const shots = result.shots.map((s, j) => j === i ? { ...s, done: !s.done } : s)
    // 打勾不进 undo 栈（太频繁）
    persistResult({ ...result, shots })
  }

  // —— Meta 编辑 ——
  const updateMeta = (field: 'totalDuration' | 'bgm' | 'shootLocation' | 'directorNotes', val: string) => {
    if (!result) return
    pushUndo(result)
    persistResult({ ...result, [field]: val })
  }

  // —— 持久化 ——
  const persistResult = (s: Script) => {
    setResult(s)
    const newHistory = history.map(h => h.id === s.id ? s : h)
    setHistory(newHistory)
    saveHistory(newHistory, settings.incognito)
  }

  // —— Undo / Redo ——
  const pushUndo = (s: Script) => {
    undoStack.current.push(JSON.parse(JSON.stringify(s)))
    if (undoStack.current.length > MAX_UNDO) undoStack.current.shift()
    redoStack.current = []
  }
  const undo = () => {
    if (!result || undoStack.current.length === 0) return
    const prev = undoStack.current.pop()!
    redoStack.current.push(JSON.parse(JSON.stringify(result)))
    persistResult(prev)
  }
  const redo = () => {
    if (!result || redoStack.current.length === 0) return
    const next = redoStack.current.pop()!
    undoStack.current.push(JSON.parse(JSON.stringify(result)))
    persistResult(next)
  }

  // —— 收藏 / 删除 ——
  const toggleFavorite = (id: number) => {
    const newHistory = history.map(s => s.id === id ? { ...s, favorite: !s.favorite } : s)
    setHistory(newHistory)
    saveHistory(newHistory, settings.incognito)
    if (result?.id === id) setResult({ ...result, favorite: !result.favorite })
  }
  const deleteScript = (id: number) => {
    const newHistory = history.filter(s => s.id !== id)
    setHistory(newHistory)
    saveHistory(newHistory, settings.incognito)
    if (result?.id === id) { setResult(null); setRawText('') }
  }

  // —— 导出 ——
  const downloadMarkdown = () => {
    if (!result) return
    downloadText(`昕昕分镜_${result.title || 'script'}.md`, toMarkdown(result), 'text/markdown;charset=utf-8')
  }
  const downloadSRT = () => {
    if (!result) return
    downloadText(`昕昕分镜_${result.title || 'script'}.srt`, toSRT(result))
  }
  const downloadShootList = () => {
    if (!result) return
    downloadText(`拍摄清单_${result.title || 'script'}.txt`, toShootingList(result))
  }
  const copyMergedVO = () => {
    if (!result) return
    navigator.clipboard.writeText(mergeVoiceover(result.shots)).then(() => flashCopied('vo'))
  }
  const copyShot = (i: number) => {
    if (!result) return
    const s = result.shots[i]
    const text = `镜头${i + 1}（${s.duration}，${s.timeRange}）\n画面：${s.visual}\n口播：${s.voiceover}\n字幕：${s.subtitle}\n指令：${s.directorNote}`
    navigator.clipboard.writeText(text).then(() => flashCopied('shot-' + i))
  }
  const flashCopied = (k: string) => { setCopied(k); setTimeout(() => setCopied(''), 2000) }

  const handleExportPDF = async () => {
    if (!result || !resultRef.current || pdfLoading) return
    setPdfLoading(true)
    try {
      const canvas = await renderToCanvas(resultRef.current, isMobile)
      if (isWechat) {
        setImgPreview(canvas.toDataURL('image/jpeg', 0.92))
        setPdfLoading(false); return
      }
      const r = await exportPDF(canvas, `昕昕分镜_${result.title}.pdf`, isMobile)
      if (r.mode === 'imgpreview' && r.url) setImgPreview(r.url)
    } catch (e: any) {
      setError('导出失败：' + (e.message || e))
    } finally {
      setPdfLoading(false)
    }
  }

  const handleShare = async () => {
    if (!result) return
    const code = await encodeShare(result)
    const url = `${window.location.origin}${window.location.pathname}#share=${code}`
    setShareUrl(url)
    setShowShareModal(true)
    navigator.clipboard.writeText(url).catch(() => {})
  }

  // —— 备份 ——
  const handleExportBackup = () => {
    downloadText(`昕昕备份_${new Date().toISOString().slice(0, 10)}.json`, exportBackup(), 'application/json')
  }
  const handleImportBackup = () => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = 'application/json'
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0]
      if (!file) return
      const text = await file.text()
      const r = importBackup(text)
      if (r.ok) { setHistory(loadHistory()); setSettings(loadSettings()); setKey(loadKey()); alert(r.msg) }
      else alert(r.msg)
    }
    input.click()
  }

  // —— 选题库 ——
  const applyTopic = (fill: Record<string, string | undefined>) => {
    const next: Record<string, string> = { ...formData }
    for (const [k, v] of Object.entries(fill)) {
      if (v !== undefined) next[k] = v
    }
    setFormData(next)
    if (fill.keyMessage) setContentType(fill.keyMessage)
    setShowTopicLibrary(false)
    setFormOpen(true)
  }

  const loadExample = () => {
    const topic = scene.topicLibrary[0]
    if (topic) applyTopic(topic.fill)
  }

  // —— 克隆 ——
  const cloneToForm = (s: Script) => {
    setModeState(s.mode)
    setFormData({ ...s.formData })
    setContentType('')
    setTargetDuration('')
    setResult(null); setRawText(''); setFormOpen(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // —— 命令面板 ——
  const commands: Command[] = useMemo(() => [
    ...SCENE_LIST.map(m => ({
      id: 'mode-' + m, section: '切换模式',
      label: `切换到 ${SCENE_LABELS[m].label}`,
      emoji: SCENE_LABELS[m].emoji,
      keywords: [m, SCENE_LABELS[m].label],
      disabled: m === mode,
      run: () => setMode(m),
    })),
    { id: 'gen', section: '操作', label: '生成脚本', emoji: '✨', hint: '⌘⏎', keywords: ['generate', 'ai'], disabled: loading, run: generateScript },
    { id: 'topic', section: '操作', label: '打开选题库', emoji: '💡', keywords: ['topic', 'library'], run: () => setShowTopicLibrary(true) },
    { id: 'example', section: '操作', label: '填入示例数据', emoji: '📦', run: loadExample },
    { id: 'reset', section: '操作', label: '清空表单', emoji: '🧹', run: () => { setFormData({}); setContentType(''); setTargetDuration(''); clearDraft() } },
    ...(result ? [
      { id: 'regen-all', section: '结果', label: '重新生成整条', emoji: '🔄', disabled: loading, run: regenerateFull },
      { id: 'shorter', section: '结果', label: '再短 10 秒', emoji: '➖', disabled: loading, run: () => adjustLength('请在保持完整性的前提下，把总时长减少约 10 秒，合并或去掉次要镜头。') },
      { id: 'longer', section: '结果', label: '再加 2 个镜头', emoji: '➕', disabled: loading, run: () => adjustLength('请在现有基础上，再加 2 个镜头，让内容更丰富。') },
      { id: 'teleprompter', section: '结果', label: '进入提词器模式', emoji: '📣', run: () => setShowTeleprompter(true) },
      { id: 'md', section: '导出', label: '导出 Markdown', emoji: '📝', hint: '⌘S', run: downloadMarkdown },
      { id: 'srt', section: '导出', label: '导出 SRT 字幕', emoji: '💬', run: downloadSRT },
      { id: 'list', section: '导出', label: '导出拍摄清单', emoji: '📋', run: downloadShootList },
      { id: 'vo', section: '导出', label: '复制合并口播', emoji: '🎤', run: copyMergedVO },
      { id: 'share', section: '导出', label: '生成分享链接', emoji: '🔗', run: handleShare },
      { id: 'pdf', section: '导出', label: '导出 PDF / 长图', emoji: '📄', run: handleExportPDF },
      { id: 'undo', section: '编辑', label: '撤销', emoji: '↶', hint: '⌘Z', disabled: undoStack.current.length === 0, run: undo },
      { id: 'redo', section: '编辑', label: '重做', emoji: '↷', hint: '⌘⇧Z', disabled: redoStack.current.length === 0, run: redo },
      { id: 'edit-mode', section: '编辑', label: editModeOn ? '关闭编辑模式' : '开启编辑模式', emoji: '✏️', run: () => setEditModeOn(e => !e) },
    ] : []),
    { id: 'settings', section: '设置', label: '打开设置', emoji: '⚙️', run: () => setShowSettings(true) },
    { id: 'key', section: '设置', label: 'API Key', emoji: '🔑', run: () => { setTempKey(key); setShowKeyInput(true) } },
    { id: 'theme', section: '设置', label: `切换主题（当前：${settings.theme}）`, emoji: '🎨',
      run: () => {
        const next: Settings['theme'] = settings.theme === 'dark' ? 'light' : settings.theme === 'light' ? 'auto' : 'dark'
        const s = { ...settings, theme: next }; setSettings(s); saveSettings(s)
      }},
    { id: 'backup-export', section: '设置', label: '导出完整备份', emoji: '💾', run: handleExportBackup },
    { id: 'backup-import', section: '设置', label: '导入备份', emoji: '📥', run: handleImportBackup },
    { id: 'incognito', section: '设置', label: settings.incognito ? '关闭无痕模式' : '开启无痕模式', emoji: '🕶',
      run: () => { const s = { ...settings, incognito: !settings.incognito }; setSettings(s); saveSettings(s) }},
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [mode, loading, result, settings, editModeOn, key])

  // —— 历史过滤 ——
  const filteredHistory = useMemo(() => {
    const q = historyQuery.trim().toLowerCase()
    if (!q) return history
    return history.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.subtitle.toLowerCase().includes(q) ||
      JSON.stringify(s.formData).toLowerCase().includes(q)
    )
  }, [history, historyQuery])

  // —— 编辑辅助 ——
  const startEdit = (e: EditMode, v: string) => { if (!editModeOn) return; setEditing(e); setEditValue(v) }
  const saveEdit = () => {
    if (!editing || !result) { setEditing(null); return }
    if (editing.type === 'meta') updateMeta(editing.field as any, editValue)
    else if (editing.type === 'shot') updateShot(editing.index, editing.field, editValue)
    else if (editing.type === 'directorNotes') updateMeta('directorNotes', editValue)
    setEditing(null); setEditValue('')
  }

  const totalWarn = result ? totalDurationWarning(result.shots, result.totalDuration) : ''
  const sensitiveHits = result ? scanScript({ shots: result.shots, publish: result.publish, directorNotes: result.directorNotes }) : []

  // =============== RENDER ===============
  return (
    <div className="container">
      <header className="header">
        <div className="badge"><span className="dot" />昕昕分镜脚本生成器</div>
        <h1>把"想法"一键变成可拍可发的脚本</h1>
        <p className="subtitle">旅游 · 口播 · 日常 — AI 生成分镜表、字幕、标题、文案 · 全流程工具</p>
        <div className="header-actions">
          <button className="key-btn" onClick={() => setShowPalette(true)} title="⌘K 命令面板">⌘K 命令</button>
          <button className="key-btn" onClick={() => setShowSettings(true)}>⚙️ 设置</button>
          {!key && <button className="key-btn primary-key" onClick={() => { setTempKey(''); setShowKeyInput(true) }}>🔑 设置 API Key</button>}
          {key && <button className="key-btn small set" onClick={() => { setTempKey(key); setShowKeyInput(true) }}>Key 已配置 · 更换</button>}
        </div>
      </header>

      {/* 场景切换 */}
      <div className="scene-tabs">
        {SCENE_LIST.map(m => (
          <button key={m} className={`scene-tab ${m === mode ? 'active' : ''}`} onClick={() => setMode(m)}>
            <span className="scene-emoji">{SCENES[m].emoji}</span>
            <span className="scene-label">{SCENES[m].label}</span>
            <span className="scene-desc">{SCENES[m].short}</span>
          </button>
        ))}
      </div>

      {/* 表单 */}
      <main className="main">
        <div className="form-card glass-card">
          <div className="form-toggle" onClick={() => setFormOpen(!formOpen)}>
            <h2>📋 {scene.label}拍摄信息<span className="form-hint">填得越细，生成越准</span></h2>
            <div className="form-toggle-right">
              <button className="topic-btn" onClick={(e) => { e.stopPropagation(); setShowTopicLibrary(true) }}>💡 选题库</button>
              <span className="toggle-icon">{formOpen ? '▲ 收起' : '▼ 展开'}</span>
            </div>
          </div>

          {formOpen && (
            <div className="form-body">
              {renderFormFields(scene, formData, updateField)}

              {/* 内容类型 */}
              <div className="form-section">
                <div className="form-section-title">
                  <span className="icon">🎭</span>内容类型<span className="desc">决定故事节奏和钩子</span>
                </div>
                <div className="chips chip-row">
                  {scene.contentTypes.map(t => (
                    <button key={t.key} className={`chip ${contentType === t.key ? 'active' : ''}`} onClick={() => setContentType(contentType === t.key ? '' : t.key)} title={t.hint}>
                      <span className="chip-emoji">{t.emoji}</span>
                      <span className="chip-label">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 目标时长 */}
              <div className="form-section">
                <div className="form-section-title">
                  <span className="icon">⏱</span>目标总时长<span className="desc">选一个大概长度，AI 会据此分配</span>
                </div>
                <div className="chips chip-row">
                  {scene.durationPresets.map(d => (
                    <button key={d} className={`chip ${targetDuration === d ? 'active' : ''}`} onClick={() => setTargetDuration(targetDuration === d ? '' : d)}>
                      <span className="chip-label">{d}</span>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="error-banner">⚠️ {error}<button className="close-x" onClick={() => setError('')}>×</button></div>
              )}

              <div className="form-footer">
                <button className="reset-btn" onClick={() => { setFormData({}); setContentType(''); setTargetDuration(''); clearDraft() }}>清空</button>
                {!loading && (
                  <button className="generate-btn" onClick={generateScript}>
                    ✨ 生成分镜脚本
                    <span className="kbd-hint">⌘⏎</span>
                  </button>
                )}
                {loading && (
                  <button className="generate-btn cancel" onClick={cancelGenerate}>⏸ 取消生成</button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 流式输出区 */}
        {loading && (streamingText || true) && (
          <div className="streaming-card glass-card">
            <div className="streaming-header">
              <span className="pulse-dot" /> AI 正在生成…
              {streamingShotCount > 0 && <span className="streaming-progress">已解析 {streamingShotCount} 个镜头</span>}
            </div>
            {streamingText && <pre className="streaming-text">{streamingText.slice(-500)}</pre>}
          </div>
        )}

        {/* 结果区 */}
        {result && (
          <div className="result-card glass-card" ref={resultRef}>
            <div className="result-header">
              <div className="result-header-left">
                <h2>🎬 {result.title}</h2>
                {result.subtitle && <span className="result-count">{result.subtitle}</span>}
                {result.usage?.total_tokens && <span className="usage-hint">· {result.usage.total_tokens} tokens</span>}
              </div>
              <div className="result-actions">
                <button className={`action-btn ${editModeOn ? 'active' : ''}`} onClick={() => setEditModeOn(!editModeOn)}>{editModeOn ? '✓ 编辑中' : '✏️ 编辑'}</button>
                <button className="action-btn" onClick={() => toggleFavorite(result.id)}>{result.favorite ? '⭐ 已收藏' : '☆ 收藏'}</button>
                <button className="action-btn" onClick={() => setShowTeleprompter(true)} title="提词器模式">📣 提词</button>
                <button className="action-btn" onClick={downloadMarkdown}>📝 MD</button>
                <button className="action-btn" onClick={downloadSRT}>💬 SRT</button>
                <button className="action-btn" onClick={copyMergedVO}>🎤 合并口播 {copied === 'vo' ? '✓' : ''}</button>
                <button className="action-btn" onClick={() => cloneToForm(result)}>📄 克隆</button>
                <button className="action-btn" onClick={handleShare}>🔗 分享</button>
                <button className="action-btn" onClick={handleExportPDF} disabled={pdfLoading}>{pdfLoading ? '⏳' : (isWechat ? '🖼 长图' : '📄 PDF')}</button>
                <button className="action-btn danger" onClick={() => deleteScript(result.id)}>🗑️</button>
              </div>
            </div>

            {isWechat && (
              <div className="wechat-tip">
                💡 微信不支持直接下载，请点「长图」生成图片后<b>长按保存</b>，或右上角用浏览器打开。
              </div>
            )}

            <div className="info-summary">
              <span>{SCENES[result.mode].emoji} {SCENES[result.mode].label}</span>
              <span>⏱ {result.totalDuration}</span>
              <span>🎵 {result.bgm}</span>
              <span>📌 {result.shootLocation}</span>
              {totalWarn && <span className="warn">⚠️ {totalWarn}</span>}
            </div>

            {/* 镜头表 */}
            <div className="shots-table">
              <div className="table-header">
                <span>✓</span><span>#</span><span>时长</span><span>时间段</span><span>画面内容</span><span>口播台词</span><span>字幕</span><span>摄影师指令</span>
                <span>操作</span>
              </div>
              {result.shots.map((shot, i) => {
                const voWarn = voiceoverWarning(shot)
                return (
                  <div key={i} className={`table-row ${shot.done ? 'done' : ''}`}>
                    <div className="cell cell-check">
                      <input type="checkbox" checked={!!shot.done} onChange={() => toggleShotDone(i)} />
                    </div>
                    <div className="cell cell-num cell-sm"><span className="num-badge">{i + 1}</span></div>
                    {(['duration', 'timeRange', 'visual', 'voiceover', 'subtitle', 'directorNote'] as const).map(f => (
                      <div key={f} className={`cell ${f === 'duration' || f === 'timeRange' || f === 'subtitle' ? 'cell-sm' : ''}`} onClick={() => startEdit({ type: 'shot', index: i, field: f }, shot[f] as string)}>
                        {editing?.type === 'shot' && editing.index === i && editing.field === f ? (
                          <textarea className="cell-input" value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} rows={3} autoFocus />
                        ) : (
                          <span className={`cell-text ${editModeOn ? 'editable' : ''} ${f === 'voiceover' ? 'voiceover' : ''}`}>
                            {shot[f]}
                            {f === 'voiceover' && voWarn && <span className="vo-warn" title={voWarn}>⚠︎</span>}
                          </span>
                        )}
                      </div>
                    ))}
                    <div className="cell cell-ops">
                      <button className="op-btn" title="上移" onClick={() => moveShot(i, -1)} disabled={i === 0}>↑</button>
                      <button className="op-btn" title="下移" onClick={() => moveShot(i, 1)} disabled={i === result.shots.length - 1}>↓</button>
                      <button className="op-btn" title="插入" onClick={() => insertShotAfter(i)}>＋</button>
                      <button className={`op-btn regen-btn ${regenIdx === i ? 'loading' : ''}`} title="AI 重写" onClick={() => regenerateShot(i)} disabled={regenIdx !== null}>{regenIdx === i ? '⏳' : '↻'}</button>
                      <button className="op-btn" title="复制" onClick={() => copyShot(i)}>{copied === 'shot-' + i ? '✓' : '⧉'}</button>
                      <button className="op-btn danger" title="删除" onClick={() => deleteShot(i)} disabled={result.shots.length <= 1}>×</button>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="table-footer">
              <button className="add-shot-btn" onClick={() => result.shots.length && insertShotAfter(result.shots.length - 1)}>+ 添加镜头</button>
              <button className="add-shot-btn" onClick={regenerateFull} disabled={loading}>🔄 重新生成整条</button>
              <button className="add-shot-btn" onClick={() => adjustLength('请把总时长减少约 10 秒')} disabled={loading}>➖ 再短 10s</button>
              <button className="add-shot-btn" onClick={() => adjustLength('请再增加 2 个镜头让内容更丰富')} disabled={loading}>➕ 再长</button>
            </div>

            {/* 导演备注（可编辑） */}
            {(result.directorNotes || editModeOn) && (
              <div className="director-section">
                <h3>📋 导演注意事项</h3>
                {editing?.type === 'directorNotes' ? (
                  <textarea className="director-input" value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} autoFocus rows={5} />
                ) : (
                  <pre className={`director-text ${editModeOn ? 'editable' : ''}`} onClick={() => startEdit({ type: 'directorNotes' }, result.directorNotes)}>{result.directorNotes || (editModeOn ? '点击添加...' : '')}</pre>
                )}
              </div>
            )}

            {/* 发布物料 */}
            {result.publish && (
              <div className="publish-kit">
                <h3>📣 发布物料</h3>
                {result.publish.titles.length > 0 && (
                  <div className="pk-block">
                    <div className="pk-label">📌 备选标题</div>
                    <ul className="pk-titles">
                      {result.publish.titles.map((t, i) => (
                        <li key={i}>
                          <span>{t}</span>
                          <button className="op-btn" onClick={() => { navigator.clipboard.writeText(t); flashCopied('title-' + i) }}>{copied === 'title-' + i ? '✓' : '⧉'}</button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {result.publish.caption && (
                  <div className="pk-block">
                    <div className="pk-label">💬 发布文案 <button className="op-btn" onClick={() => { navigator.clipboard.writeText(result.publish!.caption); flashCopied('cap') }}>{copied === 'cap' ? '已复制' : '复制'}</button></div>
                    <div className="pk-caption">{result.publish.caption}</div>
                  </div>
                )}
                {result.publish.hashtags.length > 0 && (
                  <div className="pk-block">
                    <div className="pk-label">🏷 话题 <button className="op-btn" onClick={() => { navigator.clipboard.writeText(result.publish!.hashtags.join(' ')); flashCopied('tags') }}>{copied === 'tags' ? '已复制' : '复制'}</button></div>
                    <div className="pk-tags">{result.publish.hashtags.map((t, i) => <span key={i} className="pk-tag">{t}</span>)}</div>
                  </div>
                )}
                {result.publish.coverText && (
                  <div className="pk-block">
                    <div className="pk-label">🎨 封面建议</div>
                    <div>大字：<b className="pk-cover-text">{result.publish.coverText}</b></div>
                    <div>{result.publish.coverShotIndex >= 0 ? `建议用第 ${result.publish.coverShotIndex + 1} 个镜头截图` : '另行拍摄封面'}</div>
                  </div>
                )}
              </div>
            )}

            {/* 敏感词警告 */}
            {sensitiveHits.length > 0 && (
              <div className="sensitive-warnings">
                <strong>⚠️ 检测到 {sensitiveHits.length} 处风险词（仅提示，不影响生成）：</strong>
                <ul>
                  {sensitiveHits.map((h, i) => (
                    <li key={i} className={`sw-item sw-${h.level}`}>
                      <code>{h.word}</code> — {h.reason}
                      {h.suggestion && <span className="sw-suggest"> → {h.suggestion}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {editModeOn && <p className="edit-hint">💡 编辑模式下点击任意内容可编辑；⌘Z 撤销，⌘⇧Z 重做</p>}
          </div>
        )}

        {/* 原始文本（解析失败） */}
        {rawText && !result && (
          <div className="raw-text-card glass-card">
            <h3>原始输出（解析失败）</h3>
            <pre className="raw-text">{rawText}</pre>
            <p className="error">{error}</p>
          </div>
        )}

        {/* 历史 */}
        {history.length > 0 && !result && (
          <div className="history-section">
            <div className="history-header">
              <h3>📜 历史记录<span className="history-count">{history.length}</span></h3>
              <input className="history-search" placeholder="搜索历史..." value={historyQuery} onChange={e => setHistoryQuery(e.target.value)} />
            </div>
            <div className="history-list">
              {filteredHistory.map(s => (
                <div key={s.id} className="history-item" onClick={() => { setResult(s); setRawText('') }}>
                  <div className="history-icon">{SCENES[s.mode]?.emoji || '🎬'}</div>
                  <div className="history-text">
                    <span className="history-dest">{s.favorite ? '⭐ ' : ''}{s.title}{s.subtitle ? ` — ${s.subtitle}` : ''}</span>
                    <span className="history-date">{SCENES[s.mode]?.label || ''} · {s.createdAt}</span>
                  </div>
                  <button className="history-clone" title="克隆到表单" onClick={(e) => { e.stopPropagation(); cloneToForm(s) }}>📄</button>
                  <button className="history-clone" title="收藏" onClick={(e) => { e.stopPropagation(); toggleFavorite(s.id) }}>{s.favorite ? '⭐' : '☆'}</button>
                  <button className="history-clone danger" title="删除" onClick={(e) => { e.stopPropagation(); if (confirm('删除这条脚本？')) deleteScript(s.id) }}>🗑</button>
                </div>
              ))}
              {filteredHistory.length === 0 && <div className="history-empty">没找到匹配的记录</div>}
            </div>
          </div>
        )}

        {/* 空状态 */}
        {history.length === 0 && !result && !rawText && !loading && (
          <div className="empty-state">
            <span className="emoji">✨</span>
            <h3>还没有生成过脚本</h3>
            <p>填写上方拍摄信息，或点下方按钮一键试用</p>
            <div className="empty-actions">
              <button className="generate-btn small" onClick={() => setShowTopicLibrary(true)}>💡 浏览选题库</button>
              <button className="generate-btn small ghost" onClick={loadExample}>📦 填入示例数据</button>
            </div>
          </div>
        )}
      </main>

      {/* API Key modal */}
      {showKeyInput && (
        <div className="modal-overlay" onClick={() => setShowKeyInput(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>🔑 设置 DeepSeek API Key</h3>
            <p>Key 仅存储在你本地浏览器。还没有 Key？去 <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noreferrer">platform.deepseek.com</a> 申请。</p>
            <input type="password" value={tempKey} onChange={e => setTempKey(e.target.value)} placeholder="sk-..." className="key-input" onKeyDown={e => e.key === 'Enter' && handleSaveKey()} autoFocus />
            {keyTestResult && <p className={keyTestResult.ok ? 'key-test-ok' : 'key-test-err'}>{keyTestResult.msg}</p>}
            <div className="modal-actions">
              <button onClick={() => setShowKeyInput(false)}>取消</button>
              <button onClick={handleTestKey} disabled={keyTesting}>{keyTesting ? '测试中…' : '🧪 测试'}</button>
              <button className="primary" onClick={handleSaveKey}>保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 选题库 */}
      {showTopicLibrary && (
        <div className="modal-overlay" onClick={() => setShowTopicLibrary(false)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <h3>💡 选题库 — {scene.label}</h3>
            <p>点选一个选题快速填入表单，再调整细节即可。</p>
            <div className="topic-grid">
              {scene.topicLibrary.map((t, i) => (
                <button key={i} className="topic-card" onClick={() => applyTopic(t.fill)}>
                  <span className="topic-emoji">{t.emoji}</span>
                  <span className="topic-title">{t.title}</span>
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowTopicLibrary(false)}>关闭</button>
            </div>
          </div>
        </div>
      )}

      {/* 设置 */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <h3>⚙️ 设置</h3>
            <div className="settings-section">
              <label>主题</label>
              <div className="chips">
                {(['dark', 'light', 'auto'] as const).map(t => (
                  <button key={t} className={`chip ${settings.theme === t ? 'active' : ''}`} onClick={() => { const s = { ...settings, theme: t }; setSettings(s); saveSettings(s) }}>{t === 'dark' ? '🌙 暗' : t === 'light' ? '☀️ 亮' : '🖥 跟随系统'}</button>
                ))}
              </div>
            </div>
            <div className="settings-section">
              <label>
                <input type="checkbox" checked={settings.showPublishKit} onChange={e => { const s = { ...settings, showPublishKit: e.target.checked }; setSettings(s); saveSettings(s) }} />
                &nbsp;生成脚本时同时生成发布物料（标题/文案/话题/封面）
              </label>
            </div>
            <div className="settings-section">
              <label>
                <input type="checkbox" checked={settings.incognito} onChange={e => { const s = { ...settings, incognito: e.target.checked }; setSettings(s); saveSettings(s) }} />
                &nbsp;🕶 无痕模式（不保存历史和草稿）
              </label>
            </div>
            <div className="settings-section">
              <label>自定义系统提示词（高级，覆盖默认人设）</label>
              <select
                className="form-select"
                value={''}
                onChange={() => { /* placeholder for per-mode editor below */ }}
              ><option>选择要编辑的模式</option></select>
              {SCENE_LIST.map(m => (
                <details key={m} className="prompt-editor">
                  <summary>{SCENES[m].emoji} {SCENES[m].label} {settings.customSystemPrompts[m] ? '（已自定义）' : ''}</summary>
                  <textarea
                    value={settings.customSystemPrompts[m] || ''}
                    placeholder={`留空则使用内置人设（约 ${SCENES[m].systemPrompt.length} 字）`}
                    rows={6}
                    onChange={e => {
                      const cps = { ...settings.customSystemPrompts }
                      if (e.target.value.trim()) cps[m] = e.target.value
                      else delete cps[m]
                      const s = { ...settings, customSystemPrompts: cps }
                      setSettings(s); saveSettings(s)
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="op-btn" onClick={() => {
                      const cps = { ...settings.customSystemPrompts }
                      cps[m] = SCENES[m].systemPrompt
                      const s = { ...settings, customSystemPrompts: cps }
                      setSettings(s); saveSettings(s)
                    }}>📥 载入默认再编辑</button>
                    <button className="op-btn" onClick={() => {
                      const cps = { ...settings.customSystemPrompts }
                      delete cps[m]
                      const s = { ...settings, customSystemPrompts: cps }
                      setSettings(s); saveSettings(s)
                    }}>🔄 重置为默认</button>
                  </div>
                </details>
              ))}
            </div>
            <div className="settings-section">
              <label>数据</label>
              <div className="settings-actions">
                <button onClick={handleExportBackup}>💾 导出完整备份</button>
                <button onClick={handleImportBackup}>📥 导入备份</button>
                <button className="danger" onClick={() => { if (confirm('清空所有历史？不可恢复。')) { setHistory([]); saveHistory([], settings.incognito) } }}>🗑 清空历史</button>
              </div>
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowSettings(false)}>关闭</button>
            </div>
          </div>
        </div>
      )}

      {/* 图片预览 */}
      {imgPreview && (
        <div className="modal-overlay img-preview-overlay" onClick={() => setImgPreview('')}>
          <div className="img-preview-box" onClick={e => e.stopPropagation()}>
            <div className="img-preview-tip">{isWechat ? '👇 长按图片保存到相册' : '右键图片 → 另存为'}</div>
            <img src={imgPreview} alt="分镜长图" className="img-preview-img" />
            <button className="img-preview-close" onClick={() => setImgPreview('')}>关闭</button>
          </div>
        </div>
      )}

      {/* 分享 modal */}
      {showShareModal && (
        <div className="modal-overlay" onClick={() => setShowShareModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>🔗 分享链接</h3>
            <p>链接已复制到剪贴板。对方打开链接即可查看本脚本（不走服务器）。</p>
            <textarea className="share-textarea" value={shareUrl} readOnly rows={4} />
            <p className="share-hint">链接长度：{shareUrl.length} 字符。{shareUrl.length > 2000 ? '⚠️ 链接过长，部分短信/微信可能被截断，推荐用 MD 文件分享。' : ''}</p>
            <div className="modal-actions">
              <button onClick={() => setShowShareModal(false)}>关闭</button>
              <button className="primary" onClick={() => { navigator.clipboard.writeText(shareUrl); flashCopied('share-again') }}>{copied === 'share-again' ? '✓ 已复制' : '再次复制'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 命令面板 */}
      <CommandPalette open={showPalette} onClose={() => setShowPalette(false)} commands={commands} />

      {/* 提词器 */}
      {showTeleprompter && result && (
        <Teleprompter script={result} onClose={() => setShowTeleprompter(false)} />
      )}

      {/* SW 更新 */}
      <UpdatePrompt onReload={() => window.location.reload()} />

      <footer className="footer">
        <p>昕昕分镜脚本生成器 · 数据仅存储在你的浏览器，不上传任何服务器 {settings.incognito && <span className="incognito-flag">🕶 无痕中</span>}</p>
        <div className="footer-links">
          <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noreferrer">获取 API Key</a>
          <a href="https://github.com/MXD706/xinjie-script-generator" target="_blank" rel="noreferrer">GitHub</a>
          <span>⌘K 打开命令面板</span>
        </div>
      </footer>
    </div>
  )
}

// ============== 辅助：渲染表单字段 ==============
function renderFormFields(
  scene: ReturnType<typeof getScene>,
  formData: Record<string, string>,
  updateField: (k: string, v: string) => void,
) {
  // 按 group 分组
  const groups = new Map<string, typeof scene.fields>()
  for (const f of scene.fields) {
    if (!groups.has(f.group)) groups.set(f.group, [])
    groups.get(f.group)!.push(f)
  }
  return Array.from(groups.entries()).map(([group, fields]) => (
    <div key={group} className="form-section">
      <div className="form-section-title">
        <span className="icon">📍</span>{group}
      </div>
      <div className="form-row">
        {fields.map(f => {
          const val = formData[f.key] || ''
          if (f.type === 'select' && f.options) {
            return (
              <div key={f.key} className={`form-field ${f.required ? 'required' : ''}`}>
                <label>{f.required && <span className="req-star">*</span>}{f.label}</label>
                <select className="form-select" value={val} onChange={e => updateField(f.key, e.target.value)}>
                  {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            )
          }
          if (f.type === 'textarea') {
            return (
              <div key={f.key} className={`form-field full ${f.required ? 'required' : ''}`}>
                <label>{f.required && <span className="req-star">*</span>}{f.label}</label>
                <textarea value={val} onChange={e => updateField(f.key, e.target.value)} placeholder={f.placeholder} maxLength={f.maxLength} rows={3} />
              </div>
            )
          }
          return (
            <div key={f.key} className={`form-field ${f.required ? 'required' : ''}`}>
              <label>{f.required && <span className="req-star">*</span>}{f.label}</label>
              <input type="text" value={val} onChange={e => updateField(f.key, e.target.value)} placeholder={f.placeholder} maxLength={f.maxLength} />
            </div>
          )
        })}
      </div>
    </div>
  ))
}

// ============== 辅助：调整时长 prompt 里用到的简化 md ==============
function toMarkdownForPrompt(shots: Shot[]): string {
  return shots.map((s, i) => `${i + 1}. ${s.duration} ${s.visual.slice(0, 20)} | 口播：${s.voiceover}`).join('\n')
}
