import type {
  Admin,
  Appeal,
  AuditEntry,
  BindCode,
  CollectorStatus,
  Danmu,
  DbState,
  GiftEvent,
  Host,
  HostPointsChange,
  Ledger,
  Rules,
  Season,
  ShopProduct,
  ShopPurchase,
  ShopUsage,
  TeamConfig,
  Transfer,
  Viewer,
} from './types'
import { DAY } from './utils'

export const GUILD_NAME = '新驴酱'
export const DB_VERSION = 12

export const DEFAULT_TEAMS: TeamConfig[] = [
  { id: 'red', name: '红队', color: '#d9485f' },
  { id: 'yellow', name: '黄队', color: '#d18b1b' },
  { id: 'blue', name: '蓝队', color: '#3b82c4' },
  { id: 'green', name: '绿队', color: '#2c9a73' },
]

/** Small deterministic PRNG so the demo data is stable between reloads. */
export function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const hashStr = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7)

const startOfDay = (t: number) => {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Per-host daily amounts for the last `days` days (index days-1 = today). */
export function hostDaily(h: Host, days = 30) {
  const r = rng(hashStr(h.hostUid))
  const base = Math.max(h.todayAmount, 400) * 0.85
  return Array.from({ length: days }, (_, i) => {
    if (i === days - 1) return h.todayAmount
    const wave = 0.75 + 0.35 * Math.sin((i + hashStr(h.hostName)) / 2.4)
    const weekend = [0, 6].includes(new Date(Date.now() - (days - 1 - i) * DAY).getDay()) ? 1.25 : 1
    return h.enabled ? Math.round(base * wave * weekend * (0.6 + r() * 0.8)) : 0
  })
}

export const HOURLY = [32, 18, 9, 6, 14, 26, 38, 34, 48, 66, 92, 78]

const GIFTS: [string, number][] = [
  ['超级火箭', 2000],
  ['火箭', 500],
  ['飞机', 100],
  ['办卡', 6],
  ['666', 6],
  ['棒棒哒', 1],
  ['魔法书', 50],
]

const NAMES = [
  '晚风拾月',
  '橘子汽水',
  '鱼丸大户',
  '柠檬不酸',
  '路过的猫头鹰',
  '一个很长很长的昵称用于测试省略',
  '星星落在海里',
  '阿木木',
  '山海不可平',
  '豆包小可爱',
  '冷萃美式',
  '今天也要早睡',
  '摸鱼达人',
  '南风知我意',
  '芝士奶盖',
  '白桃乌龙',
  '雨后彩虹',
  '夏日限定',
  '不吃香菜',
  '咕咕咕',
]

const DANMU_TEXT = [
  '今天这把操作太秀了！',
  '主播几点下播呀',
  '火箭安排上了',
  '这首歌叫什么名字',
  '前排打卡',
  '666666',
  '晚上好呀',
  '冲冲冲',
  '这波稳了',
  '下次一定',
]

function makeHosts(now: number): Host[] {
  // 口径：【新驴酱公会】= guildName 为新驴酱的全部主播（含未参赛）；【本赛季】= inSeason 的全部主播（含其他公会）
  const G = GUILD_NAME
  const raw: Omit<Host, 'enabled' | 'collect' | 'joinedAt' | 'note' | 'seasonAmount'>[] = [
    { hostUid: 'H10231', douyuUid: 'U10231', hostName: '星河不打烊', roomId: '8823104', guildName: G, inSeason: true, aliases: ['星河', '河河'], liveState: 'live', todayAmount: 12860, todayDanmu: 4320, todayGivers: 186, currentPoints: 3620, trend: [22, 30, 26, 41, 38, 52, 64, 58, 72, 80, 68, 91] },
    { hostUid: 'H10458', douyuUid: 'U10458', hostName: '阿柚今天赢了吗', roomId: '6650021', guildName: G, inSeason: true, aliases: ['阿柚'], liveState: 'live', todayAmount: 9420, todayDanmu: 3108, todayGivers: 142, currentPoints: 2180, trend: [18, 20, 31, 28, 44, 40, 39, 52, 61, 57, 66, 70] },
    { hostUid: 'H10712', douyuUid: 'U10712', hostName: '北辰Kiki', roomId: '9011288', guildName: G, inSeason: true, aliases: ['北辰', 'kiki'], liveState: 'replay', todayAmount: 7350, todayDanmu: 2245, todayGivers: 97, currentPoints: 1460, trend: [40, 46, 52, 48, 50, 44, 38, 30, 26, 20, 16, 12] },
    { hostUid: 'H10893', douyuUid: 'U10893', hostName: '老鱼说球', roomId: '3302915', guildName: G, inSeason: true, aliases: ['老鱼'], liveState: 'live', todayAmount: 5120, todayDanmu: 5260, todayGivers: 88, currentPoints: 980, trend: [8, 12, 15, 22, 28, 36, 30, 34, 42, 47, 50, 55] },
    { hostUid: 'H11027', douyuUid: 'U11027', hostName: '糯米团子', roomId: '7718340', guildName: G, inSeason: true, aliases: ['糯米', '团子'], liveState: 'offline', todayAmount: 3680, todayDanmu: 1290, todayGivers: 61, currentPoints: 1580, trend: [30, 34, 28, 24, 20, 14, 10, 6, 4, 2, 0, 0] },
    { hostUid: 'H11160', douyuUid: 'U11160', hostName: '一只小满', roomId: '5520673', guildName: G, inSeason: false, aliases: ['小满'], liveState: 'offline', todayAmount: 2140, todayDanmu: 860, todayGivers: 39, currentPoints: 410, trend: [12, 18, 16, 20, 14, 8, 6, 4, 2, 0, 0, 0] },
    { hostUid: 'H11302', douyuUid: 'U11302', hostName: '夜航船电台', roomId: '4408819', guildName: G, inSeason: false, aliases: ['夜航船'], liveState: 'live', todayAmount: 1890, todayDanmu: 1520, todayGivers: 44, currentPoints: 640, trend: [2, 4, 6, 10, 14, 12, 18, 20, 24, 22, 26, 30] },
    { hostUid: 'H20117', douyuUid: 'U20117', hostName: '风铃不响', roomId: '5106628', guildName: '星火', inSeason: true, aliases: ['风铃'], liveState: 'live', todayAmount: 6280, todayDanmu: 2610, todayGivers: 102, currentPoints: 1120, trend: [16, 22, 28, 30, 36, 42, 40, 48, 55, 60, 58, 66] },
    { hostUid: 'H20345', douyuUid: 'U20345', hostName: '橘猫电台', roomId: '6638201', guildName: '白夜', inSeason: true, aliases: ['橘猫'], liveState: 'offline', todayAmount: 2960, todayDanmu: 1140, todayGivers: 52, currentPoints: 530, trend: [20, 24, 26, 22, 18, 14, 10, 8, 4, 2, 0, 0] },
    { hostUid: 'H11455', douyuUid: 'U11455', hostName: '团子不圆', roomId: '6120934', guildName: G, inSeason: false, aliases: ['团子'], liveState: 'offline', todayAmount: 860, todayDanmu: 410, todayGivers: 17, currentPoints: 120, trend: [4, 6, 3, 8, 5, 2, 0, 0, 0, 0, 0, 0] },
    { hostUid: 'H11590', douyuUid: 'U11590', hostName: '小鹿乱撞', roomId: '2201457', guildName: G, inSeason: false, aliases: ['小鹿'], liveState: 'offline', todayAmount: 0, todayDanmu: 0, todayGivers: 0, currentPoints: 260, trend: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  ]
  return raw.map((h, i) => {
    const host: Host = {
      ...h,
      teamId: h.inSeason ? ({ H10231: 'red', H10458: 'red', H10712: 'yellow', H10893: 'yellow', H11027: 'blue', H20117: 'green', H20345: 'green' } as Record<string, TeamConfig['id']>)[h.hostUid] ?? 'red' : undefined,
      isCaptain: h.inSeason && ['H10712', 'H11027', 'H20117'].includes(h.hostUid),
      enabled: h.hostUid !== 'H11590',
      collect: h.hostUid !== 'H11590',
      joinedAt: new Date(now - (120 - i * 9) * DAY).toISOString(),
      note: h.guildName !== G ? `外公会（${h.guildName}）参赛主播` : h.hostUid === 'H11455' ? '新签约，别名待与糯米团子协调' : h.hostUid === 'H11590' ? '合约暂停，停止采集' : '',
      seasonAmount: 0,
    }
    host.seasonAmount = hostDaily(host, 20).reduce((a, b) => a + b, 0)
    return host
  })
}

export function createSeed(): DbState {
  const now = Date.now()
  const r = rng(20261028)
  const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)]
  const hosts = makeHosts(now)
  const activeHosts = hosts.filter((h) => h.enabled)

  const seasonStart = startOfDay(now - 20 * DAY)
  const seasons: Season[] = [
    { id: 'S1', name: '驴酱青春团', startAt: new Date(seasonStart - 70 * DAY).toISOString(), endAt: new Date(seasonStart).toISOString(), resetPoints: false, note: '首个赛季，温度值不清零' },
    { id: 'S2', name: '驴酱团播S1', startAt: new Date(seasonStart).toISOString(), endAt: new Date(seasonStart + 62 * DAY).toISOString(), resetPoints: false, note: '赛季名称即小程序首页赛季标签名' },
    { id: 'S3', name: '驴酱团播S2', startAt: new Date(seasonStart + 62 * DAY).toISOString(), resetPoints: true, note: '计划开赛时清零观众温度值' },
  ]

  // Viewers
  const viewers: Viewer[] = NAMES.map((name, i) => {
    const status = i === 13 ? 'frozen' : i === 17 || i === 18 ? 'unbound' : 'bound'
    const douyuUid = `U${[5821, 6613, 9046, 3307, 7712, 2280, 4471, 8802, 10231][i] ?? 1000 + Math.floor(r() * 8999)}`
    const hostCandidate = hosts.some((h) => h.inSeason && h.douyuUid === douyuUid)
    return {
      douyuUid,
      douyuName: name,
      openId: `oX3k${Math.floor(r() * 1e8).toString(36)}${Math.floor(r() * 1e8).toString(36)}`.padEnd(28, 'q'),
      wechatName: i % 3 === 0 ? '微信用户' : `wx_${name.slice(0, 2)}`,
      status,
      hostBindingReview: hostCandidate ? 'pending' : 'not_required',
      boundAt: new Date(now - (60 - i * 2.5) * DAY - r() * DAY).toISOString(),
      balance: 0,
      totalEarned: 0,
      totalTransferred: 0,
      lastActive: new Date(now - r() * 5 * DAY).toISOString(),
    }
  })
  const viewerMap = new Map(viewers.map((v) => [v.douyuUid, v]))

  // Gift events across the last 7 days, weighted to big spenders
  const gifts: GiftEvent[] = []
  for (let i = 0; i < 140; i++) {
    const vi = Math.min(Math.floor(Math.pow(r(), 1.8) * viewers.length), viewers.length - 1)
    const v = viewers[vi]
    const [giftName, price] = r() < 0.08 ? GIFTS[0] : pick(GIFTS.slice(1))
    const quantity = price <= 6 ? 1 + Math.floor(r() * 10) : r() < 0.85 ? 1 : 2
    const t = now - Math.pow(r(), 1.4) * 7 * DAY
    gifts.push({
      giftEventId: `G-${new Date(t).toISOString().slice(0, 10).replace(/-/g, '')}-${80000 + i * 37}`,
      senderUid: v.douyuUid,
      senderName: v.douyuName,
      hostUid: pick(activeHosts).hostUid,
      giftName,
      quantity,
      amount: price * quantity,
      time: new Date(t).toISOString(),
    })
  }

  // Transfer commands
  const transfers: Transfer[] = []
  for (let i = 0; i < 70; i++) {
    const v = viewers[Math.min(Math.floor(Math.pow(r(), 1.5) * viewers.length), viewers.length - 1)]
    const target = pick(activeHosts)
    const alias = r() < 0.7 ? target.aliases[0] : target.hostName
    const amount = pick([10, 20, 46, 50, 66, 100, 100, 200, 300, 500, 1000])
    const t = now - Math.pow(r(), 1.3) * 7 * DAY
    const roll = r()
    let raw = `#给${alias}${amount}`
    let status: Transfer['status'] = 'success'
    if (roll < 0.07) {
      raw = `给${alias}${amount}`
      status = 'format'
    } else if (roll < 0.14) {
      raw = `#给${pick(['小明', '大鱼', '主播', 'kk'])}${amount}`
      status = 'alias'
    } else if (roll < 0.17 && alias === '团子') {
      status = 'alias'
    } else if (v.status === 'unbound') {
      status = 'unbound'
    }
    transfers.push({
      id: `T-${(30000 + i * 13).toString()}`,
      time: new Date(t).toISOString(),
      senderUid: v.douyuUid,
      senderName: v.douyuName,
      roomHostUid: pick(activeHosts).hostUid,
      raw,
      alias: status === 'format' ? undefined : raw.replace(/^#给/, '').replace(/\d+$/, ''),
      targetHostUid: status === 'success' ? target.hostUid : undefined,
      amount: status === 'format' ? undefined : amount,
      status,
      danmuEventId: `D-${770000 + i * 29}`,
    })
  }

  // Build ledger chronologically and keep balances non-negative
  const ledger: Ledger[] = []
  type Ev = { t: number; kind: 'gift'; g: GiftEvent } | { t: number; kind: 'transfer'; x: Transfer }
  const events: Ev[] = [
    ...gifts.map((g) => ({ t: new Date(g.time).getTime(), kind: 'gift' as const, g })),
    ...transfers.map((x) => ({ t: new Date(x.time).getTime(), kind: 'transfer' as const, x })),
  ].sort((a, b) => a.t - b.t)
  // carry-over balance from before the window
  viewers.forEach((v, i) => {
    const carry = Math.round((viewers.length - i) * 60 + r() * 400)
    v.totalEarned = carry
    v.balance = carry
  })
  const hostName = (uid: string) => hosts.find((h) => h.hostUid === uid)?.hostName ?? uid
  const hostRoom = (uid: string) => hosts.find((h) => h.hostUid === uid)?.roomId ?? ''
  for (const ev of events) {
    if (ev.kind === 'gift') {
      const v = viewerMap.get(ev.g.senderUid)!
      if (v.status === 'unbound') continue
      v.balance += ev.g.amount
      v.totalEarned += ev.g.amount
      ledger.push({
        id: `L-${ledger.length + 1000}`,
        uid: v.douyuUid,
        type: 'gift',
        delta: ev.g.amount,
        title: `送出 ${ev.g.giftName} ×${ev.g.quantity}`,
        detail: `${hostName(ev.g.hostUid)} · 房间 ${hostRoom(ev.g.hostUid)}`,
        relatedId: ev.g.giftEventId,
        time: ev.g.time,
      })
    } else {
      const x = ev.x
      if (x.status !== 'success') continue
      const v = viewerMap.get(x.senderUid)!
      if (v.balance < (x.amount ?? 0)) {
        x.status = 'balance'
        continue
      }
      v.balance -= x.amount!
      v.totalTransferred += x.amount!
      ledger.push({
        id: `L-${ledger.length + 1000}`,
        uid: v.douyuUid,
        type: 'transfer',
        delta: -x.amount!,
        title: `转分给 ${hostName(x.targetHostUid!)}`,
        detail: `命令 ${x.raw} · 成功`,
        relatedId: x.danmuEventId,
        time: x.time,
      })
    }
  }
  // one reverted example + one manual adjust
  const firstOk = transfers.find((x) => x.status === 'success')
  if (firstOk) {
    firstOk.status = 'reverted'
    const v = viewerMap.get(firstOk.senderUid)!
    v.balance += firstOk.amount!
    v.totalTransferred -= firstOk.amount!
    ledger.push({ id: `L-${ledger.length + 1000}`, uid: v.douyuUid, type: 'revert', delta: firstOk.amount!, title: '转分撤销退回', detail: `撤销 ${firstOk.raw} · 观众误操作申诉`, relatedId: firstOk.id, time: new Date(new Date(firstOk.time).getTime() + 3_600_000).toISOString(), operator: '运营 小林' })
  }
  const adjV = viewers[2]
  adjV.balance += 200
  ledger.push({ id: `L-${ledger.length + 1000}`, uid: adjV.douyuUid, type: 'adjust', delta: 200, title: '人工补发温度值', detail: '采集中断期间礼物补录', relatedId: 'ADJ-0012', time: new Date(now - 2 * DAY).toISOString(), operator: '超级管理员' })
  ledger.sort((a, b) => b.time.localeCompare(a.time))
  transfers.sort((a, b) => b.time.localeCompare(a.time))
  gifts.sort((a, b) => b.time.localeCompare(a.time))

  // 主播温度值变动：最近的成功转分（转入）+ 演示消费，余额从当前温度值倒推
  const spendTpl = [
    { title: '餐饮消费', detail: '合作商家 · 晚餐', ratio: 0.05, ago: 0.3 },
    { title: '购物兑换', detail: '温度值商城 · 生活用品', ratio: 0.08, ago: 1.2 },
    { title: '餐饮消费', detail: '合作商家 · 奶茶', ratio: 0.02, ago: 3.5 },
  ]
  const hostPoints: HostPointsChange[] = []
  hosts.forEach((h) => {
    const items: Omit<HostPointsChange, 'balance'>[] = [
      ...transfers
        .filter((x) => x.targetHostUid === h.hostUid && x.status === 'success')
        .slice(0, 8)
        .map((x) => ({ id: `HP-${x.id}`, hostUid: h.hostUid, kind: 'in' as const, delta: x.amount!, title: `${x.senderName} 转入`, detail: `弹幕转分 ${x.raw}`, relatedId: x.id, time: x.time })),
      ...(h.currentPoints > 0
        ? spendTpl.map((t, i) => ({ id: `HP-${h.hostUid}-S${i}`, hostUid: h.hostUid, kind: 'spend' as const, delta: -Math.max(10, Math.round((h.currentPoints * t.ratio) / 10) * 10), title: t.title, detail: t.detail, relatedId: `SP-${h.hostUid}-${i}`, time: new Date(now - t.ago * DAY).toISOString() }))
        : []),
    ].sort((a, b) => b.time.localeCompare(a.time))
    let balance = h.currentPoints
    // 从最新往前倒推余额；再往前余额会小于 0 的记录视为更早历史，不展示
    for (const it of items) {
      hostPoints.push({ ...it, balance })
      balance -= it.delta
      if (balance < 0) break
    }
  })
  hostPoints.sort((a, b) => b.time.localeCompare(a.time))

  // Danmu
  const danmu: Danmu[] = Array.from({ length: 60 }, (_, i) => {
    const v = pick(viewers)
    const t = now - Math.pow(r(), 1.6) * 2 * DAY
    return {
      danmuEventId: `D-${771300 - i * 7}`,
      senderUid: v.douyuUid,
      senderName: v.douyuName,
      hostUid: pick(activeHosts).hostUid,
      text: pick(DANMU_TEXT),
      time: new Date(t).toISOString(),
    }
  }).sort((a, b) => b.time.localeCompare(a.time))

  const bindCodes: BindCode[] = [
    { code: '482916', openId: 'oX3kpending01aa82kd9qqqqqqq', createdAt: new Date(now - 4 * 60_000).toISOString(), expiresAt: new Date(now + 6 * 60_000).toISOString(), status: 'waiting' as const },
    { code: '730254', openId: 'oX3kpending02zk1m3xqqqqqqqq', createdAt: new Date(now - 8 * 60_000).toISOString(), expiresAt: new Date(now + 2 * 60_000).toISOString(), status: 'waiting' as const },
    ...viewers.slice(0, 9).map((v, i) => ({
      code: String(100000 + Math.floor(r() * 899999)),
      openId: v.openId,
      createdAt: v.boundAt,
      expiresAt: new Date(new Date(v.boundAt).getTime() + 10 * 60_000).toISOString(),
      status: (i === 3 ? 'expired' : i === 6 ? 'cancelled' : 'success') as BindCode['status'],
      douyuUid: i === 3 || i === 6 ? undefined : v.douyuUid,
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const appeals: Appeal[] = [
    { id: 'A-1031', type: 'switch', openId: viewers[4].openId, douyuUid: viewers[4].douyuUid, douyuName: viewers[4].douyuName, content: '原斗鱼账号被盗已注销，申请换绑到新账号 U9921，温度值一并迁移。', createdAt: new Date(now - 3 * 3_600_000).toISOString(), status: 'pending' },
    { id: 'A-1030', type: 'points', openId: viewers[1].openId, douyuUid: viewers[1].douyuUid, douyuName: viewers[1].douyuName, content: '昨晚 22:10 送出火箭未入账温度值，礼物截图已在群内提供。', createdAt: new Date(now - 9 * 3_600_000).toISOString(), status: 'pending' },
    { id: 'A-1029', type: 'unbind', openId: viewers[11].openId, douyuUid: viewers[11].douyuUid, douyuName: viewers[11].douyuName, content: '不再使用该微信，申请解除绑定。', createdAt: new Date(now - 1.5 * DAY).toISOString(), status: 'pending' },
    { id: 'A-1027', type: 'points', openId: viewers[0].openId, douyuUid: viewers[0].douyuUid, douyuName: viewers[0].douyuName, content: '口令打错转给了别的主播，申请撤回。', createdAt: new Date(now - 3 * DAY).toISOString(), status: 'approved', reply: '已撤销该笔转分并退回温度值', handledAt: new Date(now - 2.8 * DAY).toISOString() },
    { id: 'A-1022', type: 'switch', openId: viewers[7].openId, douyuUid: viewers[7].douyuUid, douyuName: viewers[7].douyuName, content: '想换一个斗鱼号绑定。', createdAt: new Date(now - 6 * DAY).toISOString(), status: 'rejected', reply: '无法确认新账号归属，请使用新账号重新生成绑定码', handledAt: new Date(now - 5.5 * DAY).toISOString() },
  ]

  const rules: Rules = {
    pointsPerYuan: 1,
    commandPrefix: '#给',
    allowNoHash: false,
    minTransfer: 1,
    maxTransferPerCmd: 10000,
    dailyTransferLimit: 50000,
    bindCodeTTL: 10,
    bindMinSingleGiftAmount: 100,
    bindRoomHostUid: 'H10231',
    dedupeGift: true,
    freeGiftCounts: false,
    discountGiftPolicy: 'pending',
    aliasMaxLength: 8,
    publicGuest: true,
    botReplyEnabled: true,
    botSuccessReply: '感谢{观众}，已为{主播}转入{温度值}温度值，当前温度值{当前温度值}',
    botFailureReply: '转分失败：{原因}',
    botApiEndpoint: 'http://openapi.douyu.com/api/thirdPart/outerChat',
  }

  const admins: Admin[] = [
    { id: 'AD1', name: '超级管理员', account: 'admin', role: 'owner', enabled: true, lastLogin: new Date(now - 600_000).toISOString() },
    { id: 'AD2', name: '运营 小林', account: 'lin', role: 'operator', enabled: true, lastLogin: new Date(now - 5 * 3_600_000).toISOString() },
    { id: 'AD3', name: '数据 阿杰', account: 'jie', role: 'viewer', enabled: true, lastLogin: new Date(now - 2 * DAY).toISOString() },
    { id: 'AD4', name: '实习 小王', account: 'wang', role: 'operator', enabled: false, lastLogin: new Date(now - 20 * DAY).toISOString() },
  ]

  const audit: AuditEntry[] = [
    { id: 'AU-9', time: new Date(now - 2 * DAY).toISOString(), operator: '超级管理员', module: '温度值', action: '人工调整', target: `${adjV.douyuName} (${adjV.douyuUid})`, detail: '+200 · 采集中断期间礼物补录' },
    { id: 'AU-8', time: new Date(now - 2.8 * DAY).toISOString(), operator: '运营 小林', module: '转分', action: '撤销转分', target: firstOk?.id ?? '', detail: '观众误操作申诉' },
    { id: 'AU-7', time: new Date(now - 4 * DAY).toISOString(), operator: '运营 小林', module: '主播', action: '新增主播', target: '团子不圆 (H11455)', detail: '房间 6120934' },
    { id: 'AU-6', time: new Date(now - 6 * DAY).toISOString(), operator: '超级管理员', module: '主播', action: '停用主播', target: '小鹿乱撞 (H11590)', detail: '合约暂停' },
    { id: 'AU-5', time: new Date(now - 12 * DAY).toISOString(), operator: '超级管理员', module: '规则', action: '修改规则', target: '转分规则', detail: '单次上限 5,000 → 10,000' },
    { id: 'AU-4', time: new Date(seasonStart - DAY).toISOString(), operator: '超级管理员', module: '赛季', action: '设置开始时间', target: '驴酱团播S1', detail: `开始于 ${new Date(seasonStart).toLocaleString('zh-CN')}` },
  ]

  const collectors: CollectorStatus[] = hosts.map((h) => ({
    hostUid: h.hostUid,
    state: !h.collect ? 'down' : h.hostUid === 'H10712' ? 'delay' : 'ok',
    latencyMs: h.hostUid === 'H10712' ? 4200 : 120 + Math.floor(r() * 300),
    lastMessage: new Date(now - (h.collect ? r() * 90_000 : 6 * DAY)).toISOString(),
  }))

  const products: ShopProduct[] = [
    { id: 'P-1001', name: '驴酱定制马克杯', image: 'https://placehold.co/320x320/edf2f7/344054?text=Mug', description: '新驴酱主题定制马克杯，适合日常使用。', price: 600, stock: 36, fulfillment: 'physical', isHostProp: false, enabled: true, createdAt: new Date(now - 18 * DAY).toISOString(), updatedAt: new Date(now - 2 * DAY).toISOString() },
    { id: 'P-1002', name: '主播应援徽章', image: 'https://placehold.co/320x320/e9e7ff/5146a5?text=Badge', description: '团播应援限定徽章，可兑换实体周边。', price: 300, stock: 120, fulfillment: 'physical', isHostProp: true, enabled: true, createdAt: new Date(now - 15 * DAY).toISOString(), updatedAt: new Date(now - 15 * DAY).toISOString() },
    { id: 'P-1004', name: '火箭餐卡', image: 'https://placehold.co/320x320/fff1dd/a86100?text=Meal', description: '赠送给主播，用于兑换合作餐饮福利。', price: 500, stock: 50, fulfillment: 'virtual', isHostProp: true, enabled: true, createdAt: new Date(now - 6 * DAY).toISOString(), updatedAt: new Date(now - 1 * DAY).toISOString() },
    { id: 'P-1003', name: '线下见面会入场券', image: 'https://placehold.co/320x320/e8f7ef/27734c?text=Ticket', description: '用于参加新驴酱线下活动的电子凭证。', price: 2000, stock: 8, fulfillment: 'virtual', isHostProp: false, enabled: false, createdAt: new Date(now - 10 * DAY).toISOString(), updatedAt: new Date(now - 1 * DAY).toISOString() },
  ]
  const shopPurchases: ShopPurchase[] = [
    { id: 'SP-24001', productId: 'P-1001', productName: products[0].name, buyerUid: viewers[0].douyuUid, buyerName: viewers[0].douyuName, quantity: 1, amount: 600, fulfillment: 'physical', redemptionCode: '428611', status: 'used', purchasedAt: new Date(now - 4 * DAY).toISOString(), usedAt: new Date(now - 2 * DAY).toISOString(), shippingAddress: '上海市浦东新区示例路 18 号', note: '线下活动现场领取' },
    { id: 'SP-24002', productId: 'P-1002', productName: products[1].name, buyerUid: viewers[1].douyuUid, buyerName: viewers[1].douyuName, quantity: 2, amount: 600, fulfillment: 'physical', redemptionCode: '735204', status: 'paid', purchasedAt: new Date(now - 8 * 3_600_000).toISOString() },
    { id: 'SP-24003', productId: 'P-1003', productName: products[2].name, buyerUid: viewers[2].douyuUid, buyerName: viewers[2].douyuName, quantity: 1, amount: 2000, fulfillment: 'virtual', redemptionCode: '901728', status: 'cancelled', purchasedAt: new Date(now - 5 * DAY).toISOString(), note: '活动时间调整，订单取消' },
  ]
  const shopUsages: ShopUsage[] = [
    { id: 'SU-24001', purchaseId: 'SP-24001', productId: 'P-1001', productName: products[0].name, buyerUid: viewers[0].douyuUid, buyerName: viewers[0].douyuName, quantity: 1, usedAt: new Date(now - 2 * DAY).toISOString(), operator: '运营 小林', note: '线下活动现场领取' },
  ]

  return { version: DB_VERSION, hosts, viewers, bindCodes, appeals, transfers, ledger, hostPoints, seasons, teams: DEFAULT_TEAMS, rules, gifts, danmu, admins, audit, collectors, products, shopPurchases, shopUsages }
}



