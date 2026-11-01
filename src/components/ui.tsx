import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Info,
  Loader2,
  Minus,
  Search,
  X,
  XCircle,
} from 'lucide-react'
import { cx } from '@/lib/utils'

/* ---------- Button ---------- */

type ButtonTheme = 'primary' | 'light' | 'outline' | 'text' | 'danger' | 'danger-solid'
export function Button({
  children,
  theme = 'primary',
  size = 'medium',
  block,
  loading,
  disabled,
  icon,
  onClick,
  type = 'button',
  className,
  title,
}: {
  children?: ReactNode
  theme?: ButtonTheme
  size?: 'small' | 'medium' | 'large'
  block?: boolean
  loading?: boolean
  disabled?: boolean
  icon?: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  className?: string
  title?: string
}) {
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled || loading}
      className={cx(
        'press inline-flex shrink-0 cursor-pointer items-center justify-center font-semibold whitespace-nowrap select-none',
        {
          primary: 'bg-brand-deep text-highlight shadow-primary hover:bg-brand-ink active:shadow-primary-pressed',
          light: 'bg-card text-brand-ink shadow-raised-sm hover:text-brand-deep active:shadow-inset-sm',
          outline: 'bg-card text-ink shadow-raised-sm hover:text-brand-ink active:shadow-inset-sm',
          text: 'text-brand-ink hover:bg-brand-soft/60 active:opacity-70',
          danger: 'bg-card text-danger shadow-raised-sm active:shadow-inset-sm',
          'danger-solid': 'bg-danger text-highlight shadow-raised-sm hover:brightness-95 active:shadow-inset-sm',
        }[theme],
        {
          small: 'h-8 gap-1 rounded-full px-3 text-caption',
          medium: 'h-10 gap-1.5 rounded-full px-4.5 text-body',
          large: 'h-12 gap-2 rounded-full px-6 text-section',
        }[size],
        block && 'w-full',
        (disabled || loading) && 'pointer-events-none opacity-50',
        className,
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  )
}

export function IconButton({
  label,
  children,
  onClick,
  tone = 'default',
  size = 'md',
}: {
  label: string
  children: ReactNode
  onClick?: () => void
  tone?: 'default' | 'danger'
  size?: 'sm' | 'md'
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cx(
        'press flex shrink-0 cursor-pointer items-center justify-center rounded-full bg-card shadow-raised-sm active:shadow-inset-sm',
        tone === 'danger' ? 'text-danger' : 'text-muted hover:text-brand-ink',
        size === 'sm' ? 'size-8' : 'size-10',
      )}
    >
      {children}
    </button>
  )
}

/* ---------- Tag ---------- */

