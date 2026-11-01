import { useMemo, useState } from 'react'
import { ArrowRightLeft, ChevronRight, Coins, Download, Gift, Link2, MessageSquareText, Radio, UsersRound, Wallet } from 'lucide-react'
import { useDb } from '@/lib/store'
import { BarChart, Legend, LineChart, Sparkline } from '@/components/charts'
import { Avatar, Button, Card, CardTitle, Delta, PageHeader, Segment, StatCard, Table, Tag, Td, Th, Tr, useToast } from '@/components/ui'
import { GUILD_NAME, HOURLY } from '@/lib/seed'
import { PERIODS, PERIOD_LABEL, dayLabels, guildDaily, hostAmount, hostDanmu, hostDelta, hostGivers, isGuildHost, periodDays, scopeHosts, type Period } from '@/lib/metrics'
import { activeSeason, cx, downloadCsv, fmt, fmtDate, fmtDateTime, fmtRelative } from '@/lib/utils'
import { LiveTag, TransferStatusTag } from './shared'
import { navigate } from '@/lib/router'

export function Dashboard() {
  const { db } = useDb()
  const toast = useToast()
  const [period, setPeriod] = useState<Period>('today')
  const season = activeSeason(db.seasons)
  // 本赛季 = 全部参赛主播（含其他公会）；其他时间段 = 新驴酱公会全部主播（含未参赛）
  const hosts = scopeHosts(db.hosts, period)
  const guildAll = scopeHosts(db.hosts, 'today')
  const days = periodDays(period, season)

  const totals = useMemo(() => {
    const amount = hosts.reduce((s, h) => s + hostAmount(h, period, season), 0)
    const danmu = hosts.reduce((s, h) => s + hostDanmu(h, period, season), 0)
    const givers = hosts.reduce((s, h) => s + hostGivers(h, period, season), 0)
    const prevAmount = period === 'season' ? null : (() => {
      const g = guildDaily(hosts, days * 2)
      const prev = g.slice(0, days).reduce((a, b) => a + b, 0)
      return prev ? ((amount - prev) / prev) * 100 : 0
    })()
    const since = period === 'season' && season ? new Date(season.startAt).getTime() : Date.now() - days * 86_400_000
    const sinceToday = new Date()
    sinceToday.setHours(0, 0, 0, 0)
    const from = period === 'today' ? sinceToday.getTime() : since
    const okTransfers = db.transfers.filter((t) => t.status === 'success' && new Date(t.time).getTime() >= from)
    const issued = db.ledger.filter((l) => l.type === 'gift' && new Date(l.time).getTime() >= from).reduce((s, l) => s + l.delta, 0)
    return {
      amount,
      danmu,
      givers,
      delta: prevAmount,
      transferCount: okTransfers.length,
      transferPoints: okTransfers.reduce((s, t) => s + (t.amount ?? 0), 0),
      issued,
    }
  }, [hosts, period, season, days, db.transfers, db.ledger])

  const bound = db.viewers.filter((v) => v.status === 'bound').length
  const live = hosts.filter((h) => h.liveState === 'live').length
  const ranked = [...hosts].sort((a, b) => hostAmount(b, period, season) - hostAmount(a, period, season))
  const trendDays = 30
  const trendLabels = dayLabels(trendDays)
  const trend = guildDaily(guildAll, trendDays)
  const transferDaily = trendLabels.map((_, i) => {
    const dayStart = new Date(Date.now() - (trendDays - 1 - i) * 86_400_000)
    dayStart.setHours(0, 0, 0, 0)
    const end = dayStart.getTime() + 86_400_000
    return db.transfers.filter((t) => t.status === 'success' && new Date(t.time).getTime() >= dayStart.getTime() && new Date(t.time).getTime() < end).reduce((s, t) => s + (t.amount ?? 0), 0)
  })
  const series = [
    { name: '公会流水（元）', data: trend },
    { name: '转分温度值', data: transferDaily, color: '#1e7160' },
  ]

  const hourly = HOURLY.map((v, i) => ({ label: String(i * 2).padStart(2, '0'), value: Math.round((v / 461) * guildAll.reduce((s, h) => s + h.todayAmount, 0)) }))

  const exportCsv = () =>
    downloadCsv(`主播流水_${PERIOD_LABEL[period]}_${fmtDate(new Date().toISOString())}.csv`, ['排名', '主播', 'UID', '房间号', `${PERIOD_LABEL[period]}流水(元)`, '弹幕', '送礼人数', '当前温度值', '所属公会'], ranked.map((h, i) => [i + 1, h.hostName, h.hostUid, h.roomId, hostAmount(h, period, season), hostDanmu(h, period, season), hostGivers(h, period, season), h.currentPoints, h.guildName]))

  const periodHint = {
    today: `${fmtDate(new Date().toISOString())} 00:00 起`,
    season: season ? `${season.name} · ${fmtDateTime(season.startAt, true)} 开赛 · 第 ${days} 天` : '当前无进行中的赛季',
    week: `${dayLabels(7)[0]} – 今天`,
    month: `${dayLabels(30)[0]} – 今天`,
  }[period]

  return (
    <>
      <PageHeader
        eyebrow="概览"
        title={period === 'season' ? (season ? `${season.name} · 全部参赛主播` : '本赛季') : `${GUILD_NAME}公会`}
        desc={
          <span className="flex items-center gap-1.5">
            {period === 'season'
              ? `${hosts.length} 位参赛主播 · 含 ${hosts.filter((h) => !isGuildHost(h)).length} 位其他公会`
              : `${hosts.length} 位公会主播 · 含 ${hosts.filter((h) => !h.inSeason).length} 位未参赛`}{' '}
            <span aria-hidden className="size-1 rounded-full bg-muted/50" /> {periodHint}
          </span>
        }
        actions={
          <>
            <Segment
              value={period}
              onChange={(next) => {
                if (next === 'season' && !season) {
                  toast('当前无进行中的赛季', 'brand')
                  return
                }
                setPeriod(next)
              }}
              items={PERIODS}
            />
            <Button theme="light" icon={<Download className="size-4" />} onClick={exportCsv}>
              导出报表
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-12 gap-5">
        <Card className="relative col-span-12 overflow-hidden xl:col-span-5">
          <div aria-hidden className="soft-orb absolute -top-10 -right-10 size-36 opacity-20" />
          <div className="relative">
            <div className="flex items-center justify-between gap-2">
              <span className="text-caption font-semibold text-muted">{period === 'season' ? '参赛主播本赛季总流水（元）' : `公会${PERIOD_LABEL[period]}总流水（元）`}</span>
              <span className="flex h-7 items-center gap-1.5 rounded-full bg-page px-2.5 text-micro font-semibold text-ink shadow-inset-sm">
                <span className="live-dot size-1.5 rounded-full bg-success" />
                {live} / {hosts.length} 直播中
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-1 text-ink">
              <span className="text-section font-bold text-muted">¥</span>
              <span className="font-num text-[40px] leading-none font-extrabold tracking-tight">{fmt(totals.amount)}</span>
            </div>
            <div className="mt-2 flex h-5 items-center gap-2 text-micro text-muted">{totals.delta !== null ? <Delta value={totals.delta} /> : <span>赛季累计，不做环比</span>}</div>
            <div className="mt-5 grid grid-cols-3 divide-x divide-line rounded-control bg-page py-3.5 shadow-inset-sm">
              {[
                { icon: MessageSquareText, label: '弹幕', value: totals.danmu },
                { icon: UsersRound, label: '送礼人数', value: totals.givers },
                { icon: Gift, label: '礼物笔数', value: Math.round(totals.amount / 5.6) },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex flex-col items-center gap-0.5">
                  <span className="flex items-center gap-1 text-micro text-muted">
                    <Icon className="size-3.5" aria-hidden />
                    {label}
                  </span>
                  <span className="font-num text-section font-bold text-ink">{fmt(value)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <div className="col-span-12 grid grid-cols-2 gap-5 md:grid-cols-4 xl:col-span-7 xl:grid-cols-2">
          <StatCard icon={<Coins className="size-4" />} label={`${PERIOD_LABEL[period]}温度值发放`} value={fmt(totals.issued)} foot="送礼获得 · 1 元 = 1 温度值" tone="warning" onClick={() => navigate('points?tab=ledger')} />
          <StatCard icon={<ArrowRightLeft className="size-4" />} label={`${PERIOD_LABEL[period]}转分`} value={fmt(totals.transferPoints)} unit="温度值" foot={`${totals.transferCount} 笔成功命令`} onClick={() => navigate('transfers')} />
          <StatCard icon={<Link2 className="size-4" />} label="已绑定观众" value={fmt(bound)} unit="人" foot={`${db.bindCodes.filter((c) => c.status === 'waiting').length} 个绑定码等待中`} tone="success" onClick={() => navigate('bindings')} />
          <StatCard icon={<Wallet className="size-4" />} label="观众温度值存量" value={fmt(db.viewers.reduce((s, v) => s + v.balance, 0))} foot="全部账户可用余额" onClick={() => navigate('points')} />
        </div>

        <Card className="col-span-12 xl:col-span-8">
          <CardTitle title="近 30 日趋势" sub={`${GUILD_NAME}公会礼物流水与观众转分温度值`} extra={<Legend series={series} />} />
          <LineChart series={series} labels={trendLabels} height={260} />
        </Card>
        <Card className="col-span-12 xl:col-span-4">
          <CardTitle title="今日分时礼物流水" sub={`${GUILD_NAME}公会 · 每 2 小时汇总（元）`} />
          <div className="rounded-control bg-page px-4 pt-4 pb-3 shadow-inset-sm">
            <BarChart data={hourly} height={196} unit=" 元" />
          </div>
        </Card>

        <Card flush className="col-span-12 xl:col-span-8">
          <div className="px-6 pt-5">
            <CardTitle
              title={period === 'season' ? '赛季流水榜 · 全部参赛主播' : `公会主播流水榜 · ${PERIOD_LABEL[period]}`}
              extra={
                <Button theme="text" size="small" onClick={() => navigate('hosts')}>
                  全部主播 <ChevronRight className="size-3.5" />
                </Button>
              }
            />
          </div>
          <Table>
            <thead>
              <tr>
                <Th className="w-12">排名</Th>
                <Th>主播</Th>
                <Th>状态</Th>
                <Th align="right">{PERIOD_LABEL[period]}流水</Th>
                <Th align="right">环比</Th>
                <Th align="right">当前温度值</Th>
                <Th align="center">近 12 场趋势</Th>
              </tr>
            </thead>
            <tbody>
              {ranked.slice(0, 6).map((h, i) => {
                const d = hostDelta(h, period)
                return (
                  <Tr key={h.hostUid} onClick={() => navigate(`hosts?uid=${h.hostUid}`)}>
                    <Td>
                      <span className={cx('font-num text-section font-extrabold', i === 0 ? 'text-brand-ink' : 'text-muted')}>{i + 1}</span>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={h.hostName} index={db.hosts.indexOf(h)} size="sm" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-semibold text-ink">{h.hostName}</span>
                            {!isGuildHost(h) && <Tag theme="warning">{h.guildName}</Tag>}
                          </div>
                          <div className="font-num text-micro text-muted">房间 {h.roomId}</div>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <LiveTag state={h.liveState} />
                    </Td>
                    <Td align="right" className="font-num font-bold text-ink">
                      ¥{fmt(hostAmount(h, period, season))}
                    </Td>
                    <Td align="right">{d === null ? <span className="text-micro text-muted">—</span> : <Delta value={d} label="" />}</Td>
                    <Td align="right" className="font-num text-ink">
                      {fmt(h.currentPoints)}
                    </Td>
                    <Td align="center">
                      <Sparkline data={h.trend} className="mx-auto" />
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
          <div className="h-3" />
        </Card>

        <Card className="col-span-12 xl:col-span-4">
          <CardTitle title="直播间采集状态" sub="弹幕与礼物消息采集服务" extra={<Radio className="size-4 text-brand-ink" aria-hidden />} />
          <div className="space-y-1">
            {db.collectors.map((c) => {
              const h = db.hosts.find((x) => x.hostUid === c.hostUid)
              if (!h) return null
              return (
                <div key={c.hostUid} className="flex items-center gap-3 rounded-control px-2 py-2 hover:bg-page">
                  <span className={cx('size-2 shrink-0 rounded-full', { ok: 'bg-success', delay: 'bg-warning', down: 'bg-muted/50' }[c.state], c.state === 'ok' && 'live-dot')} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-body text-ink">{h.hostName}</div>
                    <div className="font-num text-micro text-muted">
                      房间 {h.roomId} · {c.state === 'down' ? '已停止采集' : `延迟 ${c.latencyMs}ms · ${fmtRelative(c.lastMessage)}`}
                    </div>
                  </div>
                  <Tag theme={{ ok: 'success', delay: 'warning', down: 'default' }[c.state] as 'success'}>{{ ok: '正常', delay: '延迟', down: '停止' }[c.state]}</Tag>
                </div>
              )
            })}
          </div>
        </Card>

        <Card flush className="col-span-12 lg:col-span-6">
          <div className="px-6 pt-5">
            <CardTitle title="实时礼物" sub="最近入账的礼物事件" extra={<Tag theme="success" dot>采集正常</Tag>} />
          </div>
          <div className="px-3 pb-3">
            {db.gifts.slice(0, 7).map((g) => {
              const h = db.hosts.find((x) => x.hostUid === g.hostUid)
              return (
                <div key={g.giftEventId} className="flex items-center gap-3 rounded-control px-3 py-2.5 hover:bg-page">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning">
                    <Gift className="size-4" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-body text-ink">
                      <span className="font-semibold">{g.senderName}</span>
                      <span className="text-muted"> 送给 </span>
                      {h?.hostName ?? g.hostUid}
                    </div>
                    <div className="font-num text-micro text-muted">
                      {g.giftName} ×{g.quantity} · {fmtDateTime(g.time)}
                    </div>
                  </div>
                  <span className="font-num text-section font-bold text-ink">¥{fmt(g.amount)}</span>
                </div>
              )
            })}
          </div>
        </Card>

        <Card flush className="col-span-12 lg:col-span-6">
          <div className="px-6 pt-5">
            <CardTitle
              title="最近转分命令"
              sub="直播间弹幕解析结果"
              extra={
                <Button theme="text" size="small" onClick={() => navigate('transfers')}>
                  查看全部 <ChevronRight className="size-3.5" />
                </Button>
              }
            />
          </div>
          <div className="px-3 pb-3">
            {db.transfers.slice(0, 7).map((t) => {
              const h = db.hosts.find((x) => x.hostUid === t.targetHostUid)
              return (
                <div key={t.id} className="flex items-center gap-3 rounded-control px-3 py-2.5 hover:bg-page">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
                    <ArrowRightLeft className="size-4" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-body text-ink">
                      <span className="font-semibold">{t.senderName}</span>
                      <span className="font-num text-muted"> {t.raw}</span>
                    </div>
                    <div className="text-micro text-muted">
                      {h ? `→ ${h.hostName}` : '未匹配主播'} · {fmtDateTime(t.time)}
                    </div>
                  </div>
                  <TransferStatusTag status={t.status} />
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </>
  )
}

