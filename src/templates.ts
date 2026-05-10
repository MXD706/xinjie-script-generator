// 三种场景的字段定义和 prompt 模板
import type { SceneConfig, SceneMode } from './types'

// ============== 共享人设 ==============
const PERSONA = `你是昕昕，一个在大陆生活的台湾女生，你要以她的语气和风格写抖音视频分镜脚本。

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
`

// ============== 共享输出要求 ==============
const OUTPUT_FORMAT = `
## 输出格式（必须严格遵守）

先输出一行元信息：
总时长：[X] 秒 | 背景音乐：[具体风格/曲名] | 拍摄地点：[具体地点]

然后输出分镜表（Markdown 表格）：

| 时长 | 时间段 | 画面内容 | 口播台词（同步播报） | 字幕贴纸 | 摄影师跟拍指令 |
|------|--------|----------|---------------------|----------|---------------|
| X秒 | 0-X秒 | 具体描述，包含人物动作和背景 | 我是昕昕，口播台词... | 关键词提炼 | 具体拍摄指令 |

表格结束后另起一行，以"导演注意事项："开头写 2-4 条整体建议。

再另起一行，输出"发布物料："段落，包含：
- 标题（3 个备选，每个 ≤ 20 字，有钩子）：
  1. ...
  2. ...
  3. ...
- 文案（60-120 字，开头有钩子，结尾引导互动）：
  ...
- 话题（5-8 个，带 # 号，与内容强相关）：
  #xxx #xxx ...
- 封面大字（3-6 字，高对比度词）：
  xxx
- 封面镜头：第 X 个镜头（或"另拍"）

## 口播台词要求
- 口语化，像跟朋友聊天，不是念稿
- 有具体时间/数字/地点
- 每句不超过 10 字，中文口播 3-4 字/秒，时长要够念
- 不要空洞形容词

## 摄影师指令要求
- 明确机位（固定/跟拍/推进/俯拍/航拍）
- 明确景别（特写/近景/中景/半身/全景）
- 画面要求（避开杂乱/稳定不抖/聚焦清晰）

## 通用注意
- 表格每行是一个镜头，不合并
- 严格按用户提供的信息写，不自己瞎编
- 各镜头时长之和 = 总时长
`

// ============== 旅游 Vlog ==============
const TRAVEL_PROMPT = PERSONA + `
## 本次任务：旅游 Vlog

## 4 种内容类型
1. 冲动行动型：做疯狂决定→说走就走→遇到意外→结尾情感升华
2. 对比发现型：台湾视角看大陆事物→发现差异→被震撼→结尾互动
3. 情感走心型：具体经历→真情实感→两岸情怀→温暖结尾
4. 体验分享型：亲身尝试→具体感受→推荐理由→种草结尾

## 结尾公式
- 情感向：两岸本来就是一家人，想去哪就去哪
- 互动向：你们有没有做过这种冲动的事？评论区告诉我～
- 种草向：真的太值得了，推荐给大家！

## 已知爆款规律
- 车是流量密码
- "被震撼"模板有效
- 两岸差异话题稳定有受众
- 纯打卡差，要有故事
` + OUTPUT_FORMAT

// ============== 口播知识 ==============
const TALKING_PROMPT = PERSONA + `
## 本次任务：口播 / 观点 / 知识分享

## 4 种内容类型
1. 反共识观点型：大家觉得 A，我觉得 B → 给 3 个理由 → 反转/金句结尾
2. 经验分享型：踩过的坑/学到的事 → 具体事例 → 总结 → 引导互动
3. 测评安利型：具体产品/服务 → 优缺点 → 推荐人群 → 种草
4. 吐槽共鸣型：大家都遇到过 XX → 我的经历 → 你们呢？→ 互动

## 结构公式（15-60 秒口播）
开头 3 秒钩子（数据/反共识/悬念）→ 快速展开 2-3 个论点 → 结论/金句 → 评论区互动

## 口播特点
- 口播类镜头多是对镜头讲话（半身/近景为主）
- 画面内容描述"昕昕坐在 XX 处对镜头讲"，或"配合空镜/花字/走位"
- 字幕贴纸是关键词/金句提炼（字幕是爆款密码，要有 1-2 个金句字幕）
- 可以穿插 1-2 个 B-roll 画面镜头（空镜/产品特写/旧素材）

## 爆款规律
- 前 3 秒必须抓人：数字（"我花了3万"）、反共识（"其实不是这样"）、悬念（"我原本以为 XX，结果..."）
- 结尾要留钩子或互动，不要收太死
` + OUTPUT_FORMAT

