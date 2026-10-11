// «Главное сейчас»: четыре вопроса, ради которых обычно и открывают сайт.
// Каждый ответ — одно слово-вердикт с цветом и строка пояснения. Нажатие ведёт к подробностям.

import type { ReactNode } from 'react'
import type { AuroraGrid, Conditions, FlareEvent, NOAAScales } from '../lib/model'
import { FLARE_COLOR, auroraProbability, scaleColor } from '../lib/model'
import { geomagneticLatitude, type Place } from '../lib/geo'
import { outcome } from './AuroraCard'
import { Icons } from './Card'

interface Fact {
  id: string
  icon: ReactNode
  question: string
  answer: string
  color: string
  detail: string
}

const dayWord = ['сегодня', 'завтра', 'послезавтра']

export function KeyFacts({
  c,
  scales,
  flares,
  aurora,
  place,
  now,
  onJump,
}: {
  c: Conditions
  scales: NOAAScales | null
  flares: FlareEvent[]
  aurora: AuroraGrid | null
  place: Place
  now: number
  onJump: (id: string) => void
}) {
  // 1. Магнитная буря: сейчас и прогноз NOAA на три дня.
  const forecast = scales?.forecast ?? []
  const nextIdx = forecast.reduce((best, d, i) => ((d.g ?? 0) > (forecast[best]?.g ?? 0) ? i : best), 0)
  const nextG = forecast[nextIdx]?.g ?? 0
  const gNow = c.geomagnetic.g
  const storm: Fact = {
    id: 'kp-card',
    icon: Icons.calendar,
    question: 'Магнитная буря?',
    answer: gNow ? `Да, G${gNow}` : nextG ? `Ожидается G${nextG}` : 'Нет',
    color: scaleColor(Math.max(gNow, nextG)),
    detail: gNow
      ? `${c.geomagnetic.severity[0].toUpperCase()}${c.geomagnetic.severity.slice(1)} буря прямо сейчас.`
      : nextG
        ? `По прогнозу NOAA — ${dayWord[nextIdx] ?? 'в ближайшие дни'}.`
        : c.geomagnetic.rank === 1
          ? 'Поле неспокойно, но до бури не дотягивает.'
          : 'Поле спокойное, бурь в ближайшие дни не ждут.',
  }

  // 2. Сияние в выбранном месте.
  const prob = aurora ? auroraProbability(aurora, place.lat, place.lon) : null
  const distance = Math.abs(geomagneticLatitude(place.lat, place.lon)) - c.geomagnetic.boundary
  const o = outcome(prob ?? 0, distance)
  const auroraFact: Fact = {
    id: 'aurora-card',
    icon: Icons.aurora,
    question: `Сияние · ${place.name}?`,
    answer: prob === null ? '…' : o.title === 'Шансов нет' ? 'Не видно' : o.title,
    color: prob === null ? 'rgba(255,255,255,.5)' : o.title === 'Шансов нет' ? 'rgba(255,255,255,.62)' : o.color,
    detail: prob === null ? 'Загружается прогноз.' : `Вероятность ${prob} %. ${o.title === 'Шансов нет' ? 'Нужна буря посильнее.' : 'Смотрите на север, подальше от фонарей.'}`,
  }

  // 3. Вспышки за сутки.
  const day = flares.filter((f) => f.begin > now - 86_400_000)
  const strongest = day.reduce<FlareEvent | null>((m, f) => (!m || (f.peakFlux ?? 0) > (m.peakFlux ?? 0) ? f : m), null)
  const cls = (strongest?.maxClass[0] ?? 'A') as keyof typeof FLARE_COLOR
  const mChance = forecast[0]?.rMinor
  const flareFact: Fact = {
    id: 'flare-card',
    icon: Icons.flare,
    question: 'Вспышки на Солнце?',
    answer: !strongest ? 'Нет' : cls === 'X' ? `Сильная ${strongest.maxClass}` : cls === 'M' ? `Была ${strongest.maxClass}` : 'Слабые',
    color: !strongest ? FLARE_COLOR.C : FLARE_COLOR[cls] ?? FLARE_COLOR.C,
    detail: `${strongest ? `Сильнейшая за сутки — ${strongest.maxClass}.` : 'За сутки вспышек не было.'}${mChance != null ? ` Шанс вспышки M сегодня ${mChance} %.` : ''}`,
  }

  // 4. Радиация и радиосвязь.
  const worst = Math.max(c.radiation, c.radio)
  const radFact: Fact = {
    id: 'proton-card',
    icon: Icons.proton,
    question: 'Радиация и связь?',
    answer: worst ? `${c.radiation ? `S${c.radiation}` : ''}${c.radiation && c.radio ? ' · ' : ''}${c.radio ? `R${c.radio}` : ''}` : 'В норме',
    color: scaleColor(worst),
    detail: worst
      ? [c.radiation ? 'Протонное событие — риск для спутников и полярных рейсов.' : '', c.radio ? 'Помехи коротковолновой связи на дневной стороне.' : '']
          .filter(Boolean)
          .join(' ')
      : 'Радиационный фон обычный, радиосвязь без помех.',
  }

  return (
    <section className="keyfacts" aria-label="Главное сейчас">
      <h2 className="section-title compact">Главное сейчас</h2>
      <div className="facts-grid">
        {[storm, auroraFact, flareFact, radFact].map((f) => (
          <button key={f.id} className="fact" onClick={() => onJump(f.id)} style={{ ['--fc' as string]: f.color }}>
            <span className="fact-q">
              <span className="fact-icon">{f.icon}</span>
              {f.question}
            </span>
            <span className="fact-a">{f.answer}</span>
            <span className="fact-d">{f.detail}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
