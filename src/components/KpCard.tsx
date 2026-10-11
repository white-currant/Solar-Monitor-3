import type { KpForecastPoint, Point } from '../lib/model'
import { formatDayTime, geomagneticLevel, kpColor } from '../lib/model'
import { BarChart, TimeChart, type Bar } from './Chart'
import { Card, Empty, Icons } from './Card'

const H = 3_600_000

export function KpCard({ forecast, estimated, now }: { forecast: KpForecastPoint[]; estimated: Point[]; now: number }) {
  // Сутки наблюдений и трое суток прогноза одним рядом трёхчасовых столбцов.
  const bars: Bar[] = forecast
    .filter((p) => p.t >= now - 24 * H && p.t <= now + 72 * H)
    .map((p) => ({
      t: p.t,
      v: p.kp,
      color: kpColor(p.kp),
      faded: p.origin === 'predicted',
      label: p.origin,
    }))

  const peak = forecast.filter((p) => p.origin === 'predicted' && p.t > now).reduce<KpForecastPoint | null>((m, p) => (!m || p.kp > m.kp ? p : m), null)

  return (
    <Card title="Индекс Kp" icon={Icons.calendar} info="kp">
      {bars.length ? (
        <>
          <BarChart
            bars={bars}
            max={9}
            ticks={[0, 3, 5, 7, 9]}
            threshold={{ v: 5, label: 'буря G1' }}
            height={170}
            format={(b) => (
              <>
                <b style={{ color: b.color }}>Kp {b.v.toFixed(2).replace('.', ',')}</b>
                <span>
                  {formatDayTime(b.t)} · {b.faded ? 'прогноз' : b.label === 'estimated' ? 'оценка' : 'наблюдение'}
                </span>
              </>
            )}
            footer={(b) => {
              // Подпись даты — только под первым столбцом новых суток.
              const d = new Date(b.t)
              return d.getHours() < 3 ? d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : null
            }}
          />
          <div className="legend">
            <span><i className="sw solid" /> наблюдение</span>
            <span><i className="sw dashed" /> прогноз NOAA</span>
            {peak && (
              <span className="legend-right">
                максимум прогноза: <b style={{ color: kpColor(peak.kp) }}>{peak.kp.toFixed(1).replace('.', ',')}</b> — {geomagneticLevel(peak.kp).g ? `буря G${geomagneticLevel(peak.kp).g}` : geomagneticLevel(peak.kp).title.toLowerCase()}, {formatDayTime(peak.t)}
              </span>
            )}
          </div>
        </>
      ) : (
        <Empty text="Ряд Kp загружается" />
      )}

      {estimated.length > 10 && (
        <div className="subchart">
          <div className="subchart-title">Минутная оценка за 6 часов</div>
          <TimeChart
            series={[{ points: estimated, color: '#9fd8ff', area: true }]}
            start={now - 6 * H}
            end={now}
            yMin={0}
            yMax={Math.max(5, Math.ceil(Math.max(...estimated.map((p) => p.v)) + 0.5))}
            yTicks={[0, 2, 4, 6, 8].map((v) => ({ v, label: String(v) }))}
            bands={[{ from: 5, to: 9, color: 'rgba(255,199,82,0.08)', label: 'буря' }]}
            height={120}
            format={(v) => `Kp ${v.toFixed(2).replace('.', ',')}`}
          />
        </div>
      )}
    </Card>
  )
}