// ============== 日常分享 ==============
const DAILY_PROMPT = PERSONA + `
## 本次任务：日常生活分享（Vlog 片段）

## 4 种内容类型
1. 一日流水型：早-中-晚按时间线 → 穿插细节 → 结尾情绪
2. 小确幸型：具体一件开心/温暖的小事 → 细节放大 → 治愈结尾
3. 生活观察型：发现 XX 有意思的事 → 细节展开 → 感悟/互动
4. 踩坑吐槽型：今天遇到 XX → 吐槽/搞笑细节 → 共鸣互动

## 结构公式（20-60 秒）
场景开启（今天我...）→ 2-4 个生活细节/画面 → 一句情绪收束

## 日常视频特点
- 画面以生活场景为主（家里/街上/咖啡厅/车里）
- 口播可以是 VO（画外音叙述），也可以是同期声（对镜头讲）
- BGM 偏慵懒、轻快，不要宏大
- 字幕简短，多用短句和省略号
- 不要刻意立观点，真实比道理重要

## 爆款规律
- "这种生活真好"感最吃香
- 有猫/狗/家人镜头加分
- 不要流水账：每个镜头都要有情绪或信息量
` + OUTPUT_FORMAT

// ============== 字段配置 ==============

const TRAVEL_FIELDS: SceneConfig['fields'] = [
  { key: 'destination', label: '目的地', type: 'text', placeholder: '比如：西班牙巴塞罗那', required: true, maxLength: 100, group: '基础' },
  { key: 'purpose', label: '去干什么', type: 'text', placeholder: '比如：看小米汽车展厅', required: true, maxLength: 200, group: '基础' },
  { key: 'companions', label: '同行人', type: 'select', group: '基础', options: [
    { value: '', label: '选择同行人' },
    { value: '一个人', label: '一个人' },
    { value: '摄影师跟拍', label: '摄影师跟拍' },
    { value: '朋友一起', label: '朋友一起' },
    { value: '家人一起', label: '家人一起' },
  ]},
  { key: 'equipment', label: '拍摄设备', type: 'select', group: '基础', options: [
    { value: '', label: '选择设备' },
    { value: '手机', label: '手机' },
    { value: '相机', label: '相机' },
    { value: '手机+稳定器', label: '手机+稳定器' },
    { value: '相机+摄影师', label: '相机+摄影师' },
  ]},
  { key: 'departure', label: '出发地', type: 'text', placeholder: '比如：台湾家里 / 深圳', group: '交通' },
  { key: 'transport', label: '交通方式', type: 'text', placeholder: '比如：飞马德里再火车', group: '交通' },
  { key: 'transportDuration', label: '交通时长', type: 'text', placeholder: '比如：飞13小时 + 转机3小时', group: '交通' },
  { key: 'shootTime', label: '拍摄时间', type: 'select', group: '交通', options: [
    { value: '', label: '选择时段' },
    { value: '清晨/上午', label: '清晨 / 上午' },
    { value: '中午/下午', label: '中午 / 下午' },
    { value: '傍晚/黄金时段', label: '傍晚 / 黄金时段' },
    { value: '晚上', label: '晚上' },
    { value: '全天', label: '全天' },
  ]},
  { key: 'weather', label: '天气', type: 'select', group: '交通', options: [
    { value: '', label: '选择天气' },
    { value: '晴天', label: '☀️ 晴天' },
    { value: '阴天', label: '☁️ 阴天' },
    { value: '雨天', label: '🌧 雨天' },
    { value: '雪天', label: '❄️ 雪天' },
  ]},
  { key: 'arriveShoot', label: '到达后怎么拍', type: 'text', placeholder: '比如：直接打车去展厅', group: '行程' },
  { key: 'hotelName', label: '住哪个酒店', type: 'text', placeholder: '比如：巴塞罗那 W 酒店', group: '行程' },
  { key: 'howToHotel', label: '怎么去酒店', type: 'text', placeholder: '比如：打车去，路上拍街景', group: '行程' },
  { key: 'hotelShoot', label: '酒店拍什么', type: 'text', placeholder: '比如：拍房间窗外海景、大堂环境', group: '行程' },
  { key: 'keyMessage', label: '视频重点', type: 'select', group: '创作', options: [
    { value: '', label: '选择重点方向' },
    { value: '冲动行动的故事', label: '💥 冲动行动的故事' },
    { value: '被震撼的体验', label: '😲 被震撼的体验' },
    { value: '两岸差异/两岸情怀', label: '💗 两岸差异 / 情怀' },
    { value: '种草体验分享', label: '🌟 种草体验分享' },
  ]},
  { key: 'requiredShots', label: '必须要有的镜头', type: 'textarea', placeholder: '比如：小米车 LOGO 特写、展厅全景、试坐车内画面', group: '创作' },
  { key: 'extraNotes', label: '额外补充', type: 'textarea', placeholder: '任何想告诉 AI 的信息', group: '创作' },
]

