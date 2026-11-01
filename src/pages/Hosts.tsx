import { useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowRightLeft, Copy, Download, Eye, Pencil, Plus, Radio, ShoppingBag, Trash2, Trophy, Undo2, Users, X } from 'lucide-react'
import { useDb } from '@/lib/store'
import type { Host, TeamConfig } from '@/lib/types'
import { GUILD_NAME, hostDaily } from '@/lib/seed'
import { dayLabels, hostAmount, hostDanmu, hostGivers, isGuildHost } from '@/lib/metrics'
import { activeSeason, cx, downloadCsv, fmt, fmtDate, fmtDateTime, validateAlias } from '@/lib/utils'
import { navigate, useRoute } from '@/lib/router'
import { LineChart } from '@/components/charts'
import {
  Avatar,
  Button,
  Card,
  CardTitle,
  ConfirmDialog,
  Drawer,
  Empty,
  Field,
  IconButton,
  Inset,
  Notice,
  PageHeader,
  Pagination,
  SearchInput,
  Segment,
  Select,
  StatCard,
  Switch,
  Table,
  Tag,
  Td,
  TextInput,
  Textarea,
  Th,
  Toolbar,
  Tr,
  usePaged,
  useToast,
} from '@/components/ui'
import { LiveTag, TransferStatusTag } from './shared'

type LiveFilter = 'all' | 'live' | 'replay' | 'offline'
type TeamFilter = 'all' | 'none' | TeamConfig['id']
type SortKey = 'today' | 'season' | 'points' | 'joined'

// 原型演示用的斗鱼房间目录。正式环境由服务端调用斗鱼房间信息接口返回同样字段。
const DEMO_DOUYU_ROOMS: Record<string, Pick<Host, 'hostUid' | 'douyuUid' | 'hostName'>> = {
  '7742101': { hostUid: 'H11702', douyuUid: 'U11702', hostName: '月下小驴' },
  '7742102': { hostUid: 'H11703', douyuUid: 'U11703', hostName: '驴酱小满' },
  '7742103': { hostUid: 'H11704', douyuUid: 'U11704', hostName: '晚风团团' },
}

function TeamBadge({ team, captain = false }: { team?: TeamConfig; captain?: boolean }) {
  if (!team) return null
  return (
    <span
      className="inline-flex h-5.5 items-center rounded-full border px-2 text-micro font-bold whitespace-nowrap"
      style={{ color: team.color, borderColor: team.color, backgroundColor: `color-mix(in srgb, ${team.color} 14%, white)` }}
    >
      {captain ? `队长 · ${team.name}` : team.name}
    </span>
  )
}

function HostIdentityTags({ host, teams, bindRoomHostUid, seasonActive }: { host: Host; teams: TeamConfig[]; bindRoomHostUid: string; seasonActive: boolean }) {
  if (!seasonActive) {
    return <Tag>无</Tag>
  }
  const team = teams.find((x) => x.id === host.teamId)
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {bindRoomHostUid === host.hostUid && <Tag theme="warning">团长</Tag>}
      {host.inSeason && <TeamBadge team={team} captain={!!host.isCaptain && bindRoomHostUid !== host.hostUid} />}
    </div>
  )
}

