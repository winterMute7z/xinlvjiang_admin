import { useId, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { cx, fmt } from '@/lib/utils'

export const SERIES_COLORS = ['#3e6f98', '#9cc0dd', '#1e7160', '#b88a3a', '#b23f51', '#7d6bb0']

export function Sparkline({ data, className, color = '#5b91bd' }: { data: number[]; className?: string; color?: string }) {
  const id = useId()
  const max = Math.max(...data, 1)
  const pts = data.map((v, i) => [(i / Math.max(data.length - 1, 1)) * 100, 30 - (v / max) * 26 - 2])
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={cx('h-8 w-24', className)} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L100,30 L0,30 Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export interface Series {
  name: string
  data: number[]
  color?: string
}

/** Multi-series line/area chart with hover crosshair. */
export function LineChart({ series, labels, height = 240, unit = '', area = true }: { series: Series[]; labels: string[]; height?: number; unit?: string; area?: boolean }) {
  const gid = useId()
  const wrap = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const W = 800
  const H = height
  const pad = { l: 48, r: 12, t: 12, b: 28 }
  const max = useMemo(() => {
    const m = Math.max(...series.flatMap((s) => s.data), 1)
    const mag = Math.pow(10, Math.floor(Math.log10(m)))
    return Math.ceil(m / mag) * mag
  }, [series])
  const n = labels.length
  const x = (i: number) => pad.l + (i / Math.max(n - 1, 1)) * (W - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max)
  const step = Math.ceil(n / 10)

  const onMove = (e: ReactMouseEvent) => {
    const rect = wrap.current!.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (n - 1))
    setHover(Math.min(Math.max(i, 0), n - 1))
  }

  return (
    <div ref={wrap} className="relative" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} role="img" aria-label={`趋势图：${series.map((s) => s.name).join('、')}`}>
        <defs>
          {series.map((s, si) => (
            <linearGradient key={si} id={`${gid}-${si}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={s.color ?? SERIES_COLORS[si]} stopOpacity="0.22" />
              <stop offset="1" stopColor={s.color ?? SERIES_COLORS[si]} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#d6e1ee" strokeDasharray={t === 0 ? undefined : '3 4'} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="fill-muted font-num text-[11px]">
              {t >= 10000 ? `${(t / 10000).toFixed(t % 10000 ? 1 : 0)}万` : fmt(t)}
            </text>
          </g>
        ))}
        {labels.map((l, i) =>
          i % step === 0 || i === n - 1 ? (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="fill-muted font-num text-[11px]">
              {l}
            </text>
          ) : null,
        )}
        {series.map((s, si) => {
          const color = s.color ?? SERIES_COLORS[si]
          const d = s.data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
          return (
            <g key={s.name}>
              {area && <path d={`${d} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={`url(#${gid}-${si})`} />}
              <path d={d} fill="none" stroke={color} strokeWidth={si === 0 ? 2.5 : 2} strokeLinejoin="round" strokeLinecap="round" />
            </g>
          )
        })}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="#9cc0dd" strokeDasharray="3 3" />
            {series.map((s, si) => (
              <circle key={s.name} cx={x(hover)} cy={y(s.data[hover])} r={4.5} fill="#fff" stroke={s.color ?? SERIES_COLORS[si]} strokeWidth={2.5} />
            ))}
          </g>
        )}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-2 z-10 min-w-36 rounded-control bg-card px-3 py-2 shadow-surface"
          style={{ left: `calc(${(x(hover) / W) * 100}% + ${hover > n / 2 ? '-160px' : '12px'})` }}
        >
          <div className="mb-1 font-num text-micro font-semibold text-muted">{labels[hover]}</div>
          {series.map((s, si) => (
            <div key={s.name} className="flex items-center justify-between gap-3 text-caption">
              <span className="flex items-center gap-1.5 text-muted">
                <span className="size-2 rounded-full" style={{ background: s.color ?? SERIES_COLORS[si] }} />
                {s.name}
              </span>
              <span className="font-num font-bold text-ink">
                {fmt(s.data[hover])}
                {unit}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function Legend({ series }: { series: Series[] }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {series.map((s, i) => (
        <span key={s.name} className="flex items-center gap-1.5 text-caption text-muted">
          <span className="h-1 w-4 rounded-full" style={{ background: s.color ?? SERIES_COLORS[i] }} />
          {s.name}
        </span>
      ))}
    </div>
  )
}

/** Rounded vertical bars in the prototype's "分时礼物流水" style. */
export function BarChart({ data, height = 180, highlightMax = true, unit = '' }: { data: { label: string; value: number }[]; height?: number; highlightMax?: boolean; unit?: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div>
      <div className="flex items-end gap-2" style={{ height }}>
        {data.map((d, i) => {
          const isMax = highlightMax && d.value === max
          return (
            <div key={d.label} className="relative flex h-full flex-1 flex-col items-center justify-end gap-1" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {(hover === i || (hover === null && isMax)) && (
                <span className={cx('font-num text-micro font-bold whitespace-nowrap', isMax ? 'text-brand-ink' : 'text-ink')}>
                  {hover === i ? `${fmt(d.value)}${unit}` : '峰值'}
                </span>
              )}
              <div
                className={cx('w-full max-w-10 rounded-full transition-colors', isMax ? 'bg-brand shadow-raised-sm' : hover === i ? 'bg-brand/80' : 'bg-brand-light/55')}
                style={{ height: `${Math.max((d.value / max) * 82, 2)}%` }}
                title={`${d.label} · ${fmt(d.value)}${unit}`}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex gap-2">
        {data.map((d) => (
          <span key={d.label} className="flex-1 text-center font-num text-micro text-muted">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Horizontal ranking bars. */
export function HBars({ data, unit = '' }: { data: { label: string; value: number; sub?: string }[]; unit?: string }) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="space-y-3">
      {data.map((d, i) => (
        <div key={d.label}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-caption">
            <span className="truncate font-semibold text-ink">{d.label}</span>
            <span className="shrink-0 font-num font-bold text-ink">
              {fmt(d.value)}
              <span className="ml-0.5 font-normal text-muted">{unit}</span>
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-page shadow-inset-sm">
            <div className={cx('h-full rounded-full', i === 0 ? 'bg-brand-deep' : 'bg-brand-light')} style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function Donut({ data, size = 148, center }: { data: { label: string; value: number; color: string }[]; size?: number; center?: ReactNode }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const r = 52
  const c = 2 * Math.PI * r
  let acc = 0
  return (
    <div className="flex items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 140 140" className="size-full -rotate-90" role="img" aria-label={data.map((d) => `${d.label} ${d.value}`).join('，')}>
          <circle cx="70" cy="70" r={r} fill="none" stroke="#e7eff8" strokeWidth="18" />
          {data.map((d) => {
            const len = (d.value / total) * c
            const el = <circle key={d.label} cx="70" cy="70" r={r} fill="none" stroke={d.color} strokeWidth="18" strokeDasharray={`${Math.max(len - 2, 0)} ${c}`} strokeDashoffset={-acc} strokeLinecap="butt" />
            acc += len
            return el
          })}
        </svg>
        {center && <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{center}</div>}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {data.map((d) => (
          <div key={d.label} className="flex items-center justify-between gap-3 text-caption">
            <span className="flex min-w-0 items-center gap-2 text-muted">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
              <span className="truncate">{d.label}</span>
            </span>
            <span className="shrink-0 font-num font-bold text-ink">
              {fmt(d.value)}
              <span className="ml-1 font-normal text-muted">{((d.value / total) * 100).toFixed(0)}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