const TALKING_FIELDS: SceneConfig['fields'] = [
  { key: 'topic', label: '今天要讲什么主题', type: 'text', placeholder: '比如：为什么我在大陆不用信用卡了', required: true, maxLength: 100, group: '基础' },
  { key: 'viewpoint', label: '你的核心观点 / 结论', type: 'textarea', placeholder: '用一两句话说清楚你想表达的', required: true, maxLength: 300, group: '基础' },
  { key: 'reasons', label: '支撑论点 / 理由（2-3 条）', type: 'textarea', placeholder: '1. 方便\n2. 优惠多\n3. 消费心理', group: '内容' },
  { key: 'story', label: '具体故事 / 数据 / 例子', type: 'textarea', placeholder: '有真实案例最好，数字越具体越抓人', group: '内容' },
  { key: 'hook', label: '开场钩子', type: 'text', placeholder: '比如：大部分人不知道，其实... / 我花了3万买的教训是...', group: '内容' },
  { key: 'shootLocation', label: '拍摄地点 / 背景', type: 'text', placeholder: '比如：家里沙发 / 咖啡厅 / 路边', group: '拍摄' },
  { key: 'props', label: '要展示的道具 / 画面', type: 'textarea', placeholder: '比如：信用卡特写、手机支付画面、地铁扫码', group: '拍摄' },
  { key: 'equipment', label: '拍摄设备', type: 'select', group: '拍摄', options: [
    { value: '', label: '选择设备' },
    { value: '手机（自拍）', label: '手机（自拍）' },
    { value: '手机+支架', label: '手机+支架' },
    { value: '相机+摄影师', label: '相机+摄影师' },
  ]},
  { key: 'keyMessage', label: '内容类型', type: 'select', group: '风格', options: [
    { value: '', label: '选择类型' },
    { value: '反共识观点', label: '🤔 反共识观点' },
    { value: '经验踩坑分享', label: '💡 经验踩坑分享' },
    { value: '测评安利', label: '🌟 测评安利' },
    { value: '吐槽共鸣', label: '😮 吐槽共鸣' },
  ]},
  { key: 'extraNotes', label: '额外补充', type: 'textarea', placeholder: '任何想告诉 AI 的信息', group: '风格' },
]

const DAILY_FIELDS: SceneConfig['fields'] = [
  { key: 'topic', label: '今天分享什么', type: 'text', placeholder: '比如：在家包了一整天饺子', required: true, maxLength: 100, group: '基础' },
  { key: 'mood', label: '情绪 / 感受', type: 'text', placeholder: '比如：治愈 / 累但满足 / 无语搞笑', required: true, maxLength: 60, group: '基础' },
  { key: 'scene', label: '场景 / 地点', type: 'text', placeholder: '比如：家里厨房 / 北京胡同 / 车里', group: '场景' },
  { key: 'companions', label: '参与的人', type: 'text', placeholder: '比如：老公、猫、妈妈', group: '场景' },
  { key: 'timeline', label: '时间线 / 关键事件', type: 'textarea', placeholder: '早上：...\n中午：...\n晚上：...', group: '场景' },
  { key: 'details', label: '想拍到的细节', type: 'textarea', placeholder: '比如：揉面的手、饺子下锅冒泡、猫凑近来闻', group: '场景' },
  { key: 'trigger', label: '触发点 / 有意思的瞬间', type: 'text', placeholder: '比如：包到第100个时手抽筋了', group: '风格' },
  { key: 'ending', label: '想留给观众的感受', type: 'select', group: '风格', options: [
    { value: '', label: '选择' },
    { value: '治愈温暖', label: '💗 治愈温暖' },
    { value: '共鸣会心一笑', label: '😊 共鸣会心一笑' },
    { value: '小确幸感', label: '🌸 小确幸感' },
    { value: '生活真实感', label: '✨ 生活真实感' },
  ]},
  { key: 'keyMessage', label: '内容类型', type: 'select', group: '风格', options: [
    { value: '', label: '选择类型' },
    { value: '一日流水', label: '📅 一日流水' },
    { value: '小确幸', label: '🌸 小确幸' },
    { value: '生活观察', label: '👀 生活观察' },
    { value: '踩坑吐槽', label: '😅 踩坑吐槽' },
  ]},
  { key: 'extraNotes', label: '额外补充', type: 'textarea', placeholder: '任何想告诉 AI 的信息', group: '风格' },
]

