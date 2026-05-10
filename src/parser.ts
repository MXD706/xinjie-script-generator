// 输出文本解析器：shots / meta / 导演备注 / 发布物料
import type { Shot, PublishKit } from './types'

export function parseShots(text: string): Shot[] {
  const shots: Shot[] = []
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('总时长') || /^\|\s*时长/.test(t)) continue
    if (t.startsWith('导演') || t.startsWith('发布物料') || t.startsWith('注意') || t.startsWith('摄影师注意')) break
    if (!t.startsWith('|')) continue
    if (/^\|[\s\-|:]+\|$/.test(t)) continue  // 分隔行
    const cells = t.split('|').map(c => c.trim()).slice(1, -1)
    if (cells.length === 0) continue
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

export function parseMeta(text: string, fallbackLocation: string) {
  const total = text.match(/总时长[：:]\s*(\d+)\s*秒/)
  const bgm = text.match(/背景音乐[：:]\s*([^|\n]+)/)
  const loc = text.match(/拍摄地点[：:]\s*([^|\n]+)/)
  return {
    totalDuration: total ? total[1] + ' 秒' : '30 秒',
    bgm: bgm ? bgm[1].trim() : '轻快纯音乐',
    shootLocation: loc ? loc[1].trim() : fallbackLocation,
  }
}

export function parseDirectorNotes(text: string): string {
  const lines = text.split('\n')
  const notes: string[] = []
  let capture = false
  for (const line of lines) {
    const t = line.trim()
    if (t.includes('导演注意事项') || t.includes('摄影师注意事项')) { capture = true; continue }
    if (!capture) continue
    if (t.startsWith('发布物料')) break
    if (t.startsWith('|')) continue
    if (!t) continue
    notes.push(t.replace(/^[-*·]\s*/, ''))
  }
  return notes.join('\n')
}

export function parsePublishKit(text: string): PublishKit | undefined {
  // 找到"发布物料"后的内容
  const idx = text.search(/发布物料[：:]/)
  if (idx < 0) return undefined
  const segment = text.slice(idx)

  // 提取标题（1. 2. 3.）
  const titles: string[] = []
  const titlesMatch = segment.match(/标题[^:：]*[：:][\s\S]*?(?=(?:文案|话题|封面))/i)
  if (titlesMatch) {
    const block = titlesMatch[0]
    const lines = block.split('\n').map(l => l.trim())
    for (const l of lines) {
      const m = l.match(/^\s*\d+[.、)]\s*(.+)$/) || l.match(/^\s*[-*·]\s*(.+)$/)
      if (m) {
        const title = m[1].replace(/^[""]|[""]$/g, '').trim()
        if (title && title.length <= 50) titles.push(title)
      }
    }
  }

  // 提取文案
  let caption = ''
  const capMatch = segment.match(/文案[^:：]*[：:]([\s\S]*?)(?=(?:话题|标签|封面))/i)
  if (capMatch) {
    caption = capMatch[1].trim().split('\n').map(l => l.replace(/^[-*·]\s*/, '').trim()).filter(Boolean).join(' ')
  }

  // 提取话题
  const hashtags: string[] = []
  const tagMatch = segment.match(/(?:话题|标签)[^:：]*[：:]([\s\S]*?)(?=封面|$)/i)
  if (tagMatch) {
    const tagLine = tagMatch[1].replace(/\n/g, ' ')
    const matches = tagLine.match(/#[^\s#]+/g)
    if (matches) hashtags.push(...matches)
  }

  // 封面大字
  let coverText = ''
  const coverMatch = segment.match(/封面大字[^:：]*[：:]([^\n]+)/)
  if (coverMatch) {
    coverText = coverMatch[1].replace(/^[-*·]\s*/, '').replace(/^[""]|[""]$/g, '').trim()
  }

  // 封面镜头
  let coverShotIndex = -1
  const shotIdxMatch = segment.match(/封面镜头[^:：]*[：:][^\n]*?第\s*(\d+)\s*[个条]?镜头/)
  if (shotIdxMatch) {
    coverShotIndex = parseInt(shotIdxMatch[1], 10) - 1
  }

  if (titles.length === 0 && !caption && hashtags.length === 0) return undefined

  return { titles, caption, hashtags, coverText, coverShotIndex }
}

// 工具：口播字数/时长校验
export function voiceoverWarning(shot: Shot): string {
  const durMatch = shot.duration.match(/(\d+(?:\.\d+)?)/)
  if (!durMatch) return ''
  const seconds = parseFloat(durMatch[1])
  if (!seconds) return ''
  const chars = (shot.voiceover || '').replace(/[\s\p{P}]/gu, '').length
  if (chars === 0) return ''
  const ratio = chars / seconds
  if (ratio > 5) return `口播偏长（${chars} 字 / ${seconds}秒 ≈ ${ratio.toFixed(1)}字/秒，建议 ≤ 4）`
  if (ratio < 1 && chars > 0) return `口播偏短（${chars} 字 / ${seconds}秒）`
  return ''
}

// 工具：总时长一致性
export function totalDurationWarning(shots: Shot[], totalDuration: string): string {
  const sum = shots.reduce((acc, s) => {
    const m = s.duration.match(/(\d+(?:\.\d+)?)/)
    return acc + (m ? parseFloat(m[1]) : 0)
  }, 0)
  const tm = totalDuration.match(/(\d+)/)
  if (!tm) return ''
  const total = parseInt(tm[1], 10)
  const diff = Math.abs(sum - total)
  if (diff > 3) return `镜头时长合计 ${sum} 秒，与总时长 ${total} 秒不符（差 ${diff} 秒）`
  return ''
}
