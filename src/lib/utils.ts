import type { Host, Rules, Season, SeasonStatus } from './types'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export const fmt = (n: number) => n.toLocaleString('zh-CN')

export const DAY = 86_400_000

export const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 900 + 100)}`

const pad = (n: number) => String(n).padStart(2, '0')

export function fmtDateTime(iso: string | undefined, withYear = false) {
  if (!iso) return '—'
  const d = new Date(iso)
  const date = `${withYear ? `${d.getFullYear()}-` : ''}${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fmtDate(iso: string | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < DAY) return `${Math.floor(diff / 3_600_000)} 小时前`
  if (diff < DAY * 7) return `${Math.floor(diff / DAY)} 天前`
  return fmtDate(iso)
}

/** ISO -> value for <input type="datetime-local"> (local time). */
export function toLocalInput(iso: string | undefined) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : undefined)

export const maskOpenId = (id: string) => `${id.slice(0, 6)}****${id.slice(-4)}`

export type BotReplyContext = {
  viewer: string
  host: string
  points: number
  balance: number
  reason: string
}

/** 将 BOT 回复模板替换为本次命令的演示数据。 */
export function renderBotReply(template: string, context: BotReplyContext) {
  const values: Record<string, string> = {
    观众: context.viewer,
    主播: context.host,
    温度值: fmt(context.points),
    积分: fmt(context.points),
    当前温度值: fmt(context.balance),
    当前积分: fmt(context.balance),
    原因: context.reason,
  }
  return template.replace(/\{(观众|主播|温度值|积分|当前温度值|当前积分|原因)\}/g, (_, key: string) => values[key] ?? '')
}

/** 按斗鱼 outerChat 文档生成服务端应提交的弹幕数组结构。 */
export function buildOuterChatPayload(input: { roomId: string; uid: string; nickName: string; content: string; timestamp?: number }) {
  return {
    chat: [
      {
        room_id: Number(input.roomId),
        uid: Number(input.uid) || input.uid,
        nick_name: input.nickName,
        content: input.content,
        timestamp: input.timestamp ?? Math.floor(Date.now() / 1000),
      },
    ],
  }
}

export function seasonStatus(s: Season, now = Date.now()): SeasonStatus {
  const start = new Date(s.startAt).getTime()
  if (start > now) return 'scheduled'
  if (s.endAt && new Date(s.endAt).getTime() <= now) return 'ended'
  return 'active'
}

export function activeSeason(seasons: Season[]) {
  return seasons.find((s) => seasonStatus(s) === 'active')
}

export function seasonDay(s: Season, now = Date.now()) {
  return Math.max(Math.ceil((now - new Date(s.startAt).getTime()) / DAY), 0)
}

/* ---------- Alias validation (shared by host & alias pages) ---------- */

export function validateAlias(alias: string, hosts: Host[], rules: Rules, ownerUid?: string): string | null {
  const a = alias.trim()
  if (!a) return '请输入别名'
  if (/\s/.test(a)) return '别名不能包含空格'
  if (a.includes('#')) return '别名不能包含 #'
  if (/\d$/.test(a)) return '别名不能以数字结尾，否则会与转分数量混淆'
  if (a.length > rules.aliasMaxLength) return `别名最多 ${rules.aliasMaxLength} 个字符`
  const lower = a.toLowerCase()
  for (const h of hosts) {
    if (h.aliases.some((x) => x.toLowerCase() === lower)) {
      return h.hostUid === ownerUid ? '该主播已有此别名' : `与「${h.hostName}」的别名冲突`
    }
    if (h.hostUid !== ownerUid && h.hostName.toLowerCase() === lower) return `与主播「${h.hostName}」的昵称冲突`
  }
  return null
}

export interface AliasConflict {
  alias: string
  hosts: Host[]
  reason: string
}

export function findAliasConflicts(hosts: Host[]): AliasConflict[] {
  const map = new Map<string, Set<Host>>()
  for (const h of hosts) {
    for (const key of [h.hostName, ...h.aliases]) {
      const k = key.toLowerCase()
      if (!map.has(k)) map.set(k, new Set())
      map.get(k)!.add(h)
    }
  }
  const out: AliasConflict[] = []
  for (const [k, set] of map) {
    if (set.size > 1) out.push({ alias: k, hosts: [...set], reason: '多位主播共用同一别名，转分将无法唯一匹配' })
  }
  for (const h of hosts) {
    for (const a of h.aliases) {
      if (/\d$/.test(a)) out.push({ alias: a, hosts: [h], reason: '别名以数字结尾，与转分数量冲突' })
    }
  }
  return out
}

/* ---------- Transfer command parser ---------- */

export type ParseResult =
  | { status: 'empty' }
  | { status: 'ok'; host: Host; alias: string; amount: number }
  | { status: 'format' | 'alias' | 'amount' | 'limit'; message: string; alias?: string; amount?: number }

export function parseCommand(text: string, hosts: Host[], rules: Rules): ParseResult {
  const t = text.trim()
  if (!t) return { status: 'empty' }
  const prefix = rules.commandPrefix
  const bare = prefix.replace(/^#/, '')
  const escaped = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`^${escaped(prefix)}(.+?)(\\d+)$`)
  let m = t.match(re)
  if (!m && rules.allowNoHash && bare !== prefix) m = t.match(new RegExp(`^${escaped(bare)}(.+?)(\\d+)$`))
  if (!m) return { status: 'format', message: `格式不正确，应为「${prefix}主播别名数量」` }
  const alias = m[1]
  const amount = Number(m[2])
  if (amount < rules.minTransfer) return { status: 'amount', message: `转分数量需不少于 ${rules.minTransfer}`, alias, amount }
  if (amount > rules.maxTransferPerCmd)
    return { status: 'limit', message: `单次转分不能超过 ${fmt(rules.maxTransferPerCmd)}`, alias, amount }
  const lower = alias.toLowerCase()
  const matched = hosts.filter(
    (h) => h.enabled && (h.hostName.toLowerCase() === lower || h.aliases.some((a) => a.toLowerCase() === lower)),
  )
  if (matched.length === 0) return { status: 'alias', message: `未找到别名「${alias}」对应的已启用主播`, alias, amount }
  if (matched.length > 1) return { status: 'alias', message: `别名「${alias}」匹配到多位主播，请先处理冲突`, alias, amount }
  return { status: 'ok', host: matched[0], alias, amount }
}

/* ---------- CSV export ---------- */

export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = '\uFEFF' + [header, ...rows].map((r) => r.map(esc).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
