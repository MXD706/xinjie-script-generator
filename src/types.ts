// 所有 TypeScript 类型定义

export type SceneMode = 'travel' | 'talking' | 'daily'

export interface Shot {
  duration: string
  timeRange: string
  visual: string
  voiceover: string
  subtitle: string
  directorNote: string
  done?: boolean
}

export interface PublishKit {
  titles: string[]          // 3 个备选标题
  caption: string           // 一段文案
  hashtags: string[]        // 5-8 个话题
  coverText: string         // 封面大字（3-6 字）
  coverShotIndex: number    // 建议用第几个镜头截封面，-1 表示自行拍
}

export interface Script {
  id: number
  mode: SceneMode
  createdAt: string
  favorite?: boolean

  // 通用元数据
  title: string              // 主题，如 "巴塞罗那小米展厅" / "我为什么看好 YU7"
  subtitle: string           // 副标题/子主题
  totalDuration: string
  bgm: string
  shootLocation: string

  // 场景特定字段（扁平存所有字段，按 mode 使用不同子集）
  formData: Record<string, string>

  shots: Shot[]
  directorNotes: string
  publish?: PublishKit
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
}

export interface FieldDef {
  key: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'chip-select'
  placeholder?: string
  maxLength?: number
  required?: boolean
  options?: { value: string; label: string }[]   // for select / chip-select
  hint?: string
  group: string   // 分组标题，用于 UI 区块
}

export interface SceneConfig {
  key: SceneMode
  label: string
  emoji: string
  short: string               // 一行简介
  contentTypes: {             // 该场景的内容类型
    key: string
    label: string
    emoji: string
    hint: string
  }[]
  fields: FieldDef[]
  systemPrompt: string
  durationPresets: string[]
  topicLibrary: TopicSeed[]   // 选题库
}

export interface TopicSeed {
  title: string
  emoji: string
  fill: Record<string, string | undefined>   // 点选后填入的字段
}

export interface Draft {
  mode: SceneMode
  contentType: string
  targetDuration: string
  formData: Record<string, string>
}

export interface Settings {
  theme: 'dark' | 'light' | 'auto'
  customSystemPrompts: Partial<Record<SceneMode, string>>
  showPublishKit: boolean
  incognito: boolean
}

export type EditMode =
  | { type: 'meta'; field: string }
  | { type: 'shot'; index: number; field: keyof Shot }
  | { type: 'directorNotes' }
  | { type: 'publish'; field: string }
  | null
