import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ArrowRightLeft,
  Bell,
  CalendarRange,
  ChartNoAxesCombined,
  ChevronDown,
  Coins,
  LayoutDashboard,
  Link2,
  LogOut,
  RotateCcw,
  ScrollText,
  Settings2,
  ShoppingBag,
  Tags,
  Users,
} from 'lucide-react'
import { useDb } from '@/lib/store'
import type { RouteKey } from '@/lib/router'
import { activeSeason, cx, findAliasConflicts, fmtRelative, seasonDay } from '@/lib/utils'
import { GUILD_NAME } from '@/lib/seed'
import { ConfirmDialog, Tag, useToast } from './ui'

type NavItem = { key: RouteKey; label: string; icon: typeof Users; badge?: number; badgeTone?: 'danger' | 'brand' }

export function Layout({ route, onNavigate, onLogout, children }: { route: RouteKey; onNavigate: (r: string) => void; onLogout: () => void; children: ReactNode }) {
  const { db, operator, actions } = useDb()
  const toast = useToast()
  const conflicts = findAliasConflicts(db.hosts).length
  const pendingAppeals = db.appeals.filter((a) => a.status === 'pending').length
  const pendingHostReviews = db.viewers.filter((v) => v.hostBindingReview === 'pending').length
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const failedToday = db.transfers.filter((t) => t.status !== 'success' && t.status !== 'reverted' && new Date(t.time) >= todayStart).length
  const season = activeSeason(db.seasons)
  const collectorIssues = db.collectors.filter((c) => c.state !== 'ok' && db.hosts.find((h) => h.hostUid === c.hostUid)?.collect).length

  // 按管理对象分组：主播 → 观众账号 → 温度值流转 → 赛季与数据 → 系统
  const groups: { title: string; items: NavItem[] }[] = [
    { title: '概览', items: [{ key: 'dashboard', label: '数据总览', icon: LayoutDashboard }] },
    {
      title: '主播运营',
      items: [
        { key: 'hosts', label: '主播管理', icon: Users },
        { key: 'aliases', label: '别名管理', icon: Tags, badge: conflicts, badgeTone: 'danger' },
      ],
    },
    {
      title: '赛季与数据',
      items: [
        { key: 'season', label: '赛季设置', icon: CalendarRange },
        { key: 'data', label: '数据中心', icon: ChartNoAxesCombined },
      ],
    },
    {
      title: '观众与温度值',
      items: [
        { key: 'bindings', label: '绑定管理', icon: Link2, badge: pendingAppeals + pendingHostReviews, badgeTone: 'brand' },
        { key: 'points', label: '温度值账户', icon: Coins },
        { key: 'transfers', label: '转分记录', icon: ArrowRightLeft, badge: failedToday, badgeTone: 'brand' },
        { key: 'shop', label: '商店管理', icon: ShoppingBag },
      ],
    },
    {
      title: '系统',
      items: [
        { key: 'settings', label: '规则配置', icon: Settings2 },
        { key: 'audit', label: '操作日志', icon: ScrollText },
      ],
    },
  ]

  const todos = [
    conflicts > 0 && { text: `${conflicts} 个别名冲突需要处理`, to: 'aliases', tone: 'danger' as const },
    pendingHostReviews > 0 && { text: `${pendingHostReviews} 个参赛主播绑定待审核`, to: 'bindings?tab=hostReviews', tone: 'warning' as const },
    pendingAppeals > 0 && { text: `${pendingAppeals} 条换号/申诉待审核`, to: 'bindings?tab=appeals', tone: 'brand' as const },
    collectorIssues > 0 && { text: `${collectorIssues} 个直播间采集异常`, to: 'dashboard', tone: 'warning' as const },
    failedToday > 0 && { text: `今日 ${failedToday} 条转分命令未成功`, to: 'transfers?status=failed', tone: 'brand' as const },
  ].filter(Boolean) as { text: string; to: string; tone: 'danger' | 'brand' | 'warning' }[]

  const [resetOpen, setResetOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-page text-ink">
      <aside className="flex w-60 shrink-0 flex-col border-r border-highlight/70 bg-card/60">
        <div className="flex items-center gap-2.5 px-5 pt-6 pb-5">
          <div className="soft-orb size-9 shrink-0" aria-label={`${GUILD_NAME} Logo 图片占位`} role="img" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-section font-bold text-ink">{GUILD_NAME}</span>
            </div>
            <div className="text-micro text-muted">{GUILD_NAME}公会 · 管理后台</div>
          </div>
        </div>
        <nav className="thin-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto px-3 pb-4" aria-label="主导航">
          {groups.map((g) => (
            <div key={g.title}>
              <div className="px-3 pb-1.5 text-micro font-bold tracking-widest text-muted/80">{g.title}</div>
              <div className="space-y-1">
                {g.items.map((it) => {
                  const active = route === it.key
                  const Icon = it.icon
                  return (
                    <button
                      key={it.key}
                      type="button"
                      onClick={() => onNavigate(it.key)}
                      aria-current={active ? 'page' : undefined}
                      className={cx(
                        'press flex h-11 w-full cursor-pointer items-center gap-3 rounded-control px-3 text-left text-body',
                        active ? 'bg-card font-bold text-brand-ink shadow-raised-sm' : 'text-muted hover:bg-page hover:text-ink',
                      )}
                    >
                      <Icon className="size-[18px] shrink-0" strokeWidth={active ? 2.3 : 1.9} aria-hidden />
                      <span className="flex-1 truncate">{it.label}</span>
                      {!!it.badge && (
                        <span className={cx('min-w-5 rounded-full px-1.5 text-center font-num text-micro font-bold', it.badgeTone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-brand-soft text-brand-ink')}>{it.badge}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="m-3 rounded-control bg-page p-3.5 shadow-inset-sm">
          <div className="flex items-center justify-between">
            <span className="text-micro font-semibold text-muted">采集服务</span>
            <Tag theme={collectorIssues ? 'warning' : 'success'} dot>
              {collectorIssues ? `${collectorIssues} 异常` : '正常'}
            </Tag>
          </div>
          <div className="mt-1.5 text-micro text-muted">
            {db.collectors.filter((c) => c.state === 'ok').length}/{db.collectors.length} 直播间在线 · 最近消息 {fmtRelative(db.collectors.reduce((a, c) => (c.lastMessage > a ? c.lastMessage : a), ''))}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-line/80 bg-page/80 px-8 backdrop-blur">
          <div className="flex items-center gap-2 text-caption text-muted">
            {season ? (
              <button type="button" onClick={() => onNavigate('season')} className="press flex h-8 cursor-pointer items-center gap-2 rounded-full bg-card px-3 shadow-raised-sm hover:text-brand-ink active:shadow-inset-sm">
                <CalendarRange className="size-3.5 text-brand-ink" aria-hidden />
                <span className="font-semibold text-ink">{season.name}</span>
                <span className="font-num">第 {seasonDay(season)} 天</span>
              </button>
            ) : (
              <Tag theme="warning">当前无进行中的赛季</Tag>
            )}
            <Tag theme="warning">演示数据</Tag>
          </div>
          <div className="flex-1" />
          <Notifications todos={todos} onNavigate={onNavigate} />
          <UserMenu
            name={operator}
            role={db.admins.find((a) => a.name === operator)?.role ?? 'owner'}
            onLogout={onLogout}
            onReset={() => setResetOpen(true)}
          />
        </header>
        <main className="thin-scrollbar min-h-0 flex-1 overflow-y-auto">
          <div key={route} className="page-in mx-auto w-full max-w-[1440px] px-8 pt-7 pb-12">
            {children}
          </div>
        </main>
      </div>
      <ConfirmDialog
        open={resetOpen}
        title="重置演示数据？"
        danger
        confirmText="重置"
        onCancel={() => setResetOpen(false)}
        onConfirm={() => {
          actions.resetDemo()
          setResetOpen(false)
          toast('已恢复初始演示数据')
        }}
      >
        所有在后台做出的修改（主播、别名、温度值、赛季等）都会被清除，恢复为初始演示数据。
      </ConfirmDialog>
    </div>
  )
}

function usePopover() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', h)
    document.addEventListener('keydown', k)
    return () => {
      document.removeEventListener('mousedown', h)
      document.removeEventListener('keydown', k)
    }
  }, [open])
  return { open, setOpen, ref }
}

function Notifications({ todos, onNavigate }: { todos: { text: string; to: string; tone: 'danger' | 'brand' | 'warning' }[]; onNavigate: (r: string) => void }) {
  const { open, setOpen, ref } = usePopover()
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={`待办提醒 ${todos.length} 条`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="press relative flex size-10 cursor-pointer items-center justify-center rounded-full bg-card text-muted shadow-raised-sm hover:text-brand-ink active:shadow-inset-sm"
      >
        <Bell className="size-[18px]" />
        {todos.length > 0 && <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-danger font-num text-[10px] font-bold text-highlight">{todos.length}</span>}
      </button>
      {open && (
        <div className="pop-in absolute top-12 right-0 z-30 w-80 rounded-card bg-card p-2 shadow-surface">
          <div className="px-3 pt-2 pb-2 text-caption font-bold text-ink">待办提醒</div>
          {todos.length === 0 ? (
            <div className="px-3 pb-4 text-caption text-muted">暂无待处理事项</div>
          ) : (
            todos.map((t) => (
              <button
                key={t.text}
                type="button"
                onClick={() => {
                  onNavigate(t.to)
                  setOpen(false)
                }}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-control px-3 py-2.5 text-left text-body text-ink hover:bg-page"
              >
                <span className={cx('size-2 shrink-0 rounded-full', { danger: 'bg-danger', brand: 'bg-brand', warning: 'bg-warning' }[t.tone])} />
                {t.text}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

const ROLE_LABEL = { owner: '超级管理员', operator: '运营', viewer: '只读' }

function UserMenu({ name, role, onLogout, onReset }: { name: string; role: keyof typeof ROLE_LABEL; onLogout: () => void; onReset: () => void }) {
  const { open, setOpen, ref } = usePopover()
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="press flex h-10 cursor-pointer items-center gap-2.5 rounded-full bg-card pr-3 pl-1 shadow-raised-sm active:shadow-inset-sm">
        <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-light to-brand-deep text-caption font-bold text-highlight">{name.slice(0, 1)}</span>
        <span className="text-left leading-tight">
          <span className="block text-caption font-bold text-ink">{name}</span>
          <span className="block text-micro text-muted">{ROLE_LABEL[role]}</span>
        </span>
        <ChevronDown className="size-4 text-muted" />
      </button>
      {open && (
        <div className="pop-in absolute top-12 right-0 z-30 w-52 rounded-card bg-card p-2 shadow-surface">
          <button type="button" onClick={() => { setOpen(false); onReset() }} className="flex w-full cursor-pointer items-center gap-2.5 rounded-control px-3 py-2.5 text-body text-ink hover:bg-page">
            <RotateCcw className="size-4 text-muted" />
            重置演示数据
          </button>
          <button type="button" onClick={onLogout} className="flex w-full cursor-pointer items-center gap-2.5 rounded-control px-3 py-2.5 text-body text-danger hover:bg-danger-soft/60">
            <LogOut className="size-4" />
            退出登录
          </button>
        </div>
      )}
    </div>
  )
}
