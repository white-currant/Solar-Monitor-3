// Лёгкие графики на SVG: временной ряд и столбцы Kp. Ширина подстраивается под карточку,
// касание или наведение показывает значение в точке.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Point } from '../lib/model'
import { formatDayTime, formatTime } from '../lib/model'

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

export interface Series {
  points: Point[]
  color: string
  area?: boolean
  dashed?: boolean
  width?: number
}

export interface Band {
  from: number
  to: number
  color: string
  label?: string
}

export interface Marker {
  t: number
  color: string
  label?: string
}

interface TimeChartProps {
  series: Series[]
  start: number
  end: number
  yMin: number
  yMax: number
  log?: boolean
  yTicks: { v: number; label: string }[]
  bands?: Band[]
  zero?: number
  markers?: Marker[]
  height?: number
  format: (v: number) => string
  /** Подпись времени в подсказке: короткая (часы) или с датой. */
  longTime?: boolean
  /** Пропуск в данных длиннее этого (мс) разрывает линию. */
  gap?: number
}

const PAD = { top: 10, right: 8, bottom: 22, left: 40 }

export function TimeChart(props: TimeChartProps) {
  const { series, start, end, yMin, yMax, log, yTicks, bands = [], zero, markers = [], height = 170, format, gap = 20 * 60_000 } = props
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)

  const w = Math.max(0, width - PAD.left - PAD.right)
  const h = height - PAD.top - PAD.bottom
  const tf = (v: number) => (log ? Math.log10(Math.max(v, 1e-12)) : v)
  const y0 = tf(yMin)
  const y1 = tf(yMax)
  const sx = (t: number) => PAD.left + ((t - start) / (end - start)) * w
  const sy = (v: number) => PAD.top + h - ((Math.min(Math.max(tf(v), y0), y1) - y0) / (y1 - y0)) * h

  const xTicks = useMemo(() => {
    const span = end - start
    const DAY = 86_400_000
    if (span > 120 * DAY) {
      // Многолетние ряды — отметки по годам, на узком экране через год.
      const every = span > 12 * 365 * DAY || w < 420 ? 4 : 2
      const ticks: number[] = []
      for (let y = new Date(start).getUTCFullYear() + 1; ; y++) {
        const t = Date.UTC(y, 0, 1)
        if (t > end) break
        if (y % every === 0) ticks.push(t)
      }
      return { ticks, mode: 'year' as const }
    }
    const step = span <= 7 * 3_600_000 ? 2 * 3_600_000 : span <= 30 * 3_600_000 ? 6 * 3_600_000 : span <= 4 * DAY ? DAY : 2 * DAY
    const ticks: number[] = []
    // Шаг кратен локальной полуночи, чтобы подписи были «ровными» в часовом поясе зрителя.
    const offset = new Date(start).getTimezoneOffset() * 60_000
    const first = Math.ceil((start - offset) / step) * step + offset
    for (let t = first; t <= end; t += step) ticks.push(t)
    return { ticks, mode: step >= DAY ? ('day' as const) : ('hour' as const) }
  }, [start, end, w])

  const paths = useMemo(
    () =>
      series.map((s) => {
        const pts = s.points.filter((p) => p.t >= start && p.t <= end)
        if (pts.length < 2 || w <= 0) return null
        // Разрыв линии там, где в данных пропуск длиннее `gap`.
        // Заливку строим по каждому непрерывному куску отдельно, иначе она «перетекает» через пропуск.
        const segments: Point[][] = []
        pts.forEach((p, i) => {
          if (i === 0 || p.t - pts[i - 1].t > gap) segments.push([])
          segments[segments.length - 1].push(p)
        })
        const line = (seg: Point[]) => seg.map((p, i) => `${i ? 'L' : 'M'}${sx(p.t).toFixed(1)},${sy(p.v).toFixed(1)}`).join('')
        const d = segments.map(line).join('')
        const base = PAD.top + h
        const area = s.area
          ? segments
              .filter((seg) => seg.length > 1)
              .map((seg) => `${line(seg)}L${sx(seg[seg.length - 1].t).toFixed(1)},${base}L${sx(seg[0].t).toFixed(1)},${base}Z`)
              .join('')
          : null
        return { d, area, s }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, start, end, w, h, y0, y1, gap],
  )

  const main = series[0]?.points.filter((p) => p.t >= start && p.t <= end) ?? []
  const hovered = hover !== null && main.length ? main[hover] : null

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!main.length) return
    const rect = e.currentTarget.getBoundingClientRect()
    const t = start + ((e.clientX - rect.left - PAD.left) / w) * (end - start)
    let lo = 0
    let hi = main.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (main[mid].t < t) lo = mid + 1
      else hi = mid
    }
    if (lo > 0 && Math.abs(main[lo - 1].t - t) < Math.abs(main[lo].t - t)) lo--
    setHover(lo)
  }

  const gradId = useMemo(() => `g${Math.random().toString(36).slice(2, 8)}`, [])

  return (
    <div ref={ref} className="chart" style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
          role="img"
        >
          <defs>
            {series.map((s, i) => (
              <linearGradient key={i} id={`${gradId}-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.32" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

          {bands.map((b, i) => (
            <g key={i}>
              <rect x={PAD.left} width={w} y={sy(b.to)} height={Math.max(0, sy(b.from) - sy(b.to))} fill={b.color} />
              {b.label && (
                <text x={PAD.left + w - 4} y={sy(b.to) + 11} className="band-label" textAnchor="end" fill={b.color.replace(/[\d.]+\)$/, '0.9)')}>
                  {b.label}
                </text>
              )}
            </g>
          ))}

          {yTicks.filter((tick) => tick.v >= yMin && tick.v <= yMax).map((tick) => (
            <g key={tick.v}>
              <line x1={PAD.left} x2={PAD.left + w} y1={sy(tick.v)} y2={sy(tick.v)} className="grid" />
              <text x={PAD.left - 6} y={sy(tick.v) + 3.5} className="axis" textAnchor="end">
                {tick.label}
              </text>
            </g>
          ))}

          {xTicks.ticks.map((t) => (
            <text key={t} x={sx(t)} y={height - 6} className="axis" textAnchor="middle">
              {xTicks.mode === 'year'
                ? new Date(t).getUTCFullYear()
                : xTicks.mode === 'day'
                  ? new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
                  : formatTime(t)}
            </text>
          ))}

          {zero !== undefined && <line x1={PAD.left} x2={PAD.left + w} y1={sy(zero)} y2={sy(zero)} className="zero" />}

          {placeLabels(markers, sx).map((m, i) => (
            <g key={i}>
              <line x1={sx(m.t)} x2={sx(m.t)} y1={PAD.top} y2={PAD.top + h} stroke={m.color} strokeDasharray="2 3" opacity="0.7" />
              {m.label && (
                <text x={sx(m.t)} y={PAD.top + 9} className="marker-label" fill={m.color} textAnchor="middle">
                  {m.label}
                </text>
              )}
            </g>
          ))}

          {paths.map(
            (p, i) =>
              p && (
                <g key={i}>
                  {p.area && <path d={p.area} fill={`url(#${gradId}-${i})`} />}
                  <path
                    d={p.d}
                    fill="none"
                    stroke={p.s.color}
                    strokeWidth={p.s.width ?? 1.8}
                    strokeDasharray={p.s.dashed ? '4 4' : undefined}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </g>
              ),
          )}

          {hovered && (
            <g pointerEvents="none">
              <line x1={sx(hovered.t)} x2={sx(hovered.t)} y1={PAD.top} y2={PAD.top + h} className="crosshair" />
              <circle cx={sx(hovered.t)} cy={sy(hovered.v)} r="4" fill={series[0].color} stroke="#050a1c" strokeWidth="2" />
            </g>
          )}
        </svg>
      )}
      {hovered && (
        <div
          className="tip"
          style={{ left: Math.min(Math.max(sx(hovered.t), 70), width - 70) }}
        >
          <b>{format(hovered.v)}</b>
          <span>{props.longTime ? formatDayTime(hovered.t) : formatTime(hovered.t)}</span>
        </div>
      )}
    </div>
  )
}