// ============== 内容类型 ==============
const TRAVEL_CT = [
  { key: '冲动行动型', label: '冲动行动', emoji: '💥', hint: '说走就走→遇到意外→情感升华' },
  { key: '对比发现型', label: '对比发现', emoji: '🔍', hint: '台湾视角→发现差异→被震撼' },
  { key: '情感走心型', label: '情感走心', emoji: '💗', hint: '具体经历→两岸情怀→温暖结尾' },
  { key: '体验分享型', label: '体验分享', emoji: '🌟', hint: '亲身体验→具体感受→种草' },
]
const TALKING_CT = [
  { key: '反共识观点', label: '反共识', emoji: '🤔', hint: '大家觉得A，我觉得B' },
  { key: '经验踩坑', label: '经验', emoji: '💡', hint: '踩过的坑/学到的事' },
  { key: '测评安利', label: '安利', emoji: '🌟', hint: '具体产品→优缺点→种草' },
  { key: '吐槽共鸣', label: '吐槽', emoji: '😮', hint: '大家都遇到过的事' },
]
const DAILY_CT = [
  { key: '一日流水', label: '一日流水', emoji: '📅', hint: '早中晚时间线' },
  { key: '小确幸', label: '小确幸', emoji: '🌸', hint: '一件开心的小事放大' },
  { key: '生活观察', label: '生活观察', emoji: '👀', hint: '发现有意思的事' },
  { key: '踩坑吐槽', label: '踩坑吐槽', emoji: '😅', hint: '今天遇到的糟心事' },
]

// ============== 选题库（每场景 10+ 条）==============
const TRAVEL_TOPICS = [
  { title: '台湾人第一次吃重庆火锅', emoji: '🌶', fill: { destination: '重庆', purpose: '吃地道重庆火锅', keyMessage: '被震撼的体验' } },
  { title: '横穿 01/18 国道全程', emoji: '🛣', fill: { destination: '新疆独库公路', purpose: '自驾横穿独库', keyMessage: '冲动行动的故事' } },
  { title: '小米 YU7 试驾体验', emoji: '🚗', fill: { destination: '小米汽车展厅', purpose: '试驾小米 YU7', keyMessage: '种草体验分享' } },
  { title: '一个人去香港迪士尼', emoji: '🎢', fill: { destination: '香港迪士尼', purpose: '一个人玩一天', keyMessage: '体验分享', companions: '一个人' } },
  { title: '上海外滩夜景打卡', emoji: '🌃', fill: { destination: '上海外滩', purpose: '拍夜景', shootTime: '晚上', keyMessage: '两岸差异/两岸情怀' } },
  { title: '台北一日游：我带大陆朋友吃什么', emoji: '🍜', fill: { destination: '台北', purpose: '带大陆朋友吃台北', keyMessage: '两岸差异/两岸情怀' } },
  { title: '成都熊猫基地撸熊猫', emoji: '🐼', fill: { destination: '成都大熊猫基地', purpose: '看熊猫', keyMessage: '被震撼的体验' } },
  { title: '北京胡同City walk', emoji: '🏮', fill: { destination: '北京胡同', purpose: '胡同 citywalk', shootTime: '傍晚/黄金时段', keyMessage: '两岸差异/两岸情怀' } },
  { title: '哈尔滨冰雪大世界', emoji: '❄️', fill: { destination: '哈尔滨冰雪大世界', purpose: '玩冰雪大世界', weather: '雪天', shootTime: '晚上' } },
  { title: '深圳华强北逛一天', emoji: '📱', fill: { destination: '深圳华强北', purpose: '逛电子市场', keyMessage: '被震撼的体验' } },
  { title: '大理洱海骑行', emoji: '🚴', fill: { destination: '大理洱海', purpose: '环洱海骑行' } },
  { title: '西安肉夹馍 vs 台湾刈包', emoji: '🥙', fill: { destination: '西安回民街', purpose: '吃肉夹馍并对比台湾刈包', keyMessage: '两岸差异/两岸情怀' } },
]

