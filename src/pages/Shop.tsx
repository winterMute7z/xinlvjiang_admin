import { useMemo, useState } from 'react'
import { CheckCircle2, Download, ImagePlus, Pencil, Plus, QrCode, ScanLine, ShoppingBag, TicketCheck } from 'lucide-react'
import { useDb } from '@/lib/store'
import type { ShopProduct, ShopPurchase, ShopPurchaseStatus } from '@/lib/types'
import { downloadCsv, fmt, fmtDate, fmtDateTime } from '@/lib/utils'
import {
  Button,
  Card,
  CardTitle,
  Drawer,
  Empty,
  Field,
  IconButton,
  LineTabs,
  Modal,
  Notice,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  StatCard,
  Switch,
  Table,
  Tag,
  Td,
  Textarea,
  TextInput,
  Th,
  Toolbar,
  Tr,
  usePaged,
  useToast,
} from '@/components/ui'

type ShopTab = 'products' | 'purchases' | 'usage'
type ProductStatus = 'all' | 'enabled' | 'disabled'

const PURCHASE_STATUS: Record<ShopPurchaseStatus, { label: string; theme: 'success' | 'warning' | 'default' }> = {
  paid: { label: '待使用', theme: 'warning' },
  used: { label: '已使用', theme: 'success' },
  cancelled: { label: '已取消', theme: 'default' },
}

function newProduct(): ShopProduct {
  const now = new Date().toISOString()
  return { id: `P-${Date.now().toString().slice(-6)}`, name: '', image: '', description: '', price: 0, stock: 0, fulfillment: 'physical', isHostProp: false, enabled: true, createdAt: now, updatedAt: now }
}

export function Shop() {
  const { db } = useDb()
  const [tab, setTab] = useState<ShopTab>('products')
  const pending = db.shopPurchases.filter((p) => p.status === 'paid').length
  const used = db.shopUsages.length
  return (
    <>
      <PageHeader
        eyebrow="观众与温度值"
        title="商店管理"
        desc="管理温度值商城商品、商品图片，并查看商品购买与使用记录；已上架商品及图片会同步到小程序商店。"
        actions={tab === 'products' ? <ProductActions /> : undefined}
      />
      <div className="mb-5 grid grid-cols-2 gap-5 lg:grid-cols-4">
        <StatCard icon={<ShoppingBag className="size-4" />} label="商品总数" value={db.products.length} unit="件" foot={`${db.products.filter((p) => p.enabled).length} 件已上架`} onClick={() => setTab('products')} />
        <StatCard icon={<TicketCheck className="size-4" />} label="待使用订单" value={pending} unit="笔" foot="可在购买记录中核销" tone="warning" onClick={() => setTab('purchases')} />
        <StatCard icon={<CheckCircle2 className="size-4" />} label="已使用记录" value={used} unit="笔" foot="商品核销流水" tone="success" onClick={() => setTab('usage')} />
        <StatCard icon={<ShoppingBag className="size-4" />} label="累计销售温度值" value={fmt(db.shopPurchases.filter((p) => p.status !== 'cancelled').reduce((sum, p) => sum + p.amount, 0))} unit="温度值" foot="已购买与已使用订单" />
      </div>
      <div className="mb-5">
        <LineTabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'products', label: '商品管理' },
            { value: 'purchases', label: '购买记录', badge: pending },
            { value: 'usage', label: '使用记录' },
          ]}
        />
      </div>
      {tab === 'products' ? <Products /> : tab === 'purchases' ? <Purchases /> : <Usages />}
    </>
  )
}

function ProductActions() {
  const [editing, setEditing] = useState(false)
  return (
    <>
      <Button icon={<Plus className="size-4" />} onClick={() => setEditing(true)}>新增商品</Button>
      {editing && <ProductEditor initial={newProduct()} isNew onClose={() => setEditing(false)} />}
    </>
  )
}

