import { useEffect, useMemo, useState } from 'react'
import { Ban, Check, Clock, Coins, FileWarning, Link2, LinkIcon, MessageSquareWarning, ShieldCheck, Snowflake, Unlink, UserPlus, Users, X } from 'lucide-react'
import { useDb } from '@/lib/store'
import type { Appeal, AppealType, Viewer } from '@/lib/types'
import { activeSeason, cx, downloadCsv, fmt, fmtDate, fmtDateTime, fmtRelative, maskOpenId } from '@/lib/utils'
import { navigate, useRoute } from '@/lib/router'
import {
  Avatar,
  Button,
  Card,
  ConfirmDialog,
  Empty,
  Field,
  IconButton,
  LineTabs,
  Modal,
  Notice,
  PageHeader,
  Pagination,
  SearchInput,
  Segment,
  StatCard,
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
import { ViewerStatusTag } from './shared'

type Tab = 'accounts' | 'hostReviews' | 'codes' | 'appeals'

export function Bindings() {
  const { db } = useDb()
  const { params } = useRoute()
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab) || 'accounts')
  useEffect(() => {
    const t = params.get('tab') as Tab | null
    if (t) setTab(t)
  }, [params])
  const [manualOpen, setManualOpen] = useState(false)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const bindRoom = db.hosts.find((h) => h.hostUid === db.rules.bindRoomHostUid)

  return (
    <>
      <PageHeader
        eyebrow="观众与温度值"
        title="绑定管理"
        desc={`用户在小程序生成 6 位绑定码（${db.rules.bindCodeTTL} 分钟有效），在主直播间「${bindRoom?.hostName ?? '未设置'}」用本人斗鱼账号发送后完成绑定；观众还需存在一笔单次礼物金额 ≥${db.rules.bindMinSingleGiftAmount} 元；当前赛季参赛主播免除该条件，但仍需额外通过后台审核。`}
        actions={
          <Button icon={<UserPlus className="size-4" />} onClick={() => setManualOpen(true)}>
            人工绑定
          </Button>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-5 lg:grid-cols-5">
        <StatCard icon={<Link2 className="size-4" />} label="已绑定账号" value={db.viewers.filter((v) => v.status === 'bound').length} unit="个" foot={`今日新增 ${db.viewers.filter((v) => v.status === 'bound' && new Date(v.boundAt) >= todayStart).length}`} tone="success" />
        <StatCard icon={<Snowflake className="size-4" />} label="已冻结" value={db.viewers.filter((v) => v.status === 'frozen').length} unit="个" foot="冻结账号无法转分" tone="danger" />
        <StatCard icon={<Clock className="size-4" />} label="等待中绑定码" value={db.bindCodes.filter((c) => c.status === 'waiting' && new Date(c.expiresAt).getTime() > Date.now()).length} unit="个" foot={`有效期 ${db.rules.bindCodeTTL} 分钟`} onClick={() => setTab('codes')} />
        <StatCard icon={<ShieldCheck className="size-4" />} label="待审核主播绑定" value={db.viewers.filter((v) => v.hostBindingReview === 'pending').length} unit="个" foot="当前赛季参赛主播" tone="warning" onClick={() => setTab('hostReviews')} />
        <StatCard icon={<MessageSquareWarning className="size-4" />} label="待审核申诉" value={db.appeals.filter((a) => a.status === 'pending').length} unit="条" foot="换号 / 解绑 / 温度值申诉" tone="warning" onClick={() => setTab('appeals')} />
      </div>
      <Card flush>
        <div className="px-6 pt-2">
          <LineTabs
            value={tab}
            onChange={setTab}
            items={[
              { value: 'accounts', label: '绑定账号', badge: db.viewers.length },
              { value: 'hostReviews', label: '主播绑定审核', badge: db.viewers.filter((v) => v.hostBindingReview === 'pending').length },
              { value: 'codes', label: '绑定码记录', badge: db.bindCodes.filter((c) => c.status === 'waiting').length },
              { value: 'appeals', label: '换号与申诉', badge: db.appeals.filter((a) => a.status === 'pending').length },
            ]}
          />
        </div>
        {tab === 'accounts' && <Accounts />}
        {tab === 'hostReviews' && <HostReviews />}
        {tab === 'codes' && <Codes />}
        {tab === 'appeals' && <Appeals />}
      </Card>
      <ManualBind open={manualOpen} onClose={() => setManualOpen(false)} />
    </>
  )
}