export type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'default'
export function Tag({ children, theme = 'default', dot, className }: { children: ReactNode; theme?: Tone; dot?: boolean; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-micro font-semibold whitespace-nowrap',
        { brand: 'bg-brand-soft text-brand-ink', success: 'bg-success-soft text-success', warning: 'bg-warning-soft text-warning', danger: 'bg-danger-soft text-danger', default: 'bg-line/70 text-muted' }[theme],
        className,
      )}
    >
      {dot && (
        <span
          aria-hidden
          className={cx('size-1.5 rounded-full', { brand: 'bg-brand', success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger', default: 'bg-muted' }[theme], theme === 'success' && 'live-dot')}
        />
      )}
      {children}
    </span>
  )
}

/* ---------- Surfaces ---------- */

export function Card({ children, className, flush }: { children: ReactNode; className?: string; flush?: boolean }) {
  return <div className={cx('rounded-card bg-card shadow-surface', !flush && 'p-5', className)}>{children}</div>
}

export function Inset({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-control bg-page shadow-inset-sm', className)}>{children}</div>
}

export function IconBadge({ children, tone = 'brand', size = 'md' }: { children: ReactNode; tone?: 'brand' | 'warning' | 'success' | 'danger'; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div
      className={cx(
        'flex shrink-0 items-center justify-center rounded-full',
        { brand: 'bg-brand-soft text-brand-ink', warning: 'bg-warning-soft text-warning', success: 'bg-success-soft text-success', danger: 'bg-danger-soft text-danger' }[tone],
        { sm: 'size-8', md: 'size-10', lg: 'size-12' }[size],
      )}
    >
      {children}
    </div>
  )
}

export function CardTitle({ title, sub, extra }: { title: ReactNode; sub?: ReactNode; extra?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-section font-bold text-ink">{title}</div>
        {sub && <div className="mt-0.5 text-caption text-muted">{sub}</div>}
      </div>
      {extra && <div className="flex shrink-0 items-center gap-2">{extra}</div>}
    </div>
  )
}

export function PageHeader({ eyebrow, title, desc, actions }: { eyebrow: string; title: string; desc?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <div className="text-micro font-bold tracking-widest text-brand-ink">{eyebrow}</div>
        <h1 className="mt-1 text-title font-extrabold text-ink">{title}</h1>
        {desc && <div className="mt-1 max-w-2xl text-caption text-muted">{desc}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  )
}

const AVATAR_GRADIENTS = ['from-brand-light to-brand', 'from-brand to-brand-deep', 'from-brand-soft to-brand', 'from-brand-light to-brand-deep', 'from-brand-soft to-brand-ink']
export function Avatar({ name, index = 0, size = 'md' }: { name: string; index?: number; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div className="shrink-0 rounded-full bg-card p-0.5 shadow-raised-sm">
      <div
        aria-hidden
        className={cx(
          'flex items-center justify-center rounded-full bg-gradient-to-br font-bold text-highlight',
          AVATAR_GRADIENTS[Math.abs(index) % AVATAR_GRADIENTS.length],
          { sm: 'size-8 text-caption', md: 'size-10 text-body', lg: 'size-14 text-title' }[size],
        )}
      >
        {name.slice(0, 1)}
      </div>
    </div>
  )
}

export function Delta({ value, label = '较上一周期' }: { value: number; label?: string }) {
  const Icon = value === 0 ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span className={cx('inline-flex items-center gap-0.5 text-micro font-semibold whitespace-nowrap', value === 0 ? 'text-muted' : value > 0 ? 'text-success' : 'text-danger')}>
      <Icon className="size-3" aria-hidden />
      {label} {value > 0 ? '+' : ''}
      {value.toFixed(1)}%
    </span>
  )
}

export function StatCard({
  icon,
  label,
  value,
  unit,
  foot,
  tone = 'brand',
  onClick,
}: {
  icon: ReactNode
  label: string
  value: ReactNode
  unit?: string
  foot?: ReactNode
  tone?: 'brand' | 'warning' | 'success' | 'danger'
  onClick?: () => void
}) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cx('flex flex-col rounded-card bg-card p-5 text-left shadow-surface', onClick && 'press cursor-pointer hover:shadow-raised active:shadow-inset-sm')}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-caption font-semibold text-muted">{label}</span>
        <IconBadge tone={tone} size="sm">
          {icon}
        </IconBadge>
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="font-num text-[26px] leading-none font-extrabold tracking-tight text-ink">{value}</span>
        {unit && <span className="text-caption font-semibold text-muted">{unit}</span>}
      </div>
      {foot && <div className="mt-2 text-micro text-muted">{foot}</div>}
    </Comp>
  )
}

export function Notice({ children, theme = 'warning', icon }: { children: ReactNode; theme?: 'warning' | 'brand' | 'danger' | 'success'; icon?: ReactNode }) {
  const DefaultIcon = { warning: AlertTriangle, brand: Info, danger: XCircle, success: CheckCircle2 }[theme]
  return (
    <div className={cx('flex items-start gap-2 rounded-control px-3.5 py-2.5 text-caption', { warning: 'bg-warning-soft text-warning', brand: 'bg-brand-soft text-brand-ink', danger: 'bg-danger-soft text-danger', success: 'bg-success-soft text-success' }[theme])}>
      <span className="mt-0.5 shrink-0">{icon ?? <DefaultIcon className="size-3.5" aria-hidden />}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

export function Empty({ title, description, action, icon }: { title: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-page text-brand-ink shadow-inset">{icon ?? <Inbox className="size-6" aria-hidden />}</div>
      <div className="text-section font-bold text-ink">{title}</div>
      {description && <div className="mt-1.5 max-w-80 text-caption text-muted">{description}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/* ---------- Tabs ---------- */

export function Segment<T extends string>({ value, onChange, items, size = 'md' }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode }[]; size?: 'sm' | 'md' }) {
  return (
    <div className="inline-flex rounded-full bg-page p-1 shadow-inset-sm" role="tablist">
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={cx(
            'press cursor-pointer rounded-full font-semibold whitespace-nowrap',
            size === 'sm' ? 'h-7 px-3 text-micro' : 'h-8 px-4 text-caption',
            value === it.value ? 'bg-card text-brand-ink shadow-raised-sm' : 'text-muted hover:text-ink',
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}

export function LineTabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string; badge?: number }[] }) {
  return (
    <div className="flex gap-7 border-b border-line" role="tablist">
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={cx('relative flex h-11 cursor-pointer items-center gap-1.5 text-body transition-colors', value === it.value ? 'font-bold text-ink' : 'text-muted hover:text-ink')}
        >
          {it.label}
          {it.badge !== undefined && it.badge > 0 && (
            <span className={cx('rounded-full px-1.5 font-num text-micro', value === it.value ? 'bg-brand-soft text-brand-ink' : 'bg-line/70 text-muted')}>{it.badge}</span>
          )}
          {value === it.value && <span className="absolute inset-x-0 -bottom-px h-1 rounded-full bg-brand" />}
        </button>
      ))}
    </div>
  )
}

