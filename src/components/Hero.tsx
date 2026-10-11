// Главный блок: вердикт обстановки, круговая шкала Kp и сводка человеческим языком.

import type { Conditions } from '../lib/model'
import { CONDITION_TITLE, age, kpColor } from '../lib/model'
import { PALETTE } from './Sky'
import { Icons } from './Card'

function KpGauge({ kp }: { kp: number | null }) {
  // Дуга на 270°: 0 внизу слева, 9 внизу справа.
  const size = 188
  const r = 78
  const c = size / 2
  const startA = 135
  const sweep = 270
  const arc = (from: number, to: number) => {
    const a0 = ((startA + from) * Math.PI) / 180
    const a1 = ((startA + to) * Math.PI) / 180
    const large = to - from > 180 ? 1 : 0
    return `M${c + r * Math.cos(a0)},${c + r * Math.sin(a0)} A${r},${r} 0 ${large} 1 ${c + r * Math.cos(a1)},${c + r * Math.sin(a1)}`
  }
  const value = kp ?? 0
  const color = kp === null ? 'rgba(255,255,255,.3)' : kpColor(value)
  const ticks = Array.from({ length: 10 }, (_, i) => i)

  return (
    <svg className="gauge" viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={`Kp ${value.toFixed(1)}`}>
      <defs>
        <linearGradient id="kpgrad" x1="0" y1="1" x2="1" y2="1">
          <stop offset="0" stopColor="#73d999" />
          <stop offset="0.45" stopColor="#d9e073" />
          <stop offset="0.62" stopColor="#ffc752" />
          <stop offset="0.8" stopColor="#ff6b61" />
          <stop offset="1" stopColor="#f24d8c" />
        </linearGradient>
      </defs>
      <path d={arc(0, sweep)} stroke="rgba(255,255,255,.09)" strokeWidth="12" fill="none" strokeLinecap="round" />
      <path d={arc(0, sweep)} stroke="url(#kpgrad)" strokeWidth="12" fill="none" strokeLinecap="round" opacity="0.18" />
      {kp !== null && (
        <path
          d={arc(0, Math.max(2, (Math.min(value, 9) / 9) * sweep))}
          stroke={color}
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 8px ${color}88)`, transition: 'all .8s ease' }}
        />
      )}
      {ticks.map((i) => {
        const a = ((startA + (i / 9) * sweep) * Math.PI) / 180
        return (
          <text key={i} x={c + (r - 22) * Math.cos(a)} y={c + (r - 22) * Math.sin(a) + 3.5} className="gauge-tick" textAnchor="middle">
            {i}
          </text>
        )
      })}
      <text x={c} y={c + 8} className="gauge-value" textAnchor="middle" fill={color}>
        {kp === null ? '—' : value.toFixed(1).replace('.', ',')}
      </text>
      <text x={c} y={c + 30} className="gauge-caption" textAnchor="middle">
        индекс Kp
      </text>
    </svg>
  )
}

export function Hero({
  c,
  capturedAt,
  loading,
  offline,
  onRefresh,
}: {
  c: Conditions
  capturedAt: number
  loading: boolean
  offline: boolean
  onRefresh: () => void
}) {
  const p = PALETTE[c.level]
  return (
    <section className="hero">
      <div className="hero-text">
        <div className="eyebrow">Космическая погода сейчас</div>
        <h1 style={{ color: p.accent }}>{c.kp === null ? 'Загрузка…' : c.headline}</h1>
        <div className="hero-level">
          <span className="dot" style={{ background: p.accent, boxShadow: `0 0 12px ${p.accent}` }} />
          {c.level === 'calm'
            ? 'Бурь, радиозатемнений и протонных событий нет'
            : CONDITION_TITLE[c.level] !== c.headline
              ? CONDITION_TITLE[c.level]
              : `${c.geomagnetic.severity} буря`}
        </div>
        {c.kp !== null && <p className="summary">{c.summary}</p>}
        <div className="freshness">
          <button className={`refresh ${loading ? 'spin' : ''}`} onClick={onRefresh} aria-label="Обновить">
            {Icons.refresh}
          </button>
          {capturedAt ? (
            <span>
              {offline ? 'Нет связи с NOAA — показан срез ' : 'Обновлено '}
              {age(capturedAt)}
            </span>
          ) : (
            <span>Связь с NOAA…</span>
          )}
        </div>
      </div>
      <KpGauge kp={c.kp} />
    </section>
  )
}
