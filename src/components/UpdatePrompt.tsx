import { useEffect, useState } from 'react'

interface Props {
  onReload: () => void
}

/**
 * 监听 Service Worker 的更新事件，发现新版本时弹出 toast
 * 注册在 main.tsx
 */
export function UpdatePrompt({ onReload }: Props) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const check = async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration()
        if (!reg) return

        // 初次注册完成后定期检查更新
        const interval = setInterval(() => { reg.update().catch(() => {}) }, 60 * 60 * 1000)

        reg.addEventListener('updatefound', () => {
          const nw = reg.installing
          if (!nw) return
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              setShow(true)
            }
          })
        })

        return () => clearInterval(interval)
      } catch { /* ignore */ }
    }
    check()
  }, [])

  if (!show) return null

  return (
    <div className="update-toast">
      <span>✨ 检测到新版本</span>
      <button onClick={() => { setShow(false); onReload() }}>立即刷新</button>
      <button className="ghost" onClick={() => setShow(false)}>稍后</button>
    </div>
  )
}
