import { useEffect, useState, type ReactNode } from 'react'
import { Check, Coins, Link2, MessageSquareText, Minus, Pencil, RotateCcw, Save, ShieldCheck, UserPlus } from 'lucide-react'
import { useDb } from '@/lib/store'
import type { Admin, Role, Rules, TeamConfig } from '@/lib/types'
import { buildOuterChatPayload, cx, fmtRelative, renderBotReply } from '@/lib/utils'
import { Button, Card, CardTitle, Field, IconButton, LineTabs, Modal, Notice, PageHeader, Select, Switch, Table, Tag, Td, Textarea, TextInput, Th, Tr, useToast } from '@/components/ui'

export const ROLE_META: Record<Role, { label: string; tone: 'warning' | 'brand' | 'default' }> = {
  owner: { label: '超级管理员', tone: 'warning' },
  operator: { label: '运营', tone: 'brand' },
  viewer: { label: '只读', tone: 'default' },
}

export function Settings() {
  const [tab, setTab] = useState<'rules' | 'admins'>('rules')
  return (
    <>
      <PageHeader eyebrow="系统" title="规则配置" desc="温度值、转分、BOT 回复与绑定规则会同步到采集服务与小程序。所有修改都会记录在操作日志中。" />
      <div className="mb-5">
        <LineTabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'rules', label: '业务规则' },
            { value: 'admins', label: '管理员与权限' },
          ]}
        />
      </div>
      {tab === 'rules' ? <RulesForm /> : <Admins />}
    </>
  )
}

