// Живая модель «Солнце → ветер → L1 → магнитосфера → Земля». Всё на сцене считается
// из текущих данных: скорость и густота частиц — это реальный ветер, форма магнитосферы —
// модель Shue (1998), сияния на полюсах — индекс Kp, вспышка на Солнце — рентген GOES.
// Наведение — подсказка, нажатие — камера приближается и открываются подробности.
// Масштаб условный: в реальности до L1 1 % пути от Земли до Солнца.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Conditions, Snapshot } from '../lib/model'
import { FLARE_COLOR, FLARE_MEANING, duration, flareLabel, flareLetter, fmt1, kpColor, last, leadTimeFromL1, radiationScale, RADIATION_MEANING, scaleColor, scientific } from '../lib/model'
import { GEO_RADIUS, dynamicPressure, flaring, magnetopauseRadius, standoff, standoffMeaning } from '../lib/magnetosphere'
import { loadEarthTexture, renderGlobe } from '../lib/geo'

export type HotspotId = 'sun' | 'wind' | 'l1' | 'magnetosphere' | 'earth' | 'goes' | 'sdo'

interface SceneInput {
  speed: number
  density: number
  bz: number
  bt: number
  source: string
  kp: number
  xray: number
  flarePeak: number // сильнейший рентген за последние 2 часа
  protons: number
  hasWind: boolean
}

interface Geometry {
  W: number
  H: number
  pxRe: number
  ex: number
  ey: number
  earthR: number
  sunCx: number
  sunCy: number
  sunR: number
  sunEdge: number
  l1x: number
  r0: number
  alpha: number
  goes: { x: number; y: number }
  sdo: { x: number; y: number }
}

function geometry(W: number, H: number, d: SceneInput): Geometry {
  const pxRe = H * (W < 600 ? 0.021 : 0.019)
  const ex = W - Math.max(96, Math.min(W * 0.24, 280))
  const ey = H * 0.52
  const earthR = Math.max(14, pxRe * 2.9)
  const sunR = H * 0.66
  const sunCx = -sunR + Math.max(64, Math.min(W * 0.12, 150))
  const sunCy = H * 0.52
  const sunEdge = sunCx + sunR
  const p = dynamicPressure(d.density, d.speed)
  const r0 = standoff(p, d.bz)
  const alpha = flaring(p, d.bz)
  const nose = ex - r0 * 1.3 * pxRe
  const l1x = sunEdge + (nose - sunEdge) * 0.66
  const geo = GEO_RADIUS * pxRe
  const at = (deg: number) => ({ x: ex + geo * Math.cos((deg * Math.PI) / 180), y: ey - geo * Math.sin((deg * Math.PI) / 180) })
  return { W, H, pxRe, ex, ey, earthR, sunCx, sunCy, sunR, sunEdge, l1x, r0, alpha, goes: at(148), sdo: at(212) }
}

function hotspots(g: Geometry): Record<HotspotId, { x: number; y: number; r: number; label: string }> {
  return {
    sun: { x: Math.max(26, g.sunEdge * 0.5), y: g.sunCy, r: Math.min(g.sunEdge * 0.55, 90), label: 'Солнце' },
    wind: { x: (g.sunEdge + g.l1x) / 2, y: g.H * 0.3, r: 44, label: 'Солнечный ветер' },
    l1: { x: g.l1x, y: g.H * 0.52, r: 26, label: 'Спутники в L1' },
    magnetosphere: (() => {
      const th = 1.3
      const r = magnetopauseRadius(th, g.r0, g.alpha) * g.pxRe
      return { x: g.ex - r * Math.cos(th), y: g.ey - r * Math.sin(th), r: 26, label: 'Магнитосфера' }
    })(),
    earth: { x: g.ex, y: g.ey, r: Math.max(22, g.earthR + 8), label: 'Земля' },
    goes: { x: g.goes.x, y: g.goes.y, r: 16, label: 'GOES' },
    sdo: { x: g.sdo.x, y: g.sdo.y, r: 16, label: 'SDO' },
  }
}

// ─── Рисование ──────────────────────────────────────────────────────────

interface Particle {
  x: number
  y: number
  px: number // прошлое положение — по нему рисуется хвост вдоль движения
  py: number
  mode: 0 | 1 | 2 // 0 свободна, 1 обтекает, 2 прорвалась к полюсу
  t: number
  sx: number
  sy: number
  pole: number
  life: number // яркость: у магнитосферы частица постепенно гаснет
  size: number
}

