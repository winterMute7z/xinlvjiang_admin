import { useMemo, useState } from 'react'
import { Download, Gift, MessageSquareText, Trophy, UsersRound, Wallet } from 'lucide-react'
import { useDb } from '@/lib/store'
import { hostDaily } from '@/lib/seed'
import { dayLabels, guildDaily, hostDanmu, hostGivers, scopeHosts } from '@/lib/metrics'
import { GUILD_NAME } from '@/lib/seed'
import { activeSeason, cx, downloadCsv, fmt, fmtDate, fmtDateTime, seasonDay } from '@/lib/utils'
import { navigate } from '@/lib/router'
import { Donut, HBars, Legend, LineChart, SERIES_COLORS } from '@/components/charts'
import { Button, Card, CardTitle, Empty, LineTabs, PageHeader, Pagination, SearchInput, Segment, Select, StatCard, Table, Td, Th, Toolbar, Tr, usePaged } from '@/components/ui'
import { ViewerStatusTag } from './shared'

type Range = '7' | '30' | 'season'

export function DataCenter() {
  const { db } = useDb()
  const season = activeSeason(db.seasons)
  const [range, setRange] = useState<Range>('30')
  const [mode, setMode] = useState<'guild' | 'compare'>('guild')
  const [tab, setTab] = useState<'gifts' | 'danmu'>('gifts')
  const days = range === 'season' ? Math.max(season ? seasonDay(season) : 30, 2) : Number(range)
  const p = range === '7' ? 'week' : range === '30' ? 'month' : 'season'
  // 本赛季 = 全部参赛主播（含其他公会）；近 7 / 30 日 = 新驴酱公会全部主播（含未参赛）
  const hosts = scopeHosts(db.hosts, p)
  const scopeName = p === 'season' ? '参赛主播' : `${GUILD_NAME}公会`
  const labels = dayLabels(days)

  const perHost = hosts.map((h) => ({ h, total: hostDaily(h, days).reduce((a, b) => a + b, 0) })).sort((a, b) => b.total - a.total)
  const total = perHost.reduce((s, x) => s + x.total, 0)
  const series =
    mode === 'guild'
      ? [{ name: `${scopeName}流水`, data: guildDaily(hosts, days) }]
      : perHost.slice(0, 5).map((x, i) => ({ name: x.h.hostName, data: hostDaily(x.h, days), color: SERIES_COLORS[i] }))

  const since = Date.now() - days * 86_400_000
  const giftsInRange = db.gifts.filter((g) => new Date(g.time).getTime() >= since)
  const giftTypes = useMemo(() => {
    const m = new Map<string, number>()
    giftsInRange.forEach((g) => m.set(g.giftName, (m.get(g.giftName) ?? 0) + g.amount))
    const colors = ['#3e6f98', '#5b91bd', '#9cc0dd', '#b88a3a', '#1e7160', '#b23f51', '#9aa8bb']
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([label, value], i) => ({ label, value, color: colors[i % colors.length] }))
  }, [giftsInRange])
  const senders = useMemo(() => {
    const m = new Map<string, { uid: string; name: string; amount: number; count: number; last: string }>()
    giftsInRange.forEach((g) => {
      const e = m.get(g.senderUid) ?? { uid: g.senderUid, name: g.senderName, amount: 0, count: 0, last: g.time }
      e.amount += g.amount
      e.count += 1
      if (g.time > e.last) e.last = g.time
      m.set(g.senderUid, e)
    })
    return [...m.values()].sort((a, b) => b.amount - a.amount).slice(0, 10)
  }, [giftsInRange])

  return (
    <>
      <PageHeader
        eyebrow="赛季与数据"
        title="数据中心"
        desc={`近 7 / 30 日统计${GUILD_NAME}公会全部主播（含未参赛）；本赛季统计全部参赛主播（含其他公会）。支持导出明细。`}
        actions={
          <Segment
            value={range}
            onChange={setRange}
            items={[
              { value: '7', label: '近 7 日' },
              { value: '30', label: '近 30 日' },
              { value: 'season', label: season ? `本赛季（${seasonDay(season)} 天）` : '本赛季' },
            ]}
          />
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-5 lg:grid-cols-4">
        <StatCard icon={<Wallet className="size-4" />} label={`${scopeName}流水`} value={`¥${fmt(total)}`} foot={`日均 ¥${fmt(Math.round(total / days))}`} />
        <StatCard icon={<MessageSquareText className="size-4" />} label="弹幕总量" value={fmt(hosts.reduce((s, h) => s + hostDanmu(h, p, season), 0))} foot="已采集直播间" />
        <StatCard icon={<UsersRound className="size-4" />} label="送礼人次" value={fmt(hosts.reduce((s, h) => s + hostGivers(h, p, season), 0))} tone="success" foot="按主播去重后合计" />
        <StatCard icon={<Trophy className="size-4" />} label="流水冠军" value={perHost[0]?.h.hostName ?? '—'} tone="warning" foot={perHost[0] ? `¥${fmt(perHost[0].total)} · 占比 ${((perHost[0].total / (total || 1)) * 100).toFixed(1)}%` : ''} />
      </div>

      <div className="grid grid-cols-12 gap-5">
        <Card className="col-span-12 xl:col-span-8">
          <CardTitle
            title="流水趋势"
            sub="按日汇总（元）"
            extra={
              <>
                <Legend series={series} />
                <Segment
                  size="sm"
                  value={mode}
                  onChange={setMode}
                  items={[
                    { value: 'guild', label: p === 'season' ? '参赛合计' : '公会合计' },
                    { value: 'compare', label: '主播对比 Top5' },
                  ]}
                />
              </>
            }
          />
          <LineChart series={series} labels={labels} height={280} area={mode === 'guild'} unit=" 元" />
        </Card>
        <Card className="col-span-12 xl:col-span-4">
          <CardTitle title="主播流水占比" sub={`共 ${perHost.length} 位${p === 'season' ? '参赛主播' : '公会主播'}`} />
          <HBars data={perHost.slice(0, 8).map((x) => ({ label: x.h.hostName, value: x.total }))} unit="元" />
        </Card>

        <Card className="col-span-12 lg:col-span-5">
          <CardTitle title="礼物构成" sub="按礼物金额" extra={<Gift className="size-4 text-brand-ink" aria-hidden />} />
          {giftTypes.length ? (
            <Donut
              data={giftTypes}
              center={
                <>
                  <span className="font-num text-section font-extrabold text-ink">{giftsInRange.length}</span>
                  <span className="text-micro text-muted">礼物笔数</span>
                </>
              }
            />
          ) : (
            <Empty title="暂无礼物数据" />
          )}
        </Card>
        <Card flush className="col-span-12 lg:col-span-7">
          <div className="px-6 pt-5">
            <CardTitle title="观众送礼榜" sub="按送礼金额排序 · 点击查看温度值账户" />
          </div>
          <Table>
            <thead>
              <tr>
                <Th className="w-12">排名</Th>
                <Th>观众</Th>
                <Th>绑定</Th>
                <Th align="right">送礼金额</Th>
                <Th align="right">次数</Th>
                <Th>最近送礼</Th>
              </tr>
            </thead>
            <tbody>
              {senders.map((s, i) => {
                const v = db.viewers.find((x) => x.douyuUid === s.uid)
                return (
                  <Tr key={s.uid} onClick={() => navigate(`points?uid=${s.uid}`)}>
                    <Td>
                      <span className={cx('font-num font-extrabold', i < 3 ? 'text-brand-ink' : 'text-muted')}>{i + 1}</span>
                    </Td>
                    <Td>
                      <div className="max-w-48 truncate font-semibold text-ink">{s.name}</div>
                      <div className="font-num text-micro text-muted">{s.uid}</div>
                    </Td>
                    <Td>{v ? <ViewerStatusTag status={v.status} /> : '—'}</Td>
                    <Td align="right" className="font-num font-bold text-ink">
                      ¥{fmt(s.amount)}
                    </Td>
                    <Td align="right" className="font-num text-ink">
                      {s.count}
                    </Td>
                    <Td className="font-num text-caption text-muted">{fmtDateTime(s.last)}</Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
          <div className="h-3" />
        </Card>

        <Card flush className="col-span-12">
          <div className="px-6 pt-2">
            <LineTabs
              value={tab}
              onChange={setTab}
              items={[
                { value: 'gifts', label: '礼物流水' },
                { value: 'danmu', label: '弹幕记录' },
              ]}
            />
          </div>
          {tab === 'gifts' ? <GiftLog /> : <DanmuLog />}
        </Card>
      </div>
    </>
  )
}

function GiftLog() {
  const { db } = useDb()
  const [q, setQ] = useState('')
  const [host, setHost] = useState('all')
  const hostName = (uid: string) => db.hosts.find((h) => h.hostUid === uid)?.hostName ?? uid
  const rows = db.gifts.filter((g) => (host === 'all' || g.hostUid === host) && (!q || [g.senderName, g.senderUid, g.giftName, g.giftEventId].some((x) => x.toLowerCase().includes(q.toLowerCase()))))
  const paged = usePaged(rows, 10)
  return (
    <>
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="搜索观众、礼物或事件 ID" />
        <Select value={host} onChange={(e) => setHost(e.target.value)} aria-label="主播" className="w-44">
          <option value="all">全部主播</option>
          {db.hosts.map((h) => (
            <option key={h.hostUid} value={h.hostUid}>
              {h.hostName}
            </option>
          ))}
        </Select>
        <div className="flex-1" />
        <Button theme="light" icon={<Download className="size-4" />} onClick={() => downloadCsv(`礼物流水_${fmtDate(new Date().toISOString())}.csv`, ['事件ID', '时间', '观众', '斗鱼UID', '主播', '礼物', '数量', '金额(元)'], rows.map((g) => [g.giftEventId, fmtDateTime(g.time, true), g.senderName, g.senderUid, hostName(g.hostUid), g.giftName, g.quantity, g.amount]))}>
          导出
        </Button>
      </Toolbar>
      {rows.length === 0 ? (
        <Empty title="没有匹配的礼物记录" />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>时间</Th>
                <Th>事件 ID</Th>
                <Th>观众</Th>
                <Th>主播</Th>
                <Th>礼物</Th>
                <Th align="right">金额</Th>
              </tr>
            </thead>
            <tbody>
              {paged.slice.map((g) => (
                <Tr key={g.giftEventId}>
                  <Td className="font-num text-caption text-ink">{fmtDateTime(g.time, true)}</Td>
                  <Td className="font-num text-micro text-muted">{g.giftEventId}</Td>
                  <Td>
                    <div className="max-w-48 truncate font-semibold text-ink">{g.senderName}</div>
                    <div className="font-num text-micro text-muted">{g.senderUid}</div>
                  </Td>
                  <Td className="text-ink">{hostName(g.hostUid)}</Td>
                  <Td className="text-ink">
                    {g.giftName} <span className="font-num text-muted">×{g.quantity}</span>
                  </Td>
                  <Td align="right" className="font-num font-bold text-ink">
                    ¥{fmt(g.amount)}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <Pagination {...paged} />
        </>
      )}
    </>
  )
}

function DanmuLog() {
  const { db } = useDb()
  const [q, setQ] = useState('')
  const [host, setHost] = useState('all')
  const [cmdOnly, setCmdOnly] = useState<'all' | 'cmd'>('all')
  const hostName = (uid: string) => db.hosts.find((h) => h.hostUid === uid)?.hostName ?? uid
  const merged = useMemo(
    () =>
      [
        ...db.danmu.map((d) => ({ ...d, isCmd: d.text.startsWith(db.rules.commandPrefix) })),
        ...db.transfers.map((t) => ({ danmuEventId: t.danmuEventId, senderUid: t.senderUid, senderName: t.senderName, hostUid: t.roomHostUid, text: t.raw, time: t.time, isCmd: true })),
      ].sort((a, b) => b.time.localeCompare(a.time)),
    [db.danmu, db.transfers, db.rules.commandPrefix],
  )
  const rows = merged.filter((d) => (host === 'all' || d.hostUid === host) && (cmdOnly === 'all' || d.isCmd) && (!q || [d.senderName, d.senderUid, d.text].some((x) => x.toLowerCase().includes(q.toLowerCase()))))
  const paged = usePaged(rows, 10)
  return (
    <>
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="搜索观众或弹幕内容" />
        <Select value={host} onChange={(e) => setHost(e.target.value)} aria-label="直播间" className="w-44">
          <option value="all">全部直播间</option>
          {db.hosts.map((h) => (
            <option key={h.hostUid} value={h.hostUid}>
              {h.hostName}
            </option>
          ))}
        </Select>
        <Segment
          value={cmdOnly}
          onChange={setCmdOnly}
          items={[
            { value: 'all', label: '全部弹幕' },
            { value: 'cmd', label: '仅转分命令' },
          ]}
        />
        <div className="flex-1" />
        <Button theme="light" icon={<Download className="size-4" />} onClick={() => downloadCsv(`弹幕记录_${fmtDate(new Date().toISOString())}.csv`, ['事件ID', '时间', '观众', '斗鱼UID', '直播间', '内容'], rows.map((d) => [d.danmuEventId, fmtDateTime(d.time, true), d.senderName, d.senderUid, hostName(d.hostUid), d.text]))}>
          导出
        </Button>
      </Toolbar>
      {rows.length === 0 ? (
        <Empty title="没有匹配的弹幕" />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>时间</Th>
                <Th>直播间</Th>
                <Th>观众</Th>
                <Th>内容</Th>
              </tr>
            </thead>
            <tbody>
              {paged.slice.map((d) => (
                <Tr key={d.danmuEventId + d.time}>
                  <Td className="font-num text-caption whitespace-nowrap text-ink">{fmtDateTime(d.time, true)}</Td>
                  <Td className="text-ink">{hostName(d.hostUid)}</Td>
                  <Td>
                    <div className="max-w-48 truncate font-semibold text-ink">{d.senderName}</div>
                    <div className="font-num text-micro text-muted">{d.senderUid}</div>
                  </Td>
                  <Td>{d.isCmd ? <span className="rounded-chip bg-brand-soft px-2 py-1 font-num text-caption font-semibold text-brand-ink">{d.text}</span> : <span className="text-ink">{d.text}</span>}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <Pagination {...paged} />
        </>
      )}
    </>
  )
}