const TALKING_TOPICS = [
  { title: '台湾人在大陆最不习惯的 3 件事', emoji: '🤯', fill: { topic: '台湾人在大陆最不习惯的3件事', viewpoint: '不是政治也不是吃辣，是支付/叫外卖/打车这些日常', keyMessage: '反共识观点' } },
  { title: '我为什么不用信用卡了', emoji: '💳', fill: { topic: '我为什么不用信用卡了', viewpoint: '在大陆活了几年真的回不去了', keyMessage: '反共识观点' } },
  { title: '台湾创业 vs 大陆创业最大差异', emoji: '💼', fill: { topic: '台湾创业 vs 大陆创业', viewpoint: '规模/节奏/视野完全不同', keyMessage: '经验踩坑分享' } },
  { title: '来大陆必装的 5 个 App', emoji: '📲', fill: { topic: '台湾人来大陆必装的 5 个 App', keyMessage: '测评安利' } },
  { title: '大陆年轻人最近都在追的XX', emoji: '🔥', fill: { topic: '大陆年轻人最近都在追的 XX', keyMessage: '反共识观点' } },
  { title: '我踩过最惨的一个坑', emoji: '💥', fill: { topic: '在大陆创业踩过最惨的坑', keyMessage: '经验踩坑分享' } },
  { title: '小米 YU7 我为什么看好', emoji: '🚗', fill: { topic: '为什么我看好小米 YU7', viewpoint: '不只是性价比，更是生态', keyMessage: '测评安利' } },
  { title: '两岸年轻人的 3 个共同焦虑', emoji: '😩', fill: { topic: '两岸年轻人的共同焦虑', keyMessage: '吐槽共鸣' } },
  { title: '为什么我不推荐台湾人来上海', emoji: '🙅‍♀️', fill: { topic: '为什么我不推荐台湾人来上海', viewpoint: '不是不好而是不适合所有人', keyMessage: '反共识观点' } },
  { title: '我在大陆最爱的 3 个 App', emoji: '❤️', fill: { topic: '我在大陆最爱的 3 个 App', keyMessage: '测评安利' } },
  { title: '台湾人第一次用支付宝的震撼', emoji: '💰', fill: { topic: '台湾人第一次用支付宝', keyMessage: '吐槽共鸣' } },
]

const DAILY_TOPICS = [
  { title: '我在家包了一整天饺子', emoji: '🥟', fill: { topic: '在家包一整天饺子', mood: '累但满足', keyMessage: '小确幸' } },
  { title: '今天去买菜遇到的小插曲', emoji: '🥬', fill: { topic: '买菜遇到的小插曲', mood: '会心一笑', keyMessage: '生活观察' } },
  { title: '我在北京胡同 citywalk 的下午', emoji: '🏮', fill: { topic: '北京胡同下午citywalk', mood: '治愈', scene: '北京胡同', keyMessage: '小确幸' } },
  { title: '和猫在一起的一天', emoji: '🐱', fill: { topic: '和猫在一起的一天', mood: '治愈', keyMessage: '小确幸' } },
  { title: '工作 12 小时后的宵夜', emoji: '🍜', fill: { topic: '加班12小时后的宵夜', mood: '疲惫但满足', keyMessage: '一日流水' } },
  { title: '周末早 C 晚 A 新尝试', emoji: '☕️', fill: { topic: '周末早C晚A', mood: '小确幸', keyMessage: '一日流水' } },
  { title: '搬家第一天的狼狈', emoji: '📦', fill: { topic: '搬家第一天', mood: '累/吐槽', keyMessage: '踩坑吐槽' } },
  { title: '第一次一个人去医院', emoji: '🏥', fill: { topic: '一个人去医院', mood: '无助但坚强', keyMessage: '生活观察' } },
  { title: '回台湾第一顿早餐', emoji: '🥐', fill: { topic: '回台湾第一顿早餐', mood: '想念、熟悉', keyMessage: '小确幸' } },
  { title: '雨天一个人的咖啡店', emoji: '☔️', fill: { topic: '雨天一个人在咖啡店', mood: '慵懒治愈', keyMessage: '生活观察' } },
]