function Accounts() {
  const { db, actions } = useDb()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'all' | Viewer['status']>('all')
  const [action, setAction] = useState<{ v: Viewer; kind: 'unbind' | 'freeze' | 'unfreeze' | 'restore' } | null>(null)
  const rows = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return db.viewers
      .filter((v) => status === 'all' || v.status === status)
      .filter((v) => !kw || [v.douyuName, v.douyuUid, v.openId, v.wechatName].some((x) => x.toLowerCase().includes(kw)))
      .sort((a, b) => b.boundAt.localeCompare(a.boundAt))
  }, [db.viewers, q, status])
  const paged = usePaged(rows, 10)

  const meta = action
    ? {
        unbind: { title: `解除「${action.v.douyuName}」的绑定？`, text: '解绑后该微信无法查看个人温度值，斗鱼账号的转分命令将被忽略。温度值余额保留，重新绑定后恢复。', btn: '解除绑定', danger: true, next: 'unbound' as const },
        freeze: { title: `冻结「${action.v.douyuName}」？`, text: '冻结后该账号送礼仍会累计温度值，但转分命令会被拒绝，直到解除冻结。适用于疑似盗号或异常刷分。', btn: '冻结账号', danger: true, next: 'frozen' as const },
        unfreeze: { title: `解除冻结「${action.v.douyuName}」？`, text: '解除后账号恢复正常转分。', btn: '解除冻结', danger: false, next: 'bound' as const },
        restore: { title: `恢复「${action.v.douyuName}」的绑定？`, text: '将恢复与原微信的绑定关系。', btn: '恢复绑定', danger: false, next: 'bound' as const },
      }[action.kind]
    : null

  return (
    <>
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="搜索斗鱼昵称、UID 或 openid" />
        <Segment
          value={status}
          onChange={setStatus}
          items={[
            { value: 'all', label: '全部' },
            { value: 'bound', label: '已绑定' },
            { value: 'frozen', label: '已冻结' },
            { value: 'unbound', label: '已解绑' },
          ]}
        />
        <div className="flex-1" />
        <Button
          theme="light"
          onClick={() => downloadCsv(`绑定账号_${fmtDate(new Date().toISOString())}.csv`, ['斗鱼UID', '斗鱼昵称', '微信昵称', 'openid', '账号状态', '身份审核', '绑定时间', '温度值余额'], rows.map((v) => [v.douyuUid, v.douyuName, v.wechatName, maskOpenId(v.openId), v.status, v.hostBindingReview, fmtDateTime(v.boundAt, true), v.balance]))}
        >
          导出
        </Button>
      </Toolbar>
      {rows.length === 0 ? (
        <Empty title="没有匹配的绑定账号" />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>斗鱼账号</Th>
                <Th>微信身份</Th>
                <Th>身份识别</Th>
                <Th>状态</Th>
                <Th>绑定时间</Th>
                <Th align="right">温度值余额</Th>
                <Th>最近活跃</Th>
                <Th align="right">操作</Th>
              </tr>
            </thead>
            <tbody>
              {paged.slice.map((v, i) => (
                <Tr key={v.douyuUid}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={v.douyuName} index={i} size="sm" />
                      <div className="min-w-0">
                        <div className="max-w-48 truncate font-semibold text-ink">{v.douyuName}</div>
                        <div className="font-num text-micro text-muted">{v.douyuUid}</div>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <div className="text-ink">{v.wechatName}</div>
                    <div className="font-num text-micro text-muted">{maskOpenId(v.openId)}</div>
                  </Td>
                  <Td>
                    {v.hostBindingReview === 'pending' ? <Tag theme="warning">主播待审核</Tag> : v.hostBindingReview === 'approved' ? <Tag theme="success">当前赛季主播</Tag> : v.hostBindingReview === 'rejected' ? <Tag theme="danger">主播审核未通过</Tag> : <Tag>观众</Tag>}
                  </Td>
                  <Td>
                    <ViewerStatusTag status={v.status} />
                  </Td>
                  <Td className="font-num text-caption text-ink">{fmtDateTime(v.boundAt, true)}</Td>
                  <Td align="right" className="font-num font-bold text-ink">
                    {fmt(v.balance)}
                  </Td>
                  <Td className="text-caption text-muted">{fmtRelative(v.lastActive)}</Td>
                  <Td align="right">
                    <div className="flex justify-end gap-2">
                      <IconButton label="查看温度值" size="sm" onClick={() => navigate(`points?uid=${v.douyuUid}`)}>
                        <Coins className="size-4" />
                      </IconButton>
                      {v.status === 'bound' && (
                        <>
                          <IconButton label="冻结" size="sm" onClick={() => setAction({ v, kind: 'freeze' })}>
                            <Ban className="size-4" />
                          </IconButton>
                          <IconButton label="解除绑定" size="sm" tone="danger" onClick={() => setAction({ v, kind: 'unbind' })}>
                            <Unlink className="size-4" />
                          </IconButton>
                        </>
                      )}
                      {v.status === 'frozen' && (
                        <Button theme="light" size="small" onClick={() => setAction({ v, kind: 'unfreeze' })}>
                          解除冻结
                        </Button>
                      )}
                      {v.status === 'unbound' && (
                        <Button theme="light" size="small" icon={<LinkIcon className="size-3.5" />} onClick={() => setAction({ v, kind: 'restore' })}>
                          恢复
                        </Button>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <Pagination {...paged} />
        </>
      )}
      <ConfirmDialog
        open={!!action}
        title={meta?.title ?? ''}
        danger={meta?.danger}
        confirmText={meta?.btn}
        requireReason="操作原因"
        onCancel={() => setAction(null)}
        onConfirm={(reason) => {
          actions.setViewerStatus(action!.v.douyuUid, meta!.next, reason)
          toast(`${meta!.btn}成功`)
          setAction(null)
        }}
      >
        {meta?.text}
      </ConfirmDialog>
    </>
  )
}

function useNow(interval = 1000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), interval)
    return () => clearInterval(t)
  }, [interval])
  return now
}

