// 抖音常见违规/引流词检测
// 不追求完备，只覆盖最常见的高风险词

interface SensitiveRule {
  pattern: RegExp
  level: 'high' | 'medium' | 'low'
  reason: string
  suggestion?: string
}

const RULES: SensitiveRule[] = [
  // 引流类（抖音平台敏感）
  { pattern: /\b(vx|VX|V信|加微|wx|WX)\b|微信号|加我微信|私信我微信|v号|V号/gi, level: 'high', reason: '引流到微信被限流', suggestion: '改成"私信我"' },
  { pattern: /加我?QQ|Q号|QQ号|qq号/g, level: 'high', reason: '引流到 QQ 被限流', suggestion: '删除' },
  { pattern: /电话|手机号|联系方式|[01]\d{10}/g, level: 'medium', reason: '暴露联系方式易被判引流' },
  { pattern: /公众号|公号|订阅号/g, level: 'medium', reason: '引流外站' },
  { pattern: /小红书|B站|bilibili|抖音号|快手|淘宝|拼多多/g, level: 'medium', reason: '引流到其他平台' },
  { pattern: /点我头像|看主页|主页置顶|主页链接/g, level: 'medium', reason: '直白引流主页' },

  // 抽奖/返利类
  { pattern: /抽奖|免费送|免费领|0元购|白嫖|薅羊毛/g, level: 'medium', reason: '营销词可能被限流' },
  { pattern: /返利|返现|分销|推广|佣金/g, level: 'medium', reason: '带货合规问题' },

  // 夸大/绝对化
  { pattern: /最便宜|最划算|最好用|全网最低|独家|唯一/g, level: 'low', reason: '绝对化用语违反广告法' },
  { pattern: /根治|特效|立竿见影|百分百|100%有效/g, level: 'high', reason: '医疗/绝对化用语' },

  // 政治/敏感话题（两岸创作者特别注意）
  { pattern: /[台臺]独|港独|疆独|藏独/g, level: 'high', reason: '政治敏感，严禁' },
  { pattern: /国台办|中央政府.*台湾|统一台湾/g, level: 'medium', reason: '政治敏感话题谨慎表达' },
  { pattern: /共产党|共匪|民主.+?台湾/g, level: 'high', reason: '政治敏感，严禁' },

  // 医疗/健康
  { pattern: /治愈|治好|治疗|药效|疗效/g, level: 'medium', reason: '非医疗账号避免使用' },

  // 其他
  { pattern: /必看|震惊|绝了|无敌|炸裂/g, level: 'low', reason: '标题党用词被降权' },
  { pattern: /家人们谁懂啊|绝绝子|yyds|集美们/g, level: 'low', reason: 'AI 味重，不符合昕昕人设' },
]

export interface SensitiveHit {
  word: string
  level: SensitiveRule['level']
  reason: string
  suggestion?: string
  positions: number[]  // 出现在文本中的起始偏移
}

export function scanSensitive(text: string): SensitiveHit[] {
  const hitMap = new Map<string, SensitiveHit>()
  for (const rule of RULES) {
    rule.pattern.lastIndex = 0
    let m: RegExpExecArray | null
    const g = rule.pattern.flags.includes('g') ? rule.pattern : new RegExp(rule.pattern.source, rule.pattern.flags + 'g')
    while ((m = g.exec(text)) !== null) {
      const word = m[0]
      const key = word + ':' + rule.reason
      if (!hitMap.has(key)) {
        hitMap.set(key, { word, level: rule.level, reason: rule.reason, suggestion: rule.suggestion, positions: [m.index] })
      } else {
        hitMap.get(key)!.positions.push(m.index)
      }
      if (!g.global) break
    }
  }
  return Array.from(hitMap.values())
}

// 对整段 Script 扫描
export function scanScript(opts: {
  shots: Array<{ voiceover: string; subtitle: string; visual: string }>
  publish?: { titles: string[]; caption: string; hashtags: string[] }
  directorNotes?: string
}): SensitiveHit[] {
  const parts: string[] = []
  for (const s of opts.shots) {
    parts.push(s.voiceover, s.subtitle, s.visual)
  }
  if (opts.publish) {
    parts.push(...opts.publish.titles, opts.publish.caption, opts.publish.hashtags.join(' '))
  }
  if (opts.directorNotes) parts.push(opts.directorNotes)
  return scanSensitive(parts.join('\n'))
}
