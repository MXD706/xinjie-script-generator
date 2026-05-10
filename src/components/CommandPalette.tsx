import { useEffect, useMemo, useRef, useState } from 'react'
import type { SceneMode } from '../types'

export interface Command {
  id: string
  label: string
  hint?: string
  emoji?: string
  keywords?: string[]
  disabled?: boolean
  section: string
  run: () => void
}

interface Props {
  open: boolean
  onClose: () => void
  commands: Command[]
}

export function CommandPalette({ open, onClose, commands }: Props) {
  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) { setQ(''); setCursor(0); setTimeout(() => inputRef.current?.focus(), 30) }
  }, [open])

  const filtered = useMemo(() => {
    if (!q.trim()) return commands.filter(c => !c.disabled)
    const lc = q.toLowerCase()
    return commands.filter(c => {
      if (c.disabled) return false
      if (c.label.toLowerCase().includes(lc)) return true
      if (c.keywords?.some(k => k.toLowerCase().includes(lc))) return true
      return false
    })
  }, [q, commands])

  useEffect(() => { setCursor(0) }, [q])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(filtered.length - 1, c + 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(0, c - 1)) }
      else if (e.key === 'Enter') {
        e.preventDefault()
        const cmd = filtered[cursor]
        if (cmd) { cmd.run(); onClose() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, cursor, filtered, onClose])

  if (!open) return null

  return (
    <div className="palette-overlay" onClick={onClose}>
      <div className="palette" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="输入命令名、场景、操作..."
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <div className="palette-list">
          {filtered.length === 0 && <div className="palette-empty">没找到匹配的命令</div>}
          {groupBySection(filtered).map(([section, cmds]) => (
            <div key={section} className="palette-group">
              <div className="palette-section">{section}</div>
              {cmds.map((c) => {
                const globalIdx = filtered.indexOf(c)
                return (
                  <div
                    key={c.id}
                    className={`palette-item ${globalIdx === cursor ? 'active' : ''}`}
                    onClick={() => { c.run(); onClose() }}
                    onMouseEnter={() => setCursor(globalIdx)}
                  >
                    <span className="palette-emoji">{c.emoji || '▸'}</span>
                    <span className="palette-label">{c.label}</span>
                    {c.hint && <span className="palette-hint">{c.hint}</span>}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
        <div className="palette-footer">
          <span>↑↓ 选择</span><span>⏎ 执行</span><span>Esc 关闭</span>
        </div>
      </div>
    </div>
  )
}

function groupBySection(cmds: Command[]): [string, Command[]][] {
  const m = new Map<string, Command[]>()
  for (const c of cmds) {
    if (!m.has(c.section)) m.set(c.section, [])
    m.get(c.section)!.push(c)
  }
  return Array.from(m.entries())
}

// 场景切换便利 mapping
export const SCENE_LABELS: Record<SceneMode, { label: string; emoji: string }> = {
  travel: { label: '旅游 Vlog', emoji: '🧳' },
  talking: { label: '口播知识', emoji: '🎙' },
  daily: { label: '日常分享', emoji: '💭' },
}