function HostReviews() {
  const { db, actions } = useDb()
  const toast = useToast()
  const season = activeSeason(db.seasons)
  const [review, setReview] = useState<{ viewer: Viewer; approve: boolean } | null>(null)
  const [reason, setReason] = useState('')
  const rows = season
    ? db.viewers.filter((v) => v.hostBindingReview === 'pending' && db.hosts.some((h) => h.inSeason && h.douyuUid === v.douyuUid))
    : []

  return (
    <>
      <div className="px-6 pt-5">
        <Notice theme="warning" icon={<ShieldCheck className="size-4" />}>
          只有当前进行中的赛季参赛主播绑定时需要审核。审核通过后，小程序才会展示主播商店和主播背包权限；审核前按观众处理。
        </Notice>
      </div>
      {!season ? (
        <Empty title="当前无进行中的赛季" description="没有赛季时不会产生主播绑定审核申请。" />
      ) : rows.length === 0 ? (
        <Empty title="暂无待审核的主播绑定" description="新的参赛主播绑定申请会显示在这里。" icon={<Check className="size-6" />} />
      ) : (
        <div className="grid grid-cols-1 gap-4 px-6 py-5 lg:grid-cols-2">
          {rows.map((v, i) => {
            const host = db.hosts.find((h) => h.douyuUid === v.douyuUid)
            return (
              <div key={v.douyuUid} className="rounded-card bg-page p-5 shadow-inset-sm">
                <div className="flex items-center gap-3">
                  <Avatar name={v.douyuName} index={i} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-ink">{v.douyuName}</div>
                    <div className="font-num text-micro text-muted">{v.douyuUid} · {maskOpenId(v.openId)}</div>
                  </div>
                  <Tag theme="warning">待审核</Tag>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 rounded-control bg-card p-3.5 shadow-raised-sm">
                  <div><div className="text-micro text-muted">参赛主播</div><div className="mt-0.5 font-semibold text-ink">{host?.hostName ?? '—'}</div></div>
                  <div><div className="text-micro text-muted">当前赛季</div><div className="mt-0.5 font-semibold text-ink">{season.name}</div></div>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button theme="danger" size="small" icon={<X className="size-3.5" />} onClick={() => { setReview({ viewer: v, approve: false }); setReason('') }}>驳回</Button>
                  <Button size="small" icon={<Check className="size-3.5" />} onClick={() => { setReview({ viewer: v, approve: true }); setReason('') }}>通过</Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <Modal
        open={!!review}
        onClose={() => setReview(null)}
        title={review?.approve ? '通过主播绑定审核' : '驳回主播绑定审核'}
        desc={review ? `${review.viewer.douyuName}（${review.viewer.douyuUid}）` : ''}
        footer={
          <>
            <Button theme="outline" onClick={() => setReview(null)}>取消</Button>
            <Button theme={review?.approve ? 'primary' : 'danger-solid'} disabled={!reason.trim()} onClick={() => {
              const r = actions.reviewHostBinding(review!.viewer.douyuUid, review!.approve ? 'approved' : 'rejected', reason.trim())
              toast(r.message ?? '', r.ok ? 'success' : 'danger')
              if (r.ok) setReview(null)
            }}>{review?.approve ? '确认通过' : '确认驳回'}</Button>
          </>
        }
      >
        <Field label="审核备注" required hint="会记录在操作日志中">
          {(id) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={review?.approve ? '例如：已核验斗鱼账号归属' : '例如：无法确认当前赛季参赛身份'} />}
        </Field>
      </Modal>
    </>
  )
}

function Codes() {
  const { db, actions } = useDb()
  const toast = useToast()
  const now = useNow()
  const [filter, setFilter] = useState<'all' | 'waiting' | 'success' | 'expired' | 'cancelled'>('all')
  const effective = (c: (typeof db.bindCodes)[number]) => (c.status === 'waiting' && new Date(c.expiresAt).getTime() <= now ? 'expired' : c.status)
  const rows = db.bindCodes.filter((c) => filter === 'all' || effective(c) === filter)
  const paged = usePaged(rows, 10)
  const bindRoom = db.hosts.find((h) => h.hostUid === db.rules.bindRoomHostUid)
  const tone = { waiting: 'brand', success: 'success', expired: 'default', cancelled: 'danger' } as const
  const label = { waiting: '等待弹幕', success: '已绑定', expired: '已过期', cancelled: '已作废' }
  return (
    <>
      <div className="px-6 pt-5">
        <Notice theme="brand">
          绑定主直播间：<b>{bindRoom?.hostName ?? '未设置'}</b>（房间 {bindRoom?.roomId ?? '—'}）· 绑定码有效期 {db.rules.bindCodeTTL} 分钟。可在「规则配置」中修改。
        </Notice>
      </div>
      <Toolbar>
        <Segment
          value={filter}
          onChange={setFilter}
          items={[
            { value: 'all', label: '全部' },
            { value: 'waiting', label: '等待中' },
            { value: 'success', label: '已绑定' },
            { value: 'expired', label: '已过期' },
            { value: 'cancelled', label: '已作废' },
          ]}
        />
      </Toolbar>
      {rows.length === 0 ? (
        <Empty title="暂无绑定码记录" />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>绑定码</Th>
                <Th>微信 openid</Th>
                <Th>生成时间</Th>
                <Th>剩余有效期</Th>
                <Th>状态</Th>
                <Th>绑定斗鱼 UID</Th>
                <Th align="right">操作</Th>
              </tr>
            </thead>
            <tbody>
              {paged.slice.map((c) => {
                const st = effective(c)
                const left = Math.max(new Date(c.expiresAt).getTime() - now, 0)
                return (
                  <Tr key={c.code + c.createdAt}>
                    <Td>
                      <span className="font-num text-section font-bold tracking-[0.2em] text-ink">{c.code}</span>
                    </Td>
                    <Td className="font-num text-caption text-muted">{maskOpenId(c.openId)}</Td>
                    <Td className="font-num text-caption text-ink">{fmtDateTime(c.createdAt, true)}</Td>
                    <Td>
                      {st === 'waiting' ? (
                        <span className={cx('font-num font-bold', left < 120_000 ? 'text-danger' : 'text-brand-ink')}>
                          {String(Math.floor(left / 60000)).padStart(2, '0')}:{String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </Td>
                    <Td>
                      <Tag theme={tone[st]} dot={st === 'waiting'}>
                        {label[st]}
                      </Tag>
                    </Td>
                    <Td className="font-num text-ink">{c.douyuUid ?? <span className="text-muted">—</span>}</Td>
                    <Td align="right">
                      {st === 'waiting' ? (
                        <Button theme="danger" size="small" onClick={() => { actions.cancelBindCode(c.code); toast(`绑定码 ${c.code} 已作废`) }}>
                          作废
                        </Button>
                      ) : (
                        <span className="text-micro text-muted">—</span>
                      )}
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
          <Pagination {...paged} />
        </>
      )}
    </>
  )
}

const APPEAL_TYPE: Record<AppealType, { label: string; tone: 'brand' | 'warning' | 'danger' }> = {
  switch: { label: '换号', tone: 'brand' },
  unbind: { label: '解绑', tone: 'danger' },
  points: { label: '温度值申诉', tone: 'warning' },
}

function Appeals() {
  const { db, actions } = useDb()
  const toast = useToast()
  const [filter, setFilter] = useState<'pending' | 'handled' | 'all'>('pending')
  const [handling, setHandling] = useState<{ a: Appeal; approve: boolean } | null>(null)
  const [reply, setReply] = useState('')
  const rows = db.appeals.filter((a) => (filter === 'all' ? true : filter === 'pending' ? a.status === 'pending' : a.status !== 'pending'))

  return (
    <>
      <Toolbar>
        <Segment
          value={filter}
          onChange={setFilter}
          items={[
            { value: 'pending', label: `待处理 ${db.appeals.filter((a) => a.status === 'pending').length}` },
            { value: 'handled', label: '已处理' },
            { value: 'all', label: '全部' },
          ]}
        />
        <div className="flex-1" />
        <Tag theme="warning">换号与申诉规则待确认</Tag>
      </Toolbar>
      {rows.length === 0 ? (
        <Empty title="没有待处理的申诉" description="新的换号、解绑与温度值申诉会显示在这里" icon={<FileWarning className="size-6" />} />
      ) : (
        <div className="grid grid-cols-1 gap-4 px-6 pb-6 lg:grid-cols-2">
          {rows.map((a) => {
            const viewer = db.viewers.find((v) => v.douyuUid === a.douyuUid)
            return (
              <div key={a.id} className="flex flex-col rounded-card bg-page p-5 shadow-inset-sm">
                <div className="flex items-center gap-2">
                  <Tag theme={APPEAL_TYPE[a.type].tone}>{APPEAL_TYPE[a.type].label}</Tag>
                  <span className="font-num text-micro text-muted">{a.id}</span>
                  <span className="ml-auto text-micro text-muted">{fmtRelative(a.createdAt)}</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Users className="size-4 text-muted" aria-hidden />
                  <span className="font-semibold text-ink">{a.douyuName}</span>
                  <span className="font-num text-micro text-muted">{a.douyuUid}</span>
                  {viewer && <span className="text-micro text-muted">· 余额 {fmt(viewer.balance)}</span>}
                </div>
                <p className="mt-2 flex-1 text-body text-ink">{a.content}</p>
                {a.status === 'pending' ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {a.type === 'points' && (
                      <Button theme="text" size="small" onClick={() => navigate(`points?uid=${a.douyuUid}`)}>
                        查看温度值流水
                      </Button>
                    )}
                    <div className="flex-1" />
                    <Button theme="danger" size="small" onClick={() => { setHandling({ a, approve: false }); setReply('') }}>
                      驳回
                    </Button>
                    <Button size="small" onClick={() => { setHandling({ a, approve: true }); setReply('') }}>
                      通过
                    </Button>
                  </div>
                ) : (
                  <div className="mt-4 rounded-control bg-card px-3.5 py-2.5 shadow-raised-sm">
                    <div className="flex items-center gap-2">
                      <Tag theme={a.status === 'approved' ? 'success' : 'danger'}>{a.status === 'approved' ? '已通过' : '已驳回'}</Tag>
                      <span className="text-micro text-muted">{fmtDateTime(a.handledAt)}</span>
                    </div>
                    {a.reply && <div className="mt-1.5 text-caption text-muted">回复：{a.reply}</div>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      <Modal
        open={!!handling}
        onClose={() => setHandling(null)}
        title={handling?.approve ? '通过申诉' : '驳回申诉'}
        desc={handling ? `${APPEAL_TYPE[handling.a.type].label} · ${handling.a.douyuName}（${handling.a.douyuUid}）` : ''}
        footer={
          <>
            <Button theme="outline" onClick={() => setHandling(null)}>
              取消
            </Button>
            <Button
              theme={handling?.approve ? 'primary' : 'danger-solid'}
              disabled={!reply.trim()}
              onClick={() => {
                const { a, approve } = handling!
                actions.handleAppeal(a.id, approve ? 'approved' : 'rejected', reply.trim())
                if (approve && a.type === 'unbind') actions.setViewerStatus(a.douyuUid, 'unbound', `申诉 ${a.id} 通过`)
                toast(approve ? '已通过申诉' : '已驳回申诉')
                setHandling(null)
              }}
            >
              {handling?.approve ? '确认通过' : '确认驳回'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 pb-2">
          <div className="rounded-control bg-page p-3.5 text-body text-ink shadow-inset-sm">{handling?.a.content}</div>
          {handling?.approve && handling.a.type === 'unbind' && <Notice theme="warning">通过后将自动解除该账号绑定。</Notice>}
          {handling?.approve && handling.a.type === 'points' && <Notice theme="brand">如需补发或撤销温度值，请在「温度值账户」或「转分记录」中操作，审核结果仅作记录。</Notice>}
          {handling?.approve && handling.a.type === 'switch' && <Notice theme="brand">通过后请指引用户使用新账号重新生成绑定码；如需迁移温度值请使用人工调整。</Notice>}
          <Field label="回复用户" required hint="将展示在小程序申诉记录中">
            {(id) => <Textarea id={id} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={handling?.approve ? '例如：已为你补发温度值' : '例如：无法确认账号归属'} />}
          </Field>
        </div>
      </Modal>
    </>
  )
}

function ManualBind({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { actions } = useDb()
  const toast = useToast()
  const [form, setForm] = useState({ openId: '', douyuUid: '', douyuName: '', reason: '' })
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (open) {
      setForm({ openId: '', douyuUid: '', douyuName: '', reason: '' })
      setError(null)
    }
  }, [open])
  const submit = () => {
    if (form.openId.length < 10) return setError('请输入完整的微信 openid')
    if (!/^U\d{3,}$/.test(form.douyuUid)) return setError('斗鱼 UID 格式为 U + 数字')
    if (!form.douyuName.trim()) return setError('请输入斗鱼昵称')
    if (!form.reason.trim()) return setError('请填写人工绑定原因')
    const r = actions.manualBind({ ...form, douyuName: form.douyuName.trim(), reason: form.reason.trim() })
    if (!r.ok) return setError(r.message)
    toast(r.message ?? '')
    onClose()
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="人工绑定"
      desc="仅在用户无法通过弹幕完成绑定、且已核实账号归属时使用"
      footer={
        <>
          <Button theme="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={submit}>确认绑定</Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        <Field label="微信 openid" required>
          {(id) => <TextInput id={id} value={form.openId} onChange={(e) => setForm({ ...form, openId: e.target.value.trim() })} placeholder="oX3k…" />}
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="斗鱼 UID" required>
            {(id) => <TextInput id={id} value={form.douyuUid} onChange={(e) => setForm({ ...form, douyuUid: e.target.value.trim().toUpperCase() })} placeholder="U5821" />}
          </Field>
          <Field label="斗鱼昵称" required>
            {(id) => <TextInput id={id} value={form.douyuName} onChange={(e) => setForm({ ...form, douyuName: e.target.value })} />}
          </Field>
        </div>
        <Field label="原因" required error={error}>
          {(id) => <Textarea id={id} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="将记录在操作日志中" />}
        </Field>
      </div>
    </Modal>
  )
}
