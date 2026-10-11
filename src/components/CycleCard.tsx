import type { CyclePoint, CyclePrediction } from '../lib/model'
import { TimeChart } from './Chart'
import { Card, Empty, Icons } from './Card'

export function CycleCard({ data }: { data: { observed: CyclePoint[]; predicted: CyclePrediction[] } | null }) {
  if (!data || !data.observed.length) {
    return (
      <Card title="Солнечный цикл" icon={Icons.cycle} info="cycle">
        <Empty text="Архив чисел Вольфа загружается" />
      </Card>
    )
  }
  const start = Date.UTC(2008, 0, 1)
  const end = Math.max(Date.UTC(2031, 0, 1), data.predicted.length ? data.predicted[data.predicted.length - 1].t : 0)
  const observed = data.observed.filter((p) => p.t >= start)
  const smoothed = observed.filter((p) => p.smoothed !== null).map((p) => ({ t: p.t, v: p.smoothed! }))
  const lastObs = observed[observed.length - 1]
  const peak = smoothed.reduce((m, p) => (p.v > m.v ? p : m), { t: 0, v: 0 })
  const max = Math.max(200, ...observed.map((p) => p.ssn))
  const lastSmooth = smoothed[smoothed.length - 1]
  const falling = peak.v > 0 && lastSmooth && lastSmooth.t > peak.t
  const verdict = falling
    ? { text: `Пик 25-го цикла пройден в ${new Date(peak.t).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}. Активность медленно спадает, но сильные бури на спаде цикла ещё случаются.`, color: '#ffbb1f' }
    : { text: 'Солнце идёт к максимуму цикла — вспышек и бурь становится больше.', color: '#ff8a1f' }

  return (
    <Card
      title="Солнечный цикл"
      subtitle="Солнце живёт циклами примерно по 11 лет: на пике больше пятен, вспышек и магнитных бурь."
      verdict={verdict}
      icon={Icons.cycle}
      info="cycle"
    >
      <div className="stats">
        <div className="stat">
          <span className="stat-label">Пятен за месяц</span>
          <span className="stat-value">{Math.round(lastObs.ssn)}</span>
          <span className="stat-sub">{new Date(lastObs.t).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</span>
        </div>
        {peak.v > 0 && (
          <div className="stat">
            <span className="stat-label">Максимум 25-го цикла</span>
            <span className="stat-value">{Math.round(peak.v)}</span>
            <span className="stat-sub">{new Date(peak.t).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</span>
          </div>
        )}
      </div>
      <TimeChart
        series={[
          { points: observed.map((p) => ({ t: p.t, v: p.ssn })), color: 'rgba(255,187,31,0.5)', width: 1.1 },
          { points: smoothed, color: '#ffbb1f', width: 2.8 },
          { points: data.predicted.map((p) => ({ t: p.t, v: p.ssn })), color: '#4fd2ff', dashed: true, width: 1.6 },
          { points: data.predicted.map((p) => ({ t: p.t, v: p.high })), color: 'rgba(159,216,255,0.3)', width: 1 },
          { points: data.predicted.map((p) => ({ t: p.t, v: p.low })), color: 'rgba(159,216,255,0.3)', width: 1 },
        ]}
        start={start}
        end={end}
        yMin={0}
        yMax={Math.ceil(max / 50) * 50}
        yTicks={[0, 50, 100, 150, 200, 250].map((v) => ({ v, label: String(v) }))}
        markers={[{ t: Date.UTC(2019, 11, 1), color: 'rgba(255,255,255,.5)', label: 'начало 25-го' }]}
        height={210}
        gap={62 * 86_400_000}
        format={(v) => `${Math.round(v)} пятен`}
        longTime
      />
      <p className="footnote">
        Число Вольфа с {new Date(start).getFullYear()} года: тонкая линия — среднемесячное, жёлтая — сглаженное,
        голубой пунктир — прогноз NOAA до {new Date(end).getFullYear() - 1} года с коридором неопределённости.
      </p>
    </Card>
  )
}