export function Hosts() {
  const { db, actions } = useDb()
  const toast = useToast()
  const { params } = useRoute()
  const season = activeSeason(db.seasons)
  const hasActiveSeason = !!season
  const [q, setQ] = useState('')
  const [live, setLive] = useState<LiveFilter>('all')
  const [enabled, setEnabled] = useState<'all' | 'on' | 'off'>('all')
  const [teamFilter, setTeamFilter] = useState<TeamFilter>('all')
  // 公会与赛季是两个独立维度：本公会主播可能未参赛，参赛主播可能来自其他公会
  const [scope, setScope] = useState<'all' | 'guild' | 'season' | 'guildOff' | 'external'>('all')
  const [sort, setSort] = useState<SortKey>('today')
  const [editing, setEditing] = useState<{ host: Host; isNew: boolean } | null>(null)
  const [detailUid, setDetailUid] = useState<string | null>(params.get('uid'))
  const [deleting, setDeleting] = useState<Host | null>(null)

  useEffect(() => {
    const uid = params.get('uid')
    if (uid) setDetailUid(uid)
  }, [params])

  const rows = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return db.hosts
      .filter((h) => (live === 'all' ? true : h.liveState === live))
      .filter((h) => (enabled === 'all' ? true : enabled === 'on' ? h.enabled : !h.enabled))
      .filter((h) => teamFilter === 'all' ? true : teamFilter === 'none' ? !hasActiveSeason || !h.teamId : hasActiveSeason && h.teamId === teamFilter)
      .filter((h) =>
        scope === 'all'
          ? true
          : scope === 'guild'
            ? isGuildHost(h)
            : scope === 'season'
              ? hasActiveSeason && h.inSeason
              : scope === 'guildOff'
                ? isGuildHost(h) && (!hasActiveSeason || !h.inSeason)
                : !isGuildHost(h) && hasActiveSeason && h.inSeason,
      )
      .filter((h) => !kw || [h.hostName, h.hostUid, h.roomId, ...h.aliases].some((x) => x.toLowerCase().includes(kw)))
      .sort((a, b) => {
        if (sort === 'today') return b.todayAmount - a.todayAmount
        if (sort === 'season') return (hasActiveSeason && b.inSeason ? hostAmount(b, 'season', season) : 0) - (hasActiveSeason && a.inSeason ? hostAmount(a, 'season', season) : 0)
        if (sort === 'points') return b.currentPoints - a.currentPoints
        return b.joinedAt.localeCompare(a.joinedAt)
      })
  }, [db.hosts, q, live, enabled, teamFilter, scope, sort, season])
  const paged = usePaged(rows, 8)

  const counts = {
    all: db.hosts.length,
    live: db.hosts.filter((h) => h.liveState === 'live').length,
    replay: db.hosts.filter((h) => h.liveState === 'replay').length,
    offline: db.hosts.filter((h) => h.liveState === 'offline').length,
  }
  const detail = db.hosts.find((h) => h.hostUid === detailUid) ?? null

  const newHost = (): Host => ({
    hostUid: '',
    douyuUid: '',
    hostName: '',
    roomId: '',
    guildName: GUILD_NAME,
    inSeason: true,
    aliases: [],
    liveState: 'offline',
    enabled: true,
    collect: true,
    joinedAt: new Date().toISOString(),
    note: '',
    todayAmount: 0,
    todayDanmu: 0,
    todayGivers: 0,
    seasonAmount: 0,
    currentPoints: 0,
    trend: Array(12).fill(0),
    teamId: 'red',
    isCaptain: false,
  })

  const exportCsv = () =>
    downloadCsv(
      `主播列表_${fmtDate(new Date().toISOString())}.csv`,
      ['主播 UID', '斗鱼 UID', '昵称', '房间号', '所属公会', '参赛', '队伍', '身份', '别名', '状态', '转分', '采集', '今日流水', '本赛季流水', '当前温度值', '加入时间'],
      rows.map((h) => {
        const inSeason = hasActiveSeason && h.inSeason
        return [h.hostUid, h.douyuUid, h.hostName, h.roomId, h.guildName, inSeason ? '是' : '否', inSeason ? db.teams.find((t) => t.id === h.teamId)?.name ?? '' : '', inSeason ? (db.rules.bindRoomHostUid === h.hostUid ? '团长' : h.isCaptain ? '队长' : '') : '', h.aliases.join('/'), h.liveState, h.enabled ? '开启' : '关闭', h.collect ? '开启' : '关闭', h.todayAmount, inSeason ? hostAmount(h, 'season', season) : 0, h.currentPoints, fmtDate(h.joinedAt)]
      }),
    )

  return (
    <>
      <PageHeader
        eyebrow="主播运营"
        title="主播管理"
        desc={`配置主播与直播间。新增主播时输入斗鱼房间号即可自动识别昵称和 UID。「${GUILD_NAME}公会」统计公会为${GUILD_NAME}的全部主播（含未参赛）；「本赛季」统计全部参赛主播（含其他公会）。`}
        actions={
          <>
            <Button theme="light" icon={<Download className="size-4" />} onClick={exportCsv}>
              导出
            </Button>
            <Button icon={<Plus className="size-4" />} onClick={() => setEditing({ host: newHost(), isNew: true })}>
              新增主播
            </Button>
          </>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-5 lg:grid-cols-4">
        <StatCard icon={<Users className="size-4" />} label={`${GUILD_NAME}公会主播`} value={db.hosts.filter(isGuildHost).length} unit="位" foot={`含 ${db.hosts.filter((h) => isGuildHost(h) && (!hasActiveSeason || !h.inSeason)).length} 位未参赛`} onClick={() => setScope('guild')} />
        <StatCard icon={<Trophy className="size-4" />} label="本赛季参赛主播" value={db.hosts.filter((h) => hasActiveSeason && h.inSeason).length} unit="位" foot={hasActiveSeason ? `含 ${db.hosts.filter((h) => h.inSeason && !isGuildHost(h)).length} 位其他公会` : '当前无进行中的赛季'} tone="warning" onClick={() => setScope('season')} />
        <StatCard icon={<Radio className="size-4" />} label="正在直播" value={counts.live} unit="位" foot={`${counts.replay} 位轮播中`} tone="success" />
                <StatCard icon={<ArrowRightLeft className="size-4" />} label="主播当前温度值" value={fmt(db.hosts.reduce((s, h) => s + h.currentPoints, 0))} unit="温度值" foot="全部主播可用余额合计" />
      </div>

      <Card flush>
        <Toolbar>
          <SearchInput value={q} onChange={setQ} placeholder="搜索昵称、别名、UID 或房间号" />
          <Segment
            value={live}
            onChange={setLive}
            items={[
              { value: 'all', label: `全部 ${counts.all}` },
              { value: 'live', label: `直播中 ${counts.live}` },
              { value: 'replay', label: `轮播 ${counts.replay}` },
              { value: 'offline', label: `未开播 ${counts.offline}` },
            ]}
          />
          <div className="flex-1" />
          <Select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value as TeamFilter)} aria-label="队伍筛选" className="w-32">
            <option value="all">全部队伍</option>
            <option value="none">无队伍</option>
            {db.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </Select>
          <Select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} aria-label="公会与赛季" className="w-40">
            <option value="all">全部主播</option>
            <option value="guild">{GUILD_NAME}公会主播</option>
            <option value="season">本赛季参赛主播</option>
            <option value="guildOff">本公会 · 未参赛</option>
            <option value="external">其他公会 · 参赛</option>
          </Select>
          <Select value={enabled} onChange={(e) => setEnabled(e.target.value as typeof enabled)} aria-label="转分状态" className="w-36">
            <option value="all">全部转分状态</option>
            <option value="on">已开启转分</option>
            <option value="off">已关闭转分</option>
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="排序方式" className="w-40">
            <option value="today">按今日流水</option>
            <option value="season">按本赛季流水</option>
            <option value="points">按当前温度值</option>
            <option value="joined">按加入时间</option>
          </Select>
        </Toolbar>
        {rows.length === 0 ? (
          <Empty
            title="未找到匹配的主播"
            description={q ? `没有昵称、别名或房间号包含「${q}」的主播` : '调整筛选条件后重试'}
            action={
              <Button theme="light" size="small" onClick={() => { setQ(''); setLive('all'); setEnabled('all'); setTeamFilter('all'); setScope('all') }}>
                清除筛选
              </Button>
            }
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>主播</Th>
                  <Th>房间号</Th>
                  <Th>所属公会</Th>
                  <Th align="center">本赛季</Th>
                  <Th>队伍 / 身份</Th>
                  <Th>转分别名</Th>
                  <Th>直播状态</Th>
                  <Th align="right">今日流水</Th>
                  <Th align="right">本赛季流水</Th>
                  <Th align="right">当前温度值</Th>
                  <Th align="center">转分</Th>
                  <Th align="center">采集</Th>
                  <Th align="right">操作</Th>
                </tr>
              </thead>
              <tbody>
                {paged.slice.map((h) => (
                  <Tr key={h.hostUid}>
                    <Td>
                      <button type="button" onClick={() => setDetailUid(h.hostUid)} className="flex cursor-pointer items-center gap-3 text-left">
                        <Avatar name={h.hostName} index={db.hosts.indexOf(h)} size="sm" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="max-w-40 truncate font-semibold text-ink hover:text-brand-ink">{h.hostName}</span>
                          </div>
                          <div className="font-num text-micro text-muted">{h.hostUid}</div>
                        </div>
                      </button>
                    </Td>
                    <Td className="font-num text-ink">{h.roomId}</Td>
                    <Td>{isGuildHost(h) ? <Tag theme="brand">{h.guildName}</Tag> : <Tag theme="warning">{h.guildName}</Tag>}</Td>
                    <Td align="center">{hasActiveSeason && h.inSeason ? <Tag theme="success">参赛</Tag> : <span className="text-caption text-muted">未参赛</span>}</Td>
                    <Td><HostIdentityTags host={h} teams={db.teams} bindRoomHostUid={db.rules.bindRoomHostUid} seasonActive={hasActiveSeason} /></Td>
                    <Td>
                      <div className="flex max-w-48 flex-wrap gap-1">
                        {h.aliases.length ? h.aliases.map((a) => <Tag key={a} theme="brand">{a}</Tag>) : <span className="text-caption text-muted">未设置</span>}
                      </div>
                    </Td>
                    <Td>
                      <LiveTag state={h.liveState} />
                    </Td>
                    <Td align="right" className="font-num font-bold text-ink">
                      ¥{fmt(h.todayAmount)}
                    </Td>
                    <Td align="right" className="font-num text-ink">
                      ¥{fmt(hasActiveSeason && h.inSeason ? hostAmount(h, 'season', season) : 0)}
                    </Td>
                    <Td align="right" className="font-num text-ink">
                      {fmt(h.currentPoints)}
                    </Td>
                    <Td align="center">
                      <div className="flex justify-center">
                        <Switch checked={h.enabled} label={`${h.hostName} 转分`} onChange={() => { actions.toggleHost(h.hostUid, 'enabled'); toast(`${h.hostName} 已${h.enabled ? '关闭' : '开启'}转分`) }} />
                      </div>
                    </Td>
                    <Td align="center">
                      <div className="flex justify-center">
                        <Switch checked={h.collect} label={`${h.hostName} 采集`} onChange={() => { actions.toggleHost(h.hostUid, 'collect'); toast(`${h.hostName} 已${h.collect ? '停止' : '开启'}采集`) }} />
                      </div>
                    </Td>
                    <Td align="right">
                      <div className="flex justify-end gap-2">
                        <IconButton label="查看详情" size="sm" onClick={() => setDetailUid(h.hostUid)}>
                          <Eye className="size-4" />
                        </IconButton>
                        <IconButton label="编辑" size="sm" onClick={() => setEditing({ host: h, isNew: false })}>
                          <Pencil className="size-4" />
                        </IconButton>
                        <IconButton label="删除" size="sm" tone="danger" onClick={() => setDeleting(h)}>
                          <Trash2 className="size-4" />
                        </IconButton>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination {...paged} />
          </>
        )}
      </Card>

      {editing && <HostEditor key={editing.host.hostUid || 'new'} initial={editing.host} isNew={editing.isNew} onClose={() => setEditing(null)} />}
      {detail && <HostDetail host={detail} onClose={() => { setDetailUid(null); if (params.get('uid')) navigate('hosts') }} onEdit={() => setEditing({ host: detail, isNew: false })} />}
      <ConfirmDialog
        open={!!deleting}
        title={`删除主播「${deleting?.hostName}」？`}
        danger
        confirmText="删除"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const r = actions.deleteHost(deleting!.hostUid)
          toast(r.message ?? '', r.ok ? 'success' : 'danger')
          setDeleting(null)
        }}
      >
        删除后该主播的别名立即失效，观众将无法再向其转分。历史流水与温度值记录会保留。如只是暂停合作，建议关闭「转分」和「采集」。
      </ConfirmDialog>
    </>
  )
}