// Мягкие тона: ветер — фон сцены, он не должен спорить с Солнцем и Землёй.
function windColor(bz: number): [number, number, number] {
  if (bz <= -10) return [255, 110, 90]
  if (bz <= -5) return [255, 160, 90]
  if (bz >= 5) return [130, 205, 255]
  return [255, 222, 150]
}

function auroraRGB(kp: number): string {
  if (kp < 4) return '46, 232, 138'
  if (kp < 6) return '170, 240, 70'
  if (kp < 7.5) return '255, 120, 60'
  return '255, 60, 140'
}

function satellite(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, active: boolean) {
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = active ? '#ffffff' : 'rgba(255,255,255,.7)'
  ctx.strokeStyle = active ? '#9fe3ff' : 'rgba(159,227,255,.6)'
  ctx.lineWidth = Math.max(1, s * 0.18)
  ctx.fillRect(-s * 0.35, -s * 0.35, s * 0.7, s * 0.7)
  ctx.beginPath()
  ctx.moveTo(-s * 1.4, 0)
  ctx.lineTo(-s * 0.35, 0)
  ctx.moveTo(s * 0.35, 0)
  ctx.lineTo(s * 1.4, 0)
  ctx.stroke()
  ctx.fillStyle = active ? 'rgba(90,200,255,.95)' : 'rgba(90,200,255,.55)'
  ctx.fillRect(-s * 1.45, -s * 0.45, s * 0.75, s * 0.9)
  ctx.fillRect(s * 0.7, -s * 0.45, s * 0.75, s * 0.9)
  ctx.restore()
}

