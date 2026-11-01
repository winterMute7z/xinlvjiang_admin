import { useEffect, useMemo, useState } from 'react'
import { ArrowRightLeft, Coins, Download, Gift, History, PencilLine, RotateCcw, SlidersHorizontal, Wallet } from 'lucide-react'
import { useDb } from '@/lib/store'
import type { LedgerType, Viewer } from '@/lib/types'
import { cx, downloadCsv, fmt, fmtDate, fmtDateTime, fmtRelative } from '@/lib/utils'
import { navigate, useRoute } from '@/lib/router'
import {
  Avatar,
  Button,
  Card,
  Drawer,
  Empty,
  Field,
  IconBadge,
  IconButton,
  Inset,
  LineTabs,
  Modal,
  Notice,
  PageHeader,
  Pagination,
  SearchInput,
  Segment,
  Select,
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

export const LEDGER_META: Record<LedgerType, { label: string; tone: 'warning' | 'brand' | 'success' | 'danger' | 'default'; icon: typeof Gift }> = {
  gift: { label: '送礼获得', tone: 'warning', icon: Gift },
  transfer: { label: '转分支出', tone: 'brand', icon: ArrowRightLeft },
  adjust: { label: '人工调整', tone: 'success', icon: SlidersHorizontal },
  revert: { label: '撤销退回', tone: 'default', icon: RotateCcw },
  reset: { label: '赛季清零', tone: 'danger', icon: History },
}

export function Points() {
  const { db } = useDb()
  const { params } = useRoute()
  const [tab, setTab] = useState<'accounts' | 'ledger'>(params.get('tab') === 'ledger' ? 'ledger' : 'accounts')
  const [detailUid, setDetailUid] = useState<string | null>(params.get('uid'))
  const [adjusting, setAdjusting] = useState<Viewer | null>(null)
  useEffect(() => {
    if (params.get('uid')) setDetailUid(params.get('uid'))
    if (params.get('tab') === 'ledger') setTab('ledger')
  }, [params])

  const balance = db.viewers.reduce((s, v) => s + v.balance, 0)
  const earned = db.ledger.filter((l) => l.type === 'gift').reduce((s, l) => s + l.delta, 0)
  const transferred = db.ledger.filter((l) => l.type === 'transfer').reduce((s, l) => s - l.delta, 0)
  const adjusted = db.ledger.filter((l) => l.type === 'adjust').reduce((s, l) => s + l.delta, 0)
  const detail = db.viewers.find((v) => v.douyuUid === detailUid) ?? null

  return (
    <>
      <PageHeader eyebrow="观众与温度值" title="温度值账户" desc="观众在已配置直播间送出礼物后获得温度值（1 元礼物 = 1 温度值），观众温度值仅用于向主播转分；主播收到礼物不产生温度值，其温度值只能由观众转入，可用于吃饭、购物等消费。" />
      <div className="mb-5 grid grid-cols-2 gap-5 lg:grid-cols-4">
        <StatCard icon={<Wallet className="size-4" />} label="温度值存量" value={fmt(balance)} foot={`${db.viewers.filter((v) => v.balance > 0).length} 个账户有余额`} />
        <StatCard icon={<Gift className="size-4" />} label="近 7 日送礼发放" value={fmt(earned)} tone="warning" foot="同一礼物事件只计分一次" />
        <StatCard icon={<ArrowRightLeft className="size-4" />} label="近 7 日转分支出" value={fmt(transferred)} foot="成功的转分命令" onClick={() => navigate('transfers')} />
        <StatCard icon={<SlidersHorizontal className="size-4" />} label="人工调整净额" value={`${adjusted > 0 ? '+' : ''}${fmt(adjusted)}`} tone="success" foot="全部记录在操作日志" />
      </div>
      <Card flush>
        <div className="px-6 pt-2">
          <LineTabs
            value={tab}
            onChange={setTab}
            items={[
              { value: 'accounts', label: '温度值账户' },
              { value: 'ledger', label: '温度值流水' },
            ]}
          />
        </div>
        {tab === 'accounts' ? <AccountTable onOpen={setDetailUid} onAdjust={setAdjusting} /> : <LedgerTable />}
      </Card>
      {detail && <AccountDrawer v={detail} onClose={() => { setDetailUid(null); if (params.get('uid')) navigate('points') }} onAdjust={() => setAdjusting(detail)} />}
      <AdjustModal v={adjusting} onClose={() => setAdjusting(null)} />
    </>
  )
}

function AccountTable({ onOpen, onAdjust }: { onOpen: (uid: string) => void; onAdjust: (v: Viewer) => void }) {
  const { db } = useDb()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<'balance' | 'earned' | 'transferred' | 'active'>('balance')
  const rows = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return db.viewers
      .filter((v) => !kw || [v.douyuName, v.douyuUid].some((x) => x.toLowerCase().includes(kw)))
      .sort((a, b) => (sort === 'balance' ? b.balance - a.balance : sort === 'earned' ? b.totalEarned - a.totalEarned : sort === 'transferred' ? b.totalTransferred - a.totalTransferred : b.lastActive.localeCompare(a.lastActive)))
  }, [db.viewers, q, sort])
  const paged = usePaged(rows, 10)
  return (
    <>
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="搜索斗鱼昵称或 UID" />
        <div className="flex-1" />
        <Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="排序" className="w-40">
          <option value="balance">按可用温度值</option>
          <option value="earned">按累计获得</option>
          <option value="transferred">按累计转出</option>
          <option value="active">按最近活跃</option>
        </Select>
        <Button
          theme="light"
          icon={<Download className="size-4" />}
          onClick={() => downloadCsv(`温度值账户_${fmtDate(new Date().toISOString())}.csv`, ['斗鱼UID', '昵称', '状态', '可用温度值', '累计获得', '累计转出'], rows.map((v) => [v.douyuUid, v.douyuName, v.status, v.balance, v.totalEarned, v.totalTransferred]))}
        >
          导出
        </Button>
      </Toolbar>
      {rows.length === 0 ? (
        <Empty title="没有匹配的账户" />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>观众</Th>
                <Th>绑定状态</Th>
                <Th align="right">可用温度值</Th>
                <Th align="right">累计送礼获得</Th>
                <Th align="right">累计转出</Th>
                <Th>最近活跃</Th>
                <Th align="right">操作</Th>
              </tr>
            </thead>
            <tbody>
              {paged.slice.map((v, i) => (
                <Tr key={v.douyuUid}>
                  <Td>
                    <button type="button" onClick={() => onOpen(v.douyuUid)} className="flex cursor-pointer items-center gap-3 text-left">
                      <Avatar name={v.douyuName} index={i + 2} size="sm" />
                      <div className="min-w-0">
                        <div className="max-w-52 truncate font-semibold text-ink hover:text-brand-ink">{v.douyuName}</div>
                        <div className="font-num text-micro text-muted">{v.douyuUid}</div>
                      </div>
                    </button>
                  </Td>
                  <Td>
                    <ViewerStatusTag status={v.status} />
                  </Td>
                  <Td align="right" className="font-num text-section font-bold text-ink">
                    {fmt(v.balance)}
                  </Td>
                  <Td align="right" className="font-num text-success">
                    +{fmt(v.totalEarned)}
                  </Td>
                  <Td align="right" className="font-num text-ink">
                    {fmt(v.totalTransferred)}
                  </Td>
                  <Td className="text-caption text-muted">{fmtRelative(v.lastActive)}</Td>
                  <Td align="right">
                    <div className="flex justify-end gap-2">
                      <IconButton label="温度值流水" size="sm" onClick={() => onOpen(v.douyuUid)}>
                        <History className="size-4" />
                      </IconButton>
                      <Button theme="light" size="small" icon={<PencilLine className="size-3.5" />} onClick={() => onAdjust(v)}>
                        调整
                      </Button>
                    </div>
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

function LedgerTable() {
  const { db } = useDb()
  const [q, setQ] = useState('')
  const [type, setType] = useState<'all' | LedgerType>('all')
  const name = (uid: string) => db.viewers.find((v) => v.douyuUid === uid)?.douyuName ?? uid
  const rows = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return db.ledger.filter((l) => (type === 'all' || l.type === type) && (!kw || [l.uid, name(l.uid), l.relatedId, l.title].some((x) => x.toLowerCase().includes(kw))))
  }, [db.ledger, q, type])
  const paged = usePaged(rows, 12)
  return (
    <>
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="搜索观众、UID 或关联事件 ID" />
        <Segment
          value={type}
          onChange={setType}
          items={[
            { value: 'all', label: '全部' },
            { value: 'gift', label: '送礼获得' },
            { value: 'transfer', label: '转分支出' },
            { value: 'adjust', label: '人工调整' },
            { value: 'revert', label: '撤销退回' },
          ]}
        />
        <div className="flex-1" />
        <Button
          theme="light"
          icon={<Download className="size-4" />}
          onClick={() => downloadCsv(`温度值流水_${fmtDate(new Date().toISOString())}.csv`, ['流水ID', '时间', '斗鱼UID', '昵称', '类型', '变动', '说明', '详情', '关联事件', '操作人'], rows.map((l) => [l.id, fmtDateTime(l.time, true), l.uid, name(l.uid), LEDGER_META[l.type].label, l.delta, l.title, l.detail, l.relatedId, l.operator ?? '系统']))}
        >
          导出
        </Button>
      </Toolbar>
      {rows.length === 0 ? (
        <Empty title="没有匹配的流水" />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>时间</Th>
                <Th>观众</Th>
                <Th>类型</Th>
                <Th>说明</Th>
                <Th>关联事件</Th>
                <Th align="right">温度值变动</Th>
                <Th>操作人</Th>
              </tr>
            </thead>
            <tbody>
              {paged.slice.map((l) => (
                <Tr key={l.id}>
                  <Td className="font-num text-caption whitespace-nowrap text-ink">{fmtDateTime(l.time, true)}</Td>
                  <Td>
                    <button type="button" onClick={() => navigate(`points?uid=${l.uid}`)} className="cursor-pointer text-left">
                      <div className="max-w-40 truncate font-semibold text-ink hover:text-brand-ink">{name(l.uid)}</div>
                      <div className="font-num text-micro text-muted">{l.uid}</div>
                    </button>
                  </Td>
                  <Td>
                    <Tag theme={LEDGER_META[l.type].tone}>{LEDGER_META[l.type].label}</Tag>
                  </Td>
                  <Td>
                    <div className="text-ink">{l.title}</div>
                    <div className="max-w-72 truncate text-micro text-muted">{l.detail}</div>
                  </Td>
                  <Td className="font-num text-micro text-muted">{l.relatedId}</Td>
                  <Td align="right" className={cx('font-num text-section font-bold', l.delta > 0 ? 'text-success' : 'text-ink')}>
                    {l.delta > 0 ? '+' : ''}
                    {fmt(l.delta)}
                  </Td>
                  <Td className="text-caption text-muted">{l.operator ?? '系统'}</Td>
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

function AccountDrawer({ v, onClose, onAdjust }: { v: Viewer; onClose: () => void; onAdjust: () => void }) {
  const { db } = useDb()
  const [type, setType] = useState<'all' | 'gift' | 'transfer' | 'other'>('all')
  const entries = db.ledger.filter((l) => l.uid === v.douyuUid).filter((l) => type === 'all' || (type === 'other' ? l.type !== 'gift' && l.type !== 'transfer' : l.type === type))
  return (
    <Drawer
      open
      onClose={onClose}
      width="w-[560px]"
      title={
        <span className="flex items-center gap-2">
          {v.douyuName} <ViewerStatusTag status={v.status} />
        </span>
      }
      sub={`斗鱼 ${v.douyuUid} · 绑定于 ${fmtDateTime(v.boundAt, true)}`}
      footer={
        <>
          <Button theme="light" onClick={() => navigate(`transfers?q=${v.douyuUid}`)}>
            转分记录
          </Button>
          <Button icon={<PencilLine className="size-4" />} onClick={onAdjust}>
            调整温度值
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {v.status === 'frozen' && <Notice theme="danger">账号已冻结：送礼仍累计温度值，转分命令会被拒绝。</Notice>}
        <Card className="relative overflow-hidden">
          <div aria-hidden className="soft-orb absolute -top-8 -right-8 size-28 opacity-20" />
          <div className="relative">
            <div className="text-caption font-semibold text-muted">可用温度值</div>
            <div className="mt-1 font-num text-[36px] leading-none font-extrabold text-ink">{fmt(v.balance)}</div>
            <Inset className="mt-4 grid grid-cols-2 divide-x divide-line py-3">
              <div className="text-center">
                <div className="text-micro text-muted">累计送礼获得</div>
                <div className="font-num text-section font-bold text-success">+{fmt(v.totalEarned)}</div>
              </div>
              <div className="text-center">
                <div className="text-micro text-muted">累计转出</div>
                <div className="font-num text-section font-bold text-ink">{fmt(v.totalTransferred)}</div>
              </div>
            </Inset>
          </div>
        </Card>
        <Card flush>
          <div className="px-5 pt-4 pb-2">
            <div className="mb-3 text-section font-bold text-ink">温度值流水</div>
            <Segment
              value={type}
              onChange={setType}
              items={[
                { value: 'all', label: '全部' },
                { value: 'gift', label: '送礼获得' },
                { value: 'transfer', label: '转分支出' },
                { value: 'other', label: '调整/撤销' },
              ]}
            />
          </div>
          {entries.length === 0 ? (
            <Empty title="暂无流水" />
          ) : (
            entries.slice(0, 40).map((l, i) => {
              const M = LEDGER_META[l.type]
              return (
                <div key={l.id} className={cx('flex items-center gap-3 px-5 py-3', i < entries.length - 1 && 'border-b border-line/80')}>
                  <IconBadge tone={M.tone === 'default' ? 'brand' : M.tone} size="sm">
                    <M.icon className="size-4" />
                  </IconBadge>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-body font-semibold text-ink">{l.title}</div>
                    <div className="truncate text-caption text-muted">{l.detail}</div>
                    <div className="font-num text-micro text-muted">
                      {fmtDateTime(l.time)} · {l.relatedId}
                      {l.operator && ` · ${l.operator}`}
                    </div>
                  </div>
                  <span className={cx('shrink-0 font-num text-section font-bold', l.delta > 0 ? 'text-success' : 'text-ink')}>
                    {l.delta > 0 ? '+' : ''}
                    {fmt(l.delta)}
                  </span>
                </div>
              )
            })
          )}
        </Card>
      </div>
    </Drawer>
  )
}

const REASONS = ['采集中断期间礼物补录', '活动奖励', '转分申诉补偿', '异常刷分扣回', '其他']

function AdjustModal({ v, onClose }: { v: Viewer | null; onClose: () => void }) {
  const { actions } = useDb()
  const toast = useToast()
  const [dir, setDir] = useState<'add' | 'sub'>('add')
  const [amount, setAmount] = useState('')
  const [preset, setPreset] = useState(REASONS[0])
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (v) {
      setDir('add')
      setAmount('')
      setPreset(REASONS[0])
      setNote('')
      setError(null)
    }
  }, [v])
  if (!v) return null
  const n = Number(amount) || 0
  const delta = dir === 'add' ? n : -n
  const after = v.balance + delta
  const submit = () => {
    if (n <= 0) return setError('请输入大于 0 的整数')
    if (n > 100000) return setError('单次调整不能超过 100,000')
    if (after < 0) return setError('扣减后余额不能为负数')
    if (preset === '其他' && !note.trim()) return setError('请填写调整说明')
    const r = actions.adjustPoints(v.douyuUid, delta, [preset, note.trim()].filter(Boolean).join(' · '))
    if (!r.ok) return setError(r.message)
    toast(r.message ?? '')
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="人工调整温度值"
      desc={`${v.douyuName}（${v.douyuUid}）· 当前可用 ${fmt(v.balance)}`}
      footer={
        <>
          <Button theme="outline" onClick={onClose}>
            取消
          </Button>
          <Button theme={dir === 'sub' ? 'danger-solid' : 'primary'} onClick={submit}>
            确认{dir === 'add' ? '补发' : '扣减'}
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        <Segment
          value={dir}
          onChange={setDir}
          items={[
            { value: 'add', label: '补发温度值' },
            { value: 'sub', label: '扣减温度值' },
          ]}
        />
        <Field label="调整数量" required error={error}>
          {(id) => <TextInput id={id} inputMode="numeric" value={amount} onChange={(e) => { setAmount(e.target.value.replace(/\D/g, '')); setError(null) }} placeholder="0" prefix={<Coins className="size-4" />} suffix="温度值" invalid={!!error} />}
        </Field>
        <Field label="调整原因" required>
          {(id) => (
            <Select id={id} value={preset} onChange={(e) => setPreset(e.target.value)}>
              {REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="补充说明" hint="例如关联礼物事件 ID、申诉编号">
          {(id) => <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} />}
        </Field>
        <Inset className="grid grid-cols-3 py-3 text-center">
          <div>
            <div className="text-micro text-muted">当前</div>
            <div className="font-num font-bold text-ink">{fmt(v.balance)}</div>
          </div>
          <div>
            <div className="text-micro text-muted">变动</div>
            <div className={cx('font-num font-bold', delta >= 0 ? 'text-success' : 'text-danger')}>
              {delta >= 0 ? '+' : ''}
              {fmt(delta)}
            </div>
          </div>
          <div>
            <div className="text-micro text-muted">调整后</div>
            <div className={cx('font-num font-bold', after < 0 ? 'text-danger' : 'text-ink')}>{fmt(after)}</div>
          </div>
        </Inset>
      </div>
    </Modal>
  )
}
