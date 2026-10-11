import { useEffect, useState } from 'react'
import type { FlareEvent, Point } from '../lib/model'
import { FLARE_COLOR, FLARE_MEANING, flareLabel, flareLetter, formatDayTime, formatTime, last, scientific } from '../lib/model'
import { loadXray } from '../lib/noaa'
import { TimeChart, type Marker } from './Chart'
import { Card, Empty, Icons, More, Segmented } from './Card'

const H = 3_600_000

const CLASS_BANDS = [
  { from: 1e-6, to: 1e-5, color: 'rgba(115,217,153,0.06)', label: 'C' },
  { from: 1e-5, to: 1e-4, color: 'rgba(255,191,77,0.08)', label: 'M' },
  { from: 1e-4, to: 1e-2, color: 'rgba(255,102,102,0.10)', label: 'X' },
]

export function FlareCard({ xray, flares, now }: { xray: Point[]; flares: FlareEvent[]; now: number }) {
  const [days, setDays] = useState<1 | 3>(1)
  const [xray3, setXray3] = useState<Point[] | null>(null)

  useEffect(() => {
    if (days === 3 && !xray3) loadXray(3).then(setXray3, () => setDays(1))
  }, [days, xray3])

  const series = days === 3 && xray3 ? xray3 : xray
  const cur = last(xray)
  const start = now - days * 24 * H

  // Сильнейшие первыми: при тесном соседстве подпись получит более мощная вспышка.
  const markers: Marker[] = flares
    .filter((f) => f.begin >= start && /^[MX]/.test(f.maxClass))
    .sort((a, b) => (b.peakFlux ?? 0) - (a.peakFlux ?? 0))
    .map((f) => ({ t: f.max ?? f.begin, color: FLARE_COLOR[f.maxClass[0] as 'M' | 'X'], label: f.maxClass }))

  const week = [...flares].filter((f) => f.begin > now - 7 * 24 * H).reverse()
  const strongest = week.reduce<FlareEvent | null>((m, f) => (!m || (f.peakFlux ?? 0) > (m.peakFlux ?? 0) ? f : m), null)
  const letter = cur ? flareLetter(cur.v) : 'A'
  const day = flares.filter((f) => f.begin > now - 24 * H)
  const dayMax = day.reduce<FlareEvent | null>((m, f) => (!m || (f.peakFlux ?? 0) > (m.peakFlux ?? 0) ? f : m), null)
  const dayLetter = (dayMax?.maxClass[0] ?? 'A') as keyof typeof FLARE_COLOR
  const verdict = !dayMax
    ? { text: 'За сутки вспышек не было — Солнце спокойно.', color: FLARE_COLOR.C }
    : dayLetter === 'X'
      ? { text: `За сутки сильная вспышка ${dayMax.maxClass} — возможны сбои связи и выброс к Земле.`, color: FLARE_COLOR.X }
      : dayLetter === 'M'
        ? { text: `За сутки была средняя вспышка ${dayMax.maxClass}. Сейчас ${flareLabel(cur?.v ?? 0)} — ${letter === 'M' || letter === 'X' ? 'активно' : 'спокойнее'}.`, color: FLARE_COLOR.M }
        : { text: `Сильных вспышек нет, максимум за сутки — ${dayMax.maxClass}.`, color: FLARE_COLOR.C }

  return (
    <Card
      id="flare-card"
      subtitle="Рентгеновский свет Солнца по данным спутников GOES. Всплеск на графике — вспышка. Классы по силе: B, C — слабые, M — средние, X — сильные."
      verdict={verdict}
      title="Вспышки на Солнце"
      icon={Icons.flare}
      info="flares"
      aside={
        <Segmented
          value={days}
          onChange={setDays}
          options={[
            { value: 1, label: '24 ч' },
            { value: 3, label: '3 сут' },
          ]}
        />
      }
    >
      {cur ? (
        <>
          <div className="flare-now">
            <span className="flare-class" style={{ color: FLARE_COLOR[letter], textShadow: `0 0 18px ${FLARE_COLOR[letter]}66` }}>
              {flareLabel(cur.v)}
            </span>
            <div>
              <div className="flare-flux">
                {scientific(cur.v)} Вт/м² · {formatTime(cur.t)}
              </div>
              <div className="muted small">{FLARE_MEANING[letter]}</div>
            </div>
          </div>
          <TimeChart
            series={[{ points: series, color: FLARE_COLOR.B, area: true, width: 2, colorAt: (v) => FLARE_COLOR[flareLetter(v)] }]}
            start={start}
            end={now}
            yMin={1e-8}
            yMax={1e-3}
            log
            yTicks={[
              { v: 1e-8, label: 'A' },
              { v: 1e-7, label: 'B' },
              { v: 1e-6, label: 'C' },
              { v: 1e-5, label: 'M' },
              { v: 1e-4, label: 'X' },
            ]}
            bands={CLASS_BANDS}
            markers={markers}
            format={(v) => `${flareLabel(v)} · ${scientific(v)}`}
            longTime={days === 3}
          />
        </>
      ) : (
        <Empty text="Поток GOES загружается" />
      )}

      <div className="flare-list">
        <div className="subchart-title">
          Вспышки за неделю: {week.length}
          {strongest && (
            <>
              {' '}· сильнейшая <b style={{ color: FLARE_COLOR[strongest.maxClass[0] as 'C'] ?? '#fff' }}>{strongest.maxClass}</b>
            </>
          )}
        </div>
        <ul>
          {week.slice(0, 5).map((f) => (
            <li key={f.begin}>
              <span className="flare-tag" style={{ background: `${FLARE_COLOR[f.maxClass[0] as 'C'] ?? '#888'}22`, color: FLARE_COLOR[f.maxClass[0] as 'C'] ?? '#ccc' }}>
                {f.maxClass}
              </span>
              <span>{formatDayTime(f.max ?? f.begin)}</span>
              <span className="muted">
                {f.end && f.begin ? `${Math.round((f.end - f.begin) / 60_000)} мин` : ''}
              </span>
            </li>
          ))}
        </ul>
        {week.length > 5 && (
          <More label={`Ещё ${Math.min(week.length, 25) - 5}`}>
            <ul>
              {week.slice(5, 25).map((f) => (
                <li key={f.begin}>
                  <span className="flare-tag" style={{ background: `${FLARE_COLOR[f.maxClass[0] as 'C'] ?? '#888'}22`, color: FLARE_COLOR[f.maxClass[0] as 'C'] ?? '#ccc' }}>
                    {f.maxClass}
                  </span>
                  <span>{formatDayTime(f.max ?? f.begin)}</span>
                </li>
              ))}
            </ul>
          </More>
        )}
        {week.length === 0 && <Empty text="За неделю вспышек не зарегистрировано" />}
      </div>
    </Card>
  )
}
