import { useEffect, useState } from 'react'
import type { Script } from '../types'

interface Props {
  script: Script
  onClose: () => void
}

export function Teleprompter({ script, onClose }: Props) {
  const [idx, setIdx] = useState(0)
  const [fontSize, setFontSize] = useState(56)
  const [mirrored, setMirrored] = useState(false)

  const shots = script.shots

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); setIdx(i => Math.min(shots.length - 1, i + 1)) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); setIdx(i => Math.max(0, i - 1)) }
      else if (e.key === 'Escape') { onClose() }
      else if (e.key === '+' || e.key === '=') { setFontSize(f => Math.min(120, f + 4)) }
      else if (e.key === '-') { setFontSize(f => Math.max(28, f - 4)) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shots.length, onClose])

  // swipe
  useEffect(() => {
    let startX = 0
    const onStart = (e: TouchEvent) => { startX = e.touches[0].clientX }
    const onEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startX
      if (Math.abs(dx) < 40) return
      if (dx < 0) setIdx(i => Math.min(shots.length - 1, i + 1))
      else setIdx(i => Math.max(0, i - 1))
    }
    window.addEventListener('touchstart', onStart)
    window.addEventListener('touchend', onEnd)
    return () => { window.removeEventListener('touchstart', onStart); window.removeEventListener('touchend', onEnd) }
  }, [shots.length])

  if (shots.length === 0) return null
  const shot = shots[idx]

  return (
    <div className="teleprompter-overlay">
      <div className="teleprompter-topbar">
        <button className="tp-btn" onClick={onClose}>✕ 退出</button>
        <span className="tp-progress">{idx + 1} / {shots.length}</span>
        <div className="tp-controls">
          <button className="tp-btn" onClick={() => setFontSize(f => Math.max(28, f - 4))}>A−</button>
          <button className="tp-btn" onClick={() => setFontSize(f => Math.min(120, f + 4))}>A+</button>
          <button className="tp-btn" onClick={() => setMirrored(m => !m)}>{mirrored ? '正向' : '镜像'}</button>
        </div>
      </div>

      <div className="teleprompter-shotinfo">
        <span>⏱ {shot.duration}</span>
        <span>{shot.timeRange}</span>
      </div>

      <div
        className="teleprompter-text"
        style={{ fontSize: `${fontSize}px`, transform: mirrored ? 'scaleX(-1)' : 'none' }}
        onClick={() => setIdx(i => Math.min(shots.length - 1, i + 1))}
      >
        {shot.voiceover || <span style={{ opacity: 0.3 }}>（此镜头无口播）</span>}
      </div>

      <div className="teleprompter-visual">
        🎬 <span style={{ opacity: 0.7 }}>画面：</span>{shot.visual}
      </div>

      <div className="teleprompter-bottom">
        <button className="tp-nav" onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}>‹ 上一条</button>
        <div className="tp-dots">
          {shots.map((_, i) => (
            <span key={i} className={`tp-dot ${i === idx ? 'active' : ''}`} onClick={() => setIdx(i)} />
          ))}
        </div>
        <button className="tp-nav" onClick={() => setIdx(i => Math.min(shots.length - 1, i + 1))} disabled={idx === shots.length - 1}>下一条 ›</button>
      </div>
    </div>
  )
}