function drawStatic(ctx: CanvasRenderingContext2D, g: Geometry, d: SceneInput, time: number, auroraBoost: number, globe: HTMLCanvasElement | null) {
  const { W, H, ex, ey, earthR, pxRe, r0, alpha } = g

  // Солнце: корона ярче при высоком рентгене, вспышка пульсирует.
  const xrayLevel = Math.min(1, Math.max(0, (Math.log10(Math.max(d.xray, 1e-9)) + 8) / 4)) // A0→0, X→1
  const corona = ctx.createRadialGradient(g.sunCx, g.sunCy, g.sunR * 0.9, g.sunCx, g.sunCy, g.sunR * (1.28 + xrayLevel * 0.25))
  corona.addColorStop(0, `rgba(255, 170, 40, ${0.55 + xrayLevel * 0.35})`)
  corona.addColorStop(0.4, `rgba(255, 110, 20, ${0.18 + xrayLevel * 0.2})`)
  corona.addColorStop(1, 'rgba(255, 80, 0, 0)')
  ctx.fillStyle = corona
  ctx.fillRect(0, 0, g.sunEdge + g.sunR * 0.5, H)

  const disk = ctx.createRadialGradient(g.sunCx + g.sunR * 0.5, g.sunCy - g.sunR * 0.1, g.sunR * 0.1, g.sunCx, g.sunCy, g.sunR)
  disk.addColorStop(0, '#fff6c8')
  disk.addColorStop(0.55, '#ffc430')
  disk.addColorStop(0.9, '#ff8a1a')
  disk.addColorStop(1, '#ff5a10')
  ctx.fillStyle = disk
  ctx.beginPath()
  ctx.arc(g.sunCx, g.sunCy, g.sunR, 0, Math.PI * 2)
  ctx.fill()

  const flare = d.flarePeak >= 1e-4 ? 1 : d.flarePeak >= 1e-5 ? 0.65 : d.flarePeak >= 5e-6 ? 0.3 : 0
  if (flare > 0) {
    const pulse = 0.6 + 0.4 * Math.sin(time * 3)
    const fx = g.sunEdge - g.sunR * 0.06
    const fy = g.sunCy - H * 0.12
    const fr = 10 + flare * 34 * pulse
    const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr * 2.4)
    fg.addColorStop(0, `rgba(255,255,255,${0.95 * pulse})`)
    fg.addColorStop(0.3, `rgba(255,236,150,${0.7 * pulse})`)
    fg.addColorStop(1, 'rgba(255,200,80,0)')
    ctx.fillStyle = fg
    ctx.beginPath()
    ctx.arc(fx, fy, fr * 2.4, 0, Math.PI * 2)
    ctx.fill()
    // Расходящееся кольцо — импульс излучения.
    const ring = (time * 0.7) % 1
    ctx.strokeStyle = `rgba(255, 230, 140, ${(1 - ring) * 0.6 * flare})`
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(fx, fy, fr + ring * 120 * flare, -1.2, 1.2)
    ctx.stroke()
  }

  // Геостационарная орбита: краснеет, если магнитопауза внутри неё.
  const geo = GEO_RADIUS * pxRe
  const exposed = r0 < GEO_RADIUS
  ctx.setLineDash([3, 5])
  ctx.strokeStyle = exposed ? 'rgba(255, 84, 64, .8)' : 'rgba(159, 227, 255, .28)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(ex, ey, geo, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])

  // Силовые линии диполя — внутри магнитосферы.
  ctx.strokeStyle = 'rgba(120, 200, 255, .16)'
  ctx.lineWidth = 1
  for (const L of [2.4, 3.6, 5]) {
    for (const side of [-1, 1]) {
      ctx.beginPath()
      for (let lat = -78; lat <= 78; lat += 3) {
        const l = (lat * Math.PI) / 180
        const r = L * Math.cos(l) ** 2 * pxRe * (side < 0 ? Math.min(1, r0 / 10) : 1.25)
        const x = ex + side * r * Math.cos(l)
        const y = ey - r * Math.sin(l)
        if (lat === -78) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  }

  // Ударная волна и магнитопауза.
  const kpC = kpColor(d.kp)
  const curve = (scale: number, a: number) => {
    ctx.beginPath()
    for (let th = -2.55; th <= 2.55; th += 0.05) {
      const r = magnetopauseRadius(th, r0 * scale, a) * pxRe
      const x = ex - r * Math.cos(th)
      const y = ey + r * Math.sin(th)
      if (th === -2.55) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
  }
  curve(1.3, alpha * 0.85)
  ctx.strokeStyle = 'rgba(255,255,255,.14)'
  ctx.setLineDash([4, 6])
  ctx.lineWidth = 1.2
  ctx.stroke()
  ctx.setLineDash([])

  curve(1, alpha)
  ctx.save()
  ctx.shadowColor = kpC
  ctx.shadowBlur = 10 + Math.min(d.kp, 9) * 2
  ctx.strokeStyle = kpC
  ctx.globalAlpha = 0.85
  ctx.lineWidth = 2 + Math.min(d.kp, 9) * 0.25
  ctx.stroke()
  ctx.restore()

  // Земля: дневная сторона обращена к Солнцу.
  const atm = ctx.createRadialGradient(ex, ey, earthR * 0.9, ex, ey, earthR * 1.6)
  atm.addColorStop(0, 'rgba(90, 180, 255, .55)')
  atm.addColorStop(1, 'rgba(90, 180, 255, 0)')
  ctx.fillStyle = atm
  ctx.beginPath()
  ctx.arc(ex, ey, earthR * 1.6, 0, Math.PI * 2)
  ctx.fill()
  if (globe) {
    ctx.drawImage(globe, ex - earthR, ey - earthR, earthR * 2, earthR * 2)
  } else {
    const earth = ctx.createLinearGradient(ex - earthR, ey, ex + earthR, ey)
    earth.addColorStop(0, '#5fc4ff')
    earth.addColorStop(0.45, '#2a7fd6')
    earth.addColorStop(0.62, '#0d2a55')
    earth.addColorStop(1, '#06132b')
    ctx.fillStyle = earth
    ctx.beginPath()
    ctx.arc(ex, ey, earthR, 0, Math.PI * 2)
    ctx.fill()
  }

  // Овалы сияний — шапки у полюсов. В спокойную погоду едва заметны, с ростом Kp
  // расширяются к экватору и разгораются; вспыхивают от прорвавшихся частиц.
  const glow = Math.min(1, Math.max(0.08, (d.kp - 1) / 7) + auroraBoost)
  for (const pole of [-1, 1]) {
    const ax = ex + earthR * 0.08
    const ay = ey + pole * earthR * 0.9
    const w = earthR * (0.32 + Math.min(d.kp, 9) * 0.07)
    const ag = ctx.createRadialGradient(ax, ay, 0, ax, ay, w)
    ag.addColorStop(0, `rgba(${auroraRGB(d.kp)}, ${0.85 * glow})`)
    ag.addColorStop(0.55, `rgba(${auroraRGB(d.kp)}, ${0.3 * glow})`)
    ag.addColorStop(1, `rgba(${auroraRGB(d.kp)}, 0)`)
    ctx.fillStyle = ag
    ctx.beginPath()
    ctx.ellipse(ax, ay, w, w * 0.5, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // Протонное событие: искры вокруг Земли.
  if (d.protons >= 10) {
    const n = Math.min(60, Math.round(Math.log10(d.protons) * 14))
    for (let i = 0; i < n; i++) {
      const a = i * 2.399 + time * 0.4
      const rr = geo * (0.6 + ((i * 37) % 100) / 70)
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(time * 4 + i))
      ctx.fillStyle = `rgba(200, 160, 255, ${tw})`
      ctx.fillRect(ex + rr * Math.cos(a), ey + rr * Math.sin(a), 2, 2)
    }
  }

  // Спутники: GOES и SDO на геостационаре, три аппарата в L1.
  const s = Math.max(4, H * 0.016)
  satellite(ctx, g.goes.x, g.goes.y, s, true)
  satellite(ctx, g.sdo.x, g.sdo.y, s, true)
  // Аппараты в L1 — те, чьи ряды NOAA отдаёт в данных реального времени.
  const l1 = ['SOLAR1', 'ACE', 'IMAP']
  l1.forEach((name, i) => {
    satellite(ctx, g.l1x + (i - 1) * s * 1.2, H * 0.52 + (i - 1) * s * 3.4, s, d.source.toUpperCase() === name)
  })
  void W
}

// ─── Компонент ──────────────────────────────────────────────────────────

export function sceneInput(s: Snapshot, c: Conditions, now: number): SceneInput {
  const wind = last(s.wind)
  const recent = s.xray.filter((p) => p.t > now - 2 * 3_600_000).map((p) => p.v)
  // Только при локальной разработке: ?scene=storm показывает сцену в сильную бурю.
  // В опубликованную сборку эта ветка не попадает.
  if (import.meta.env.DEV && new URLSearchParams(location.search).get('scene') === 'storm') {
    return { speed: 820, density: 18, bz: -18, bt: 25, source: 'SOLAR1', kp: 7.7, xray: 3e-4, flarePeak: 4e-4, protons: 320, hasWind: true }
  }
  return {
    speed: wind?.speed ?? 400,
    density: wind?.density ?? 5,
    bz: wind?.bz ?? 0,
    bt: wind?.bt ?? 5,
    source: wind?.source ?? '',
    kp: c.kp ?? 2,
    xray: last(s.xray)?.v ?? 1e-7,
    flarePeak: recent.length ? Math.max(...recent) : 0,
    protons: last(s.protons)?.v ?? 0.1,
    hasWind: !!wind,
  }
}

export function SpaceScene({
  data,
  c,
  aurora,
  onJump,
}: {
  data: SceneInput
  c: Conditions
  aurora: { place: string; probability: number } | null
  onJump: (id: string) => void
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const spots = useRef<Partial<Record<HotspotId, HTMLButtonElement | null>>>({})
  const dataRef = useRef(data)
  dataRef.current = data
  const [size, setSize] = useState({ W: 0, H: 0 })
  const [selected, setSelected] = useState<HotspotId | null>(null)
  const [hover, setHover] = useState<HotspotId | null>(null)
  const selectedRef = useRef<HotspotId | null>(null)
  selectedRef.current = selected
  const camera = useRef({ x: 0, y: 0, k: 1 })

  const g = useMemo(() => (size.W ? geometry(size.W, size.H, data) : null), [size, data])
  const spotsGeo = useMemo(() => (g ? hotspots(g) : null), [g])
  const gRef = useRef(g)
  gRef.current = g

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const W = Math.round(e.contentRect.width)
      setSize({ W, H: W < 600 ? 270 : W < 900 ? 360 : 460 })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Камера: куда смотреть и во сколько раз приблизить.
  const target = () => {
    const geo = gRef.current
    const sel = selectedRef.current
    if (!geo || !sel) return { x: 0, y: 0, k: 1 }
    const spot = hotspots(geo)[sel]
    const mobile = geo.W < 700
    const k = sel === 'sun' ? 1.5 : sel === 'wind' ? 1.4 : mobile ? 1.9 : 2.2
    // На компьютере объект сдвигается влево — справа открывается панель.
    const fx = mobile ? geo.W / 2 : geo.W * 0.32
    const fy = geo.H / 2
    let x = fx - spot.x * k
    let y = fy - spot.y * k
    x = Math.min(0, Math.max(geo.W - geo.W * k, x))
    y = Math.min(0, Math.max(geo.H - geo.H * k, y))
    return { x, y, k }
  }

  useEffect(() => {
    const el = canvas.current
    if (!el || !size.W) return
    const ctx = el.getContext('2d')!
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    el.width = size.W * dpr
    el.height = size.H * dpr
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const particles: Particle[] = []
    let raf = 0
    let last = performance.now()
    let visible = true
    let auroraBoost = 0
    let seeded = false
    let globe: HTMLCanvasElement | null = null
    // Глобус по карте NASA: перерисовываем раз в 10 минут — Земля поворачивается.
    const makeGlobe = () =>
      loadEarthTexture(`${import.meta.env.BASE_URL}earth.jpg`).then(
        (t) => (globe = renderGlobe(t, 256, Date.now())),
        () => null,
      )
    makeGlobe()
    const globeTimer = setInterval(makeGlobe, 600_000)

    const spawn = (geo: Geometry, anywhere: boolean): Particle => {
      const y = geo.H * (0.04 + Math.random() * 0.92)
      const dy = y - geo.sunCy
      const edge = geo.sunCx + Math.sqrt(Math.max(0, geo.sunR ** 2 - dy * dy))
      const x = anywhere ? edge + Math.random() * (geo.W - edge) : edge - 2
      return { x, y, px: x - 1, py: y, mode: 0, t: 0, sx: 0, sy: 0, pole: 1, life: 1, size: 0.7 + Math.random() * 0.9 }
    }

    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting))
    io.observe(el)

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const geo = gRef.current
      if (!geo || !visible || document.hidden) return
      const dt = Math.min(0.05, (now - last) / 1000)
      if (dt < 1 / 32) return
      last = now
      step(geo, dt, now / 1000)
    }

    const step = (geo: Geometry, dt: number, time: number) => {
      const d = dataRef.current
      const tgt = target()
      const cam = camera.current
      const ease = reduce ? 1 : 1 - Math.pow(0.0015, dt)
      cam.x += (tgt.x - cam.x) * ease
      cam.y += (tgt.y - cam.y) * ease
      cam.k += (tgt.k - cam.k) * ease

      // Сколько частиц: плотность ветра, с поправкой на ширину экрана.
      const want = Math.round(Math.min(300, Math.max(50, d.density * 16)) * Math.min(1.2, Math.max(0.45, geo.W / 1100)))
      // Первое заполнение — по всей сцене, дальше частицы рождаются у Солнца.
      while (particles.length < want) particles.push(spawn(geo, !seeded))
      seeded = true
      if (particles.length > want) particles.length = want

      const v = (d.speed * geo.W) / 2300 // пикселей в секунду
      const leakChance = Math.max(0, Math.min(0.55, -d.bz / 14))
      auroraBoost = Math.max(0, auroraBoost - dt * 0.6)

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        if (p.mode === 2) {
          // Прорвавшаяся частица летит по дуге к полюсу и зажигает сияние.
          p.t += dt * 1.1
          const tx = geo.ex + geo.earthR * 0.1
          const ty = geo.ey + p.pole * geo.earthR * 0.86
          const cx = geo.ex + geo.r0 * geo.pxRe * 0.4
          const cy = geo.ey + p.pole * geo.r0 * geo.pxRe * 1.1
          const u = Math.min(1, p.t)
          p.x = (1 - u) ** 2 * p.sx + 2 * (1 - u) * u * cx + u * u * tx
          p.y = (1 - u) ** 2 * p.sy + 2 * (1 - u) * u * cy + u * u * ty
          if (u >= 1) {
            auroraBoost = Math.min(0.6, auroraBoost + 0.04)
            particles[i] = spawn(geo, false)
          }
          continue
        }
        p.px = p.x
        p.py = p.y
        p.x += v * dt * (0.85 + (i % 7) * 0.05)
        const dx = p.x - geo.ex
        const dy = p.y - geo.ey
        const r = Math.hypot(dx, dy)
        const th = Math.atan2(Math.abs(dy), -dx)
        if (th < 2.5) {
          const rb = magnetopauseRadius(th, geo.r0 * 1.3, geo.alpha * 0.85) * geo.pxRe
          if (r < rb) {
            if (p.mode === 0 && th < 0.9 && Math.random() < leakChance * 0.35) {
              p.mode = 2
              p.t = 0
              p.sx = p.x
              p.sy = p.y
              p.pole = dy < 0 ? -1 : 1
              continue
            }
            // Обтекание: частица плавно уходит вдоль ударной волны и гаснет.
            p.mode = 1
            const sign = dy === 0 ? (i % 2 ? 1 : -1) : Math.sign(dy)
            const target = geo.ey + sign * Math.sqrt(Math.max(0, rb * rb - dx * dx))
            p.y += (target - p.y) * Math.min(1, dt * 9)
          }
        }
        if (p.mode === 1) p.life -= dt * 0.55
        if (p.life <= 0 || p.x > geo.W + 20 || p.y < -20 || p.y > geo.H + 20) particles[i] = spawn(geo, false)
      }

      // Кадр.
      const dpr2 = el.width / geo.W
      ctx.setTransform(dpr2, 0, 0, dpr2, 0, 0)
      ctx.clearRect(0, 0, geo.W, geo.H)
      ctx.setTransform(dpr2 * cam.k, 0, 0, dpr2 * cam.k, dpr2 * cam.x, dpr2 * cam.y)

      drawStatic(ctx, geo, d, time, auroraBoost, globe)

      // Частица — мягкая точка с затухающим хвостом вдоль направления движения.
      const [cr, cg, cb] = windColor(d.bz)
      const tail = Math.min(14, 4 + d.speed / 80)
      ctx.lineCap = 'round'
      ctx.globalCompositeOperation = 'lighter'
      for (const p of particles) {
        if (p.mode === 2) {
          ctx.fillStyle = 'rgba(255, 120, 90, .9)'
          ctx.beginPath()
          ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2)
          ctx.fill()
          continue
        }
        let ux = p.x - p.px
        let uy = p.y - p.py
        const l = Math.hypot(ux, uy) || 1
        ux /= l
        uy /= l
        const a = Math.max(0, p.life) * (p.mode === 1 ? 0.4 : 0.5)
        const tx = p.x - ux * tail * p.size
        const ty = p.y - uy * tail * p.size
        const grad = ctx.createLinearGradient(tx, ty, p.x, p.y)
        grad.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, 0)`)
        grad.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, ${a})`)
        ctx.strokeStyle = grad
        ctx.lineWidth = 1.1 * p.size + 0.4
        ctx.beginPath()
        ctx.moveTo(tx, ty)
        ctx.lineTo(p.x, p.y)
        ctx.stroke()
      }
      ctx.globalCompositeOperation = 'source-over'

      // Метки следуют за камерой.
      const hs = hotspots(geo)
      for (const id of Object.keys(hs) as HotspotId[]) {
        const btn = spots.current[id]
        if (!btn) continue
        const h = hs[id]
        btn.style.transform = `translate(${cam.x + h.x * cam.k}px, ${cam.y + h.y * cam.k}px)`
      }
    }

    if (reduce) {
      // Без анимации: один кадр с уже разлетевшимися частицами.
      const geo = gRef.current!
      for (let i = 0; i < 180; i++) particles.push(spawn(geo, true))
      step(geo, 0.016, 0)
      const id = setInterval(() => gRef.current && step(gRef.current, 0.016, 0), 600)
      return () => {
        clearInterval(id)
        clearInterval(globeTimer)
        io.disconnect()
      }
    }
    // Первый кадр рисуем сразу, даже если вкладка в фоне: сцена не должна быть пустой.
    if (gRef.current) step(gRef.current, 0.016, performance.now() / 1000)
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      clearInterval(globeTimer)
      io.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSelected(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const info = details(data, c, aurora, g)
  const showTip = hover && !selected ? hover : null

  return (
    <div className={`scene ${selected ? 'zoomed' : ''}`} ref={wrap} style={{ height: size.H || 270 }}>
      <canvas ref={canvas} style={{ width: size.W, height: size.H }} onClick={() => setSelected(null)} />
      {spotsGeo &&
        (Object.keys(spotsGeo) as HotspotId[]).map((id) => {
          const h = spotsGeo[id]
          return (
            <button
              key={id}
              ref={(el) => (spots.current[id] = el)}
              className={`spot spot-${id} ${selected === id ? 'on' : ''}`}
              style={{ width: h.r * 2, height: h.r * 2, marginLeft: -h.r, marginTop: -h.r }}
              aria-label={`${h.label}: подробнее`}
              onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(id)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(id)}
              onBlur={() => setHover(null)}
              onClick={(e) => {
                e.stopPropagation()
                setHover(null)
                setSelected(selected === id ? null : id)
              }}
            >
              <span className="spot-label">{h.label}</span>
            </button>
          )
        })}

      {showTip && spotsGeo && (
        <div
          className="scene-tip"
          style={{
            left: Math.min(Math.max(spotsGeo[showTip].x, 130), size.W - 130),
            top: spotsGeo[showTip].y > size.H * 0.55 ? spotsGeo[showTip].y - spotsGeo[showTip].r - 8 : spotsGeo[showTip].y + spotsGeo[showTip].r + 8,
            transform: spotsGeo[showTip].y > size.H * 0.55 ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
          }}
        >
          <b>{info[showTip].title}</b>
          {info[showTip].rows.slice(0, 3).map(([k, v]) => (
            <div key={k} className="tip-row">
              <span>{k}</span>
              <span>{v}</span>
            </div>
          ))}
          <em>нажмите, чтобы приблизить</em>
        </div>
      )}

      {selected && (
        <>
          <div className="scene-backdrop" onClick={() => setSelected(null)} />
          <aside className="scene-panel" role="dialog" aria-label={info[selected].title}>
            <button className="panel-close" onClick={() => setSelected(null)} aria-label="Закрыть">
              ×
            </button>
            <h3>{info[selected].title}</h3>
            <p className="panel-lead">{info[selected].lead}</p>
            <div className="panel-rows">
              {info[selected].rows.map(([k, v]) => (
                <div key={k}>
                  <span>{k}</span>
                  <b>{v}</b>
                </div>
              ))}
            </div>
            {info[selected].jump && (
              <button
                className="panel-jump"
                onClick={() => {
                  setSelected(null)
                  onJump(info[selected].jump!.id)
                }}
              >
                {info[selected].jump!.label} →
              </button>
            )}
            {info[selected].extra}
          </aside>
        </>
      )}
      <div className="scene-hint">{selected ? 'Нажмите на пустое место, чтобы отдалить' : 'Нажмите на объект · масштаб условный'}</div>
    </div>
  )
}

