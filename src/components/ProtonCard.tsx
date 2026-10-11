import type { Point } from '../lib/model'
import { RADIATION_MEANING, last, radiationScale, scaleColor } from '../lib/model'
import { TimeChart } from './Chart'
import { Card, Empty, Icons } from './Card'

const H = 3_600_000
const fmt = (v: number) => (v < 10 ? v.toFixed(2).replace('.', ',') : Math.round(v).toLocaleString('ru-RU'))

export function ProtonCard({ protons, now }: { protons: Point[]; now: number }) {
  const cur = last(protons)
  const s = cur ? radiationScale(cur.v) : 0
  return (
    <Card
      id="proton-card"
      title="Радиация · протоны"
      subtitle="Быстрые частицы от сильных вспышек. Опасны для спутников и полярных авиарейсов; порог события — 10 pfu."
      verdict={cur ? (s ? { text: `Протонное событие S${s}: ${RADIATION_MEANING[s].toLowerCase()}`, color: scaleColor(s) } : { text: 'Радиационный фон — опасности нет.', color: scaleColor(0) }) : null}
      icon={Icons.proton}
      info="protons"
    >
      {cur ? (
        <>
          <div className="flare-now">
            <span className="flare-class" style={{ color: scaleColor(s) }}>
              {s ? `S${s}` : 'Фон'}
            </span>
            <div>
              <div className="flare-flux">{fmt(cur.v)} pfu</div>
              <div className="muted small">{RADIATION_MEANING[s]}</div>
            </div>
          </div>
          <TimeChart
            now={now}
            series={[{ points: protons, color: '#b98cff', area: true, width: 1.8 }]}
            start={now - 24 * H}
            end={now}
            yMin={0.01}
            yMax={1e4}
            log
            yTicks={[0.01, 1, 10, 100, 1e4].map((v) => ({ v, label: v >= 1 ? v.toLocaleString('ru-RU') : '0,01' }))}
            bands={[{ from: 10, to: 1e6, color: 'rgba(255,199,82,0.07)', label: 'протонное событие' }]}
            height={170}
            format={(v) => `${fmt(v)} pfu`}
          />
        </>
      ) : (
        <Empty text="Поток протонов загружается" />
      )}
    </Card>
  )
}
