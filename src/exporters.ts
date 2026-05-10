// 导出器：PDF、长图、Markdown、SRT、合并口播、拍摄清单
import type { Script, Shot } from './types'

// Markdown 导出
export function toMarkdown(s: Script): string {
  const lines: string[] = []
  lines.push(`# ${s.title || '分镜脚本'}${s.subtitle ? ` — ${s.subtitle}` : ''}`)
  lines.push('')
  lines.push(`> 总时长：${s.totalDuration} · 背景音乐：${s.bgm} · 拍摄地点：${s.shootLocation}`)
  lines.push('')
  lines.push('## 分镜表')
  lines.push('')
  lines.push('| # | 时长 | 时间段 | 画面内容 | 口播台词 | 字幕 | 摄影师指令 |')
  lines.push('|---|------|--------|----------|----------|------|------------|')
  s.shots.forEach((sh, i) => {
    const cell = (v: string) => v.replace(/\|/g, '\\|').replace(/\n/g, '<br>')
    lines.push(`| ${i + 1} | ${cell(sh.duration)} | ${cell(sh.timeRange)} | ${cell(sh.visual)} | ${cell(sh.voiceover)} | ${cell(sh.subtitle)} | ${cell(sh.directorNote)} |`)
  })
  lines.push('')

  if (s.directorNotes) {
    lines.push('## 导演注意事项')
    lines.push('')
    s.directorNotes.split('\n').forEach(l => {
      if (l.trim()) lines.push(`- ${l.trim()}`)
    })
    lines.push('')
  }

  if (s.publish) {
    lines.push('## 发布物料')
    lines.push('')
    if (s.publish.titles.length) {
      lines.push('### 备选标题')
      s.publish.titles.forEach((t, i) => lines.push(`${i + 1}. ${t}`))
      lines.push('')
    }
    if (s.publish.caption) {
      lines.push('### 文案')
      lines.push(s.publish.caption)
      lines.push('')
    }
    if (s.publish.hashtags.length) {
      lines.push('### 话题')
      lines.push(s.publish.hashtags.join(' '))
      lines.push('')
    }
    if (s.publish.coverText) {
      lines.push('### 封面')
      lines.push(`- 大字：${s.publish.coverText}`)
      if (s.publish.coverShotIndex >= 0) lines.push(`- 建议用第 ${s.publish.coverShotIndex + 1} 个镜头截图`)
      else if (s.publish.coverShotIndex === -1) lines.push('- 另行拍摄封面')
      lines.push('')
    }
  }

  return lines.join('\n')
}

// SRT 字幕导出（基于 timeRange 解析）
export function toSRT(s: Script): string {
  const lines: string[] = []
  let start = 0
  s.shots.forEach((sh, i) => {
    const { startSec, endSec } = parseTimeRange(sh.timeRange, start, sh.duration)
    lines.push(String(i + 1))
    lines.push(`${secToSRT(startSec)} --> ${secToSRT(endSec)}`)
    // 字幕优先用 subtitle 字段（短关键词），没有的话用 voiceover
    const text = (sh.subtitle || sh.voiceover || '').trim() || `镜头 ${i + 1}`
    lines.push(text)
    lines.push('')
    start = endSec
  })
  return lines.join('\n')
}

function parseTimeRange(range: string, prevEnd: number, duration: string): { startSec: number; endSec: number } {
  // 格式如 "0-3秒" / "3-7秒" / "3秒"
  const m = range.match(/(\d+)\s*[-~至]\s*(\d+)/)
  if (m) return { startSec: parseInt(m[1], 10), endSec: parseInt(m[2], 10) }
  // 退化：用 prevEnd + duration
  const dm = duration.match(/(\d+)/)
  const d = dm ? parseInt(dm[1], 10) : 3
  return { startSec: prevEnd, endSec: prevEnd + d }
}

function secToSRT(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  const ms = Math.round((sec - Math.floor(sec)) * 1000)
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`
}

// 合并口播为一段
export function mergeVoiceover(shots: Shot[]): string {
  return shots.map(s => s.voiceover.trim()).filter(Boolean).join('\n')
}

// 拍摄清单（纯摄影师视角）
export function toShootingList(s: Script): string {
  const lines: string[] = []
  lines.push(`📹 拍摄清单 — ${s.title}`)
  lines.push(`地点：${s.shootLocation}`)
  lines.push('─────────')
  s.shots.forEach((sh, i) => {
    lines.push(`[${i + 1}] ${sh.duration} ${sh.timeRange}`)
    lines.push(`  画面：${sh.visual}`)
    lines.push(`  指令：${sh.directorNote}`)
    lines.push('')
  })
  return lines.join('\n')
}

// 触发下载
export function downloadText(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// —— PDF / 图片导出（动态加载 html2canvas + jspdf） ——
// 首屏不加载这两个大库（~400kB），点导出时再动态 import
export async function renderToCanvas(node: HTMLElement, isMobile: boolean): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import('html2canvas')
  node.classList.add('pdf-export')
  await new Promise(r => setTimeout(r, 60))
  try {
    return await html2canvas(node, {
      scale: isMobile ? 1.5 : 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      windowWidth: Math.max(node.scrollWidth, 1000),
    })
  } finally {
    node.classList.remove('pdf-export')
  }
}

export async function exportPDF(canvas: HTMLCanvasElement, filename: string, isMobile: boolean): Promise<{ mode: 'download' | 'newwindow' | 'imgpreview'; url?: string }> {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 8
  const imgWidth = pageWidth - margin * 2
  const imgHeight = (canvas.height * imgWidth) / canvas.width

  const imgData = canvas.toDataURL('image/jpeg', 0.92)

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
      w.document.write(`<title>${filename}</title><iframe src="${dataUrl}" frameborder="0" style="border:0;width:100%;height:100vh" allowfullscreen></iframe>`)
      return { mode: 'newwindow' }
    }
    return { mode: 'imgpreview', url: canvas.toDataURL('image/jpeg', 0.92) }
  }

  const blob = pdf.output('blob')
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return { mode: 'download' }
}