function Row({ title, desc, children }: { title: string; desc: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-line/70 py-4 last:border-0">
      <div className="min-w-0">
        <div className="text-body font-semibold text-ink">{title}</div>
        <div className="text-caption text-muted">{desc}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function NumberInput({ value, onChange, suffix, min = 0, max }: { value: number; onChange: (n: number) => void; suffix?: string; min?: number; max?: number }) {
  return (
    <TextInput
      className="w-40"
      inputMode="numeric"
      value={String(value)}
      onChange={(e) => {
        const n = Number(e.target.value.replace(/\D/g, '') || 0)
        onChange(max ? Math.min(n, max) : n)
      }}
      onBlur={() => value < min && onChange(min)}
      suffix={suffix}
    />
  )
}

function RulesForm() {
  const { db, actions } = useDb()
  const toast = useToast()
  const [r, setR] = useState<Rules>(db.rules)
  useEffect(() => setR(db.rules), [db.rules])
  const set = <K extends keyof Rules>(k: K, v: Rules[K]) => setR((p) => ({ ...p, [k]: v }))
  const dirty = JSON.stringify(r) !== JSON.stringify(db.rules)
  const prefixError = !r.commandPrefix.trim() ? '前缀不能为空' : /\d/.test(r.commandPrefix) ? '前缀不能包含数字' : null
  const limitError = r.maxTransferPerCmd < r.minTransfer ? '单次上限不能小于最小数量' : r.dailyTransferLimit < r.maxTransferPerCmd ? '每日上限不能小于单次上限' : null
  const botError = r.botReplyEnabled && (!r.botSuccessReply.trim() || !r.botFailureReply.trim()) ? '启用 BOT 回复时，成功和失败模板都不能为空' : null
  const botPreview = renderBotReply(r.botSuccessReply, { viewer: '路过的猫头鹰', host: '星河不打烊', points: 100, balance: 1860, reason: '演示' })
  const apiPayloadPreview = JSON.stringify(buildOuterChatPayload({ roomId: '77611122', uid: '123456', nickName: '路过的猫头鹰', content: botPreview || '请输入回复模板', timestamp: 1671160366 }), null, 2)

  return (
    <div className="grid grid-cols-12 gap-5 pb-20">
      <Card className="col-span-12 xl:col-span-6">
        <CardTitle title={<span className="flex items-center gap-2"><Coins className="size-4 text-warning" /> 温度值规则</span>} sub="送礼获得温度值的计算口径" />
        <Row title="温度值兑换比例" desc="观众送出 1 元礼物获得的温度值">
          <NumberInput value={r.pointsPerYuan} onChange={(n) => set('pointsPerYuan', n)} suffix="温度值 / 元" min={1} max={100} />
        </Row>
        <Row title="礼物事件去重" desc="同一礼物事件只计分一次，重复事件自动忽略">
          <Switch checked={r.dedupeGift} onChange={(v) => set('dedupeGift', v)} label="礼物事件去重" />
        </Row>
        <Row title="免费礼物计分" desc="荧光棒等免费礼物是否累计温度值">
          <Switch checked={r.freeGiftCounts} onChange={(v) => set('freeGiftCounts', v)} label="免费礼物计分" />
        </Row>
        <Row title="折扣礼物口径" desc="折扣礼物与撤销的计分口径待与斗鱼接口字段确认">
          <Select value={r.discountGiftPolicy} onChange={(e) => set('discountGiftPolicy', e.target.value as Rules['discountGiftPolicy'])} className="w-40" aria-label="折扣礼物口径">
            <option value="pending">待确认（不计分）</option>
            <option value="paid">按实付金额</option>
            <option value="original">按原价</option>
          </Select>
        </Row>
        {!r.dedupeGift && <Notice theme="danger">关闭去重可能导致同一礼物重复入账，仅建议在排查问题时临时关闭。</Notice>}
      </Card>

      <TeamConfigCard />

      <Card className="col-span-12">
        <CardTitle title={<span className="flex items-center gap-2"><MessageSquareText className="size-4 text-success" /> 弹幕命令与 BOT 回复</span>} sub="命令由采集服务解析；回复通过斗鱼 outerChat 接口发送，真实签名由服务端生成" />
        <div className="grid gap-x-8 gap-y-5 xl:grid-cols-2">
          <div className="space-y-4">
            <Row title="启用 BOT 回复" desc="转分命令处理后，自动生成一条回复弹幕">
              <Switch checked={r.botReplyEnabled} onChange={(v) => set('botReplyEnabled', v)} label="启用 BOT 回复" />
            </Row>
            <div>
              <div className="text-body font-semibold text-ink">成功回复模板</div>
              <div className="mt-1 text-caption text-muted">支持：{'{观众}'}、{'{主播}'}、{'{温度值}'}、{'{当前温度值}'}</div>
              <Textarea className="mt-2" rows={2} value={r.botSuccessReply} onChange={(e) => set('botSuccessReply', e.target.value)} invalid={!!botError && !r.botSuccessReply.trim()} aria-label="成功回复模板" />
            </div>
            <div>
              <div className="text-body font-semibold text-ink">失败回复模板</div>
              <div className="mt-1 text-caption text-muted">支持：{'{观众}'}、{'{原因}'}、{'{温度值}'}</div>
              <Textarea className="mt-2" rows={2} value={r.botFailureReply} onChange={(e) => set('botFailureReply', e.target.value)} invalid={!!botError && !r.botFailureReply.trim()} aria-label="失败回复模板" />
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <div className="text-body font-semibold text-ink">回复预览</div>
              <div className="mt-1 text-caption text-muted">示例命令：{r.commandPrefix}星河100</div>
              <div className="mt-2 rounded-control bg-page p-4 shadow-inset-sm">
                <div className="flex items-start gap-2.5">
                  <MessageSquareText className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                  <span className="text-body text-ink">{r.botReplyEnabled ? botPreview || '请输入回复模板' : 'BOT 回复已关闭'}</span>
                </div>
              </div>
            </div>
            <Row title="斗鱼接口地址" desc="对应文档中的房间弹幕接入接口">
              <TextInput className="w-[28rem] max-w-[55vw] font-num text-caption" value={r.botApiEndpoint} onChange={(e) => set('botApiEndpoint', e.target.value.trim())} aria-label="BOT 接口地址" />
            </Row>
            <Notice theme="brand">
              真实发送需要服务端补充 <span className="font-num font-semibold">aid / auth / time / token</span>，浏览器端只保存回复规则和接口地址，不保存开发者密钥。
            </Notice>
            <details className="rounded-control bg-page px-3.5 py-3 shadow-inset-sm">
              <summary className="cursor-pointer text-caption font-semibold text-brand-ink">查看 outerChat 请求体预览</summary>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-micro leading-relaxed text-muted">{apiPayloadPreview}</pre>
            </details>
            {botError && <Notice theme="danger">{botError}</Notice>}
          </div>
        </div>
      </Card>

      <Card className="col-span-12 xl:col-span-6">
        <CardTitle title={<span className="flex items-center gap-2"><RotateCcw className="size-4 text-brand-ink" /> 转分规则</span>} sub="直播间弹幕转分命令的解析规则" />
        <Row title="命令前缀" desc={prefixError ? <span className="text-danger">{prefixError}</span> : <>示例：<span className="font-num font-bold text-ink">{r.commandPrefix}星河100</span></>}>
          <TextInput className="w-40" value={r.commandPrefix} onChange={(e) => set('commandPrefix', e.target.value.trim())} invalid={!!prefixError} aria-label="命令前缀" />
        </Row>
        <Row title="允许省略 #" desc={`同时识别「${r.commandPrefix.replace(/^#/, '')}星河100」`}>
          <Switch checked={r.allowNoHash} onChange={(v) => set('allowNoHash', v)} label="允许省略 #" />
        </Row>
        <Row title="单次最小数量" desc="低于该数量的命令判定为无效">
          <NumberInput value={r.minTransfer} onChange={(n) => set('minTransfer', n)} suffix="温度值" min={1} />
        </Row>
        <Row title="单次上限" desc={limitError ? <span className="text-danger">{limitError}</span> : '超出将判定为「超出上限」'}>
          <NumberInput value={r.maxTransferPerCmd} onChange={(n) => set('maxTransferPerCmd', n)} suffix="温度值" min={1} />
        </Row>
        <Row title="每人每日上限" desc="自然日内成功转分合计">
          <NumberInput value={r.dailyTransferLimit} onChange={(n) => set('dailyTransferLimit', n)} suffix="温度值" min={1} />
        </Row>
        <Row title="别名最大长度" desc="新增别名时校验">
          <NumberInput value={r.aliasMaxLength} onChange={(n) => set('aliasMaxLength', n)} suffix="字" min={1} max={20} />
        </Row>
      </Card>

      <Card className="col-span-12 xl:col-span-6">
        <CardTitle title={<span className="flex items-center gap-2"><Link2 className="size-4 text-success" /> 绑定与访问</span>} sub="小程序账号绑定流程" />
        <Row title="绑定主直播间" desc="用户需在此直播间发送绑定码">
          <Select value={r.bindRoomHostUid} onChange={(e) => set('bindRoomHostUid', e.target.value)} className="w-48" aria-label="绑定主直播间">
            {db.hosts.filter((h) => h.collect).map((h) => (
              <option key={h.hostUid} value={h.hostUid}>
                {h.hostName}（{h.roomId}）
              </option>
            ))}
          </Select>
        </Row>
        <Row title="绑定码有效期" desc="倒计时仅作提示，以服务端为准">
          <NumberInput value={r.bindCodeTTL} onChange={(n) => set('bindCodeTTL', n)} suffix="分钟" min={1} max={60} />
        </Row>
        <Row title="绑定最低礼物金额" desc="观众绑定需在主直播间一次性送出达到该金额的礼物，当前赛季参赛主播免除，累计多笔不算">
          <NumberInput value={r.bindMinSingleGiftAmount} onChange={(n) => set('bindMinSingleGiftAmount', n)} suffix="元" min={1} max={100000} />
        </Row>
        <Row title="游客浏览公开数据" desc="未绑定用户可查看主页与主播列表">
          <Switch checked={r.publicGuest} onChange={(v) => set('publicGuest', v)} label="游客浏览公开数据" />
        </Row>
      </Card>

      <Card className="col-span-12 xl:col-span-6">
        <CardTitle title="隐私与合规" sub="只读，由产品策略决定" />
        <ul className="space-y-2.5 text-caption text-muted">
          {['不采集 IP，不需要手机号', '微信头像与昵称非必填，需用户主动提供', '未绑定用户不下发任何个人明细', '温度值不可兑换或提现，仅用于站内转分'].map((t) => (
            <li key={t} className="flex items-center gap-2 rounded-control bg-page px-3.5 py-2.5 shadow-inset-sm">
              <ShieldCheck className="size-4 shrink-0 text-success" aria-hidden />
              {t}
            </li>
          ))}
        </ul>
      </Card>

      <div className={cx('fixed right-8 bottom-6 left-[272px] z-20 transition-all', dirty ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0')}>
        <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-full bg-card py-2 pr-2 pl-5 shadow-surface">
          <span className="size-2 rounded-full bg-warning" aria-hidden />
          <span className="flex-1 text-body text-ink">有未保存的规则修改</span>
          <Button theme="outline" onClick={() => setR(db.rules)}>
            放弃
          </Button>
          <Button
            icon={<Save className="size-4" />}
            disabled={!!prefixError || !!limitError || !!botError}
            onClick={() => {
              actions.saveRules(r)
              toast('规则已保存并同步')
            }}
          >
            保存规则
          </Button>
        </div>
      </div>
    </div>
  )
}

function TeamConfigCard() {
  const { db, actions } = useDb()
  const toast = useToast()
  const [teams, setTeams] = useState<TeamConfig[]>(db.teams)
  useEffect(() => setTeams(db.teams), [db.teams])
  const dirty = JSON.stringify(teams) !== JSON.stringify(db.teams)
  const invalid = teams.some((team) => !team.name.trim()) || new Set(teams.map((team) => team.name.trim())).size !== teams.length
  const update = (id: TeamConfig['id'], patch: Partial<TeamConfig>) => setTeams((items) => items.map((team) => (team.id === id ? { ...team, ...patch } : team)))

  return (
    <Card className="col-span-12">
      <CardTitle title="赛季队伍" sub="参赛主播可分配到红、黄、蓝、绿四队；队长标签会使用所属队伍颜色。" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {teams.map((team) => (
          <div key={team.id} className="rounded-control bg-page p-3.5 shadow-inset-sm">
            <div className="flex items-center gap-2">
              <span className="size-5 rounded-full border-2 border-highlight shadow-raised-sm" style={{ backgroundColor: team.color }} aria-hidden />
              <span className="text-body font-semibold text-ink">{team.name || '未命名队伍'}</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <TextInput value={team.name} onChange={(e) => update(team.id, { name: e.target.value })} aria-label={`${team.id}队名称`} />
              <input type="color" value={team.color} onChange={(e) => update(team.id, { color: e.target.value })} aria-label={`${team.name || team.id}队颜色`} className="size-10 cursor-pointer rounded-control border-0 bg-transparent p-0.5" />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        {invalid ? <span className="text-caption text-danger">队伍名称不能为空且不能重复</span> : <span className="text-caption text-muted">颜色修改会同步到主播管理中的队伍和队长标签。</span>}
        <Button
          icon={<Save className="size-4" />}
          disabled={!dirty || invalid}
          onClick={() => {
            actions.saveTeams(teams.map((team) => ({ ...team, name: team.name.trim() })))
            toast('队伍配置已保存')
          }}
        >
          保存队伍配置
        </Button>
      </div>
    </Card>
  )
}

const PERMS: { label: string; roles: Role[] }[] = [
  { label: '查看数据与报表', roles: ['owner', 'operator', 'viewer'] },
  { label: '主播、别名管理', roles: ['owner', 'operator'] },
  { label: '绑定管理与申诉审核', roles: ['owner', 'operator'] },
  { label: '撤销转分', roles: ['owner', 'operator'] },
  { label: '人工调整温度值', roles: ['owner'] },
  { label: '赛季与规则配置', roles: ['owner'] },
  { label: '管理员管理', roles: ['owner'] },
]

function Admins() {
  const { db, actions } = useDb()
  const toast = useToast()
  const [editing, setEditing] = useState<{ a: Admin; isNew: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const open = (a: Admin, isNew: boolean) => {
    setEditing({ a, isNew })
    setError(null)
  }
  return (
    <div className="grid grid-cols-12 gap-5">
      <Card flush className="col-span-12 xl:col-span-7">
        <div className="px-6 pt-5">
          <CardTitle
            title="管理员"
            extra={
              <Button size="small" icon={<UserPlus className="size-3.5" />} onClick={() => open({ id: `AD${Date.now()}`, name: '', account: '', role: 'operator', enabled: true, lastLogin: '' }, true)}>
                新增管理员
              </Button>
            }
          />
        </div>
        <Table>
          <thead>
            <tr>
              <Th>姓名</Th>
              <Th>登录账号</Th>
              <Th>角色</Th>
              <Th>最近登录</Th>
              <Th align="center">启用</Th>
              <Th align="right">操作</Th>
            </tr>
          </thead>
          <tbody>
            {db.admins.map((a) => (
              <Tr key={a.id}>
                <Td className="font-semibold text-ink">{a.name}</Td>
                <Td className="font-num text-ink">{a.account}</Td>
                <Td>
                  <Tag theme={ROLE_META[a.role].tone}>{ROLE_META[a.role].label}</Tag>
                </Td>
                <Td className="text-caption text-muted">{a.lastLogin ? fmtRelative(a.lastLogin) : '从未登录'}</Td>
                <Td align="center">
                  <div className="flex justify-center">
                    <Switch
                      checked={a.enabled}
                      disabled={a.role === 'owner'}
                      label={`启用 ${a.name}`}
                      onChange={(v) => {
                        actions.saveAdmin({ ...a, enabled: v }, false)
                        toast(`${a.name} 已${v ? '启用' : '停用'}`)
                      }}
                    />
                  </div>
                </Td>
                <Td align="right">
                  <IconButton label="编辑" size="sm" onClick={() => open(a, false)}>
                    <Pencil className="size-4" />
                  </IconButton>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
        <div className="h-3" />
      </Card>
      <Card flush className="col-span-12 xl:col-span-5">
        <div className="px-6 pt-5">
          <CardTitle title="角色权限" sub="演示用权限矩阵" />
        </div>
        <Table>
          <thead>
            <tr>
              <Th>权限</Th>
              {(Object.keys(ROLE_META) as Role[]).map((r) => (
                <Th key={r} align="center">
                  {ROLE_META[r].label}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMS.map((p) => (
              <Tr key={p.label}>
                <Td className="text-caption text-ink">{p.label}</Td>
                {(Object.keys(ROLE_META) as Role[]).map((r) => (
                  <Td key={r} align="center">
                    {p.roles.includes(r) ? <Check className="mx-auto size-4 text-success" aria-label="有权限" /> : <Minus className="mx-auto size-4 text-muted/50" aria-label="无权限" />}
                  </Td>
                ))}
              </Tr>
            ))}
          </tbody>
        </Table>
        <div className="h-3" />
      </Card>
      {editing && (
        <Modal
          open
          onClose={() => setEditing(null)}
          title={editing.isNew ? '新增管理员' : `编辑 · ${editing.a.name}`}
          footer={
            <>
              <Button theme="outline" onClick={() => setEditing(null)}>
                取消
              </Button>
              <Button
                onClick={() => {
                  const a = editing.a
                  if (!a.name.trim()) return setError('请输入姓名')
                  if (!/^[a-z][a-z0-9_]{2,}$/.test(a.account)) return setError('账号为小写字母开头，至少 3 位')
                  const r = actions.saveAdmin({ ...a, name: a.name.trim() }, editing.isNew)
                  if (!r.ok) return setError(r.message)
                  toast(r.message ?? '')
                  setEditing(null)
                }}
              >
                保存
              </Button>
            </>
          }
        >
          <div className="space-y-4 pb-2">
            <Field label="姓名" required>
              {(id) => <TextInput id={id} value={editing.a.name} onChange={(e) => setEditing({ ...editing, a: { ...editing.a, name: e.target.value } })} />}
            </Field>
            <Field label="登录账号" required hint={editing.isNew ? '初始密码将通过企业微信发送' : undefined}>
              {(id) => <TextInput id={id} value={editing.a.account} disabled={!editing.isNew} onChange={(e) => setEditing({ ...editing, a: { ...editing.a, account: e.target.value.trim().toLowerCase() } })} />}
            </Field>
            <Field label="角色" required error={error}>
              {(id) => (
                <Select id={id} value={editing.a.role} onChange={(e) => setEditing({ ...editing, a: { ...editing.a, role: e.target.value as Role } })}>
                  {(Object.keys(ROLE_META) as Role[]).map((r) => (
                    <option key={r} value={r}>
                      {ROLE_META[r].label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        </Modal>
      )}
    </div>
  )
}
