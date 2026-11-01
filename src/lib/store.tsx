import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Admin, AppealStatus, DbState, Host, HostBindingReviewStatus, Ledger, Rules, Season, ShopProduct, TeamConfig, Transfer, Viewer } from './types'
import { DB_VERSION, createSeed } from './seed'
import { activeSeason, parseCommand, renderBotReply, uid } from './utils'

const KEY = 'xlj-admin-db'

function load(): DbState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      // 兼容更名之前保存的演示数据，让旧记录中的“积分”在界面中同步显示为“温度值”。
      const migrated = raw.replace(/积分/g, '温度值')
      const parsed = JSON.parse(migrated) as DbState
      if (parsed.version === DB_VERSION) return parsed
    }
  } catch {
    /* fall through to seed */
  }
  return createSeed()
}

type Result = { ok: true; message?: string } | { ok: false; message: string }

function useDbState(operator: string) {
  const [db, setDb] = useState<DbState>(load)
  const opRef = useRef(operator)
  opRef.current = operator

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(db))
  }, [db])

  const commit = useCallback((fn: (d: DbState) => DbState, audit?: { module: string; action: string; target: string; detail: string }) => {
    setDb((prev) => {
      const next = fn(prev)
      if (!audit) return next
      return {
        ...next,
        audit: [{ id: uid('AU'), time: new Date().toISOString(), operator: opRef.current, ...audit }, ...next.audit],
      }
    })
  }, [])

  const hostLabel = (h: Host) => `${h.hostName} (${h.hostUid})`
  const hostBindingStatus = (d: DbState, douyuUid: string): HostBindingReviewStatus => activeSeason(d.seasons) && d.hosts.some((h) => h.inSeason && h.douyuUid === douyuUid) ? 'pending' : 'not_required'

  const redeemShopPurchase = (id: string, note: string, shippingAddress?: string): Result => {
    const purchase = db.shopPurchases.find((p) => p.id === id)
    if (!purchase) return { ok: false, message: '购买记录不存在' }
    if (purchase.status !== 'paid') return { ok: false, message: purchase.status === 'used' ? '该订单已经使用' : '该订单已取消，无法核销' }
    const redemptionCode = purchase.redemptionCode?.trim()
    const address = shippingAddress?.trim() || purchase.shippingAddress?.trim()
    const usedAt = new Date().toISOString()
    const usage = {
      id: uid('SU'),
      purchaseId: purchase.id,
      productId: purchase.productId,
      productName: purchase.productName,
      buyerUid: purchase.buyerUid,
      buyerName: purchase.buyerName,
      quantity: purchase.quantity,
      usedAt,
      operator: opRef.current,
      redemptionCode,
      shippingAddress: address,
      note: note.trim() || undefined,
    }
    commit(
      (d) => ({
        ...d,
        shopPurchases: d.shopPurchases.map((p) => (p.id === id ? { ...p, status: 'used' as const, usedAt, shippingAddress: address || p.shippingAddress, note: note.trim() || undefined } : p)),
        shopUsages: [usage, ...d.shopUsages],
      }),
      { module: '商店', action: '核销商品', target: `${purchase.productName} · ${purchase.buyerName}`, detail: `${purchase.quantity} 件${redemptionCode ? ` · 核销码 ${redemptionCode}` : ''}${address ? ` · 地址已登记` : ''}${note.trim() ? ` · ${note.trim()}` : ''}` },
    )
    return { ok: true, message: '商品已核销，使用记录已生成' }
  }

  const actions = {
    /* ---------- Hosts ---------- */
    saveHost(host: Host, isNew: boolean): Result {
      if (isNew && db.hosts.some((h) => h.hostUid === host.hostUid)) return { ok: false, message: '主播 UID 已存在' }
      if (db.hosts.some((h) => h.roomId === host.roomId && h.hostUid !== host.hostUid))
        return { ok: false, message: '该房间号已被其他主播使用' }
      commit(
        (d) => ({
          ...d,
          hosts: isNew
            ? [...d.hosts, { ...host, isCaptain: d.rules.bindRoomHostUid === host.hostUid || !host.teamId ? false : host.isCaptain }]
            : d.hosts.map((h) =>
                h.hostUid === host.hostUid
                  ? { ...host, isCaptain: d.rules.bindRoomHostUid === host.hostUid || !host.teamId ? false : host.isCaptain }
                  : h,
              ),
          collectors: isNew
            ? [...d.collectors, { hostUid: host.hostUid, state: host.collect ? 'ok' : 'down', latencyMs: 180, lastMessage: new Date().toISOString() }]
            : d.collectors,
        }),
        { module: '主播', action: isNew ? '新增主播' : '编辑主播', target: hostLabel(host), detail: `房间 ${host.roomId} · 别名 ${host.aliases.join('、') || '无'}` },
      )
      return { ok: true, message: isNew ? '已新增主播' : '已保存修改' }
    },
    deleteHost(hostUid: string): Result {
      const h = db.hosts.find((x) => x.hostUid === hostUid)
      if (!h) return { ok: false, message: '主播不存在' }
      if (db.rules.bindRoomHostUid === hostUid) return { ok: false, message: '该主播是绑定主直播间，请先在规则配置中更换' }
      commit((d) => ({ ...d, hosts: d.hosts.filter((x) => x.hostUid !== hostUid), collectors: d.collectors.filter((c) => c.hostUid !== hostUid) }), {
        module: '主播',
        action: '删除主播',
        target: hostLabel(h),
        detail: '历史流水保留',
      })
      return { ok: true, message: `已删除 ${h.hostName}` }
    },
    toggleHost(hostUid: string, field: 'enabled' | 'collect') {
      const h = db.hosts.find((x) => x.hostUid === hostUid)!
      const value = !h[field]
      commit(
        (d) => ({
          ...d,
          hosts: d.hosts.map((x) => (x.hostUid === hostUid ? { ...x, [field]: value } : x)),
          collectors: field === 'collect' ? d.collectors.map((c) => (c.hostUid === hostUid ? { ...c, state: value ? 'ok' : 'down' } : c)) : d.collectors,
        }),
        { module: '主播', action: `${value ? '开启' : '关闭'}${field === 'enabled' ? '转分' : '采集'}`, target: hostLabel(h), detail: '' },
      )
    },

    /* ---------- Aliases ---------- */
    addAlias(hostUid: string, alias: string) {
      const h = db.hosts.find((x) => x.hostUid === hostUid)!
      commit((d) => ({ ...d, hosts: d.hosts.map((x) => (x.hostUid === hostUid ? { ...x, aliases: [...x.aliases, alias.trim()] } : x)) }), {
        module: '别名',
        action: '新增别名',
        target: hostLabel(h),
        detail: alias.trim(),
      })
    },
    removeAlias(hostUid: string, alias: string) {
      const h = db.hosts.find((x) => x.hostUid === hostUid)!
      commit((d) => ({ ...d, hosts: d.hosts.map((x) => (x.hostUid === hostUid ? { ...x, aliases: x.aliases.filter((a) => a !== alias) } : x)) }), {
        module: '别名',
        action: '删除别名',
        target: hostLabel(h),
        detail: alias,
      })
    },

    /* ---------- Bindings ---------- */
    setViewerStatus(douyuUid: string, status: Viewer['status'], reason: string) {
      const v = db.viewers.find((x) => x.douyuUid === douyuUid)!
      const label = { bound: v.status === 'frozen' ? '解除冻结' : '恢复绑定', frozen: '冻结账号', unbound: '解除绑定' }[status]
      commit((d) => ({ ...d, viewers: d.viewers.map((x) => (x.douyuUid === douyuUid ? { ...x, status } : x)) }), {
        module: '绑定',
        action: label,
        target: `${v.douyuName} (${v.douyuUid})`,
        detail: reason,
      })
    },
    reviewHostBinding(douyuUid: string, status: Extract<HostBindingReviewStatus, 'approved' | 'rejected'>, reason: string): Result {
      const v = db.viewers.find((x) => x.douyuUid === douyuUid)
      if (!v) return { ok: false, message: '账号不存在' }
      if (v.hostBindingReview !== 'pending') return { ok: false, message: '该账号没有待审核的主播绑定申请' }
      const host = db.hosts.find((h) => h.inSeason && h.douyuUid === douyuUid)
      if (!host) return { ok: false, message: '该账号已不属于当前赛季参赛主播' }
      const now = new Date().toISOString()
      commit(
        (d) => ({ ...d, viewers: d.viewers.map((x) => x.douyuUid === douyuUid ? { ...x, hostBindingReview: status, hostBindingReviewAt: now, hostBindingReviewNote: reason } : x) }),
        { module: '绑定', action: status === 'approved' ? '通过主播绑定审核' : '驳回主播绑定审核', target: `${v.douyuName} (${douyuUid})`, detail: `${host.hostName} · ${reason}` },
      )
      return { ok: true, message: status === 'approved' ? '已通过主播绑定审核' : '已驳回主播绑定审核' }
    },
    manualBind(input: { openId: string; douyuUid: string; douyuName: string; reason: string }): Result {
      if (db.viewers.some((v) => v.douyuUid === input.douyuUid && v.status !== 'unbound'))
        return { ok: false, message: '该斗鱼 UID 已绑定其他微信' }
      if (db.viewers.some((v) => v.openId === input.openId && v.status !== 'unbound')) return { ok: false, message: '该微信已绑定斗鱼账号' }
      const now = new Date().toISOString()
      commit(
        (d) => {
          const existing = d.viewers.find((v) => v.douyuUid === input.douyuUid)
          const review = hostBindingStatus(d, input.douyuUid)
          const viewers = existing
            ? d.viewers.map((v) => (v.douyuUid === input.douyuUid ? { ...v, openId: input.openId, douyuName: input.douyuName, status: 'bound' as const, hostBindingReview: review, hostBindingReviewAt: review === 'pending' ? now : undefined, hostBindingReviewNote: undefined, boundAt: now } : v))
            : [{ ...input, wechatName: '微信用户', status: 'bound' as const, hostBindingReview: review, hostBindingReviewAt: review === 'pending' ? now : undefined, boundAt: now, balance: 0, totalEarned: 0, totalTransferred: 0, lastActive: now }, ...d.viewers]
          return { ...d, viewers }
        },
        { module: '绑定', action: hostBindingStatus(db, input.douyuUid) === 'pending' ? '提交主播绑定审核' : '人工绑定', target: `${input.douyuName} (${input.douyuUid})`, detail: input.reason },
      )
      return { ok: true, message: hostBindingStatus(db, input.douyuUid) === 'pending' ? '已绑定，等待主播身份审核' : '已完成人工绑定' }
    },
    cancelBindCode(code: string) {
      commit((d) => ({ ...d, bindCodes: d.bindCodes.map((c) => (c.code === code ? { ...c, status: 'cancelled' } : c)) }), {
        module: '绑定',
        action: '作废绑定码',
        target: code,
        detail: '',
      })
    },
    handleAppeal(id: string, status: Exclude<AppealStatus, 'pending'>, reply: string) {
      commit(
        (d) => ({ ...d, appeals: d.appeals.map((a) => (a.id === id ? { ...a, status, reply, handledAt: new Date().toISOString() } : a)) }),
        { module: '绑定', action: status === 'approved' ? '通过申诉' : '驳回申诉', target: id, detail: reply },
      )
    },

    /* ---------- Points ---------- */
    adjustPoints(douyuUid: string, delta: number, reason: string): Result {
      const v = db.viewers.find((x) => x.douyuUid === douyuUid)
      if (!v) return { ok: false, message: '账户不存在' }
      if (v.balance + delta < 0) return { ok: false, message: '调整后余额不能为负数' }
      const entry: Ledger = {
        id: uid('L'),
        uid: douyuUid,
        type: 'adjust',
        delta,
        title: delta > 0 ? '人工补发温度值' : '人工扣减温度值',
        detail: reason,
        relatedId: uid('ADJ'),
        time: new Date().toISOString(),
        operator: opRef.current,
      }
      commit(
        (d) => ({
          ...d,
          viewers: d.viewers.map((x) => (x.douyuUid === douyuUid ? { ...x, balance: x.balance + delta, totalEarned: x.totalEarned + Math.max(delta, 0) } : x)),
          ledger: [entry, ...d.ledger],
        }),
        { module: '温度值', action: '人工调整', target: `${v.douyuName} (${v.douyuUid})`, detail: `${delta > 0 ? '+' : ''}${delta} · ${reason}` },
      )
      return { ok: true, message: `已${delta > 0 ? '补发' : '扣减'} ${Math.abs(delta)} 温度值` }
    },
    revertTransfer(id: string, reason: string): Result {
      const t = db.transfers.find((x) => x.id === id)
      if (!t || t.status !== 'success') return { ok: false, message: '仅成功的转分可撤销' }
      const host = db.hosts.find((h) => h.hostUid === t.targetHostUid)
      const entry: Ledger = {
        id: uid('L'),
        uid: t.senderUid,
        type: 'revert',
        delta: t.amount!,
        title: '转分撤销退回',
        detail: `撤销 ${t.raw} · ${reason}`,
        relatedId: t.id,
        time: new Date().toISOString(),
        operator: opRef.current,
      }
      commit(
        (d) => ({
          ...d,
          transfers: d.transfers.map((x) => (x.id === id ? { ...x, status: 'reverted' } : x)),
          viewers: d.viewers.map((v) => (v.douyuUid === t.senderUid ? { ...v, balance: v.balance + t.amount!, totalTransferred: v.totalTransferred - t.amount! } : v)),
          hosts: d.hosts.map((h) => (h.hostUid === t.targetHostUid ? { ...h, currentPoints: Math.max(h.currentPoints - t.amount!, 0) } : h)),
          hostPoints: host
            ? [{ id: uid('HP'), hostUid: host.hostUid, kind: 'revert', delta: -t.amount!, balance: Math.max((d.hosts.find((h) => h.hostUid === host.hostUid)?.currentPoints ?? 0) - t.amount!, 0), title: '转分撤销扣回', detail: `撤销 ${t.senderName} 的 ${t.raw} · ${reason}`, relatedId: t.id, time: entry.time }, ...d.hostPoints]
            : d.hostPoints,
          ledger: [entry, ...d.ledger],
        }),
        { module: '转分', action: '撤销转分', target: `${t.id} · ${t.senderName} → ${host?.hostName ?? '-'}`, detail: `${t.amount} 温度值 · ${reason}` },
      )
      return { ok: true, message: `已撤销，${t.amount} 温度值退回 ${t.senderName}` }
    },
    /** Run a danmu command through the same rules the server would apply. */
    simulateCommand(senderUid: string, text: string, roomHostUid: string): { transfer: Transfer; message: string; botReply?: string } {
      const v = db.viewers.find((x) => x.douyuUid === senderUid)
      const parsed = parseCommand(text, db.hosts, db.rules)
      const base = {
        id: uid('T'),
        time: new Date().toISOString(),
        senderUid,
        senderName: v?.douyuName ?? senderUid,
        roomHostUid,
        raw: text.trim(),
        danmuEventId: uid('D'),
      }
      let transfer: Transfer
      let message: string
      if (parsed.status === 'empty' || parsed.status === 'format') {
        transfer = { ...base, status: 'format' }
        message = '格式不正确'
      } else if (parsed.status !== 'ok') {
        transfer = { ...base, status: parsed.status === 'alias' ? 'alias' : parsed.status === 'limit' ? 'limit' : 'format', alias: parsed.alias, amount: parsed.amount }
        message = parsed.message
      } else if (!v || v.status !== 'bound') {
        transfer = { ...base, status: 'unbound', alias: parsed.alias, amount: parsed.amount, targetHostUid: parsed.host.hostUid }
        message = v?.status === 'frozen' ? '账号已冻结，无法转分' : '发送者未绑定，命令被忽略'
      } else if (v.balance < parsed.amount) {
        transfer = { ...base, status: 'balance', alias: parsed.alias, amount: parsed.amount, targetHostUid: parsed.host.hostUid }
        message = `余额不足：当前可用 ${v.balance}`
      } else {
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)
        const usedToday = db.transfers
          .filter((x) => x.senderUid === senderUid && x.status === 'success' && new Date(x.time) >= todayStart)
          .reduce((s, x) => s + (x.amount ?? 0), 0)
        if (usedToday + parsed.amount > db.rules.dailyTransferLimit) {
          transfer = { ...base, status: 'limit', alias: parsed.alias, amount: parsed.amount, targetHostUid: parsed.host.hostUid }
          message = '超出每日转分上限'
        } else {
          transfer = { ...base, status: 'success', alias: parsed.alias, amount: parsed.amount, targetHostUid: parsed.host.hostUid }
          message = `转分成功：${parsed.amount} 温度值 → ${parsed.host.hostName}`
        }
      }
      const ok = transfer.status === 'success'
      const targetHost = transfer.targetHostUid ? db.hosts.find((h) => h.hostUid === transfer.targetHostUid) : undefined
      const botReply = db.rules.botReplyEnabled
        ? renderBotReply(ok ? db.rules.botSuccessReply : db.rules.botFailureReply, {
            viewer: base.senderName,
            host: targetHost?.hostName ?? '主播',
            points: transfer.amount ?? 0,
            balance: targetHost ? targetHost.currentPoints + (ok ? transfer.amount ?? 0 : 0) : 0,
            reason: message,
          })
        : undefined
      transfer = { ...transfer, botReply }
      commit(
        (d) => ({
          ...d,
          transfers: [transfer, ...d.transfers],
          viewers: ok ? d.viewers.map((x) => (x.douyuUid === senderUid ? { ...x, balance: x.balance - transfer.amount!, totalTransferred: x.totalTransferred + transfer.amount!, lastActive: transfer.time } : x)) : d.viewers,
          hosts: ok ? d.hosts.map((h) => (h.hostUid === transfer.targetHostUid ? { ...h, currentPoints: h.currentPoints + transfer.amount! } : h)) : d.hosts,
          hostPoints: ok
            ? [{ id: uid('HP'), hostUid: transfer.targetHostUid!, kind: 'in', delta: transfer.amount!, balance: (d.hosts.find((h) => h.hostUid === transfer.targetHostUid)?.currentPoints ?? 0) + transfer.amount!, title: `${transfer.senderName} 转入`, detail: `弹幕转分 ${transfer.raw}（模拟）`, relatedId: transfer.id, time: transfer.time }, ...d.hostPoints]
            : d.hostPoints,
          ledger: ok
            ? [{ id: uid('L'), uid: senderUid, type: 'transfer', delta: -transfer.amount!, title: `转分给 ${d.hosts.find((h) => h.hostUid === transfer.targetHostUid)?.hostName}`, detail: `命令 ${transfer.raw} · 成功（模拟）`, relatedId: transfer.danmuEventId, time: transfer.time }, ...d.ledger]
            : d.ledger,
        }),
        { module: '转分', action: '模拟弹幕', target: `${base.senderName} (${senderUid})`, detail: `${text.trim()} → ${message}${botReply ? ` · BOT：${botReply}` : ''}` },
      )
      return { transfer, message, botReply }
    },

    /* ---------- Shop ---------- */
    saveProduct(product: ShopProduct, isNew: boolean): Result {
      if (!product.name.trim()) return { ok: false, message: '商品名称不能为空' }
      if (product.price < 0) return { ok: false, message: '商品价格不能为负数' }
      if (product.stock !== null && (!Number.isInteger(product.stock) || product.stock < 0)) return { ok: false, message: '库存必须是大于等于 0 的整数，或设置为不限库存' }
      if (db.products.some((p) => p.name.trim() === product.name.trim() && p.id !== product.id)) return { ok: false, message: '商品名称已存在' }
      const next = { ...product, fulfillment: product.fulfillment ?? 'physical', name: product.name.trim(), description: product.description.trim(), updatedAt: new Date().toISOString() }
      commit(
        (d) => ({ ...d, products: isNew ? [next, ...d.products] : d.products.map((p) => (p.id === next.id ? next : p)) }),
        { module: '商店', action: isNew ? '新增商品' : '编辑商品', target: `${next.name} (${next.id})`, detail: `${next.price} 温度值 · ${next.stock === null ? '不限库存' : `库存 ${next.stock}`}` },
      )
      return { ok: true, message: isNew ? '已新增商品' : '商品信息已保存' }
    },
    toggleProduct(id: string) {
      const product = db.products.find((p) => p.id === id)
      if (!product) return { ok: false, message: '商品不存在' } as const
      const enabled = !product.enabled
      commit((d) => ({ ...d, products: d.products.map((p) => (p.id === id ? { ...p, enabled, updatedAt: new Date().toISOString() } : p)) }), {
        module: '商店',
        action: enabled ? '上架商品' : '下架商品',
        target: `${product.name} (${product.id})`,
        detail: '',
      })
      return { ok: true, message: enabled ? '商品已上架' : '商品已下架' } as const
    },
    useShopPurchase(id: string, note: string, shippingAddress?: string): Result {
      return redeemShopPurchase(id, note, shippingAddress)
    },
    useShopPurchaseByCode(code: string, note: string, shippingAddress?: string): Result {
      const normalized = code.trim()
      if (!/^\d{6}$/.test(normalized)) return { ok: false, message: '请输入 6 位数字核销码' }
      const purchase = db.shopPurchases.find((p) => p.redemptionCode === normalized)
      if (!purchase) return { ok: false, message: '核销码不存在，请检查后重试' }
      return redeemShopPurchase(purchase.id, note, shippingAddress)
    },

    /* ---------- Seasons ---------- */
    saveSeason(season: Season, isNew: boolean): Result {
      const start = new Date(season.startAt).getTime()
      const end = season.endAt ? new Date(season.endAt).getTime() : Infinity
      if (end <= start) return { ok: false, message: '结束时间必须晚于开始时间' }
      const overlap = db.seasons.find((s) => {
        if (s.id === season.id) return false
        const ss = new Date(s.startAt).getTime()
        const se = s.endAt ? new Date(s.endAt).getTime() : Infinity
        return start < se && ss < end
      })
      if (overlap) return { ok: false, message: `与「${overlap.name}」时间重叠` }
      commit(
        (d) => ({ ...d, seasons: (isNew ? [...d.seasons, season] : d.seasons.map((s) => (s.id === season.id ? season : s))).sort((a, b) => a.startAt.localeCompare(b.startAt)) }),
        { module: '赛季', action: isNew ? '新建赛季' : '修改赛季', target: season.name, detail: `${new Date(season.startAt).toLocaleString('zh-CN')} – ${season.endAt ? new Date(season.endAt).toLocaleString('zh-CN') : '未设置结束'}` },
      )
      return { ok: true, message: isNew ? '已创建赛季' : '赛季时间已更新，小程序口径同步生效' }
    },
    deleteSeason(id: string) {
      const s = db.seasons.find((x) => x.id === id)!
      commit((d) => ({ ...d, seasons: d.seasons.filter((x) => x.id !== id) }), { module: '赛季', action: '删除赛季', target: s.name, detail: '' })
    },

    /* ---------- Rules & admins ---------- */
    saveRules(rules: Rules) {
      const changed = (Object.keys(rules) as (keyof Rules)[]).filter((k) => rules[k] !== db.rules[k])
      commit(
        (d) => ({
          ...d,
          rules,
          hosts: d.hosts.map((h) => (h.hostUid === rules.bindRoomHostUid ? { ...h, isCaptain: false } : h)),
        }),
        { module: '规则', action: '修改规则', target: '规则配置', detail: `修改 ${changed.length} 项：${changed.join(', ')}` },
      )
    },
    saveTeams(teams: TeamConfig[]) {
      const changed = teams.filter((team, i) => JSON.stringify(team) !== JSON.stringify(db.teams[i])).length
      commit((d) => ({ ...d, teams }), { module: '赛季', action: '修改队伍配置', target: '赛季队伍', detail: `修改 ${changed} 支队伍的名称或颜色` })
    },
    saveAdmin(admin: Admin, isNew: boolean): Result {
      if (db.admins.some((a) => a.account === admin.account && a.id !== admin.id)) return { ok: false, message: '登录账号已存在' }
      commit((d) => ({ ...d, admins: isNew ? [...d.admins, admin] : d.admins.map((a) => (a.id === admin.id ? admin : a)) }), {
        module: '系统',
        action: isNew ? '新增管理员' : '编辑管理员',
        target: `${admin.name} (${admin.account})`,
        detail: admin.role,
      })
      return { ok: true, message: '已保存管理员' }
    },
    resetDemo() {
      localStorage.removeItem(KEY)
      setDb(createSeed())
    },
  }

  return { db, actions }
}

type Ctx = ReturnType<typeof useDbState> & { operator: string }
const DbContext = createContext<Ctx | null>(null)

export function DbProvider({ operator, children }: { operator: string; children: ReactNode }) {
  const value = useDbState(operator)
  const ctx = useMemo(() => ({ ...value, operator }), [value, operator])
  return <DbContext.Provider value={ctx}>{children}</DbContext.Provider>
}

export function useDb() {
  const ctx = useContext(DbContext)
  if (!ctx) throw new Error('useDb must be used inside DbProvider')
  return ctx
}
