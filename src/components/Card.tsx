import { useState, type ReactNode } from 'react'
import { INFO, type Topic } from '../lib/info'

export function Card({
  title,
  icon,
  info,
  aside,
  children,
  className = '',
  id,
}: {
  title: string
  icon?: ReactNode
  info?: Topic
  aside?: ReactNode
  children: ReactNode
  className?: string
  id?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <section className={`card ${className}`} id={id}>
      <header className="card-head">
        <h2>
          {icon && <span className="card-icon">{icon}</span>}
          {title}
        </h2>
        <div className="card-aside">
          {aside}
          {info && (
            <button
              className={`info-btn ${open ? 'on' : ''}`}
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              aria-label="Что это значит"
            >
              ?
            </button>
          )}
        </div>
      </header>
      {info && open && (
        <div className="info">
          {INFO[info].map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )}
      {children}
    </section>
  )
}

export function Stat({
  label,
  value,
  unit,
  color,
  sub,
}: {
  label: string
  value: ReactNode
  unit?: string
  color?: string
  sub?: ReactNode
}) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value" style={color ? { color } : undefined}>
        {value}
        {unit && <small>{unit}</small>}
      </span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  )
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>
}

// Иконки — простые штрихи в одном стиле, без внешних библиотек.
const I = (d: string) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)
export const Icons = {
  gauge: I('M12 14l4-4M3.5 15a9 9 0 1 1 17 0M12 14h.01'),
  wind: I('M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7'),
  flare: I('M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z'),
  proton: I('M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M4 12c0-4 3.6-7 8-7s8 3 8 7-3.6 7-8 7-8-3-8-7z'),
  sun: I('M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z'),
  aurora: I('M3 18c3-8 6-12 9-12s6 4 9 12M7 18c1.5-4 3-6 5-6s3.5 2 5 6'),
  bell: I('M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0'),
  cycle: I('M3 12a9 9 0 0 1 15.5-6.3L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.3L3 16M3 21v-5h5'),
  calendar: I('M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z'),
  pin: I('M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12zM12 10m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0'),
  refresh: I('M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5'),
}
