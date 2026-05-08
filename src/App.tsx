import { useState, useCallback, useRef } from 'react'
import './App.css'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'

const DEEPSEEK_KEY_STORAGE = 'xinjie_deepseek_key'
const HISTORY_STORAGE = 'xinjie_script_history'

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
  // Form inputs
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
  // Output
  totalDuration: string
  bgm: string
  shootLocation: string
  shots: Shot[]
  directorNotes: string
  createdAt: string
}

type EditMode = {
  type: 'meta' | 'shot'
  index?: number
  field?: string
}

function getStoredKey(): string {
  return localStorage.getItem(DEEPSEEK_KEY_STORAGE) || ''
}
function saveKey(key: string) {
  localStorage.setItem(DEEPSEEK_KEY_STORAGE, key)
}
function getHistory(): Script[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_STORAGE) || '[]') } catch { return [] }
}
function saveHistory(scripts: Script[]) {
  localStorage.setItem(HISTORY_STORAGE, JSON.stringify(scripts.slice(0, 20)))
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
`

export default function App() {
  const [key, setKey] = useState(getStoredKey)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Script | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [history, setHistory] = useState<Script[]>(getHistory)
  const [showKeyInput, setShowKeyInput] = useState(false)
  const [tempKey, setTempKey] = useState(getStoredKey())
  const [editMode, setEditMode] = useState<EditMode | null>(null)
  const [editValue, setEditValue] = useState('')
  const [rawText, setRawText] = useState('')
  const [formOpen, setFormOpen] = useState(true)
  const [pdfLoading, setPdfLoading] = useState(false)
  const resultRef = useRef<HTMLDivElement>(null)

  // Form state
  const [destination, setDestination] = useState('')
  const [purpose, setPurpose] = useState('')
  const [departure, setDeparture] = useState('')
  const [transport, setTransport] = useState('')
  const [transportDuration, setTransportDuration] = useState('')
  const [shootTime, setShootTime] = useState('')
  const [weather, setWeather] = useState('')
  const [arriveShoot, setArriveShoot] = useState('')
  const [hotelName, setHotelName] = useState('')
  const [howToHotel, setHowToHotel] = useState('')
  const [hotelShoot, setHotelShoot] = useState('')
  const [companions, setCompanions] = useState('')
  const [equipment, setEquipment] = useState('')
  const [keyMessage, setKeyMessage] = useState('')
  const [requiredShots, setRequiredShots] = useState('')
  const [extraNotes, setExtraNotes] = useState('')

  const handleSaveKey = () => { saveKey(tempKey); setKey(tempKey); setShowKeyInput(false) }

  const parseShots = (text: string): Shot[] => {
    const shots: Shot[] = []
    for (const line of text.split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('总时长') || t.startsWith('| 时长')) continue
      if (t.startsWith('导演') || t.startsWith('注意')) break
      if (!t.startsWith('|')) continue
      const cells = t.split('|').map(c => c.trim()).filter(Boolean)
      if (cells.length >= 6) shots.push({ duration: cells[0], timeRange: cells[1], visual: cells[2], voiceover: cells[3], subtitle: cells[4], directorNote: cells[5] })
    }
    return shots
  }

  const parseMeta = (text: string) => {
    const total = text.match(/总时长[：:]\s*(\d+)\s*秒/)
    const bgm = text.match(/背景音乐[：:]\s*([^|]+)/)
    const loc = text.match(/拍摄地点[：:]\s*([^|]+)/)
    return {
      totalDuration: total ? total[1] + ' 秒' : '30 秒',
      bgm: bgm ? bgm[1].trim() : '全程轻快旅行风纯音乐',
      shootLocation: loc ? loc[1].trim() : destination
    }
  }

  const parseDirectorNotes = (text: string) => {
    const lines = text.split('\n')
    const notes: string[] = []
    let capture = false
    for (const line of lines) {
      if (line.includes('导演注意事项') || line.includes('摄影师注意事项')) { capture = true; continue }
      if (capture && line.trim().startsWith('|')) continue
      if (capture && line.trim() && !line.trim().startsWith('-') && !line.match(/^\d/)) {
        if (notes.length > 0 || line.trim()) notes.push(line.trim())
      }
    }
    return notes.join('\n')
  }

  const generateScript = useCallback(async () => {
    if (!key) { setShowKeyInput(true); return }
    if (!destination.trim()) { setError('请填写目的地'); return }
    if (!purpose.trim()) { setError('请填写去干什么'); return }

    setLoading(true)
    setError('')
    setResult(null)
    setRawText('')

    const userPrompt = `帮我写一条关于「${destination}」的抖音视频分镜脚本。

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
- 必须要有的镜头：${requiredShots || '无特别要求'}
- 额外补充：${extraNotes || '无'}

严格按照上述信息来写，不要自己瞎编乱造。`

    try {
      const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userPrompt }],
          max_tokens: 1500, temperature: 0.8
        })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error?.message || `API错误 ${res.status}`)
      }
      const data = await res.json()
      const text = data.choices?.[0]?.message?.content || ''
      if (!text.includes('|')) throw new Error('生成格式不对，请重试')

      setRawText(text)
      const meta = parseMeta(text)
      const shots = parseShots(text)
      if (shots.length === 0) throw new Error('未能解析出镜头，请重试')

      const script: Script = {
        id: Date.now(), destination: destination.trim(), purpose: purpose.trim(), departure: departure.trim(),
        transport: transport.trim(), transportDuration: transportDuration.trim(), shootTime: shootTime.trim(),
        weather: weather.trim(), arriveShoot: arriveShoot.trim(), hotelName: hotelName.trim(),
        howToHotel: howToHotel.trim(), hotelShoot: hotelShoot.trim(), companions: companions.trim(),
        equipment: equipment.trim(), keyMessage: keyMessage.trim(), requiredShots: requiredShots.trim(),
        extraNotes: extraNotes.trim(), ...meta, shots, directorNotes: parseDirectorNotes(text),
        createdAt: new Date().toLocaleString('zh-CN')
      }
      setResult(script)
      const newHistory = [script, ...history.filter(s => s.destination !== script.destination)].slice(0, 20)
      setHistory(newHistory)
      saveHistory(newHistory)
    } catch (err: any) {
      setError(err.message || '生成失败')
    } finally {
      setLoading(false)
    }
  }, [key, destination, purpose, departure, transport, transportDuration, shootTime, weather, arriveShoot, hotelName, howToHotel, hotelShoot, companions, equipment, keyMessage, requiredShots, extraNotes, history])

  const updateShot = (i: number, field: keyof Shot, val: string) => {
    if (!result) return
    const updated = { ...result, shots: result.shots.map((s, j) => j === i ? { ...s, [field]: val } : s) }
    setResult(updated)
    const newHistory = history.map(s => s.id === updated.id ? updated : s)
    saveHistory(newHistory)
    setHistory(newHistory)
  }

  const updateMeta = (field: string, val: string) => {
    if (!result) return
    const updated = { ...result, [field]: val }
    setResult(updated)
    const newHistory = history.map(s => s.id === updated.id ? updated : s)
    saveHistory(newHistory)
    setHistory(newHistory)
  }

  const downloadPDF = async () => {
    if (!result || !result.shots?.length) return
    setPdfLoading(true)

    try {
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      let yPos = 15

      // 标题
      doc.setFontSize(16)
      doc.setTextColor(30, 30, 30)
      doc.text(`${result.destination} — ${result.purpose}`, pageWidth / 2, yPos, { align: 'center' })
      yPos += 12

      // 信息摘要
      doc.setFontSize(10)
      doc.setTextColor(80, 80, 80)
      const infoItems = [result.destination, result.purpose, result.hotelName, result.shootTime].filter(Boolean)
      doc.text(infoItems.join(' | '), pageWidth / 2, yPos, { align: 'center' })
      yPos += 10

      // 元信息
      doc.setFontSize(11)
      doc.setTextColor(60, 60, 60)
      doc.text(`总时长: ${result.totalDuration}  |  背景音乐: ${result.bgm}  |  拍摄地点: ${result.shootLocation}`, 14, yPos)
      yPos += 12

      // 分隔线
      doc.setDrawColor(200, 200, 200)
      doc.line(14, yPos, pageWidth - 14, yPos)
      yPos += 8

      // 表格数据
      const tableData = result.shots.map((shot, i) => [
        String(i + 1),
        shot.duration,
        shot.timeRange,
        shot.visual,
        shot.voiceover,
        shot.subtitle,
        shot.directorNote
      ])

      // @ts-ignore - autotable types
      doc.autoTable({
        startY: yPos,
        head: [['#', '时长', '时间段', '画面内容', '口播台词', '字幕', '摄影师指令']],
        body: tableData,
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [240, 240, 240], textColor: [30, 30, 30], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 15 },
          2: { cellWidth: 20 },
          3: { cellWidth: 35 },
          4: { cellWidth: 35 },
          5: { cellWidth: 20 },
          6: { cellWidth: 35 }
        },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        margin: { left: 14, right: 14 }
      })

      // 导演注意事项
      const finalY = (doc as any).lastAutoTable.finalY + 10
      if (result.directorNotes) {
        doc.setFontSize(12)
        doc.setTextColor(30, 30, 30)
        doc.text('导演注意事项', 14, finalY)
        doc.setFontSize(10)
        doc.setTextColor(60, 60, 60)
        const noteLines = doc.splitTextToSize(result.directorNotes, pageWidth - 28)
        doc.text(noteLines, 14, finalY + 6)
      }

      // 使用data URL方式确保手机下载
      const pdfDataUrl = doc.output('dataurlstring')
      const link = document.createElement('a')
      link.href = pdfDataUrl
      link.download = `昕昕分镜_${result.destination}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error('PDF生成失败:', err)
    } finally {
      setPdfLoading(false)
    }
  }

  const copyAll = () => {
    if (!result) return
    let text = `总时长：${result.totalDuration} | 背景音乐：${result.bgm} | 拍摄地点：${result.shootLocation}\n\n`
    text += '| 时长 | 时间段 | 画面内容 | 口播台词（同步播报） | 字幕贴纸 | 摄影师跟拍指令 |\n'
    text += '|------|--------|----------|---------------------|----------|---------------|\n'
    for (const shot of result.shots) text += `| ${shot.duration} | ${shot.timeRange} | ${shot.visual} | ${shot.voiceover} | ${shot.subtitle} | ${shot.directorNote} |\n`
    if (result.directorNotes) text += `\n导演注意事项：\n${result.directorNotes}`
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  const isMetaEditing = (f: string) => editMode?.type === 'meta' && editMode?.field === f
  const isShotEditing = (i: number, f: string) => editMode?.type === 'shot' && editMode?.index === i && editMode?.field === f

  const startMetaEdit = (f: string) => { if (!result) return; setEditMode({ type: 'meta', field: f }); setEditValue((result as any)[f]) }
  const startShotEdit = (i: number, f: keyof Shot) => { if (!result) return; setEditMode({ type: 'shot', index: i, field: f }); setEditValue(result.shots[i][f]) }
  const saveEdit = () => {
    if (!editMode) return
    if (editMode.type === 'meta') updateMeta(editMode.field!, editValue)
    else if (editMode.type === 'shot' && editMode.index !== undefined) updateShot(editMode.index, editMode.field as keyof Shot, editValue)
    setEditMode(null)
    setEditValue('')
  }

  return (
    <div className="container">
      <header className="header">
        <h1>🎬 昕昕分镜脚本器</h1>
        <p className="subtitle">填写真实拍摄信息 → 生成准确分镜脚本</p>
        {!key && <button className="key-btn" onClick={() => setShowKeyInput(true)}>🔑 设置API Key</button>}
        {key && <button className="key-btn small" onClick={() => setShowKeyInput(true)}>更换Key</button>}
      </header>

      {showKeyInput && (
        <div className="modal-overlay" onClick={() => setShowKeyInput(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>设置 DeepSeek API Key</h3>
            <p>Key仅存储在本地浏览器，不会上传</p>
            <input type="password" value={tempKey} onChange={e => setTempKey(e.target.value)} placeholder="sk-..." className="key-input"
              onKeyDown={e => e.key === 'Enter' && handleSaveKey()} />
            <div className="modal-actions">
              <button onClick={() => setShowKeyInput(false)}>取消</button>
              <button className="primary" onClick={handleSaveKey}>保存</button>
            </div>
          </div>
        </div>
      )}

      <main className="main">
        {/* Form */}
        <div className="form-card">
          <div className="form-toggle" onClick={() => setFormOpen(!formOpen)}>
            <h2>📋 拍摄信息 <span className="form-hint">填得越细生成越准</span></h2>
            <span className="toggle-icon">{formOpen ? '▲ 收起' : '▼ 展开'}</span>
          </div>

          {formOpen && (
            <div className="form-body">
              {/* Row 1: Destination + Purpose */}
              <div className="form-row">
                <div className="form-field required">
                  <label>目的地</label>
                  <input type="text" value={destination} onChange={e => setDestination(e.target.value)} placeholder="比如：西班牙巴塞罗那" />
                </div>
                <div className="form-field required">
                  <label>去干什么</label>
                  <input type="text" value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="比如：看小米汽车展厅" />
                </div>
              </div>

              {/* Row 2: Departure + Transport */}
              <div className="form-row">
                <div className="form-field">
                  <label>出发地</label>
                  <input type="text" value={departure} onChange={e => setDeparture(e.target.value)} placeholder="比如：台湾家里 / 深圳" />
                </div>
                <div className="form-field">
                  <label>交通方式</label>
                  <input type="text" value={transport} onChange={e => setTransport(e.target.value)} placeholder="比如：台湾出发飞马德里再火车" />
                </div>
              </div>

              {/* Row 3: Transport Duration + Shoot Time */}
              <div className="form-row">
                <div className="form-field">
                  <label>交通时长</label>
                  <input type="text" value={transportDuration} onChange={e => setTransportDuration(e.target.value)} placeholder="比如：飞13小时 + 转机3小时" />
                </div>
                <div className="form-field">
                  <label>拍摄时间</label>
                  <select value={shootTime} onChange={e => setShootTime(e.target.value)} className="form-select">
                    <option value="">选择时段</option>
                    <option value="清晨/上午">清晨/上午</option>
                    <option value="中午/下午">中午/下午</option>
                    <option value="傍晚/黄金时段">傍晚/黄金时段</option>
                    <option value="晚上">晚上</option>
                    <option value="全天">全天</option>
                  </select>
                </div>
              </div>

              {/* Row 4: Weather + Companions */}
              <div className="form-row">
                <div className="form-field">
                  <label>天气</label>
                  <select value={weather} onChange={e => setWeather(e.target.value)} className="form-select">
                    <option value="">选择天气</option>
                    <option value="晴天">晴天</option>
                    <option value="阴天">阴天</option>
                    <option value="雨天">雨天</option>
                    <option value="雪天">雪天</option>
                  </select>
                </div>
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
              </div>

              {/* Row 5: Equipment + Key Message */}
              <div className="form-row">
                <div className="form-field">
                  <label>拍摄设备</label>
                  <select value={equipment} onChange={e => setEquipment(e.target.value)} className="form-select">
                    <option value="">选择设备</option>
                    <option value="手机">手机</option>
                    <option value="相机">相机</option>
                    <option value="手机+稳定器">手机+稳定器</option>
                    <option value="相机+摄影师">相机+摄影师</option>
                    <option value="有航拍">有航拍</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>视频重点</label>
                  <select value={keyMessage} onChange={e => setKeyMessage(e.target.value)} className="form-select">
                    <option value="">选择重点</option>
                    <option value="惊喜发现">惊喜发现</option>
                    <option value="被震撼的感受">被震撼的感受</option>
                    <option value="冲动决定">冲动决定</option>
                    <option value="两岸差异观察">两岸差异观察</option>
                    <option value="真实体验分享">真实体验分享</option>
                    <option value="情感走心">情感走心</option>
                  </select>
                </div>
              </div>

              {/* Row 6: Arrive Shoot */}
              <div className="form-row">
                <div className="form-field full">
                  <label>到了之后怎么拍</label>
                  <input type="text" value={arriveShoot} onChange={e => setArriveShoot(e.target.value)} placeholder="比如：在展厅外拍外观，进店拍内饰细节" />
                </div>
              </div>

              {/* Row 7: Hotel + How to Hotel */}
              <div className="form-row">
                <div className="form-field">
                  <label>住哪个酒店</label>
                  <input type="text" value={hotelName} onChange={e => setHotelName(e.target.value)} placeholder="比如：巴塞罗那W酒店" />
                </div>
                <div className="form-field">
                  <label>怎么去酒店</label>
                  <input type="text" value={howToHotel} onChange={e => setHowToHotel(e.target.value)} placeholder="比如：打车去，路上拍街景" />
                </div>
              </div>

              {/* Row 8: Hotel Shoot */}
              <div className="form-row">
                <div className="form-field full">
                  <label>酒店拍什么</label>
                  <input type="text" value={hotelShoot} onChange={e => setHotelShoot(e.target.value)} placeholder="比如：拍房间窗外海景，大堂环境，酒店早餐" />
                </div>
              </div>

              {/* Row 9: Required Shots */}
              <div className="form-row">
                <div className="form-field full">
                  <label>必须有镜头</label>
                  <input type="text" value={requiredShots} onChange={e => setRequiredShots(e.target.value)} placeholder="比如：一定要有展厅外观，酒店夜景，车内方向盘视角" />
                </div>
              </div>

              {/* Row 10: Extra Notes */}
              <div className="form-row">
                <div className="form-field full">
                  <label>额外补充</label>
                  <textarea value={extraNotes} onChange={e => setExtraNotes(e.target.value)} placeholder="还有什么特别想拍的、要注意的、或想表达的内容？"
                    rows={2} />
                </div>
              </div>

              <div className="form-footer">
                {error && <p className="error">{error}</p>}
                {!key && !showKeyInput && <p className="hint">👉 先设置API Key再生成</p>}
                <button className={`generate-btn ${loading ? 'loading' : ''}`} onClick={generateScript} disabled={loading}>
                  {loading ? <><span className="spinner"></span>生成中...</> : '🎬 生成分镜'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Result */}
        {result && (
          <div className="result-card" ref={resultRef}>
            <div className="result-header">
              <div className="result-header-left">
                <button className="back-btn" onClick={() => { setResult(null); setRawText('') }}>← 返回</button>
                <h2>✨ {result.destination} — {result.purpose}</h2>
              </div>
              <div className="result-actions">
                <button className="copy-btn" onClick={copyAll}>{copied ? '✅ 已复制' : '📋 复制全部'}</button>
                <button className="pdf-btn" onClick={downloadPDF} disabled={pdfLoading}>{pdfLoading ? '⏳ 生成中...' : '📄 下载PDF'}</button>
                <button className="delete-btn" onClick={() => {
                  const newHistory = history.filter(s => s.id !== result.id)
                  setHistory(newHistory); saveHistory(newHistory); setResult(null); setRawText('')
                }}>🗑️ 删除</button>
              </div>
            </div>

            <div className="info-summary">
              <span>📍 {result.destination}</span>
              <span>🎯 {result.purpose}</span>
              {result.hotelName && <span>🏨 {result.hotelName}</span>}
              {result.shootTime && <span>⏰ {result.shootTime}</span>}
            </div>

            <div className="meta-row">
              <div className="meta-item" onClick={() => !editMode && startMetaEdit('totalDuration')}>
                <span className="meta-label">总时长</span>
                {isMetaEditing('totalDuration') ? (
                  <input className="meta-input" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEdit()} onBlur={saveEdit} autoFocus />
                ) : (<span className="meta-value">{result.totalDuration}</span>)}
              </div>
              <div className="meta-item" onClick={() => !editMode && startMetaEdit('bgm')}>
                <span className="meta-label">背景音乐</span>
                {isMetaEditing('bgm') ? (
                  <input className="meta-input" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEdit()} onBlur={saveEdit} autoFocus />
                ) : (<span className="meta-value">{result.bgm}</span>)}
              </div>
              <div className="meta-item" onClick={() => !editMode && startMetaEdit('shootLocation')}>
                <span className="meta-label">拍摄地点</span>
                {isMetaEditing('shootLocation') ? (
                  <input className="meta-input" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEdit()} onBlur={saveEdit} autoFocus />
                ) : (<span className="meta-value">{result.shootLocation}</span>)}
              </div>
            </div>

            <div className="shots-table">
              <div className="table-header">
                <span>时长</span><span>时间段</span><span>画面内容</span><span>口播台词</span><span>字幕</span><span>摄影师指令</span>
              </div>
              {result.shots.map((shot, i) => (
                <div key={i} className="table-row">
                  <div className="cell cell-sm" onClick={() => !editMode && startShotEdit(i, 'duration')}>
                    {isShotEditing(i, 'duration') ? (
                      <textarea className="cell-input" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.ctrlKey ? saveEdit() : null)} onBlur={saveEdit} rows={2} autoFocus />
                    ) : (<span className="cell-text editable">{shot.duration}</span>)}
                  </div>
                  <div className="cell cell-sm" onClick={() => !editMode && startShotEdit(i, 'timeRange')}>
                    {isShotEditing(i, 'timeRange') ? (
                      <textarea className="cell-input" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.ctrlKey ? saveEdit() : null)} onBlur={saveEdit} rows={2} autoFocus />
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
                      <textarea className="cell-input" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.ctrlKey ? saveEdit() : null)} onBlur={saveEdit} rows={2} autoFocus />
                    ) : (<span className="cell-text editable">{shot.subtitle}</span>)}
                  </div>
                  <div className="cell" onClick={() => !editMode && startShotEdit(i, 'directorNote')}>
                    {isShotEditing(i, 'directorNote') ? (
                      <textarea className="cell-input" value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} rows={3} autoFocus />
                    ) : (<span className="cell-text editable">{shot.directorNote}</span>)}
                  </div>
                </div>
              ))}
            </div>

            {result.directorNotes && (
              <div className="director-section">
                <h3>📋 导演注意事项</h3>
                <pre className="director-text">{result.directorNotes}</pre>
              </div>
            )}

            <p className="edit-hint">💡 点击任意格子直接修改</p>
          </div>
        )}

        {rawText && !result && (
          <div className="raw-text-card">
            <h3>原始输出（解析失败）</h3>
            <pre className="raw-text">{rawText}</pre>
            <p className="error">{error || '格式解析失败，请重试'}</p>
          </div>
        )}

        {history.length > 0 && !result && (
          <div className="history-section">
            <h3>📜 历史记录</h3>
            <div className="history-list">
              {history.map(script => (
                <div key={script.id} className="history-item" onClick={() => { setResult(script); setRawText('') }}>
                  <span className="history-dest">{script.destination} — {script.purpose}</span>
                  <span className="history-date">{script.createdAt}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