function Products() {
  const { db, actions } = useDb()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<ProductStatus>('all')
  const [editing, setEditing] = useState<{ product: ShopProduct; isNew: boolean } | null>(null)
  const rows = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return db.products.filter((p) => {
      if (status === 'enabled' && !p.enabled) return false
      if (status === 'disabled' && p.enabled) return false
      return !kw || [p.id, p.name, p.description].some((x) => x.toLowerCase().includes(kw))
    })
  }, [db.products, q, status])
  const paged = usePaged(rows, 8)
  return (
    <Card flush>
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="搜索商品名称、ID 或描述" />
        <Select value={status} onChange={(e) => setStatus(e.target.value as ProductStatus)} aria-label="商品状态" className="w-36">
          <option value="all">全部商品</option>
          <option value="enabled">已上架</option>
          <option value="disabled">已下架</option>
        </Select>
        {(q || status !== 'all') && <Button theme="text" size="small" onClick={() => { setQ(''); setStatus('all') }}>清除筛选</Button>}
      </Toolbar>
      {rows.length === 0 ? <Empty title="暂无匹配商品" description="调整搜索或筛选条件后重试" /> : (
        <>
          <Table>
            <thead><tr><Th>商品</Th><Th>类型</Th><Th align="right">兑换价格</Th><Th align="right">库存</Th><Th>状态</Th><Th>更新时间</Th><Th align="right">操作</Th></tr></thead>
            <tbody>
              {paged.slice.map((p) => (
                <Tr key={p.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      {p.image ? <img src={p.image} alt="" className="size-10 shrink-0 rounded-control object-cover shadow-inset-sm" /> : <div className="flex size-10 shrink-0 items-center justify-center rounded-control bg-page text-muted shadow-inset-sm"><ImagePlus className="size-4" /></div>}
                      <div className="min-w-0"><div className="font-semibold text-ink">{p.name}</div>
                    <div className="mt-0.5 max-w-80 truncate text-micro text-muted">{p.id} · {p.description || '暂无描述'}</div>
                      </div>
                    </div>
                  </Td>
                  <Td><div className="flex flex-wrap gap-1.5"><Tag theme={p.isHostProp ? 'warning' : 'default'}>{p.isHostProp ? '主播道具' : '普通商品'}</Tag><Tag theme={(p.fulfillment ?? 'physical') === 'virtual' ? 'brand' : 'default'}>{(p.fulfillment ?? 'physical') === 'virtual' ? '虚拟商品' : '实体商品'}</Tag></div></Td>
                  <Td align="right" className="font-num font-bold text-ink">{fmt(p.price)} 温度值</Td>
                  <Td align="right" className="font-num text-ink">{p.stock === null ? '不限' : fmt(p.stock)}</Td>
                  <Td><Tag theme={p.enabled ? 'success' : 'default'}>{p.enabled ? '已上架' : '已下架'}</Tag></Td>
                  <Td className="font-num text-caption text-muted">{fmtDateTime(p.updatedAt, true)}</Td>
                  <Td align="right">
                    <div className="flex justify-end gap-2">
                      <Switch checked={p.enabled} onChange={() => { const r = actions.toggleProduct(p.id); toast(r.message ?? '', r.ok ? 'success' : 'danger') }} label={`${p.name} ${p.enabled ? '下架' : '上架'}`} />
                      <IconButton label="编辑商品" size="sm" onClick={() => setEditing({ product: p, isNew: false })}><Pencil className="size-4" /></IconButton>
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <Pagination {...paged} />
        </>
      )}
      {editing && <ProductEditor initial={editing.product} isNew={editing.isNew} onClose={() => setEditing(null)} />}
    </Card>
  )
}

function Purchases() {
  const { db, actions } = useDb()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'all' | ShopPurchaseStatus>('all')
  const [using, setUsing] = useState<ShopPurchase | null>(null)
  const [note, setNote] = useState('')
  const [redeemOpen, setRedeemOpen] = useState(false)
  const [redeemMode, setRedeemMode] = useState<'scan' | 'manual'>('scan')
  const [redeemCode, setRedeemCode] = useState('')
  const [redeemNote, setRedeemNote] = useState('')
  const [redeemAddress, setRedeemAddress] = useState('')
  const productById = useMemo(() => new Map(db.products.map((p) => [p.id, p])), [db.products])
  const redeemPurchase = redeemCode.trim() ? db.shopPurchases.find((p) => p.redemptionCode === redeemCode.trim()) : undefined
  const rows = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return db.shopPurchases.filter((p) => {
      if (status !== 'all' && p.status !== status) return false
      return !kw || [p.id, p.productName, p.buyerName, p.buyerUid].some((x) => x.toLowerCase().includes(kw))
    }).sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt))
  }, [db.shopPurchases, q, status])
  const paged = usePaged(rows, 10)
  const exportRows = rows.map((p) => [p.id, fmtDateTime(p.purchasedAt, true), p.buyerName, p.buyerUid, p.productName, p.quantity, p.amount, PURCHASE_STATUS[p.status].label, p.usedAt ? fmtDateTime(p.usedAt, true) : ''])
  return (
    <Card flush>
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="搜索订单、商品或购买者" />
        <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="购买状态" className="w-36">
          <option value="all">全部状态</option><option value="paid">待使用</option><option value="used">已使用</option><option value="cancelled">已取消</option>
        </Select>
        <div className="flex-1" />
        <Button icon={<ScanLine className="size-4" />} onClick={() => { setRedeemOpen(true); setRedeemMode('scan'); setRedeemCode(''); setRedeemNote(''); setRedeemAddress('') }}>扫码核销</Button>
        <Button theme="light" icon={<QrCode className="size-4" />} onClick={() => { setRedeemOpen(true); setRedeemMode('manual'); setRedeemCode(''); setRedeemNote(''); setRedeemAddress('') }}>手动输入核销码</Button>
        <Button theme="light" icon={<Download className="size-4" />} onClick={() => downloadCsv(`商品购买记录_${fmtDate(new Date().toISOString())}.csv`, ['订单ID', '购买时间', '购买者', '斗鱼UID', '商品', '数量', '温度值', '状态', '使用时间'], exportRows)}>导出</Button>
      </Toolbar>
      {rows.length === 0 ? <Empty title="暂无购买记录" description="调整搜索或筛选条件后重试" /> : (
        <>
          <Table>
            <thead><tr><Th>购买时间</Th><Th>购买者</Th><Th>商品</Th><Th align="right">数量</Th><Th align="right">温度值</Th><Th>状态</Th><Th align="right">操作</Th></tr></thead>
            <tbody>
              {paged.slice.map((p) => (
                <Tr key={p.id}>
                  <Td className="font-num text-caption text-muted">{fmtDateTime(p.purchasedAt, true)}<div className="text-micro">{p.id}</div></Td>
                  <Td><div className="font-semibold text-ink">{p.buyerName}</div><div className="font-num text-micro text-muted">{p.buyerUid}</div></Td>
                  <Td><div className="font-semibold text-ink">{p.productName}</div><div className="mt-0.5 text-micro text-muted">{(p.fulfillment ?? productById.get(p.productId)?.fulfillment ?? 'physical') === 'virtual' ? '虚拟商品' : '实体商品'}{p.redemptionCode ? ` · 核销码 ${p.redemptionCode}` : ''}</div>{p.shippingAddress && <div className="mt-0.5 max-w-64 truncate text-micro text-muted">收货地址：{p.shippingAddress}</div>}{p.note && <div className="mt-0.5 text-micro text-muted">{p.note}</div>}</Td>
                  <Td align="right" className="font-num text-ink">{p.quantity}</Td>
                  <Td align="right" className="font-num font-bold text-ink">{fmt(p.amount)}</Td>
                  <Td><Tag theme={PURCHASE_STATUS[p.status].theme}>{PURCHASE_STATUS[p.status].label}</Tag></Td>
                  <Td align="right">{p.status === 'paid' ? <Button size="small" icon={<TicketCheck className="size-3.5" />} onClick={() => { setUsing(p); setNote('') }}>核销</Button> : <span className="text-micro text-muted">{p.usedAt ? fmtDateTime(p.usedAt, true) : '—'}</span>}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <Pagination {...paged} />
        </>
      )}
      <Modal open={!!using} onClose={() => setUsing(null)} title="核销商品" desc={using ? `${using.productName} · ${using.buyerName} · ${using.quantity} 件` : undefined} footer={<><Button theme="outline" onClick={() => setUsing(null)}>取消</Button><Button onClick={() => { if (!using) return; const r = actions.useShopPurchase(using.id, note); toast(r.message ?? '', r.ok ? 'success' : 'danger'); if (r.ok) setUsing(null) }}>确认核销</Button></>}>
        <div className="space-y-4 pb-3"><Notice theme="brand">核销后会生成一条使用记录，订单状态变为“已使用”。{using?.redemptionCode && ` 当前核销码：${using.redemptionCode}`}</Notice>{using?.shippingAddress && <div className="rounded-control bg-page px-3 py-2 text-caption text-muted">收货地址：{using.shippingAddress}</div>}<Field label="使用备注" hint="可选，例如领取地点、核销凭证等">{(id) => <Textarea id={id} rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="填写本次使用说明" />}</Field></div>
      </Modal>
      <Modal open={redeemOpen} onClose={() => setRedeemOpen(false)} title={redeemMode === 'scan' ? '扫码核销' : '手动输入核销码'} desc="支持 6 位数字核销码；扫码枪可直接在输入框中输入">
        <div className="space-y-4 pb-3">
          <div className="flex gap-2 rounded-control bg-page p-1 shadow-inset-sm">
            <button type="button" className={`flex-1 rounded-control px-3 py-2 text-caption font-semibold ${redeemMode === 'scan' ? 'bg-card text-brand-ink shadow-raised-sm' : 'text-muted'}`} onClick={() => setRedeemMode('scan')}><ScanLine className="mr-1 inline size-4" />扫码核销</button>
            <button type="button" className={`flex-1 rounded-control px-3 py-2 text-caption font-semibold ${redeemMode === 'manual' ? 'bg-card text-brand-ink shadow-raised-sm' : 'text-muted'}`} onClick={() => setRedeemMode('manual')}><QrCode className="mr-1 inline size-4" />手动输码</button>
          </div>
          {redeemMode === 'scan' && <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-brand/40 bg-brand-soft/30 px-6 py-7 text-center"><div className="flex size-16 items-center justify-center rounded-full bg-card text-brand-ink shadow-raised-sm"><ScanLine className="size-8" /></div><div className="text-body font-semibold text-ink">将用户二维码放入扫描框</div><div className="text-caption text-muted">原型预览使用核销码模拟扫码结果</div></div>}
          <Field label="6 位核销码" hint="扫码枪或手动输入后会自动匹配订单">{(id) => <TextInput id={id} value={redeemCode} maxLength={6} inputMode="numeric" onChange={(e) => setRedeemCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="例如 735204" />}</Field>
          <button type="button" className="text-caption font-semibold text-brand-ink hover:underline" onClick={() => setRedeemCode('735204')}>填入待使用演示码 735204</button>
          {redeemPurchase && <div className="space-y-1 rounded-control bg-success-soft px-3.5 py-3 text-caption"><div className="font-semibold text-success">已匹配订单 {redeemPurchase.id}</div><div className="text-muted">{redeemPurchase.productName} · {redeemPurchase.buyerName} · {redeemPurchase.quantity} 件</div><div className="text-muted">{(redeemPurchase.fulfillment ?? productById.get(redeemPurchase.productId)?.fulfillment ?? 'physical') === 'virtual' ? '虚拟商品，确认后立即核销' : '实体商品，核销后按收货地址处理'}</div>{redeemPurchase.shippingAddress && <div className="text-muted">收货地址：{redeemPurchase.shippingAddress}</div>}</div>}
          <Field label="实体商品收货地址" hint="仅实体商品需要填写；可沿用订单地址">{(id) => <Textarea id={id} rows={2} value={redeemAddress} onChange={(e) => setRedeemAddress(e.target.value)} placeholder="可选，填写或确认收货地址" />}</Field>
          <Field label="核销备注" hint="可选">{(id) => <Textarea id={id} rows={2} value={redeemNote} onChange={(e) => setRedeemNote(e.target.value)} placeholder="例如：线下领取、已交付" />}</Field>
        </div>
        <div className="-mx-6 -mb-6 flex justify-end gap-2 border-t border-line px-6 py-4"><Button theme="outline" onClick={() => setRedeemOpen(false)}>取消</Button><Button disabled={!redeemPurchase} onClick={() => { if (!redeemPurchase) return; const r = actions.useShopPurchaseByCode(redeemCode, redeemNote, redeemAddress); toast(r.message ?? '', r.ok ? 'success' : 'danger'); if (r.ok) { setRedeemOpen(false); setRedeemCode(''); setRedeemNote(''); setRedeemAddress('') } }}>确认核销</Button></div>
      </Modal>
    </Card>
  )
}

function Usages() {
  const { db } = useDb()
  const [q, setQ] = useState('')
  const rows = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return db.shopUsages.filter((u) => !kw || [u.id, u.purchaseId, u.productName, u.buyerName, u.buyerUid, u.operator].some((x) => x.toLowerCase().includes(kw))).sort((a, b) => b.usedAt.localeCompare(a.usedAt))
  }, [db.shopUsages, q])
  const paged = usePaged(rows, 10)
  return (
    <Card flush>
      <Toolbar><SearchInput value={q} onChange={setQ} placeholder="搜索商品、购买者或核销人" /><div className="flex-1" /><Button theme="light" icon={<Download className="size-4" />} onClick={() => downloadCsv(`商品使用记录_${fmtDate(new Date().toISOString())}.csv`, ['记录ID', '使用时间', '商品', '购买者', '斗鱼UID', '数量', '核销人', '备注'], rows.map((u) => [u.id, fmtDateTime(u.usedAt, true), u.productName, u.buyerName, u.buyerUid, u.quantity, u.operator, u.note ?? '']))}>导出</Button></Toolbar>
      {rows.length === 0 ? <Empty title="暂无使用记录" description="商品核销后会在这里留下记录" /> : (
        <><Table><thead><tr><Th>使用时间</Th><Th>商品</Th><Th>购买者</Th><Th align="right">数量</Th><Th>核销信息</Th><Th>核销人</Th><Th>备注</Th></tr></thead><tbody>{paged.slice.map((u) => <Tr key={u.id}><Td className="font-num text-caption text-muted">{fmtDateTime(u.usedAt, true)}<div className="text-micro">{u.id}</div></Td><Td><div className="font-semibold text-ink">{u.productName}</div><div className="text-micro text-muted">订单 {u.purchaseId}</div></Td><Td><div className="font-semibold text-ink">{u.buyerName}</div><div className="font-num text-micro text-muted">{u.buyerUid}</div></Td><Td align="right" className="font-num text-ink">{u.quantity}</Td><Td className="max-w-56 text-caption text-muted">{u.redemptionCode ? `核销码 ${u.redemptionCode}` : u.shippingAddress ? `收货地址：${u.shippingAddress}` : '—'}</Td><Td>{u.operator}</Td><Td className="max-w-56 text-caption text-muted">{u.note || '—'}</Td></Tr>)}</tbody></Table><Pagination {...paged} /></>
      )}
    </Card>
  )
}

function ProductEditor({ initial, isNew, onClose }: { initial: ShopProduct; isNew: boolean; onClose: () => void }) {
  const { actions } = useDb()
  const toast = useToast()
  const [p, setP] = useState(initial)
  const [touched, setTouched] = useState(false)
  const chooseImage = (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast('请选择图片文件', 'danger')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast('图片不能超过 5MB', 'danger')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setP((x) => ({ ...x, image: typeof reader.result === 'string' ? reader.result : '' }))
    reader.readAsDataURL(file)
  }
  const nameError = !p.name.trim() ? '请输入商品名称' : null
  const priceError = !Number.isFinite(p.price) || p.price < 0 ? '请输入有效的温度值价格' : null
  const valid = !nameError && !priceError && (p.stock === null || (Number.isInteger(p.stock) && p.stock >= 0))
  const save = () => {
    setTouched(true)
    if (!valid) return
    const r = actions.saveProduct(p, isNew)
    toast(r.message ?? '', r.ok ? 'success' : 'danger')
    if (r.ok) onClose()
  }
  return (
    <Drawer open onClose={onClose} title={isNew ? '新增商品' : `编辑商品 · ${initial.name}`} sub={`${p.id} · 商品信息会记录在操作日志中`} footer={<><Button theme="outline" onClick={onClose}>取消</Button><Button onClick={save}>保存商品</Button></>}>
      <div className="space-y-5">
        <Card className="space-y-4"><div className="text-caption font-bold text-ink">商品信息</div><Field label="商品名称" required error={touched ? nameError : null}>{(id) => <TextInput id={id} value={p.name} onChange={(e) => setP((x) => ({ ...x, name: e.target.value }))} placeholder="例如：驴酱定制马克杯" invalid={touched && !!nameError} />}</Field><Field label="商品图片" hint="选择本地图片，建议使用 1:1 方图，单张不超过 5MB">{(id) => <div className="flex items-center gap-2"><input id={id} type="file" accept="image/*" className="sr-only" onChange={(e) => chooseImage(e.target.files?.[0])} /><label htmlFor={id} className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-control bg-brand-deep px-3.5 text-caption font-semibold text-highlight shadow-raised-sm transition hover:brightness-105"><ImagePlus className="size-4" />选择图片</label>{p.image && <button type="button" className="text-caption font-semibold text-danger hover:underline" onClick={() => setP((x) => ({ ...x, image: '' }))}>移除图片</button>}</div>}</Field>{p.image ? <div className="flex items-center gap-3 rounded-control bg-page p-3 shadow-inset-sm"><img src={p.image} alt="商品图片预览" className="size-16 rounded-control object-cover" /><div className="min-w-0 text-micro text-muted">图片预览 · 保存后同步到小程序商品卡片</div></div> : <div className="flex items-center gap-2 rounded-control bg-page px-3.5 py-3 text-caption text-muted shadow-inset-sm"><ImagePlus className="size-4" />未设置图片，将使用默认商品图标</div>}<Field label="商品描述" hint="用于后台识别商品，后续可同步到小程序">{(id) => <Textarea id={id} rows={3} value={p.description} onChange={(e) => setP((x) => ({ ...x, description: e.target.value }))} placeholder="填写商品用途、兑换说明等" />}</Field></Card>
        <Card className="space-y-4"><div className="text-caption font-bold text-ink">兑换与库存</div><Field label="兑换价格" required error={touched ? priceError : null}>{(id) => <TextInput id={id} inputMode="numeric" value={String(p.price)} onChange={(e) => setP((x) => ({ ...x, price: Number(e.target.value.replace(/\D/g, '') || 0) }))} suffix="温度值" invalid={touched && !!priceError} />}</Field><Field label="商品形态" hint="虚拟商品使用动态二维码核销，实体商品使用收货地址">{(id) => <Select id={id} value={p.fulfillment ?? 'physical'} onChange={(e) => setP((x) => ({ ...x, fulfillment: e.target.value as ShopProduct['fulfillment'] }))}><option value="physical">实体商品</option><option value="virtual">虚拟商品</option></Select>}</Field><div className="flex items-center justify-between gap-4"><div><div className="text-body font-semibold text-ink">主播道具</div><div className="text-caption text-muted">观众兑换后选择主播赠送，按钮显示为“赠送”</div></div><Switch checked={p.isHostProp} onChange={(v) => setP((x) => ({ ...x, isHostProp: v }))} label="主播道具" /></div><div className="flex items-center justify-between gap-4"><div><div className="text-body font-semibold text-ink">不限库存</div><div className="text-caption text-muted">适用于电子凭证、服务类商品</div></div><Switch checked={p.stock === null} onChange={(v) => setP((x) => ({ ...x, stock: v ? null : 0 }))} label="不限库存" /></div>{p.stock !== null && <Field label="库存数量" hint="设置为 0 后商品会显示售罄状态">{(id) => <TextInput id={id} inputMode="numeric" value={String(p.stock)} onChange={(e) => setP((x) => ({ ...x, stock: Number(e.target.value.replace(/\D/g, '') || 0) }))} suffix="件" />}</Field>}</Card>
        <Card className="space-y-4"><div className="flex items-center justify-between gap-4"><div><div className="text-body font-semibold text-ink">商品状态</div><div className="text-caption text-muted">下架后小程序不会展示该商品</div></div><Switch checked={p.enabled} onChange={(v) => setP((x) => ({ ...x, enabled: v }))} label="商品上架" /></div></Card>
      </div>
    </Drawer>
  )
}