/* ---------- Form controls ---------- */

const controlShell = 'flex h-10 items-center gap-2 rounded-full bg-page px-4 shadow-inset-sm outline-2 outline-transparent transition-[outline-color] focus-within:outline focus-within:outline-brand/35'

export function Field({ label, hint, error, children, required }: { label: string; hint?: ReactNode; error?: string | null; children: (id: string) => ReactNode; required?: boolean }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-caption font-semibold text-ink">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </label>
      {children(id)}
      {error ? (
        <div className="flex items-center gap-1 text-micro text-danger" role="alert">
          <XCircle className="size-3" aria-hidden />
          {error}
        </div>
      ) : (
        hint && <div className="text-micro text-muted">{hint}</div>
      )}
    </div>
  )
}

export function TextInput({ invalid, prefix, suffix, className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> & { invalid?: boolean; prefix?: ReactNode; suffix?: ReactNode }) {
  return (
    <div className={cx(controlShell, invalid && 'outline outline-danger/40', className)}>
      {prefix && <span className="shrink-0 text-muted">{prefix}</span>}
      <input {...props} className="h-full min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-muted/80 disabled:opacity-60" />
      {suffix && <span className="shrink-0 text-caption text-muted">{suffix}</span>}
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  return (
    <div className={cx(controlShell, 'w-72', className)}>
      <Search className="size-4 shrink-0 text-muted" aria-hidden />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="h-full min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-muted/80" />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="清除搜索" className="flex size-6 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-line/60">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cx(controlShell, 'relative pr-9', className)}>
      <select {...props} className="h-full min-w-0 flex-1 cursor-pointer appearance-none bg-transparent text-body text-ink outline-none">
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 size-4 text-muted" aria-hidden />
    </div>
  )
}

export function Textarea({ invalid, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      {...props}
      className={cx(
        'min-h-20 w-full resize-y rounded-control bg-page px-4 py-2.5 text-body text-ink shadow-inset-sm outline-2 outline-transparent transition-[outline-color] placeholder:text-muted/80 focus:outline focus:outline-brand/35',
        invalid && 'outline outline-danger/40',
      )}
    />
  )
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  // 与参考代码 NeumorphicSwitch size="sm" 完全一致
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`group relative inline-flex h-8 w-16 shrink-0 items-center rounded-full p-1 outline-none transition-all duration-300 ease-out focus-visible:ring-2 focus-visible:ring-[#79add6]/70 focus-visible:ring-offset-4 focus-visible:ring-offset-[#e8f0f9] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.44),inset_-2px_-2px_5px_rgba(255,255,255,0.82),4px_4px_10px_rgba(163,177,198,0.32),-4px_-4px_10px_rgba(255,255,255,0.82)] ${checked ? 'bg-[#c7e1f6] shadow-[inset_3px_3px_7px_rgba(104,157,201,0.3),inset_-3px_-3px_7px_rgba(255,255,255,0.72),5px_5px_12px_rgba(163,177,198,0.28),-5px_-5px_12px_rgba(255,255,255,0.8)]' : 'bg-[#e8f0f9]'} ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer active:scale-[0.97]'}`}
    >
      <span
        aria-hidden="true"
        className={`relative block h-6 w-6 rounded-full bg-[#e9f3fd] transition-all duration-300 ease-out ${checked ? 'translate-x-8 bg-[#a9d0f0] shadow-[inset_-2px_-2px_4px_rgba(255,255,255,0.58),inset_2px_2px_4px_rgba(89,142,187,0.28),0_0_0_4px_rgba(142,192,229,0.08)]' : 'shadow-[3px_3px_6px_rgba(163,177,198,0.34),-3px_-3px_6px_rgba(255,255,255,0.9)]'}`}
      >
        <span className={`absolute inset-0 rounded-full bg-gradient-to-br from-white/40 to-transparent transition-opacity duration-300 ${checked ? 'opacity-50' : 'opacity-100'}`} />
      </span>
    </button>
  )
}

