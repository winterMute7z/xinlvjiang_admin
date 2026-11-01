import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Plus, Tags, Terminal, X } from 'lucide-react'
import { useDb } from '@/lib/store'
import { findAliasConflicts, parseCommand, validateAlias, cx } from '@/lib/utils'
import {
  Avatar,
  Button,
  Card,
  CardTitle,
  ConfirmDialog,
  Empty,
  Field,
  Notice,
  PageHeader,
  SearchInput,
  Select,
  Table,
  Tag,
  Td,
  TextInput,
  Th,
  Toolbar,
  Tr,
  useToast,
} from '@/components/ui'

export function Aliases() {
  const { db, actions } = useDb()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [hostUid, setHostUid] = useState(db.hosts[0]?.hostUid ?? '')
  const [alias, setAlias] = useState('')
  const [touched, setTouched] = useState(false)
  const [removing, setRemoving] = useState<{ hostUid: string; alias: string } | null>(null)
  const [cmd, setCmd] = useState(`${db.rules.commandPrefix}星河100`)

  const conflicts = findAliasConflicts(db.hosts)
  const conflictSet = new Set(conflicts.map((c) => c.alias.toLowerCase()))
  const error = validateAlias(alias, db.hosts, db.rules, hostUid)
  const parsed = parseCommand(cmd, db.hosts, db.rules)
  const totalAliases = db.hosts.reduce((s, h) => s + h.aliases.length, 0)

  const rows = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return db.hosts.filter((h) => !kw || [h.hostName, ...h.aliases].some((a) => a.toLowerCase().includes(kw)))
  }, [db.hosts, q])

  const add = () => {
    setTouched(true)
    if (error) return
    actions.addAlias(hostUid, alias)
    toast(`已为 ${db.hosts.find((h) => h.hostUid === hostUid)?.hostName} 添加别名「${alias.trim()}」`)
    setAlias('')
    setTouched(false)
  }

  return (
    <>
      <PageHeader
        eyebrow="主播运营"
        title="别名管理"
        desc={`观众在直播间发送「${db.rules.commandPrefix}别名数量」即可向主播转分。别名必须全局唯一，否则命令无法唯一匹配主播。`}
        actions={
          <>
            <Tag theme="brand">{totalAliases} 个别名</Tag>
            <Tag theme={conflicts.length ? 'danger' : 'success'}>{conflicts.length ? `${conflicts.length} 个冲突` : '无冲突'}</Tag>
          </>
        }
      />

      {conflicts.length > 0 && (
        <Card className="mb-5 border border-danger/15">
          <CardTitle title={<span className="flex items-center gap-2 text-danger"><AlertTriangle className="size-4" /> 别名冲突</span>} sub="冲突的别名在转分时会被判定为「别名无效」，请尽快处理" />
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {conflicts.map((c) => (
              <div key={c.alias + c.reason} className="rounded-control bg-danger-soft/60 p-4">
                <div className="flex items-center gap-2">
                  <span className="font-num text-section font-bold text-danger">「{c.alias}」</span>
                  <span className="text-caption text-danger/80">{c.reason}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {c.hosts.map((h) => {
                    const own = h.aliases.find((a) => a.toLowerCase() === c.alias.toLowerCase())
                    return (
                      <div key={h.hostUid} className="flex items-center gap-2 rounded-full bg-card py-1 pr-1 pl-3 shadow-raised-sm">
                        <span className="text-caption font-semibold text-ink">{h.hostName}</span>
                        {own ? (
                          <Button theme="danger" size="small" onClick={() => setRemoving({ hostUid: h.hostUid, alias: own })}>
                            移除此别名
                          </Button>
                        ) : (
                          <span className="pr-2 text-micro text-muted">（昵称）</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-12 gap-5">
        <Card flush className="col-span-12 xl:col-span-8">
          <Toolbar>
            <SearchInput value={q} onChange={setQ} placeholder="搜索别名或主播昵称" />
          </Toolbar>
          {rows.length === 0 ? (
            <Empty title="未找到匹配的别名" action={<Button theme="light" size="small" onClick={() => setQ('')}>清除搜索</Button>} />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>主播</Th>
                  <Th>别名（点击 × 删除）</Th>
                  <Th align="center">状态</Th>
                  <Th align="right">操作</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((h) => (
                  <Tr key={h.hostUid} active={h.hostUid === hostUid}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={h.hostName} index={db.hosts.indexOf(h)} size="sm" />
                        <div>
                          <div className={cx('font-semibold', conflictSet.has(h.hostName.toLowerCase()) ? 'text-danger' : 'text-ink')}>{h.hostName}</div>
                          <div className="font-num text-micro text-muted">{h.hostUid}</div>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1.5">
                        {h.aliases.length === 0 && <span className="text-caption text-muted">未设置别名</span>}
                        {h.aliases.map((a) => {
                          const bad = conflictSet.has(a.toLowerCase()) || /\d$/.test(a)
                          return (
                            <span key={a} className={cx('inline-flex h-7 items-center gap-0.5 rounded-full pr-0.5 pl-2.5 text-caption font-semibold', bad ? 'bg-danger-soft text-danger' : 'bg-brand-soft text-brand-ink')}>
                              {bad && <AlertTriangle className="mr-0.5 size-3" aria-label="冲突" />}
                              {a}
                              <button type="button" aria-label={`删除别名 ${a}`} onClick={() => setRemoving({ hostUid: h.hostUid, alias: a })} className="flex size-6 cursor-pointer items-center justify-center rounded-full hover:bg-card">
                                <X className="size-3" />
                              </button>
                            </span>
                          )
                        })}
                      </div>
                    </Td>
                    <Td align="center">{h.enabled ? <Tag theme="success">转分开启</Tag> : <Tag>转分关闭</Tag>}</Td>
                    <Td align="right">
                      <Button theme="light" size="small" icon={<Plus className="size-3.5" />} onClick={() => { setHostUid(h.hostUid); document.getElementById('alias-input')?.focus() }}>
                        添加
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
          <div className="h-3" />
        </Card>

        <div className="col-span-12 space-y-5 xl:col-span-4">
          <Card>
            <CardTitle title={<span className="flex items-center gap-2"><Tags className="size-4 text-brand-ink" /> 新增别名</span>} />
            <div className="space-y-4">
              <Field label="主播">
                {(id) => (
                  <Select id={id} value={hostUid} onChange={(e) => setHostUid(e.target.value)}>
                    {db.hosts.map((h) => (
                      <option key={h.hostUid} value={h.hostUid}>
                        {h.hostName}（{h.hostUid}）
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="别名" error={touched || alias ? (alias ? error : touched ? error : null) : null} hint={!error && alias ? <span className="text-success">可以使用</span> : `最多 ${db.rules.aliasMaxLength} 字，不能以数字结尾`}>
                {() => (
                  <TextInput id="alias-input" value={alias} onChange={(e) => setAlias(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="例如：星河" invalid={!!alias && !!error} />
                )}
              </Field>
              {alias && !error && (
                <div className="rounded-control bg-page px-4 py-2.5 text-caption text-muted shadow-inset-sm">
                  观众命令示例：<span className="font-num font-bold text-ink">{db.rules.commandPrefix}{alias.trim()}100</span>
                </div>
              )}
              <Button block onClick={add} icon={<Plus className="size-4" />}>
                添加别名
              </Button>
            </div>
          </Card>

          <Card>
            <CardTitle title={<span className="flex items-center gap-2"><Terminal className="size-4 text-brand-ink" /> 命令解析测试</span>} sub="按当前别名与规则预览服务端识别结果" />
            <TextInput value={cmd} onChange={(e) => setCmd(e.target.value)} placeholder={`${db.rules.commandPrefix}别名数量`} className="font-num" aria-label="测试命令" />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[`${db.rules.commandPrefix}阿柚50`, `${db.rules.commandPrefix}kiki2000`, `${db.rules.commandPrefix}团子100`, `${db.rules.commandPrefix}小明100`, '给星河100'].map((s) => (
                <button key={s} type="button" onClick={() => setCmd(s)} className={cx('press h-7 cursor-pointer rounded-full px-3 font-num text-micro font-semibold', cmd === s ? 'bg-page text-brand-ink shadow-inset-sm' : 'bg-card text-ink shadow-raised-sm')}>
                  {s}
                </button>
              ))}
            </div>
            <div className="mt-3">
              {parsed.status === 'empty' && <Notice theme="brand">输入命令以预览识别结果</Notice>}
              {parsed.status === 'ok' && (
                <div className="rounded-control bg-success-soft p-3.5">
                  <div className="flex items-center gap-1.5 text-body font-semibold text-success">
                    <CheckCircle2 className="size-4" /> 可识别 <Tag theme="success" className="ml-auto">唯一匹配</Tag>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-micro text-muted">匹配别名</div>
                      <div className="truncate text-caption font-semibold text-ink">{parsed.alias}</div>
                    </div>
                    <div>
                      <div className="text-micro text-muted">目标主播</div>
                      <div className="truncate text-caption font-semibold text-ink">{parsed.host.hostName}</div>
                    </div>
                    <div>
                      <div className="text-micro text-muted">转出温度值</div>
                      <div className="font-num text-caption font-semibold text-ink">{parsed.amount}</div>
                    </div>
                  </div>
                </div>
              )}
              {parsed.status !== 'empty' && parsed.status !== 'ok' && <Notice theme={parsed.status === 'limit' ? 'warning' : 'danger'}>{parsed.message}</Notice>}
            </div>
          </Card>

          <Card>
            <CardTitle title="别名规则" />
            <ul className="space-y-2 text-caption text-muted">
              {[
                '别名与主播昵称在全部主播中唯一，不区分大小写',
                '不能包含空格或 #，不能以数字结尾（避免与数量混淆）',
                '关闭「转分」的主播，其别名不会被识别',
                '删除别名立即生效，进行中的命令以服务端处理时刻为准',
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={!!removing}
        title={`删除别名「${removing?.alias}」？`}
        danger
        confirmText="删除"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          actions.removeAlias(removing!.hostUid, removing!.alias)
          toast(`已删除别名「${removing!.alias}」`)
          setRemoving(null)
        }}
      >
        删除后观众使用「{db.rules.commandPrefix}{removing?.alias}数量」将无法转分给 {db.hosts.find((h) => h.hostUid === removing?.hostUid)?.hostName}。
      </ConfirmDialog>
    </>
  )
}
