import { useEffect, useState } from 'react'
import type { ActiveRegion } from '../lib/model'
import { Card, Empty, Icons, More } from './Card'

const CHANNELS = [
  { id: '0193', label: '193 Å', note: 'корона, 1,2 млн K' },
  { id: '0171', label: '171 Å', note: 'корональные петли, 600 тыс. K' },
  { id: '0304', label: '304 Å', note: 'хромосфера и протуберанцы' },
  { id: '0131', label: '131 Å', note: 'горячие вспышки, 10 млн K' },
  { id: 'HMIIC', label: 'Видимый', note: 'фотосфера и пятна' },
  { id: 'HMIBC', label: 'Магнитограмма', note: 'полярности поля' },
]

const sdoUrl = (id: string, size: number, bust: number) =>
  `https://sdo.gsfc.nasa.gov/assets/img/latest/latest_${size}_${id}.jpg?t=${bust}`

function Disk({ regions }: { regions: ActiveRegion[] }) {
  // Положение области на диске: долгота от центрального меридиана, широта — гелиографическая.
  return (
    <svg className="disk-overlay" viewBox="-1.12 -1.12 2.24 2.24" aria-hidden="true">
      {regions.map((r) => {
        if (Math.abs(r.longitude) > 90) return null
        const lat = (r.latitude * Math.PI) / 180
        const lon = (r.longitude * Math.PI) / 180
        // В solar_regions.json западная долгота отрицательная (S13W39 → −39),
        // а на снимке с Земли запад справа — отсюда минус.
        const x = -Math.cos(lat) * Math.sin(lon) * 0.88
        const y = -Math.sin(lat) * 0.88
        const hot = r.probM >= 20 || r.probX >= 5
        return (
          <g key={r.number}>
            <circle cx={x} cy={y} r="0.035" fill="none" stroke={hot ? '#ffc752' : 'rgba(255,255,255,.75)'} strokeWidth="0.008" />
            <text x={x} y={y - 0.055} className="disk-label" textAnchor="middle" fill={hot ? '#ffc752' : '#fff'}>
              {r.number}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function SunCard({ regions }: { regions: ActiveRegion[] }) {
  const [channel, setChannel] = useState(CHANNELS[0])
  const [bust, setBust] = useState(() => Math.floor(Date.now() / 600_000))
  const [loaded, setLoaded] = useState(false)
  const [showRegions, setShowRegions] = useState(true)

  useEffect(() => {
    const id = setInterval(() => setBust(Math.floor(Date.now() / 600_000)), 60_000)
    return () => clearInterval(id)
  }, [])

  const top = regions[0]
  const verdict = !regions.length
    ? { text: 'Активных областей нет — вспышкам взяться неоткуда.', color: '#2ee88a' }
    : top.probX >= 5 || top.probM >= 40
      ? { text: `Самая опасная область — ${top.number}: шанс вспышки M ${top.probM} %, X ${top.probX} %.`, color: top.probX >= 10 ? '#ff4d4d' : '#ffb21a' }
      : { text: `На диске ${regions.length} активных областей, сильных вспышек не ждут.`, color: '#2ee88a' }
  return (
    <Card
      title="Солнце сейчас"
      subtitle="Свежие снимки обсерватории NASA SDO. Номера на диске — активные области, где рождаются вспышки."
      verdict={verdict}
      icon={Icons.sun}
      info="sdo"
    >
      <div className="channels">
        {CHANNELS.map((c) => (
          <button key={c.id} className={c.id === channel.id ? 'on' : ''} onClick={() => { setLoaded(false); setChannel(c) }}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="sun-wrap">
        <a href={sdoUrl(channel.id, 2048, bust)} target="_blank" rel="noreferrer" className={`sun ${loaded ? 'ready' : ''}`}>
          <img
            src={sdoUrl(channel.id, 1024, bust)}
            alt={`Солнце, канал ${channel.label}`}
            onLoad={() => setLoaded(true)}
            loading="lazy"
          />
          {showRegions && loaded && <Disk regions={regions} />}
        </a>
      </div>
      <div className="sun-caption">
        <span>
          {channel.label} — {channel.note}. Снимок NASA SDO, нажмите для полного размера.
        </span>
        {regions.length > 0 && (
          <label className="toggle">
            <input type="checkbox" checked={showRegions} onChange={(e) => setShowRegions(e.target.checked)} /> номера областей
          </label>
        )}
      </div>
      <RegionsTable regions={regions} />
    </Card>
  )
}

function RegionsTable({ regions }: { regions: ActiveRegion[] }) {
  if (!regions.length) return <Empty text="Активных областей на диске нет" />
  return (
    <div className="regions">
      <div className="subchart-title">
        Активные области: {regions.length}
        <span className="muted"> · вероятность вспышки за сутки</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>№</th>
            <th>Место</th>
            <th>Пятен</th>
            <th>Поле</th>
            <th>C</th>
            <th>M</th>
            <th>X</th>
          </tr>
        </thead>
        <tbody>
          {regions.slice(0, 3).map((r) => {
            const delta = (r.magClass ?? '').toLowerCase().includes('d')
            return (
              <tr key={r.number}>
                <td>{r.number}</td>
                <td className="mono">{r.location}</td>
                <td>{r.spotCount}</td>
                <td className={delta ? 'warn' : ''} title={delta ? 'дельта-конфигурация: высокий риск сильных вспышек' : undefined}>
                  {r.magClass ?? '—'}
                  {delta && ' ⚠'}
                </td>
                <td>{r.probC}%</td>
                <td className={r.probM >= 20 ? 'warn' : ''}>{r.probM}%</td>
                <td className={r.probX >= 5 ? 'hot' : ''}>{r.probX}%</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {regions.length > 3 && (
        <More label={`Ещё ${regions.length - 3}`}>
          <table>
            <tbody>
              {regions.slice(3).map((r) => (
                <tr key={r.number}>
                  <td>{r.number}</td>
                  <td className="mono">{r.location}</td>
                  <td>{r.spotCount}</td>
                  <td>{r.magClass ?? '—'}</td>
                  <td>{r.probC}%</td>
                  <td>{r.probM}%</td>
                  <td>{r.probX}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </More>
      )}
    </div>
  )
}