// ============== 导出 ==============
export const SCENES: Record<SceneMode, SceneConfig> = {
  travel: {
    key: 'travel',
    label: '旅游 Vlog',
    emoji: '🧳',
    short: '旅行见闻 / 体验分享 / 被震撼',
    contentTypes: TRAVEL_CT,
    fields: TRAVEL_FIELDS,
    systemPrompt: TRAVEL_PROMPT,
    durationPresets: ['28秒', '45秒', '60秒'],
    topicLibrary: TRAVEL_TOPICS,
  },
  talking: {
    key: 'talking',
    label: '口播知识',
    emoji: '🎙',
    short: '观点输出 / 经验分享 / 测评',
    contentTypes: TALKING_CT,
    fields: TALKING_FIELDS,
    systemPrompt: TALKING_PROMPT,
    durationPresets: ['20秒', '30秒', '45秒', '60秒'],
    topicLibrary: TALKING_TOPICS,
  },
  daily: {
    key: 'daily',
    label: '日常分享',
    emoji: '💭',
    short: '生活碎片 / 小确幸 / 日常 Vlog',
    contentTypes: DAILY_CT,
    fields: DAILY_FIELDS,
    systemPrompt: DAILY_PROMPT,
    durationPresets: ['20秒', '30秒', '45秒', '60秒'],
    topicLibrary: DAILY_TOPICS,
  },
}

export const SCENE_LIST: SceneMode[] = ['travel', 'talking', 'daily']

export function getScene(mode: SceneMode): SceneConfig {
  return SCENES[mode]
}

export function buildUserPrompt(
  mode: SceneMode,
  formData: Record<string, string>,
  contentType: string,
  targetDuration: string,
): string {
  const scene = SCENES[mode]
  const lines: string[] = []
  lines.push(`帮我写一条${scene.label}类型的抖音视频分镜脚本。\n`)
  lines.push(`## 拍摄信息`)
  for (const f of scene.fields) {
    const v = (formData[f.key] || '').trim()
    if (v) lines.push(`- ${f.label}：${v}`)
  }
  if (contentType) lines.push(`- 内容类型：${contentType}`)
  if (targetDuration) lines.push(`- 目标总时长：${targetDuration}`)
  lines.push('')
  lines.push('严格按照上述信息来写，不要自己瞎编乱造。')
  if (targetDuration) lines.push(`全片总时长严格控制在 ${targetDuration} 左右。`)
  lines.push('记得在最后输出"发布物料："段落，包含标题/文案/话题/封面。')
  return lines.join('\n')
}

export function buildRegenShotPrompt(
  mode: SceneMode,
  formData: Record<string, string>,
  shotIndex: number,
  originalShot: { duration: string; timeRange: string; visual: string; voiceover: string; subtitle: string; directorNote: string },
): string {
  const scene = SCENES[mode]
  const context = scene.fields.map(f => {
    const v = (formData[f.key] || '').trim()
    return v ? `- ${f.label}：${v}` : ''
  }).filter(Boolean).join('\n')

  return `基于以下${scene.label}的拍摄信息：\n${context}\n\n请只重写第 ${shotIndex + 1} 个镜头，保持时长 ${originalShot.duration} 和时间段 ${originalShot.timeRange} 不变，给出一个新的更好的版本。\n\n原镜头：\n- 画面：${originalShot.visual}\n- 口播：${originalShot.voiceover}\n- 字幕：${originalShot.subtitle}\n- 指令：${originalShot.directorNote}\n\n直接输出一行 Markdown 表格，格式：\n| 时长 | 时间段 | 画面内容 | 口播台词 | 字幕贴纸 | 摄影师跟拍指令 |\n| ${originalShot.duration} | ${originalShot.timeRange} | ... | ... | ... | ... |`
}
