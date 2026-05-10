// localStorage 封装（安全：try/catch，无痕模式支持）
import type { Script, Draft, Settings, SceneMode } from './types'

const K_KEY = 'xinjie_deepseek_key'
const K_HISTORY = 'xinjie_script_history_v2'
const K_DRAFT = 'xinjie_draft_v2'
const K_SETTINGS = 'xinjie_settings_v1'
const K_OLD_HISTORY = 'xinjie_script_history'  // v1 迁移

const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  customSystemPrompts: {},
  showPublishKit: true,
  incognito: false,
}

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn() } catch { return fallback }
}

// —— Key ——
export const loadKey = () => safe(() => localStorage.getItem(K_KEY) || '', '')
export const saveKey = (k: string) => safe(() => { localStorage.setItem(K_KEY, k); return true }, false)

// —— Settings ——
export function loadSettings(): Settings {
  return safe(() => {
    const raw = localStorage.getItem(K_SETTINGS)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  }, DEFAULT_SETTINGS)
}
export function saveSettings(s: Settings) {
  safe(() => { localStorage.setItem(K_SETTINGS, JSON.stringify(s)); return true }, false)
}

// —— History ——
export function loadHistory(): Script[] {
  return safe(() => {
    // 尝试 v2
    const v2 = localStorage.getItem(K_HISTORY)
    if (v2) return JSON.parse(v2)
    // 迁移 v1
    const v1 = localStorage.getItem(K_OLD_HISTORY)
    if (!v1) return []
    const oldScripts = JSON.parse(v1) as any[]
    const migrated: Script[] = oldScripts.map(s => migrateV1ToV2(s))
    localStorage.setItem(K_HISTORY, JSON.stringify(migrated))
    return migrated
  }, [])
}

function migrateV1ToV2(s: any): Script {
  return {
    id: s.id || Date.now(),
    mode: 'travel',
    createdAt: s.createdAt || new Date().toLocaleString('zh-CN'),
    title: s.destination || '',
    subtitle: s.purpose || '',
    totalDuration: s.totalDuration || '30 秒',
    bgm: s.bgm || '',
    shootLocation: s.shootLocation || '',
    formData: {
      destination: s.destination || '', purpose: s.purpose || '',
      departure: s.departure || '', transport: s.transport || '',
      transportDuration: s.transportDuration || '', shootTime: s.shootTime || '',
      weather: s.weather || '', arriveShoot: s.arriveShoot || '',
      hotelName: s.hotelName || '', howToHotel: s.howToHotel || '',
      hotelShoot: s.hotelShoot || '', companions: s.companions || '',
      equipment: s.equipment || '', keyMessage: s.keyMessage || '',
      requiredShots: s.requiredShots || '', extraNotes: s.extraNotes || '',
    },
    shots: s.shots || [],
    directorNotes: s.directorNotes || '',
    usage: s.usage,
  }
}

export function saveHistory(scripts: Script[], incognito = false) {
  if (incognito) return
  safe(() => {
    // 保留收藏 + 最近 30 条
    const favs = scripts.filter(s => s.favorite)
    const recent = scripts.filter(s => !s.favorite).slice(0, 30)
    localStorage.setItem(K_HISTORY, JSON.stringify([...favs, ...recent]))
    return true
  }, false)
}

// —— Draft ——
export function loadDraft(mode?: SceneMode): Draft | null {
  return safe(() => {
    const raw = localStorage.getItem(K_DRAFT)
    if (!raw) return null
    const d = JSON.parse(raw) as Draft
    if (mode && d.mode !== mode) return null  // 模式切换时不串用
    return d
  }, null)
}
export function saveDraft(d: Draft, incognito = false) {
  if (incognito) return
  safe(() => { localStorage.setItem(K_DRAFT, JSON.stringify(d)); return true }, false)
}
export function clearDraft() {
  safe(() => { localStorage.removeItem(K_DRAFT); return true }, false)
}

// —— 完整备份 ——
export function exportBackup(): string {
  const data = {
    version: 2,
    exportedAt: new Date().toISOString(),
    key: loadKey(),
    settings: loadSettings(),
    history: loadHistory(),
  }
  return JSON.stringify(data, null, 2)
}

export function importBackup(json: string): { ok: boolean; msg: string } {
  try {
    const d = JSON.parse(json)
    if (!d.version) return { ok: false, msg: '不是有效的备份文件' }
    if (d.key) saveKey(d.key)
    if (d.settings) saveSettings(d.settings)
    if (Array.isArray(d.history)) saveHistory(d.history)
    return { ok: true, msg: `已导入 ${d.history?.length || 0} 条历史` }
  } catch (e: any) {
    return { ok: false, msg: '解析失败：' + (e.message || e) }
  }
}
