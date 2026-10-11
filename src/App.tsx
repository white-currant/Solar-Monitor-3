import { useEffect, useMemo, useState } from 'react'
import { conditions } from './lib/model'
import { useSpaceWeather } from './lib/store'
import { Sky, PALETTE } from './components/Sky'
import { Hero } from './components/Hero'
import { ScalesCard } from './components/Scales'
import { KpCard } from './components/KpCard'
import { WindCard } from './components/WindCard'
import { FlareCard } from './components/FlareCard'
import { ProtonCard } from './components/ProtonCard'
import { SunCard } from './components/SunCard'
import { AuroraCard } from './components/AuroraCard'
import { AlertsCard } from './components/AlertsCard'
import { CycleCard } from './components/CycleCard'
import { SpaceScene, sceneInput } from './components/SpaceScene'
import { KeyFacts } from './components/KeyFacts'
import { loadPlace } from './components/AuroraCard'
import { auroraProbability } from './lib/model'

const SECTIONS = [
  { id: 'now', label: 'Сейчас' },
  { id: 'sun', label: 'Солнце' },
  { id: 'aurora', label: 'Сияния' },
  { id: 'cycle', label: 'Цикл' },
]

export default function App() {
  const { snapshot, aurora, cycle, failed, loading, refresh } = useSpaceWeather()
  const [now, setNow] = useState(Date.now())

  // Минутный «пульс»: окна графиков и надписи «N мин назад» двигаются сами.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])
  useEffect(() => setNow(Date.now()), [snapshot.capturedAt])

  const c = useMemo(() => conditions(snapshot, now), [snapshot, now])
  const scene = useMemo(() => sceneInput(snapshot, c, now), [snapshot, c, now])
  const [placeVersion, setPlaceVersion] = useState(0)
  useEffect(() => {
    const bump = () => setPlaceVersion((v) => v + 1)
    window.addEventListener('solar-place', bump)
    return () => window.removeEventListener('solar-place', bump)
  }, [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const place = useMemo(() => loadPlace(), [placeVersion])
  const auroraHere = aurora ? { place: place.name, probability: auroraProbability(aurora, place.lat, place.lon) } : null
  // Переход к карточке: прокрутить и ненадолго подсветить, чтобы было понятно, куда смотреть.
  const jump = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    // Прокрутка расчётом, с поправкой на шапку: scrollIntoView ведёт себя по-разному в браузерах.
    const top = el.getBoundingClientRect().top + window.scrollY - 76
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' })
    // Атрибут, а не класс: className карточки ведёт React и перезаписал бы подсветку.
    delete el.dataset.flash
    void el.offsetWidth
    el.dataset.flash = '1'
    window.setTimeout(() => delete el.dataset.flash, 3200)
  }
  const offline = failed.size >= 4 && !loading

  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', PALETTE[c.level].top)
    document.documentElement.style.setProperty('--accent', PALETTE[c.level].accent)
    document.title = c.kp === null ? 'Солнечный монитор' : `Kp ${c.kp.toFixed(1).replace('.', ',')} · ${c.headline} — Солнечный монитор`
  }, [c.level, c.kp, c.headline])

  return (
    <>
      <Sky level={c.level} />
      <nav className="topbar">
        <div className="brand">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <circle cx="12" cy="12" r="5" fill="#ffc752" />
            <g stroke="#ffc752" strokeWidth="1.8" strokeLinecap="round">
              <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
            </g>
          </svg>
          <span className="brand-text">Солнечный монитор</span>
        </div>
        <div className="tabs">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`}>
              {s.label}
            </a>
          ))}
        </div>
      </nav>

      <main className="wrap">
        <div id="now" className="anchor" />
        <SpaceScene data={scene} c={c} aurora={auroraHere} onJump={jump} />
        <Hero c={c} capturedAt={snapshot.capturedAt} loading={loading} offline={offline} onRefresh={refresh} />

        <KeyFacts c={c} scales={snapshot.scales} flares={snapshot.flares} aurora={aurora} place={place} now={now} onJump={jump} />

        <h2 className="section-title">Подробно</h2>
        <div className="cards">
          <KpCard forecast={snapshot.kpForecast} estimated={snapshot.kpEstimated} now={now} />
          <WindCard wind={snapshot.wind} now={now} />
          <FlareCard xray={snapshot.xray} flares={snapshot.flares} now={now} />
          <ScalesCard scales={snapshot.scales} c={c} />
          <ProtonCard protons={snapshot.protons} now={now} />
          <AlertsCard alerts={snapshot.alerts} now={now} />
        </div>

        <div id="sun" className="anchor" />
        <h2 className="section-title">Солнце</h2>
        <SunCard regions={snapshot.regions} />

        <div id="aurora" className="anchor" />
        <h2 className="section-title">Сияния</h2>
        <AuroraCard grid={aurora} c={c} />

        <div id="cycle" className="anchor" />
        <h2 className="section-title">Солнечный цикл</h2>
        <CycleCard data={cycle} />

        <footer>
          <p>
            Данные — Центр прогнозов космической погоды{' '}
            <a href="https://www.swpc.noaa.gov/" target="_blank" rel="noreferrer">NOAA SWPC</a>, снимки Солнца —{' '}
            <a href="https://sdo.gsfc.nasa.gov/" target="_blank" rel="noreferrer">NASA SDO</a>, карта Земли — NASA Blue Marble.
            Данные загружаются напрямую с серверов NOAA и обновляются каждые 2–10 минут.
          </p>
          <p className="muted">
            Без связи сайт показывает последний сохранённый срез с отметкой времени — выдуманных данных здесь нет.
            {failed.size > 0 && ` Сейчас не ответили: ${[...failed].join(', ')}.`}
          </p>
        </footer>
      </main>
    </>
  )
}
