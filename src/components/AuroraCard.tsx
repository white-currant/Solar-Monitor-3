import { useEffect, useRef, useState } from 'react'
import type { AuroraGrid, Conditions } from '../lib/model'
import { auroraProbability, formatDayTime, scaleColor } from '../lib/model'
import { PLACES, geomagneticLatitude, loadEarthTexture, project, renderAuroraMap, solarElevation, subsolarPoint, type Hemisphere, type Place } from '../lib/geo'
import { Card, Empty, Icons, Segmented } from './Card'

const PLACE_KEY = 'solar-monitor:place'

function loadPlace(): Place {
  try {
    const saved = JSON.parse(localStorage.getItem(PLACE_KEY) ?? 'null')
    if (saved && typeof saved.lat === 'number') return saved
  } catch {
    /* нет сохранённого места */
  }
  return PLACES[0]
}

type Outcome = { title: string; color: string; advice: (d: number) => string }

function outcome(probability: number, distance: number): Outcome {
  if (probability >= 35 || distance >= 4)
    return {
      title: 'Высокая вероятность',
      color: scaleColor(4),
      advice: () => 'Сияние должно быть хорошо видно при ясном небе. Отойдите от фонарей и дайте глазам привыкнуть к темноте.',
    }
  if (probability >= 12 || distance >= 0)
    return {
      title: 'Есть шанс',
      color: scaleColor(2),
      advice: () => 'Смотрите низко над горизонтом в сторону севера. Нужны ясное небо и место без городской засветки.',
    }
  if (probability >= 3 || distance >= -6)
    return {
      title: 'Маловероятно',
      color: scaleColor(1),
      advice: () => 'Овал близко, но не дотягивается. Стоит проверить прогноз ближе к ночи.',
    }
  return {
    title: 'Шансов нет',
    color: 'rgba(255,255,255,.45)',
    advice: (d) => `Овал сияния проходит примерно на ${Math.round(Math.abs(d))}° севернее. Нужна более сильная буря.`,
  }
}

function AuroraMap({ grid, place, hemisphere }: { grid: AuroraGrid; place: Place; hemisphere: Hemisphere }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState(false)
  const side = 720

  useEffect(() => {
    let cancelled = false
    loadEarthTexture(`${import.meta.env.BASE_URL}earth.jpg`).then(
      (texture) => {
        if (cancelled || !canvas.current) return
        const ctx = canvas.current.getContext('2d')!
        // Отдаём кадр браузеру, чтобы интерфейс не замирал на расчёте полумиллиона пикселей.
        requestAnimationFrame(() => !cancelled && renderAuroraMap(ctx, side, grid, texture, hemisphere, Date.now()))
      },
      () => setError(true),
    )
    return () => {
      cancelled = true
    }
  }, [grid, hemisphere])

  const p = project(place.lat, place.lon, hemisphere)
  return (
    <div className="aurora-map">
      <canvas ref={canvas} width={side} height={side} />
      <svg viewBox="-1 -1 2 2" className="map-overlay" aria-hidden="true">
        {[40, 50, 60, 70, 80].map((lat) => (
          <circle key={lat} r={(90 - lat) / 60} fill="none" stroke="rgba(255,255,255,.10)" strokeWidth="0.004" strokeDasharray="0.01 0.012" />
        ))}
        {[50, 60, 70].map((lat) => (
          <text key={lat} x={0.012} y={-(90 - lat) / 60 + 0.035} className="map-lat">
            {lat}°
          </text>
        ))}
        {p && (
          <g>
            <circle cx={p.x} cy={p.y} r="0.03" fill="rgba(255,255,255,.18)" />
            <circle cx={p.x} cy={p.y} r="0.012" fill="#fff" />
            <text x={p.x + 0.03} y={p.y + 0.012} className="map-place">
              {place.name}
            </text>
          </g>
        )}
      </svg>
      {error && <div className="empty overlay-msg">Не загрузилась карта Земли</div>}
    </div>
  )
}

export function AuroraCard({ grid, c }: { grid: AuroraGrid | null; c: Conditions }) {
  const [place, setPlace] = useState<Place>(loadPlace)
  const [hemisphere, setHemisphere] = useState<Hemisphere>('north')
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)

  const choose = (p: Place) => {
    setPlace(p)
    try {
      localStorage.setItem(PLACE_KEY, JSON.stringify(p))
    } catch {
      /* без сохранения */
    }
  }

  const locate = () => {
    if (!navigator.geolocation) return setGeoError('Браузер не умеет определять место')
    setLocating(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        // Округляем до сотых: для сияния этого достаточно, а точное место не храним.
        choose({ name: 'Моё место', lat: +pos.coords.latitude.toFixed(2), lon: +pos.coords.longitude.toFixed(2) })
      },
      () => {
        setLocating(false)
        setGeoError('Доступ к геопозиции закрыт — выберите город из списка')
      },
      { timeout: 15_000, maximumAge: 600_000 },
    )
  }

  const magLat = geomagneticLatitude(place.lat, place.lon)
  const probability = grid ? auroraProbability(grid, place.lat, place.lon) : 0
  const boundary = c.geomagnetic.boundary
  const distance = Math.abs(magLat) - boundary
  const o = outcome(probability, distance)
  const elevation = solarElevation(place.lat, place.lon, subsolarPoint(Date.now()))

  return (
    <Card title="Полярные сияния" icon={Icons.aurora} info="aurora">
      <div className="place-row">
        <select
          value={PLACES.some((p) => p.name === place.name) ? place.name : '__mine'}
          onChange={(e) => {
            const p = PLACES.find((x) => x.name === e.target.value)
            if (p) choose(p)
          }}
          aria-label="Место наблюдения"
        >
          {PLACES.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
          {!PLACES.some((p) => p.name === place.name) && <option value="__mine">{place.name}</option>}
        </select>
        <button className="ghost" onClick={locate} disabled={locating}>
          {Icons.pin} {locating ? 'Определяю…' : 'Где я?'}
        </button>
      </div>
      {geoError && <p className="footnote">{geoError}</p>}

      <div className="verdict">
        <div className="verdict-num" style={{ color: o.color }}>
          {grid ? `${probability} %` : '—'}
        </div>
        <div>
          <div className="verdict-title">{o.title}</div>
          <div className="muted small">вероятность увидеть сияние в точке «{place.name}»</div>
        </div>
      </div>
      <p className="advice">{o.advice(distance)}</p>
      {elevation > -6 && (
        <p className="footnote">
          {elevation > 0 ? '☀︎ Сейчас там день — сияние не разглядеть.' : '◐ Сейчас сумерки — небо ещё слишком светлое.'}
        </p>
      )}
      <div className="facts">
        <div>
          <span>Геомагнитная широта</span>
          <b>{magLat.toFixed(1).replace('.', ',')}°</b>
        </div>
        <div>
          <span>Граница овала при текущем Kp</span>
          <b>{boundary}°</b>
        </div>
      </div>

      <Segmented
        value={hemisphere}
        onChange={setHemisphere}
        options={[
          { value: 'north', label: 'Северное полушарие' },
          { value: 'south', label: 'Южное' },
        ]}
      />
      {grid ? <AuroraMap grid={grid} place={place} hemisphere={hemisphere} /> : <Empty text="Сетка прогноза OVATION загружается" />}
      <div className="aurora-legend">
        <span>вероятность</span>
        <i />
        <span>60 % и выше</span>
      </div>
      {grid && (
        <p className="footnote">
          Прогноз OVATION на {formatDayTime(grid.forecastFor)}. Ночная сторона Земли затемнена — сияние видно только там.
        </p>
      )}
    </Card>
  )
}