// ─── Тексты для подсказок и панелей ─────────────────────────────────────

interface Info {
  title: string
  lead: string
  rows: [string, ReactNode][]
  extra?: ReactNode
  jump?: { id: string; label: string }
}

function details(d: SceneInput, c: Conditions, aurora: { place: string; probability: number } | null, g: Geometry | null): Record<HotspotId, Info> {
  const letter = flareLetter(d.xray)
  const p = dynamicPressure(d.density, d.speed)
  const r0 = g?.r0 ?? standoff(p, d.bz)
  const lead = leadTimeFromL1(d.speed)
  const s = radiationScale(d.protons)
  const col = (v: ReactNode, color: string) => <span style={{ color }}>{v}</span>
  const sdoBust = Math.floor(Date.now() / 600_000)

  return {
    sun: {
      title: 'Солнце',
      lead: FLARE_MEANING[letter],
      rows: [
        ['Рентген сейчас', col(flareLabel(d.xray), FLARE_COLOR[letter])],
        ['Максимум за 2 часа', d.flarePeak ? col(flareLabel(d.flarePeak), FLARE_COLOR[flareLetter(d.flarePeak)]) : '—'],
        ['Поток', `${scientific(d.xray)} Вт/м²`],
      ],
      extra: <p className="panel-note">Чем ярче корона на сцене, тем выше рентгеновский поток. При вспышке класса M и X на краю диска пульсирует яркое пятно.</p>,
      jump: { id: 'flare-card', label: 'График вспышек' },
    },
    wind: {
      title: 'Солнечный ветер',
      lead:
        d.speed >= 700 ? 'Очень быстрый поток — скорее всего, ударная волна от выброса массы.' : d.speed >= 500 ? 'Быстрый поток — вероятно, из корональной дыры.' : 'Спокойный ветер.',
      rows: [
        ['Скорость', col(`${Math.round(d.speed)} км/с`, d.speed >= 700 ? '#ff4d4d' : d.speed >= 500 ? '#ffb21a' : '#2ee88a')],
        ['Плотность', `${fmt1(d.density)} частиц/см³`],
        ['Давление', `${fmt1(p)} нПа`],
        ['Поле Bz', col(`${fmt1(d.bz)} нТл`, d.bz <= -5 ? '#ff6a3d' : d.bz >= 5 ? '#5ac8ff' : '#fff')],
      ],
      extra: <p className="panel-note">На сцене скорость частиц — это реальная скорость ветра, их густота — плотность. Цвет показывает Bz: оранжево-красный — южное поле, открывающее магнитосферу, голубой — северное.</p>,
      jump: { id: 'wind-card', label: 'График ветра' },
    },
    l1: {
      title: 'Спутники в точке L1',
      lead: 'В полутора миллионах километров перед Землёй ветер замеряют SOLAR-1 (SWFO-L1, NOAA), ACE и IMAP (NASA). Яркий значок — аппарат, чьи данные NOAA использует сейчас.',
      rows: [
        ['Ведущий аппарат', d.source ? (d.source.toUpperCase() === 'SOLAR1' ? 'SOLAR-1' : d.source) : '—'],
        ['Поле Bt', `${fmt1(d.bt)} нТл`],
        ['Bz', col(`${fmt1(d.bz)} нТл`, d.bz <= -5 ? '#ff6a3d' : '#fff')],
        ['До Земли при этой скорости', lead ? duration(lead) : '—'],
      ],
      jump: { id: 'wind-card', label: 'Данные L1' },
    },
    magnetosphere: {
      title: 'Магнитосфера',
      lead: standoffMeaning(r0),
      rows: [
        ['Нос магнитопаузы', `${fmt1(r0)} радиуса Земли`],
        ['Геостационар', `${GEO_RADIUS} радиуса Земли`],
        ['Индекс Kp', col(fmt1(c.kp ?? 0), kpColor(c.kp ?? 0))],
        ['Обстановка', col(c.geomagnetic.title, kpColor(c.kp ?? 0))],
      ],
      extra: (
        <p className="panel-note">
          Форма считается по модели Shue (1998) из давления ветра и Bz. Цвет границы — по индексу Kp. Пунктир перед ней — ударная волна, где ветер тормозит и
          обтекает Землю.
        </p>
      ),
      jump: { id: 'kp-card', label: 'Индекс Kp и прогноз' },
    },
    earth: {
      title: 'Земля и сияния',
      lead: c.geomagnetic.meaning,
      rows: [
        ['Индекс Kp', col(fmt1(c.kp ?? 0), kpColor(c.kp ?? 0))],
        ['Граница овала', `${c.geomagnetic.boundary}° геомагн. широты`],
        ...(aurora ? ([[`Сияние: ${aurora.place}`, col(`${aurora.probability} %`, aurora.probability >= 12 ? scaleColor(2) : 'rgba(255,255,255,.7)')]] as [string, ReactNode][]) : []),
      ],
      extra: <p className="panel-note">Овалы на полюсах разгораются вместе с Kp. При южном Bz часть частиц прорывается к полюсам — это видно как оранжевые точки, летящие к Земле.</p>,
      jump: { id: 'aurora', label: 'Карта сияний' },
    },
    goes: {
      title: 'GOES',
      lead: 'Геостационарные спутники NOAA: меряют рентген Солнца и поток частиц вокруг Земли.',
      rows: [
        ['Рентген', col(flareLabel(d.xray), FLARE_COLOR[letter])],
        ['Протоны ≥10 МэВ', col(`${d.protons < 10 ? d.protons.toFixed(2).replace('.', ',') : Math.round(d.protons)} pfu`, scaleColor(s))],
        ['Радиация', col(s ? `S${s}` : 'фон', scaleColor(s))],
      ],
      extra: (
        <p className="panel-note">
          {RADIATION_MEANING[s]} {r0 < GEO_RADIUS ? 'Сейчас орбита GOES — снаружи магнитосферы, пунктир орбиты красный.' : 'Пунктирная окружность — геостационарная орбита.'}
        </p>
      ),
      jump: { id: 'proton-card', label: 'Протоны' },
    },
    sdo: {
      title: 'SDO',
      lead: 'Обсерватория солнечной динамики NASA. Каждые несколько секунд снимает Солнце в десяти каналах ультрафиолета и видимом свете.',
      rows: [['Снимок', 'канал 193 Å, корона']],
      extra: (
        <img className="panel-img" src={`https://sdo.gsfc.nasa.gov/assets/img/latest/latest_512_0193.jpg?t=${sdoBust}`} alt="Солнце сейчас, SDO 193 Å" loading="lazy" />
      ),
      jump: { id: 'sun', label: 'Все каналы и активные области' },
    },
  }
}