/* ---------- Alias chip input (shared) ---------- */

export function AliasEditor({ aliases, onChange, ownerUid, otherHosts }: { aliases: string[]; onChange: (a: string[]) => void; ownerUid: string; otherHosts: Host[] }) {
  const { db } = useDb()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const add = () => {
    const pseudo = [...otherHosts, { hostUid: ownerUid, hostName: '', aliases } as unknown as Host]
    const err = validateAlias(value, pseudo, db.rules, ownerUid)
    if (err) return setError(err)
    onChange([...aliases, value.trim()])
    setValue('')
    setError(null)
  }
  return (
    <Field label="转分别名" hint={`观众发送「${db.rules.commandPrefix}别名数量」转分；不区分大小写，不能以数字结尾，最多 ${db.rules.aliasMaxLength} 字`} error={error}>
      {(id) => (
        <div className="space-y-2.5">
          <div className="flex gap-2">
            <TextInput
              id={id}
              className="flex-1"
              value={value}
              invalid={!!error}
              onChange={(e) => { setValue(e.target.value); setError(null) }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
              placeholder="输入别名后回车添加"
            />
            <Button theme="light" onClick={add} icon={<Plus className="size-4" />}>
              添加
            </Button>
          </div>
          <div className="flex min-h-8 flex-wrap gap-2">
            {aliases.length === 0 && <span className="text-caption text-muted">暂无别名，观众只能使用完整昵称转分</span>}
            {aliases.map((a) => (
              <span key={a} className="inline-flex h-8 items-center gap-1 rounded-full bg-brand-soft pr-1 pl-3 text-caption font-semibold text-brand-ink">
                {a}
                <button type="button" aria-label={`移除别名 ${a}`} onClick={() => onChange(aliases.filter((x) => x !== a))} className="flex size-6 cursor-pointer items-center justify-center rounded-full hover:bg-card">
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </Field>
  )
}

function HostEditor({ initial, isNew, onClose }: { initial: Host; isNew: boolean; onClose: () => void }) {
  const { db, actions } = useDb()
  const toast = useToast()
  const hasActiveSeason = !!activeSeason(db.seasons)
  const [h, setH] = useState<Host>(initial)
  const [touched, setTouched] = useState(false)
  const [lookupState, setLookupState] = useState<'idle' | 'found' | 'not_found'>(isNew ? 'idle' : 'found')
  const set = <K extends keyof Host>(k: K, v: Host[K]) => setH((p) => ({ ...p, [k]: v }))
  const others = db.hosts.filter((x) => x.hostUid !== initial.hostUid)
  const recognizeRoom = (roomId: string) => {
    const value = roomId.replace(/\D/g, '')
    if (value.length < 5) {
      setH((p) => ({ ...p, roomId: value, hostUid: '', douyuUid: '', hostName: '' }))
      setLookupState('idle')
      return
    }
    const found = db.hosts.find((x) => x.roomId === value) ?? DEMO_DOUYU_ROOMS[value]
    if (!found) {
      setH((p) => ({ ...p, roomId: value, hostUid: '', douyuUid: '', hostName: '' }))
      setLookupState('not_found')
      return
    }
    setH((p) => ({ ...p, roomId: value, hostUid: found.hostUid, douyuUid: found.douyuUid, hostName: found.hostName, aliases: p.aliases.length ? p.aliases : [] }))
    setLookupState('found')
  }
  const errors = {
    guildName: !h.guildName.trim() ? '请输入所属公会' : null,
    hostName: !h.hostName.trim() ? '请输入主播昵称' : others.some((o) => o.hostName === h.hostName.trim() || o.aliases.some((a) => a.toLowerCase() === h.hostName.trim().toLowerCase())) ? '与其他主播的昵称或别名重复' : null,
    hostUid: !/^H\d{4,}$/.test(h.hostUid) ? '格式为 H + 数字，例如 H11702' : isNew && db.hosts.some((x) => x.hostUid === h.hostUid) ? 'UID 已存在' : null,
    douyuUid: !/^U\d{3,}$/.test(h.douyuUid) ? '格式为 U + 数字，例如 U10231' : db.hosts.some((x) => x.douyuUid === h.douyuUid && x.hostUid !== h.hostUid) ? '该斗鱼 UID 已绑定其他主播' : null,
    roomId: !/^\d{5,9}$/.test(h.roomId) ? '请输入 5–9 位斗鱼房间号' : others.some((o) => o.roomId === h.roomId) ? '该房间号已被其他主播使用' : null,
  }
  const valid = !Object.values(errors).some(Boolean)
  const isGroupLeader = db.rules.bindRoomHostUid === h.hostUid
  const save = () => {
    setTouched(true)
    if (!valid) return
    const inSeason = hasActiveSeason && h.inSeason
    const r = actions.saveHost({ ...h, hostName: h.hostName.trim(), guildName: h.guildName.trim(), inSeason, teamId: inSeason ? h.teamId : undefined, isCaptain: inSeason && !!h.teamId && !isGroupLeader ? !!h.isCaptain : false }, isNew)
    toast(r.message ?? '', r.ok ? 'success' : 'danger')
    if (r.ok) onClose()
  }
  return (
    <Drawer
      open
      onClose={onClose}
      title={isNew ? '新增主播' : `编辑 · ${initial.hostName}`}
      sub={isNew ? '添加后将自动开始采集该直播间消息' : `UID ${initial.hostUid} · 加入于 ${fmtDate(initial.joinedAt)}`}
      footer={
        <>
          <Button theme="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={save}>{isNew ? '创建主播' : '保存修改'}</Button>
        </>
      }
    >
      <div className="space-y-5">
        <Card className="space-y-4">
          <div className="text-caption font-bold text-ink">基础信息</div>
          <Field label="主播昵称" required error={touched ? errors.hostName : null} hint={isNew ? '输入房间号后自动识别' : undefined}>
            {(id) => <TextInput id={id} value={h.hostName} disabled={isNew} onChange={(e) => set('hostName', e.target.value)} placeholder={isNew ? '等待识别' : '与斗鱼昵称保持一致'} invalid={touched && !!errors.hostName} />}
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="主播 UID" required error={touched ? errors.hostUid : null} hint={isNew ? undefined : '创建后不可修改'}>
              {(id) => <TextInput id={id} value={h.hostUid} disabled onChange={(e) => set('hostUid', e.target.value.trim().toUpperCase())} placeholder="自动识别" invalid={touched && !!errors.hostUid} />}
            </Field>
            <Field label="斗鱼 UID" required error={touched ? errors.douyuUid : null} hint={isNew ? '根据房间号自动识别' : '用于绑定身份识别'}>
              {(id) => <TextInput id={id} value={h.douyuUid} disabled={isNew} onChange={(e) => set('douyuUid', e.target.value.trim().toUpperCase())} placeholder={isNew ? '等待识别' : 'U10231'} invalid={touched && !!errors.douyuUid} />}
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="斗鱼房间号" required error={touched ? errors.roomId : null} hint={isNew ? '输入后自动识别昵称和 UID' : undefined}>
              {(id) => <TextInput id={id} value={h.roomId} inputMode="numeric" onChange={(e) => isNew ? recognizeRoom(e.target.value) : set('roomId', e.target.value.replace(/\D/g, ''))} placeholder="例如 7742101" invalid={touched && !!errors.roomId} />}
            </Field>
          </div>
          {isNew && lookupState === 'found' && <Notice theme="success">已识别主播：{h.hostName}（斗鱼 UID {h.douyuUid}）</Notice>}
          {isNew && lookupState === 'not_found' && <Notice theme="warning">暂未识别该房间号。原型演示可使用 7742101、7742102 或 7742103；正式环境将由斗鱼接口查询。</Notice>}
        </Card>
        <Card className="space-y-4">
          <div className="text-caption font-bold text-ink">公会与赛季</div>
          <Field label="所属公会" required hint={`填写「${GUILD_NAME}」计入本公会统计；其他公会主播可仅参加赛季`}>
            {(id) => <TextInput id={id} value={h.guildName} onChange={(e) => set('guildName', e.target.value)} placeholder={GUILD_NAME} />}
          </Field>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-body font-semibold text-ink">参加本赛季</div>
              <div className="text-caption text-muted">开启后计入「本赛季」流水与赛季流水榜，与所属公会无关</div>
            </div>
            <Switch checked={hasActiveSeason && h.inSeason} disabled={!hasActiveSeason} onChange={(v) => set('inSeason', v)} label="参加本赛季" />
          </div>
          {!hasActiveSeason && <Notice theme="warning">当前无进行中的赛季，参赛状态和队伍 / 身份统一显示为“无”。</Notice>}
          {hasActiveSeason && h.inSeason && (
            <>
              <Field label="参赛队伍" hint="队伍名称与颜色可在「规则配置 · 赛季队伍」中自定义">
                {(id) => (
                  <Select
                    id={id}
                    value={h.teamId ?? 'none'}
                    onChange={(e) => {
                      const teamId = e.target.value === 'none' ? undefined : e.target.value as Host['teamId']
                      setH((p) => ({ ...p, teamId, isCaptain: teamId ? p.isCaptain : false }))
                    }}
                    aria-label="参赛队伍"
                  >
                    <option value="none">无</option>
                    {db.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                  </Select>
                )}
              </Field>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-body font-semibold text-ink">队长</div>
                  <div className="text-caption text-muted">仅队长显示队长标签，标签颜色跟随所属队伍</div>
                </div>
                <Switch checked={!isGroupLeader && !!h.teamId && !!h.isCaptain} disabled={isGroupLeader || !h.teamId} onChange={(v) => set('isCaptain', v)} label="设置为队长" />
              </div>
            </>
          )}
          {isGroupLeader && <Notice theme="warning">该主播绑定为主直播间主播，只保留“团长”身份，不能设置为队长。</Notice>}
        </Card>
        <Card>
          <AliasEditor aliases={h.aliases} onChange={(a) => set('aliases', a)} ownerUid={h.hostUid || '__new__'} otherHosts={others} />
        </Card>
        <Card className="space-y-4">
          <div className="text-caption font-bold text-ink">开关</div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-body font-semibold text-ink">允许转分</div>
              <div className="text-caption text-muted">关闭后别名将不再被识别，命令记为「别名无效」</div>
            </div>
            <Switch checked={h.enabled} onChange={(v) => set('enabled', v)} label="允许转分" />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-body font-semibold text-ink">采集直播间消息</div>
              <div className="text-caption text-muted">采集弹幕、礼物用于流水统计与温度值入账</div>
            </div>
            <Switch checked={h.collect} onChange={(v) => set('collect', v)} label="采集直播间消息" />
          </div>
        </Card>
        <Card>
          <Field label="备注" hint="仅后台可见">
            {(id) => <Textarea id={id} value={h.note} onChange={(e) => set('note', e.target.value)} placeholder="例如合约信息、别名协调说明" />}
          </Field>
        </Card>
      </div>
    </Drawer>
  )
}

function HostDetail({ host: h, onClose, onEdit }: { host: Host; onClose: () => void; onEdit: () => void }) {
  const { db } = useDb()
  const toast = useToast()
  const season = activeSeason(db.seasons)
  const inSeason = !!season && h.inSeason
  const [tab, setTab] = useState<'senders' | 'transfers' | 'points'>('senders')
  const daily = hostDaily(h, 30)
  const senders = useMemo(() => {
    const map = new Map<string, { name: string; uid: string; amount: number; count: number }>()
    db.gifts.filter((g) => g.hostUid === h.hostUid).forEach((g) => {
      const e = map.get(g.senderUid) ?? { name: g.senderName, uid: g.senderUid, amount: 0, count: 0 }
      e.amount += g.amount
      e.count += 1
      map.set(g.senderUid, e)
    })
    return [...map.values()].sort((a, b) => b.amount - a.amount).slice(0, 8)
  }, [db.gifts, h.hostUid])
  const received = db.transfers.filter((t) => t.targetHostUid === h.hostUid).slice(0, 8)
  const pointChanges = db.hostPoints.filter((p) => p.hostUid === h.hostUid).slice(0, 12)
  const cmd = `${db.rules.commandPrefix}${h.aliases[0] ?? h.hostName}100`
  const collector = db.collectors.find((c) => c.hostUid === h.hostUid)

  return (
    <Drawer
      open
      onClose={onClose}
      width="w-[640px]"
      title={
        <span className="flex items-center gap-2">
          {h.hostName} <LiveTag state={h.liveState} />
        </span>
      }
      sub={`${h.hostUid} · 房间 ${h.roomId} · ${h.guildName}公会 · ${inSeason ? '本赛季参赛' : '未参赛'} · 加入于 ${fmtDate(h.joinedAt)}`}
      footer={
        <>
          <Button theme="light" icon={<ArrowRightLeft className="size-4" />} onClick={() => navigate(`transfers?host=${h.hostUid}`)}>
            转分记录
          </Button>
          <Button icon={<Pencil className="size-4" />} onClick={onEdit}>
            编辑主播
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <HostIdentityTags host={h} teams={db.teams} bindRoomHostUid={db.rules.bindRoomHostUid} seasonActive={!!season} />
        </div>
        {!h.enabled && <Notice theme="warning">该主播已关闭转分，观众发送的转分命令将被记为「别名无效」。</Notice>}
        {collector && collector.state !== 'ok' && <Notice theme={collector.state === 'down' ? 'danger' : 'warning'}>{collector.state === 'down' ? '直播间采集已停止，流水与温度值不会更新。' : `采集延迟 ${collector.latencyMs}ms，数据可能滞后。`}</Notice>}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: '今日流水', value: `¥${fmt(h.todayAmount)}`, sub: '今日 00:00 起' },
            { label: '本赛季流水', value: inSeason ? `¥${fmt(hostAmount(h, 'season', season))}` : '未参赛', sub: inSeason ? `${season!.name}` : '不计入赛季统计' },
            { label: '当前温度值', value: fmt(h.currentPoints), sub: '观众转入 − 已消费' },
          ].map((k) => (
            <Card key={k.label} className="p-4">
              <div className="text-micro text-muted">{k.label}</div>
              <div className="mt-1 font-num text-title font-extrabold text-ink">{k.value}</div>
              <div className="text-micro text-muted">{k.sub}</div>
            </Card>
          ))}
        </div>
        <Inset className="grid grid-cols-2 divide-x divide-line py-3.5">
          <div className="text-center">
            <div className="text-micro text-muted">近 7 日弹幕</div>
            <div className="font-num text-section font-bold text-ink">{fmt(hostDanmu(h, 'week'))}</div>
          </div>
          <div className="text-center">
            <div className="text-micro text-muted">近 7 日送礼人数</div>
            <div className="font-num text-section font-bold text-ink">{fmt(hostGivers(h, 'week'))}</div>
          </div>
        </Inset>
        <Card>
          <CardTitle title="近 30 日流水" sub="元" />
          <LineChart series={[{ name: '流水', data: daily }]} labels={dayLabels(30)} height={180} unit=" 元" />
        </Card>
        <Card>
          <CardTitle title="转分别名" sub="观众在任意已配置直播间发送命令即可转分" />
          <div className="flex flex-wrap gap-2">
            {h.aliases.length ? h.aliases.map((a) => <Tag key={a} theme="brand">{a}</Tag>) : <span className="text-caption text-muted">未设置别名</span>}
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-control bg-page px-4 py-3 shadow-inset-sm">
            <span className="text-micro text-muted">示例命令</span>
            <span className="flex-1 font-num text-section font-bold text-ink">{cmd}</span>
            <Button
              theme="light"
              size="small"
              icon={<Copy className="size-3.5" />}
              onClick={() => {
                navigator.clipboard?.writeText(cmd).catch(() => {})
                toast(`已复制 ${cmd}`)
              }}
            >
              复制
            </Button>
          </div>
        </Card>
        <Card flush>
          <div className="flex gap-2 px-5 pt-4">
            <Segment
              value={tab}
              onChange={setTab}
              items={[
                { value: 'senders', label: '近 7 日送礼榜' },
                { value: 'transfers', label: '最近收到转分' },
                { value: 'points', label: '温度值变动' },
              ]}
            />
          </div>
          <div className="px-2 py-3">
            {tab === 'senders' &&
              (senders.length ? (
                senders.map((s, i) => (
                  <button key={s.uid} type="button" onClick={() => navigate(`points?uid=${s.uid}`)} className="flex w-full cursor-pointer items-center gap-3 rounded-control px-3 py-2.5 text-left hover:bg-page">
                    <span className={cx('w-5 text-center font-num font-extrabold', i === 0 ? 'text-brand-ink' : 'text-muted')}>{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-body font-semibold text-ink">{s.name}</div>
                      <div className="font-num text-micro text-muted">
                        {s.uid} · 送礼 {s.count} 次
                      </div>
                    </div>
                    <span className="font-num font-bold text-ink">¥{fmt(s.amount)}</span>
                  </button>
                ))
              ) : (
                <Empty title="暂无送礼记录" />
              ))}
            {tab === 'transfers' &&
              (received.length ? (
                received.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 rounded-control px-3 py-2.5 hover:bg-page">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-body text-ink">
                        <span className="font-semibold">{t.senderName}</span> <span className="font-num text-muted">{t.raw}</span>
                      </div>
                      <div className="font-num text-micro text-muted">{fmtDateTime(t.time)}</div>
                    </div>
                    <span className="font-num font-bold text-ink">{t.amount ? `+${fmt(t.amount)}` : '—'}</span>
                    <TransferStatusTag status={t.status} />
                  </div>
                ))
              ) : (
                <Empty title="暂无转分记录" />
              ))}
            {tab === 'points' &&
              (pointChanges.length ? (
                pointChanges.map((p) => {
                  const Icon = p.kind === 'in' ? ArrowDownLeft : p.kind === 'spend' ? ShoppingBag : Undo2
                  return (
                    <div key={p.id} className="flex items-center gap-3 rounded-control px-3 py-2.5 hover:bg-page">
                      <span className={cx('flex size-8 shrink-0 items-center justify-center rounded-full', p.kind === 'in' ? 'bg-success-soft text-success' : p.kind === 'spend' ? 'bg-warning-soft text-warning' : 'bg-danger-soft text-danger')}>
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-body font-semibold text-ink">{p.title}</div>
                        <div className="truncate font-num text-micro text-muted">
                          {p.detail} · {fmtDateTime(p.time)}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className={cx('font-num font-bold', p.delta > 0 ? 'text-success' : 'text-ink')}>
                          {p.delta > 0 ? '+' : ''}
                          {fmt(p.delta)}
                        </div>
                        <div className="font-num text-micro text-muted">余额 {fmt(p.balance)}</div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <Empty title="暂无温度值变动" />
              ))}
          </div>
        </Card>
        {h.note && (
          <Card>
            <div className="text-micro text-muted">备注</div>
            <div className="mt-1 text-body text-ink">{h.note}</div>
          </Card>
        )}
      </div>
    </Drawer>
  )
}
