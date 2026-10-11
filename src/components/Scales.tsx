import type { Conditions, NOAAScales, ScalesDay } from '../lib/model'
import { RADIATION_MEANING, RADIO_MEANING, scaleColor } from '../lib/model'
import { Card, Icons } from './Card'

const dayName = (date: string, i: number) => {
  if (i === 0) return 'Сегодня'
  if (i === 1) return 'Завтра'
  const d = new Date(date + 'T12:00:00Z')
  return isNaN(d.getTime()) ? `+${i} сут` : d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric' })
}

function Pill({ letter, value, meaning }: { letter: string; value: number; meaning: string }) {
  const color = scaleColor(value)
  return (
    <div className="scale-pill" style={{ borderColor: `${color}55` }}>
      <div className="scale-letter" style={{ color }}>
        {letter}
        <b>{value}</b>
      </div>
      <div className="scale-meaning">{meaning}</div>
    </div>
  )
}

const prob = (v: number | null) => (v === null ? '—' : `${v} %`)

export function ScalesCard({ scales, c }: { scales: NOAAScales | null; c: Conditions }) {
  const forecast: ScalesDay[] = scales?.forecast ?? []
  return (
    <Card title="Шкалы NOAA" icon={Icons.gauge} info="scales">
      <div className="scales-row">
        <Pill letter="R" value={c.radio} meaning={`Радиосвязь. ${RADIO_MEANING[c.radio]}`} />
        <Pill letter="S" value={c.radiation} meaning={`Радиация. ${RADIATION_MEANING[c.radiation]}`} />
        <Pill letter="G" value={c.geomagnetic.g} meaning={`Магнитное поле. ${c.geomagnetic.meaning}`} />
      </div>
      {forecast.length > 0 && (
        <div className="table-scroll">
        <table className="forecast-table">
          <thead>
            <tr>
              <th>Прогноз NOAA</th>
              {forecast.map((d, i) => (
                <th key={d.date}>{dayName(d.date, i)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Вспышка M</td>
              {forecast.map((d) => <td key={d.date}>{prob(d.rMinor)}</td>)}
            </tr>
            <tr>
              <td>Вспышка X</td>
              {forecast.map((d) => <td key={d.date}>{prob(d.rMajor)}</td>)}
            </tr>
            <tr>
              <td>Протонное событие</td>
              {forecast.map((d) => <td key={d.date}>{prob(d.sProb)}</td>)}
            </tr>
            <tr>
              <td>Геомагнитная буря</td>
              {forecast.map((d) => (
                <td key={d.date} style={{ color: scaleColor(d.g ?? 0), fontWeight: d.g ? 700 : 400 }}>
                  {d.g ? `G${d.g}` : 'нет'}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        </div>
      )}
      {scales?.yesterday && (scales.yesterday.r || scales.yesterday.s || scales.yesterday.g) ? (
        <p className="footnote">
          Вчера максимум: R{scales.yesterday.r ?? 0} · S{scales.yesterday.s ?? 0} · G{scales.yesterday.g ?? 0}
        </p>
      ) : null}
    </Card>
  )
}
