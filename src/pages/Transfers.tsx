import { useEffect, useMemo, useState } from 'react'
import { ArrowRightLeft, Check, CheckCircle2, Download, Eye, MessageSquarePlus, RotateCcw, Target, TrendingUp, X, XCircle } from 'lucide-react'
import { useDb } from '@/lib/store'
import type { Transfer, TransferStatus } from '@/lib/types'
import { cx, downloadCsv, fmt, fmtDate, fmtDateTime, parseCommand } from '@/lib/utils'
import { navigate, useRoute } from '@/lib/router'
import { Donut, HBars } from '@/components/charts'
import {
  Button,
  Card,
  CardTitle,
  ConfirmDialog,
  Drawer,
  Empty,
  Field,
  IconButton,
  Modal,
  Notice,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  StatCard,
  Table,
  Td,
  TextInput,
  Th,
  Toolbar,
  Tr,
  usePaged,
  useToast,
} from '@/components/ui'
import { TRANSFER_STATUS, TransferStatusTag } from './shared'

type StatusFilter = 'all' | 'failed' | TransferStatus

export function Transfers() {
  const { db, actions } = useDb()
  const toast = useToast()
  const { params } = useRoute()
  const [q, setQ] = useState(params.get('q') ?? '')
  const [status, setStatus] = useState<StatusFilter>((params.get('status') as StatusFilter) ?? 'all')
  const [host, setHost] = useState(params.get('host') ?? 'all')
  const [range, setRange] = useState<'1' | '7' | 'all'>('7')
  const [detail, setDetail] = useState<Transfer | null>(null)
  const [reverting, setReverting] = useState<Transfer | null>(null)
  const [simOpen, setSimOpen] = useState(false)

  useEffect(() => {
    if (params.get('q')) setQ(params.get('q')!)
    if (params.get('status')) setStatus(params.get('status') as StatusFilter)
    if (params.get('host')) setHost(params.get('host')!)
  }, [params])

  const hostName = (uid?: string) => db.hosts.find((h) => h.hostUid === uid)?.hostName
  const rows = useMemo(() => {
    const kw = q.trim().toLowerCase()
    const since = range === 'all' ? 0 : range === '1' ? new Date().setHours(0, 0, 0, 0) : Date.now() - 7 * 86_400_000
    return db.transfers.filter((t) => {
      if (new Date(t.time).getTime() < since) return false
      if (status === 'failed' ? ['success', 'reverted'].includes(t.status) : status !== 'all' && t.status !== status) return false
      if (host !== 'all' && t.targetHostUid !== host) return false
      return !kw || [t.senderName, t.senderUid, t.raw, t.id, t.danmuEventId].some((x) => x.toLowerCase().includes(kw))
    })
  }, [db.transfers, q, status, host, range])
  const paged = usePaged(rows, 12)

  const ok = rows.filter((t) => t.status === 'success')
  const rate = rows.length ? (ok.length / rows.length) * 100 : 0
  const dist = (Object.keys(TRANSFER_STATUS) as TransferStatus[])
    .map((s) => ({ label: TRANSFER_STATUS[s].label, value: rows.filter((t) => t.status === s).length, color: { success: '#1e7160', format: '#b23f51', alias: '#d77a8a', balance: '#b88a3a', unbound: '#e0c48f', limit: '#9cc0dd', reverted: '#9aa8bb' }[s] }))
    .filter((d) => d.value > 0)
  const byHost = db.hosts
    .map((h) => ({ label: h.hostName, value: ok.filter((t) => t.targetHostUid === h.hostUid).reduce((s, t) => s + (t.amount ?? 0), 0) }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)

  return (
    <>
      <PageHeader
        eyebrow="观众与温度值"
        title="转分记录"
        desc={`服务端解析直播间弹幕中的「${db.rules.commandPrefix}别名数量」命令。可查看每条命令的解析过程，并对误操作的成功转分进行撤销。`}
        actions={
          <>
            <Button
              theme="light"
              icon={<Download className="size-4" />}
              onClick={() => downloadCsv(`转分记录_${fmtDate(new Date().toISOString())}.csv`, ['记录ID', '时间', '发送者', '斗鱼UID', '发送直播间', '原始弹幕', '别名', '目标主播', '温度值', '状态'], rows.map((t) => [t.id, fmtDateTime(t.time, true), t.senderName, t.senderUid, hostName(t.roomHostUid) ?? '', t.raw, t.alias ?? '', hostName(t.targetHostUid) ?? '', t.amount ?? '', TRANSFER_STATUS[t.status].label]))}
            >
              导出
            </Button>
            <Button icon={<MessageSquarePlus className="size-4" />} onClick={() => setSimOpen(true)}>
              模拟弹幕
            </Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-12 gap-5">
        <div className="col-span-12 grid grid-cols-2 gap-5 xl:col-span-4 xl:grid-cols-1">
          <StatCard icon={<ArrowRightLeft className="size-4" />} label="命令总数" value={fmt(rows.length)} unit="条" foot={range === '1' ? '今日' : range === '7' ? '近 7 日' : '全部时间'} />
          <StatCard icon={<TrendingUp className="size-4" />} label="成功转分" value={fmt(ok.reduce((s, t) => s + (t.amount ?? 0), 0))} unit="温度值" foot={`成功率 ${rate.toFixed(1)}% · ${ok.length} 笔`} tone="success" />
        </div>
        <Card className="col-span-12 md:col-span-6 xl:col-span-4">
          <CardTitle title="命令结果分布" sub="当前筛选范围" />
          {dist.length ? (
            <Donut
              data={dist}
              size={140}
              center={
                <>
                  <span className="font-num text-title font-extrabold text-ink">{rate.toFixed(0)}%</span>
                  <span className="text-micro text-muted">成功率</span>
                </>
              }
            />
          ) : (
            <Empty title="暂无数据" />
          )}
        </Card>
        <Card className="col-span-12 md:col-span-6 xl:col-span-4">
          <CardTitle title="主播收到转分" sub="成功转分温度值合计" extra={<Target className="size-4 text-brand-ink" aria-hidden />} />
          {byHost.length ? <HBars data={byHost} unit="分" /> : <Empty title="暂无数据" />}
        </Card>
      </div>

      <Card flush>
        <Toolbar>
          <SearchInput value={q} onChange={setQ} placeholder="搜索发送者、UID、弹幕或记录 ID" />
          <Select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} aria-label="状态" className="w-36">
            <option value="all">全部状态</option>
            <option value="failed">全部未成功</option>
            {(Object.keys(TRANSFER_STATUS) as TransferStatus[]).map((s) => (
              <option key={s} value={s}>
                {TRANSFER_STATUS[s].label}
              </option>
            ))}
          </Select>
          <Select value={host} onChange={(e) => setHost(e.target.value)} aria-label="目标主播" className="w-44">
            <option value="all">全部目标主播</option>
            {db.hosts.map((h) => (
              <option key={h.hostUid} value={h.hostUid}>
                {h.hostName}
              </option>
            ))}
          </Select>
          <Select value={range} onChange={(e) => setRange(e.target.value as typeof range)} aria-label="时间范围" className="w-32">
            <option value="1">今日</option>
            <option value="7">近 7 日</option>
            <option value="all">全部</option>
          </Select>
          {(q || status !== 'all' || host !== 'all') && (
            <Button theme="text" size="small" onClick={() => { setQ(''); setStatus('all'); setHost('all'); navigate('transfers') }}>
              清除筛选
            </Button>
          )}
        </Toolbar>
        {rows.length === 0 ? (
          <Empty title="没有匹配的转分记录" description="调整筛选条件或时间范围后重试" />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>时间</Th>
                  <Th>发送者</Th>
                  <Th>原始弹幕</Th>
                  <Th>解析结果</Th>
                  <Th align="right">温度值</Th>
                  <Th>状态</Th>
                  <Th align="right">操作</Th>
                </tr>
              </thead>
              <tbody>
                {paged.slice.map((t) => (
                  <Tr key={t.id}>
                    <Td className="font-num text-caption whitespace-nowrap text-ink">{fmtDateTime(t.time, true)}</Td>
                    <Td>
                      <button type="button" onClick={() => navigate(`points?uid=${t.senderUid}`)} className="cursor-pointer text-left">
                        <div className="max-w-40 truncate font-semibold text-ink hover:text-brand-ink">{t.senderName}</div>
                        <div className="font-num text-micro text-muted">{t.senderUid}</div>
                      </button>
                    </Td>
                    <Td>
                      <span className="rounded-chip bg-page px-2 py-1 font-num text-caption font-semibold text-ink shadow-inset-sm">{t.raw}</span>
                      <div className="mt-1 text-micro text-muted">于 {hostName(t.roomHostUid) ?? '—'} 直播间</div>
                    </Td>
                    <Td>
                      {t.targetHostUid ? (
                        <div className="text-ink">
                          <span className="text-muted">「{t.alias}」→</span> {hostName(t.targetHostUid)}
                        </div>
                      ) : (
                        <span className="text-caption text-muted">{t.alias ? `「${t.alias}」未匹配` : '无法解析'}</span>
                      )}
                    </Td>
                    <Td align="right" className={cx('font-num font-bold', t.status === 'success' ? 'text-ink' : 'text-muted line-through decoration-muted/40')}>
                      {t.amount ? fmt(t.amount) : '—'}
                    </Td>
                    <Td>
                      <TransferStatusTag status={t.status} />
                    </Td>
                    <Td align="right">
                      <div className="flex justify-end gap-2">
                        <IconButton label="解析详情" size="sm" onClick={() => setDetail(t)}>
                          <Eye className="size-4" />
                        </IconButton>
                        {t.status === 'success' && (
                          <Button theme="danger" size="small" icon={<RotateCcw className="size-3.5" />} onClick={() => setReverting(t)}>
                            撤销
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
      </Card>

      {detail && <TransferDetail t={db.transfers.find((x) => x.id === detail.id) ?? detail} onClose={() => setDetail(null)} onRevert={() => setReverting(detail)} />}
      <ConfirmDialog
        open={!!reverting}
        title="撤销这笔转分？"
        danger
        confirmText="确认撤销"
        requireReason="撤销原因"
        onCancel={() => setReverting(null)}
        onConfirm={(reason) => {
          const r = actions.revertTransfer(reverting!.id, reason)
          toast(r.message ?? '', r.ok ? 'success' : 'danger')
          setReverting(null)
        }}
      >
        {reverting && (
          <div className="rounded-control bg-page p-3.5 shadow-inset-sm">
            <div className="font-num font-bold text-ink">{reverting.raw}</div>
            <div className="mt-1 text-caption">
              {reverting.senderName} → {hostName(reverting.targetHostUid)} · {reverting.amount} 温度值将退回发送者，并从主播「当前温度值」中扣回。
            </div>
          </div>
        )}
      </ConfirmDialog>
      <Simulator open={simOpen} onClose={() => setSimOpen(false)} />
    </>
  )
}

function TransferDetail({ t, onClose, onRevert }: { t: Transfer; onClose: () => void; onRevert: () => void }) {
  const { db } = useDb()
  const hostName = (uid?: string) => db.hosts.find((h) => h.hostUid === uid)?.hostName
  const v = db.viewers.find((x) => x.douyuUid === t.senderUid)
  const failAt: Record<TransferStatus, number> = { format: 1, alias: 2, limit: 2, unbound: 3, balance: 3, success: 99, reverted: 99 }
  const steps = [
    { title: '收到直播间弹幕', desc: `${hostName(t.roomHostUid)} 直播间 · 事件 ${t.danmuEventId}` },
    { title: '命令格式解析', desc: t.status === 'format' ? `不符合「${db.rules.commandPrefix}别名数量」格式` : `别名「${t.alias}」，数量 ${t.amount}` },
    { title: '别名匹配主播', desc: t.status === 'alias' ? '未找到或匹配到多位主播' : t.status === 'limit' && !t.targetHostUid ? '数量超出单次上限' : `唯一匹配 ${hostName(t.targetHostUid) ?? '—'}` },
    { title: '发送者账户校验', desc: t.status === 'unbound' ? '发送者未绑定或已冻结' : t.status === 'balance' ? `余额不足（当前 ${fmt(v?.balance ?? 0)}）` : t.status === 'limit' ? '超出每日转分上限' : '已绑定，余额充足' },
    { title: t.status === 'reverted' ? '已入账，后被撤销' : '扣减并入账', desc: t.status === 'success' ? `发送者 -${t.amount}，主播 +${t.amount}` : t.status === 'reverted' ? '温度值已退回发送者' : '未执行' },
  ]
  const fail = failAt[t.status]
  return (
    <Drawer
      open
      onClose={onClose}
      title={`转分详情 · ${t.id}`}
      sub={fmtDateTime(t.time, true)}
      footer={
        t.status === 'success' ? (
          <Button theme="danger" icon={<RotateCcw className="size-4" />} onClick={onRevert}>
            撤销此转分
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-5">
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-caption text-muted">原始弹幕</span>
            <TransferStatusTag status={t.status} />
          </div>
          <div className="mt-2 font-num text-title font-extrabold text-ink">{t.raw}</div>
          <div className="mt-4 grid grid-cols-3 gap-3 rounded-control bg-page p-3.5 text-center shadow-inset-sm">
            <div>
              <div className="text-micro text-muted">发送者</div>
              <div className="truncate text-caption font-semibold text-ink">{t.senderName}</div>
            </div>
            <div>
              <div className="text-micro text-muted">目标主播</div>
              <div className="truncate text-caption font-semibold text-ink">{hostName(t.targetHostUid) ?? '—'}</div>
            </div>
            <div>
              <div className="text-micro text-muted">温度值</div>
              <div className="font-num text-caption font-semibold text-ink">{t.amount ?? '—'}</div>
            </div>
          </div>
        </Card>
        <Card>
          <CardTitle title="处理过程" />
          <ol className="relative space-y-5">
            {steps.map((s, i) => {
              const state = i < fail ? 'ok' : i === fail ? 'fail' : 'skip'
              return (
                <li key={s.title} className="relative flex gap-3">
                  {i < steps.length - 1 && <span aria-hidden className={cx('absolute top-8 left-[15px] h-[calc(100%-12px)] w-0.5 rounded-full', state === 'ok' ? 'bg-success/40' : 'bg-line')} />}
                  <span className={cx('flex size-8 shrink-0 items-center justify-center rounded-full', state === 'ok' ? 'bg-success text-highlight shadow-raised-sm' : state === 'fail' ? 'bg-danger text-highlight shadow-raised-sm' : 'bg-page text-muted shadow-inset-sm')}>
                    {state === 'ok' ? <Check className="size-4" strokeWidth={3} /> : state === 'fail' ? <X className="size-4" strokeWidth={3} /> : <span className="font-num text-caption font-bold">{i + 1}</span>}
                  </span>
                  <div className="pt-1">
                    <div className={cx('text-body font-semibold', state === 'skip' ? 'text-muted' : 'text-ink')}>{s.title}</div>
                    <div className="text-caption text-muted">{s.desc}</div>
                  </div>
                </li>
              )
            })}
          </ol>
        </Card>
        {t.botReply && (
          <Card>
            <CardTitle title="BOT 回复" sub="按当前规则生成的回复内容" />
            <div className="rounded-control bg-page p-3.5 text-body text-ink shadow-inset-sm">{t.botReply}</div>
            <div className="mt-2 text-micro text-muted">真实发送需由服务端调用斗鱼 outerChat 接口并完成签名。</div>
          </Card>
        )}
        <Notice theme="brand">实际扣减与入账以服务端处理直播间消息的结果为准；同一弹幕事件只会处理一次。</Notice>
      </div>
    </Drawer>
  )
}

function Simulator({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { db, actions } = useDb()
  const toast = useToast()
  const bound = db.viewers.filter((v) => v.status !== 'unbound')
  const [sender, setSender] = useState(bound[0]?.douyuUid ?? '')
  const [room, setRoom] = useState(db.hosts.find((h) => h.collect)?.hostUid ?? '')
  const [text, setText] = useState(`${db.rules.commandPrefix}星河100`)
  const [result, setResult] = useState<{ ok: boolean; message: string; botReply?: string } | null>(null)
  useEffect(() => {
    if (open) setResult(null)
  }, [open])
  const v = db.viewers.find((x) => x.douyuUid === sender)
  const parsed = parseCommand(text, db.hosts, db.rules)
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="模拟直播间弹幕"
      desc="以选定观众身份在直播间发送弹幕，按当前规则执行转分，并生成 BOT 回复预览（会真实修改演示数据）"
      footer={
        <>
          <Button theme="outline" onClick={onClose}>
            关闭
          </Button>
          <Button
            icon={<MessageSquarePlus className="size-4" />}
            disabled={!text.trim() || !sender}
            onClick={() => {
              const r = actions.simulateCommand(sender, text, room)
              const ok = r.transfer.status === 'success'
              setResult({ ok, message: r.message, botReply: r.botReply })
              toast(r.message, ok ? 'success' : 'danger')
            }}
          >
            发送弹幕
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        <div className="grid grid-cols-2 gap-4">
          <Field label="发送观众" hint={v ? `可用温度值 ${fmt(v.balance)}${v.status === 'frozen' ? ' · 已冻结' : ''}` : undefined}>
            {(id) => (
              <Select id={id} value={sender} onChange={(e) => setSender(e.target.value)}>
                {bound.map((x) => (
                  <option key={x.douyuUid} value={x.douyuUid}>
                    {x.douyuName}（{x.douyuUid}）
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="所在直播间">
            {(id) => (
              <Select id={id} value={room} onChange={(e) => setRoom(e.target.value)}>
                {db.hosts.filter((h) => h.collect).map((h) => (
                  <option key={h.hostUid} value={h.hostUid}>
                    {h.hostName}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label="弹幕内容">
          {(id) => <TextInput id={id} value={text} onChange={(e) => { setText(e.target.value); setResult(null) }} className="font-num" placeholder={`${db.rules.commandPrefix}别名数量`} />}
        </Field>
        {parsed.status === 'ok' ? (
          <Notice theme="success">
            预检：转 {parsed.amount} 温度值给 {parsed.host.hostName}
            {v && v.balance < parsed.amount && '（余额不足，将失败）'}
          </Notice>
        ) : parsed.status !== 'empty' ? (
          <Notice theme="danger">预检：{parsed.message}</Notice>
        ) : null}
        {result && (
          <div className={cx('flex items-center gap-2 rounded-control p-3.5 text-body font-semibold', result.ok ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger')}>
            {result.ok ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
            {result.message}
          </div>
        )}
        {result?.botReply && <Notice theme="brand">BOT 回复预览：{result.botReply}<div className="mt-1 text-micro opacity-80">当前为原型生成结果，真实发送由服务端调用 outerChat 接口。</div></Notice>}
      </div>
    </Modal>
  )
}