/** Подписи меток не должны налезать: из близких оставляем первую по важности (порядок массива). */
function placeLabels(markers: Marker[], sx: (t: number) => number): Marker[] {
  const taken: number[] = []
  return markers.map((m) => {
    if (!m.label) return m
    const x = sx(m.t)
    if (taken.some((t) => Math.abs(t - x) < 36)) return { ...m, label: undefined }
    taken.push(x)
    return m
  })
}

// ─── Столбцы Kp ─────────────────────────────────────────────────────────

export interface Bar {
  t: number
  v: number
  color: string
  faded?: boolean
  label?: string
}

export function BarChart({
  bars,
  max,
  height = 150,
  ticks,
  threshold,
  format,
  footer,
}: {
  bars: Bar[]
  max: number
  height?: number
  ticks: number[]
  threshold?: { v: number; label: string }
  format: (b: Bar) => ReactNode
  footer?: (b: Bar, i: number) => string | null
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const left = 22
  const bottom = 22
  const w = Math.max(0, width - left - 4)
  const h = height - 10 - bottom
  const step = bars.length ? w / bars.length : 0
  const sy = (v: number) => 10 + h - (Math.min(v, max) / max) * h

  return (
    <div ref={ref} className="chart" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} onPointerLeave={() => setHover(null)} role="img">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={left} x2={left + w} y1={sy(t)} y2={sy(t)} className="grid" />
              <text x={left - 6} y={sy(t) + 3.5} className="axis" textAnchor="end">
                {t}
              </text>
            </g>
          ))}
          {threshold && (
            <g>
              <line x1={left} x2={left + w} y1={sy(threshold.v)} y2={sy(threshold.v)} className="threshold" />
              <text x={left + w - 2} y={sy(threshold.v) - 4} className="band-label" textAnchor="end" fill="#ffc752">
                {threshold.label}
              </text>
            </g>
          )}
          {bars.map((b, i) => {
            const bw = Math.max(2, step - Math.min(4, step * 0.22))
            const x = left + i * step + (step - bw) / 2
            const y = sy(Math.max(b.v, 0.15))
            return (
              <g key={b.t} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)}>
                <rect x={left + i * step} y={10} width={step} height={h} fill="transparent" />
                <rect
                  x={x}
                  y={y}
                  width={bw}
                  height={10 + h - y}
                  rx={Math.min(3, bw / 3)}
                  fill={b.color}
                  opacity={b.faded ? 0.38 : hover === i ? 1 : 0.88}
                  stroke={b.faded ? b.color : 'none'}
                  strokeDasharray={b.faded ? '2 2' : undefined}
                />
                {footer?.(b, i) && (
                  <text x={left + i * step + step / 2} y={height - 6} className="axis" textAnchor="middle">
                    {footer(b, i)}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      )}
      {hover !== null && bars[hover] && (
        <div className="tip" style={{ left: Math.min(Math.max(left + hover * step + step / 2, 70), width - 70) }}>
          {format(bars[hover])}
        </div>
      )}
    </div>
  )
}
