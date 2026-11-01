import { useState } from 'react'
import { CalendarClock, CalendarPlus, Flag, Info, Pencil, Trash2, Trophy } from 'lucide-react'
import { useDb } from '@/lib/store'
import type { Season as SeasonT } from '@/lib/types'
import { DAY, activeSeason, cx, fmt, fmtDateTime, fromLocalInput, seasonDay, seasonStatus, toLocalInput } from '@/lib/utils'
import { guildDaily } from '@/lib/metrics'
import { Button, Card, CardTitle, ConfirmDialog, Empty, Field, IconButton, Inset, Modal, Notice, PageHeader, Switch, Table, Tag, Td, TextInput, Textarea, Th, Tr, useToast } from '@/components/ui'

const STATUS = { active: { label: '进行中', tone: 'success' as const }, scheduled: { label: '未开始', tone: 'brand' as const }, ended: { label: '已结束', tone: 'default' as const } }

function seasonAmount(hosts: ReturnType<typeof useDb>['db']['hosts'], startIso: string) {
  const days = Math.max(Math.ceil((Date.now() - new Date(startIso).getTime()) / DAY), 0)
  if (!days) return 0
  // 赛季口径：全部参赛主播（含其他公会），与公会无关
  return guildDaily(hosts.filter((h) => h.inSeason), Math.min(days, 365)).reduce((a, b) => a + b, 0)
}