/* ---------- Overlays ---------- */

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
}

function useAutoFocus(open: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const el = ref.current?.querySelector<HTMLElement>('input:not([disabled]),textarea,select,[data-autofocus]')
    ;(el ?? ref.current)?.focus()
    return () => prev?.focus?.()
  }, [open])
  return ref
}

export function Modal({ open, onClose, title, desc, children, footer, width = 'max-w-lg' }: { open: boolean; onClose: () => void; title: string; desc?: ReactNode; children?: ReactNode; footer?: ReactNode; width?: string }) {
  useEscape(open, onClose)
  const ref = useAutoFocus(open)
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 p-6 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={cx('pop-in flex max-h-[88vh] w-full flex-col rounded-card bg-card shadow-surface outline-none', width)}>
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
          <div>
            <div className="text-section font-bold text-ink">{title}</div>
            {desc && <div className="mt-1 text-caption text-muted">{desc}</div>}
          </div>
          <IconButton label="关闭" size="sm" onClick={onClose}>
            <X className="size-4" />
          </IconButton>
        </div>
        {children && <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-2">{children}</div>}
        {footer && <div className="flex justify-end gap-2.5 px-6 pt-3 pb-5">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function Drawer({ open, onClose, title, sub, children, footer, width = 'w-[520px]' }: { open: boolean; onClose: () => void; title: ReactNode; sub?: ReactNode; children: ReactNode; footer?: ReactNode; width?: string }) {
  useEscape(open, onClose)
  const ref = useAutoFocus(open)
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/20 backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" className={cx('drawer-in flex h-full max-w-full flex-col bg-page shadow-surface outline-none', width)}>
        <div className="flex items-start justify-between gap-4 border-b border-line bg-card px-6 py-4">
          <div className="min-w-0">
            <div className="truncate text-section font-bold text-ink">{title}</div>
            {sub && <div className="mt-0.5 text-caption text-muted">{sub}</div>}
          </div>
          <IconButton label="关闭" size="sm" onClick={onClose}>
            <X className="size-4" />
          </IconButton>
        </div>
        <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto p-6">{children}</div>
        {footer && <div className="flex justify-end gap-2.5 border-t border-line bg-card px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmDialog({
  open,
  title,
  children,
  confirmText = '确定',
  danger,
  onConfirm,
  onCancel,
  requireReason,
}: {
  open: boolean
  title: string
  children?: ReactNode
  confirmText?: string
  danger?: boolean
  onConfirm: (reason: string) => void
  onCancel: () => void
  requireReason?: string
}) {
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  useEffect(() => {
    if (open) {
      setReason('')
      setTouched(false)
    }
  }, [open])
  const invalid = !!requireReason && !reason.trim()
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      width="max-w-md"
      footer={
        <>
          <Button theme="outline" onClick={onCancel}>
            取消
          </Button>
          <Button
            theme={danger ? 'danger-solid' : 'primary'}
            onClick={() => {
              setTouched(true)
              if (!invalid) onConfirm(reason.trim())
            }}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-2 text-body text-muted">
        {children}
        {requireReason && (
          <Field label={requireReason} required error={touched && invalid ? '请填写原因，将记录在操作日志中' : null}>
            {(id) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="将记录在操作日志中" invalid={touched && invalid} />}
          </Field>
        )}
      </div>
    </Modal>
  )
}

/* ---------- Toast ---------- */

type ToastItem = { id: number; text: string; tone: 'success' | 'danger' | 'brand' }
const ToastCtx = createContext<(text: string, tone?: ToastItem['tone']) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const push = useCallback((text: string, tone: ToastItem['tone'] = 'success') => {
    const id = Date.now() + Math.random()
    setItems((p) => [...p, { id, text, tone }])
    setTimeout(() => setItems((p) => p.filter((t) => t.id !== id)), 2800)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed top-5 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2" aria-live="polite">
        {items.map((t) => {
          const Icon = t.tone === 'success' ? CheckCircle2 : t.tone === 'danger' ? XCircle : Info
          return (
            <div key={t.id} className="pop-in flex items-center gap-2 rounded-full bg-ink/90 px-5 py-2.5 text-body text-highlight shadow-surface">
              <Icon className={cx('size-4', t.tone === 'success' ? 'text-[#7fd1bd]' : t.tone === 'danger' ? 'text-[#f2a5b1]' : 'text-brand-light')} aria-hidden />
              {t.text}
            </div>
          )
        })}
      </div>
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)

/* ---------- Table ---------- */

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('thin-scrollbar overflow-x-auto', className)}>
      <table className="w-full border-separate border-spacing-0 text-left text-body">{children}</table>
    </div>
  )
}

export function Th({ children, className, align = 'left' }: { children?: ReactNode; className?: string; align?: 'left' | 'right' | 'center' }) {
  return (
    <th
      scope="col"
      className={cx(
        'sticky top-0 z-[1] h-10 border-b border-line bg-card px-4 text-caption font-semibold whitespace-nowrap text-muted first:pl-6 last:pr-6',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
    >
      {children}
    </th>
  )
}

export function Td({ children, className, align = 'left' }: { children?: ReactNode; className?: string; align?: 'left' | 'right' | 'center' }) {
  return (
    <td className={cx('border-b border-line/70 px-4 py-3 align-middle first:pl-6 last:pr-6', align === 'right' && 'text-right', align === 'center' && 'text-center', className)}>{children}</td>
  )
}

export function Tr({ children, onClick, active }: { children: ReactNode; onClick?: () => void; active?: boolean }) {
  return <tr onClick={onClick} className={cx('transition-colors', onClick && 'cursor-pointer hover:bg-page/70', active && 'bg-brand-soft/40')}>{children}</tr>
}

export function usePaged<T>(rows: T[], pageSize = 10) {
  const [page, setPage] = useState(1)
  const pages = Math.max(Math.ceil(rows.length / pageSize), 1)
  useEffect(() => {
    if (page > pages) setPage(1)
  }, [pages, page])
  const slice = useMemo(() => rows.slice((page - 1) * pageSize, page * pageSize), [rows, page, pageSize])
  return { slice, page, pages, setPage, total: rows.length, pageSize }
}

export function Pagination({ page, pages, total, pageSize, setPage }: { page: number; pages: number; total: number; pageSize: number; setPage: (p: number) => void }) {
  if (total === 0) return null
  const nums: (number | '…')[] = []
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i)
    else if (nums[nums.length - 1] !== '…') nums.push('…')
  }
  return (
    <div className="flex items-center justify-between gap-3 px-6 py-4">
      <div className="text-caption text-muted">
        共 <span className="font-num font-semibold text-ink">{total}</span> 条 · 第 {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} 条
      </div>
      <div className="flex items-center gap-1.5">
        <IconButton label="上一页" size="sm" onClick={() => setPage(Math.max(page - 1, 1))}>
          <ChevronLeft className="size-4" />
        </IconButton>
        {nums.map((n, i) =>
          n === '…' ? (
            <span key={`e${i}`} className="w-6 text-center text-muted">
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              onClick={() => setPage(n)}
              aria-current={n === page ? 'page' : undefined}
              className={cx('press size-8 cursor-pointer rounded-full font-num text-caption font-semibold', n === page ? 'bg-brand-deep text-highlight shadow-primary' : 'text-muted hover:bg-card hover:shadow-raised-sm')}
            >
              {n}
            </button>
          ),
        )}
        <IconButton label="下一页" size="sm" onClick={() => setPage(Math.min(page + 1, pages))}>
          <ChevronRight className="size-4" />
        </IconButton>
      </div>
    </div>
  )
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3 px-6 pt-5 pb-4">{children}</div>
}
