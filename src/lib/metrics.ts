import type { Host, Season } from './types'
import { GUILD_NAME, hostDaily } from './seed'

/** 新驴酱公会主播（含未参赛） */
export const isGuildHost = (h: Host) => h.guildName === GUILD_NAME
/** 本赛季参赛主播（含其他公会） */
export const isSeasonHost = (h: Host) => h.inSeason
/**
 * 统计口径：本赛季 → 全部参赛主播；其他时间段 → 新驴酱公会全部主播。
 * 停止采集的直播间同样计入人数，只是没有新增流水。
 */
export const scopeHosts = (hosts: Host[], p: Period) => hosts.filter((h) => (p === 'season' ? isSeasonHost(h) : isGuildHost(h)))
import { DAY, seasonDay } from './utils'

export type Period = 'today' | 'season' | 'week' | 'month'

export const PERIODS: { value: Period; label: string }[] = [
  { value: 'today', label: '今日' },
  { value: 'season', label: '本赛季' },
  { value: 'week', label: '近 7 日' },
  { value: 'month', label: '近 30 日' },
]

export const PERIOD_LABEL: Record<Period, string> = { today: '今日', season: '本赛季', week: '近 7 日', month: '近 30 日' }

export function periodDays(p: Period, season?: Season) {
  return { today: 1, week: 7, month: 30, season: season ? Math.max(seasonDay(season), 1) : 30 }[p]
}

export function hostAmount(h: Host, p: Period, season?: Season) {
  // 未参赛主播没有本赛季流水
  if (p === 'season' && !h.inSeason) return 0
  const n = periodDays(p, season)
  return hostDaily(h, n).reduce((a, b) => a + b, 0)
}

/** Percentage change vs. the previous equal-length window, or null for season. */
export function hostDelta(h: Host, p: Period) {
  if (p === 'season') return null
  const n = periodDays(p)
  const series = hostDaily(h, n * 2)
  const prev = series.slice(0, n).reduce((a, b) => a + b, 0)
  const cur = series.slice(n).reduce((a, b) => a + b, 0)
  if (!prev) return cur ? 100 : 0
  return ((cur - prev) / prev) * 100
}

export function ratio(h: Host, p: Period, season?: Season) {
  return h.todayAmount ? hostAmount(h, p, season) / h.todayAmount : periodDays(p, season)
}

export const hostDanmu = (h: Host, p: Period, s?: Season) => Math.round(h.todayDanmu * ratio(h, p, s) * 0.96)
export const hostGivers = (h: Host, p: Period, s?: Season) => (p === 'today' ? h.todayGivers : Math.round(h.todayGivers * ratio(h, p, s) * 0.42))

export function dayLabels(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.now() - (n - 1 - i) * DAY)
    return `${d.getMonth() + 1}/${d.getDate()}`
  })
}

export function guildDaily(hosts: Host[], n: number) {
  const all = hosts.map((h) => hostDaily(h, n))
  return Array.from({ length: n }, (_, i) => all.reduce((s, arr) => s + arr[i], 0))
}