export function Season() {
  const { db, actions } = useDb()
  const toast = useToast()
  const current = activeSeason(db.seasons)
  const [editing, setEditing] = useState<{ s: SeasonT; isNew: boolean } | null>(null)
  const [ending, setEnding] = useState(false)
  const [deleting, setDeleting] = useState<SeasonT | null>(null)

  const nextDefault = (): SeasonT => {
    const last = [...db.seasons].sort((a, b) => b.startAt.localeCompare(a.startAt))[0]
    const start = last?.endAt ? new Date(last.endAt) : new Date(Date.now() + DAY)
    if (!last?.endAt) start.setHours(0, 0, 0, 0)
    return { id: `S${db.seasons.length + 1}-${Date.now().toString(36)}`, name: `S${db.seasons.length + 1} 新赛季`, startAt: start.toISOString(), endAt: new Date(start.getTime() + 60 * DAY).toISOString(), resetPoints: false, note: '' }
  }

  const progress = current?.endAt ? Math.min((Date.now() - new Date(current.startAt).getTime()) / (new Date(current.endAt).getTime() - new Date(current.startAt).getTime()), 1) : null
  const daysLeft = current?.endAt ? Math.max(Math.ceil((new Date(current.endAt).getTime() - Date.now()) / DAY), 0) : null

  return (
    <>
      <PageHeader
        eyebrow="赛季与数据"
        title="赛季设置"
        desc="赛季开始时间决定小程序主页与主播详情中「本赛季」口径：从开始时间统计到当前时刻。时间均为北京时间（UTC+8）。"
        actions={
          <Button icon={<CalendarPlus className="size-4" />} onClick={() => setEditing({ s: nextDefault(), isNew: true })}>
            新建赛季
          </Button>
        }
      />

      <div className="grid grid-cols-12 gap-5">
        {current ? (
          <Card className="relative col-span-12 overflow-hidden xl:col-span-8">
            <div aria-hidden className="soft-orb absolute -top-14 -right-14 size-48 opacity-20" />
            <div className="relative">
              <div className="flex items-center gap-2">
                <Tag theme="success" dot>
                  进行中
                </Tag>
                <span className="text-caption text-muted">当前赛季</span>
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-2">
                <h2 className="text-[28px] leading-tight font-extrabold text-ink">{current.name}</h2>
                <span className="pb-1 font-num text-section font-bold text-brand-ink">第 {seasonDay(current)} 天</span>
              </div>
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                <Inset className="p-4">
                  <div className="text-micro text-muted">开始时间</div>
                  <div className="mt-1 font-num text-section font-bold text-ink">{fmtDateTime(current.startAt, true)}</div>
                </Inset>
                <Inset className="p-4">
                  <div className="text-micro text-muted">结束时间</div>
                  <div className="mt-1 font-num text-section font-bold text-ink">{current.endAt ? fmtDateTime(current.endAt, true) : '未设置'}</div>
                </Inset>
                <Inset className="p-4">
                  <div className="text-micro text-muted">本赛季流水 · {db.hosts.filter((h) => h.inSeason).length} 位参赛主播</div>
                  <div className="mt-1 font-num text-section font-bold text-ink">¥{fmt(seasonAmount(db.hosts, current.startAt))}</div>
                </Inset>
              </div>
              {progress !== null && (
                <div className="mt-5">
                  <div className="mb-1.5 flex justify-between text-micro text-muted">
                    <span>赛季进度 {(progress * 100).toFixed(0)}%</span>
                    <span>剩余 {daysLeft} 天</span>
                  </div>
                  <div className="h-3 rounded-full bg-page shadow-inset-sm">
                    <div className="h-full rounded-full bg-gradient-to-r from-brand-light to-brand-deep" style={{ width: `${progress * 100}%` }} />
                  </div>
                </div>
              )}
              <div className="mt-6 flex flex-wrap gap-2.5">
                <Button icon={<CalendarClock className="size-4" />} onClick={() => setEditing({ s: current, isNew: false })}>
                  修改赛季时间
                </Button>
                <Button theme="danger" icon={<Flag className="size-4" />} onClick={() => setEnding(true)}>
                  立即结束赛季
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="col-span-12 xl:col-span-8">
            <Empty title="当前没有进行中的赛季" description="小程序「本赛季」将显示为空，请新建或调整赛季时间" icon={<Trophy className="size-6" />} action={<Button onClick={() => setEditing({ s: nextDefault(), isNew: true })}>新建赛季</Button>} />
          </Card>
        )}
        <Card className="col-span-12 xl:col-span-4">
          <CardTitle title={<span className="flex items-center gap-2"><Info className="size-4 text-brand-ink" /> 口径说明</span>} />
          <ul className="space-y-3 text-caption text-muted">
            {[
              ['参赛范围', `统计全部参赛主播，包括其他公会的主播；未参赛的本公会主播不计入。在「主播管理」中设置是否参赛`],
              ['本赛季流水', '从赛季开始时间统计到当前，修改开始时间后立即按新口径重新计算'],
              ['温度值', '温度值账户不随赛季自动变化；开启「开赛清零」后，赛季开始时清空观众可用温度值'],
              ['时间重叠', '赛季之间不能重叠，同一时刻最多一个进行中的赛季'],
              ['小程序同步', '赛季名称即小程序首页赛季标签名（如「驴酱团播S1」）；没有进行中的赛季时，小程序首页只显示公会标签'],
            ].map(([t, d]) => (
              <li key={t} className="rounded-control bg-page p-3 shadow-inset-sm">
                <div className="font-semibold text-ink">{t}</div>
                <div className="mt-0.5">{d}</div>
              </li>
            ))}
          </ul>
        </Card>

        <Card flush className="col-span-12">
          <div className="px-6 pt-5">
            <CardTitle title="赛季列表" sub="按开始时间排序" />
          </div>
          <Table>
            <thead>
              <tr>
                <Th>赛季</Th>
                <Th>状态</Th>
                <Th>开始时间</Th>
                <Th>结束时间</Th>
                <Th align="right">时长</Th>
                <Th align="center">开赛清零</Th>
                <Th>备注</Th>
                <Th align="right">操作</Th>
              </tr>
            </thead>
            <tbody>
              {db.seasons.map((s) => {
                const st = seasonStatus(s)
                const dur = s.endAt ? Math.round((new Date(s.endAt).getTime() - new Date(s.startAt).getTime()) / DAY) : null
                return (
                  <Tr key={s.id} active={st === 'active'}>
                    <Td className="font-semibold text-ink">{s.name}</Td>
                    <Td>
                      <Tag theme={STATUS[st].tone} dot={st === 'active'}>
                        {STATUS[st].label}
                      </Tag>
                    </Td>
                    <Td className="font-num text-caption text-ink">{fmtDateTime(s.startAt, true)}</Td>
                    <Td className="font-num text-caption text-ink">{s.endAt ? fmtDateTime(s.endAt, true) : <span className="text-muted">未设置</span>}</Td>
                    <Td align="right" className="font-num text-ink">
                      {dur !== null ? `${dur} 天` : '—'}
                    </Td>
                    <Td align="center">{s.resetPoints ? <Tag theme="warning">清零</Tag> : <span className="text-caption text-muted">保留</span>}</Td>
                    <Td className="max-w-64 truncate text-caption text-muted">{s.note || '—'}</Td>
                    <Td align="right">
                      <div className="flex justify-end gap-2">
                        <IconButton label="编辑" size="sm" onClick={() => setEditing({ s, isNew: false })}>
                          <Pencil className="size-4" />
                        </IconButton>
                        {st === 'scheduled' && (
                          <IconButton label="删除" size="sm" tone="danger" onClick={() => setDeleting(s)}>
                            <Trash2 className="size-4" />
                          </IconButton>
                        )}
                      </div>
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
          <div className="h-3" />
        </Card>
      </div>

      {editing && <SeasonEditor key={editing.s.id} initial={editing.s} isNew={editing.isNew} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={ending}
        title={`立即结束「${current?.name}」？`}
        danger
        confirmText="结束赛季"
        onCancel={() => setEnding(false)}
        onConfirm={() => {
          const r = actions.saveSeason({ ...current!, endAt: new Date().toISOString() }, false)
          toast(r.ok ? '赛季已结束' : r.message, r.ok ? 'success' : 'danger')
          setEnding(false)
        }}
      >
        结束时间将设为当前时刻。结束后小程序「本赛季」将显示无进行中赛季，直到下一个赛季开始。
      </ConfirmDialog>
      <ConfirmDialog
        open={!!deleting}
        title={`删除「${deleting?.name}」？`}
        danger
        confirmText="删除"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          actions.deleteSeason(deleting!.id)
          toast('已删除赛季')
          setDeleting(null)
        }}
      >
        仅未开始的赛季可删除。
      </ConfirmDialog>
    </>
  )
}

function SeasonEditor({ initial, isNew, onClose }: { initial: SeasonT; isNew: boolean; onClose: () => void }) {
  const { db, actions } = useDb()
  const toast = useToast()
  const [s, setS] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const st = seasonStatus(initial)
  const startChanged = s.startAt !== initial.startAt

  const presets = (() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const monday = new Date(today)
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
    const month = new Date(today.getFullYear(), today.getMonth(), 1)
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1)
    return [
      { label: '今天 00:00', v: today },
      { label: '本周一 00:00', v: monday },
      { label: '本月 1 日 00:00', v: month },
      { label: '下月 1 日 00:00', v: nextMonth },
    ]
  })()

  const save = () => {
    if (!s.name.trim()) return setError('请输入赛季名称')
    if (!s.startAt) return setError('请设置开始时间')
    const r = actions.saveSeason({ ...s, name: s.name.trim() }, isNew)
    if (!r.ok) return setError(r.message)
    toast(r.message ?? '')
    onClose()
  }

  const oldAmount = st === 'active' ? seasonAmount(db.hosts, initial.startAt) : 0
  const newAmount = seasonAmount(db.hosts, s.startAt)
  const willBeActive = seasonStatus(s) === 'active'

  return (
    <Modal
      open
      onClose={onClose}
      width="max-w-xl"
      title={isNew ? '新建赛季' : `编辑 · ${initial.name}`}
      desc="时间为北京时间（UTC+8），精确到分钟"
      footer={
        <>
          <Button theme="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={save}>{isNew ? '创建赛季' : '保存'}</Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        <Field label="赛季名称" required>
          {(id) => <TextInput id={id} value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} placeholder="例如：驴酱团播S2" />}
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="开始时间" required>
            {(id) => <TextInput id={id} type="datetime-local" value={toLocalInput(s.startAt)} onChange={(e) => { setS({ ...s, startAt: fromLocalInput(e.target.value) ?? s.startAt }); setError(null) }} />}
          </Field>
          <Field label="结束时间" hint="可留空，表示持续到手动结束">
            {(id) => <TextInput id={id} type="datetime-local" value={toLocalInput(s.endAt)} onChange={(e) => { setS({ ...s, endAt: fromLocalInput(e.target.value) }); setError(null) }} />}
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-micro text-muted">快捷设置开始：</span>
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setS({ ...s, startAt: p.v.toISOString() })}
              className={cx('press h-7 cursor-pointer rounded-full px-3 text-micro font-semibold', s.startAt === p.v.toISOString() ? 'bg-page text-brand-ink shadow-inset-sm' : 'bg-card text-ink shadow-raised-sm')}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-4 rounded-control bg-page p-4 shadow-inset-sm">
          <div>
            <div className="text-body font-semibold text-ink">开赛时清零观众温度值</div>
            <div className="text-caption text-muted">清零前自动生成温度值快照，可在温度值流水中追溯</div>
          </div>
          <Switch checked={s.resetPoints} onChange={(v) => setS({ ...s, resetPoints: v })} label="开赛时清零观众温度值" disabled={st !== 'scheduled' && !isNew} />
        </div>
        <Field label="备注">
          {(id) => <Textarea id={id} value={s.note} onChange={(e) => setS({ ...s, note: e.target.value })} />}
        </Field>
        {startChanged && willBeActive && (
          <Notice theme="warning">
            修改后「本赛季」口径将从 <b>{fmtDateTime(s.startAt, true)}</b> 起算，本赛季流水 {st === 'active' ? <>由 ¥{fmt(oldAmount)} 变为 </> : '为 '}
            <b>¥{fmt(newAmount)}</b>，小程序同步生效。
          </Notice>
        )}
        {st === 'active' && !isNew && <Notice theme="brand">赛季进行中：可调整开始/结束时间，「开赛清零」已无法修改。</Notice>}
        {error && <Notice theme="danger">{error}</Notice>}
      </div>
    </Modal>
  )
}
