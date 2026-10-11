import { useState } from 'react'
import type { WindPoint } from '../lib/model'
import { age, duration, fmt1, last, leadTimeFromL1, travelTimeFromSun } from '../lib/model'
import { TimeChart } from './Chart'
import { Card, Empty, Icons, Segmented, Stat } from './Card'

type Mode = 'speed' | 'bz' | 'density'
const H = 3_600_000

const speedColor = (v: number) => (v >= 700 ? '#ff4d4d' : v >= 500 ? '#ffb21a' : '#2ee88a')
const bzColor = (v: number) => (v <= -10 ? '#ff4d4d' : v <= -5 ? '#ff8a1f' : v >= 5 ? '#4fb6ff' : '#f2f6ff')

export function WindCard({ wind, now }: { wind: WindPoint[]; now: number }) {
  const [mode, setMode] = useState<Mode>('speed')
  const cur = last(wind)
  if (!cur) {
    return (
      <Card id="wind-card" title="Солнечный ветер" icon={Icons.wind} info="wind">
        <Empty text="Данные спутников в точке L1 загружаются" />
      </Card>
    )
  }

  const lead = leadTimeFromL1(cur.speed)
  const travel = travelTimeFromSun(cur.speed)
  const start = now - 24 * H

  const chart = {
    speed: {
      series: [{ points: wind.map((p) => ({ t: p.t, v: p.speed })), color: '#ffb21a', area: true }],
      yMin: 250,
      yMax: Math.max(700, Math.ceil(Math.max(...wind.map((p) => p.speed)) / 100) * 100 + 50),
      ticks: [300, 400, 500, 600, 700, 800, 900].map((v) => ({ v, label: String(v) })),
      bands: [{ from: 500, to: 2000, color: 'rgba(255,199,82,0.06)', label: 'быстрый поток' }],
      zero: undefined as number | undefined,
      format: (v: number) => `${Math.round(v)} км/с`,
    },
    bz: {
      series: [
        { points: wind.map((p) => ({ t: p.t, v: p.bz })), color: '#ff6a3d', width: 2.2 },
        { points: wind.map((p) => ({ t: p.t, v: p.bt })), color: 'rgba(232,238,252,0.45)', width: 1.2, dashed: true },
      ],
      yMin: -Math.max(15, Math.ceil(Math.max(...wind.map((p) => p.bt)) / 5) * 5),
      yMax: Math.max(15, Math.ceil(Math.max(...wind.map((p) => p.bt)) / 5) * 5),
      ticks: [-20, -10, 0, 10, 20].map((v) => ({ v, label: String(v) })),
      bands: [{ from: -100, to: -5, color: 'rgba(255,107,97,0.08)', label: 'южное поле' }],
      zero: 0,
      format: (v: number) => `Bz ${fmt1(v)} нТл`,
    },
    density: {
      series: [{ points: wind.map((p) => ({ t: p.t, v: p.density })), color: '#4fb6ff', area: true }],
      yMin: 0,
      yMax: Math.max(10, Math.ceil(Math.max(...wind.map((p) => p.density)) / 5) * 5),
      ticks: [0, 5, 10, 20, 30, 40].map((v) => ({ v, label: String(v) })),
      bands: [],
      zero: undefined,
      format: (v: number) => `${fmt1(v)} част/см³`,
    },
  }[mode]

  return (
    <Card id="wind-card" title="Солнечный ветер" icon={Icons.wind} info="wind" aside={<span className="stamp">{age(cur.t)}</span>}>
      <div className="stats">
        <Stat label="Скорость" value={Math.round(cur.speed)} unit="км/с" color={speedColor(cur.speed)} />
        <Stat label="Плотность" value={fmt1(cur.density)} unit="см⁻³" />
        <Stat label="Bz" value={fmt1(cur.bz)} unit="нТл" color={bzColor(cur.bz)} sub={cur.bz < 0 ? 'южное' : 'северное'} />
        <Stat label="Bt" value={fmt1(cur.bt)} unit="нТл" />
      </div>

      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: 'speed', label: 'Скорость' },
          { value: 'bz', label: 'Поле Bz' },
          { value: 'density', label: 'Плотность' },
        ]}
      />
      <TimeChart
        series={chart.series}
        start={start}
        end={now}
        yMin={chart.yMin}
        yMax={chart.yMax}
        yTicks={chart.ticks.filter((t) => t.v >= chart.yMin && t.v <= chart.yMax)}
        bands={chart.bands}
        zero={chart.zero}
        format={chart.format}
      />
      {mode === 'bz' && <p className="footnote">Сплошная — Bz, пунктир — полная сила поля Bt. Ниже нуля поле открывает магнитосферу.</p>}

      <div className="facts">
        {lead && (
          <div>
            <span>От спутника в L1 до Земли</span>
            <b>{duration(lead)}</b>
          </div>
        )}
        {travel && (
          <div>
            <span>Путь от Солнца при этой скорости</span>
            <b>{duration(travel)}</b>
          </div>
        )}
      </div>
    </Card>
  )
}
