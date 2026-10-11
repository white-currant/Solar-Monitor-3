import { useState } from 'react'
import type { AlertKind, SWPCAlert } from '../lib/model'
import { formatDayTime } from '../lib/model'
import { Card, Icons, More } from './Card'

const KIND: Record<AlertKind, { label: string; color: string }> = {
  alert: { label: 'Тревога', color: '#ff4d4d' },
  warning: { label: 'Предупреждение', color: '#ffb21a' },
  watch: { label: 'Наблюдение', color: '#4fb6ff' },
  summary: { label: 'Итог', color: '#2ee88a' },
  other: { label: 'Сообщение', color: '#a9b4cc' },
}

export function AlertsCard({ alerts, now }: { alerts: SWPCAlert[]; now: number }) {
  const [open, setOpen] = useState<string | null>(null)
  const [all, setAll] = useState(false)
  const recent = alerts.filter((a) => a.issued > now - 3 * 86_400_000)
  const shown = all ? alerts.slice(0, 40) : recent.slice(0, 3)
  const rest = all ? [] : recent.slice(3, 15)
  const newest = recent[0]

  return (
    <Card
      id="alerts-card"
      title="Сообщения NOAA"
      subtitle="Официальные тревоги и предупреждения центра прогнозов космической погоды."
      verdict={newest ? { text: `Последнее: ${newest.headlineRu.toLowerCase()} (${formatDayTime(newest.issued)}).`, color: KIND[newest.kind].color } : { text: 'За трое суток сообщений не было.', color: '#2ee88a' }}
      icon={Icons.bell}
      info="alerts"
      aside={<span className="stamp">{recent.length} за 3 сут</span>}
    >
      {shown.length ? (
        <ul className="alerts">
          {shown.map((a) => (
            <li key={a.id} className={open === a.id ? 'open' : ''}>
              <button onClick={() => setOpen(open === a.id ? null : a.id)}>
                <span className="alert-kind" style={{ color: KIND[a.kind].color, borderColor: `${KIND[a.kind].color}55` }}>
                  {KIND[a.kind].label}
                </span>
                <span className="alert-head">{a.headlineRu}</span>
                <span className="alert-time">{formatDayTime(a.issued)}</span>
              </button>
              {open === a.id && <pre className="alert-body">{a.body}</pre>}
            </li>
          ))}
        </ul>
      ) : null}
      {rest.length > 0 && (
        <More label={`Ещё ${rest.length}`}>
          <ul className="alerts">
            {rest.map((a) => (
              <li key={a.id} className={open === a.id ? 'open' : ''}>
                <button onClick={() => setOpen(open === a.id ? null : a.id)}>
                  <span className="alert-kind" style={{ color: KIND[a.kind].color, borderColor: `${KIND[a.kind].color}55` }}>
                    {KIND[a.kind].label}
                  </span>
                  <span className="alert-head">{a.headlineRu}</span>
                  <span className="alert-time">{formatDayTime(a.issued)}</span>
                </button>
                {open === a.id && <pre className="alert-body">{a.body}</pre>}
              </li>
            ))}
          </ul>
        </More>
      )}
      {alerts.length > recent.length && (
        <button className="link" onClick={() => setAll(!all)}>
          {all ? 'Только последние' : `Показать архив (${alerts.length})`}
        </button>
      )}
    </Card>
  )
}
