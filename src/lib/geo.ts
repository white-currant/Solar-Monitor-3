// Геометрия: геомагнитная широта, освещённость, полярная проекция и растр карты сияний.

import type { AuroraGrid } from './model'
import { auroraProbability } from './model'

const RAD = Math.PI / 180

/** Северный геомагнитный полюс, эпоха 2020 года. */
const POLE_LAT = 80.7
const POLE_LON = -72.7

/** Геомагнитная широта: именно от неё, а не от географической, зависит, дотянется ли овал. */
export function geomagneticLatitude(latitude: number, longitude: number): number {
  const s =
    Math.sin(latitude * RAD) * Math.sin(POLE_LAT * RAD) +
    Math.cos(latitude * RAD) * Math.cos(POLE_LAT * RAD) * Math.cos((longitude - POLE_LON) * RAD)
  return Math.asin(Math.max(-1, Math.min(1, s))) / RAD
}

/** Подсолнечная точка — центр освещённого полушария. Приближение, достаточное для карты. */
export function subsolarPoint(t: number): { lat: number; lon: number } {
  const d = new Date(t)
  const start = Date.UTC(d.getUTCFullYear(), 0, 0)
  const dayOfYear = Math.floor((t - start) / 86_400_000)
  const hours = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600
  const declination = -23.44 * Math.sin((2 * Math.PI * (dayOfYear + 10)) / 365.24)
  return { lat: declination, lon: (180 - hours * 15) % 360 }
}

/** Высота Солнца над горизонтом, градусы. Отрицательная — ночь. */
export function solarElevation(lat: number, lon: number, sub: { lat: number; lon: number }): number {
  const c =
    Math.sin(lat * RAD) * Math.sin(sub.lat * RAD) +
    Math.cos(lat * RAD) * Math.cos(sub.lat * RAD) * Math.cos((lon - sub.lon) * RAD)
  return 90 - Math.acos(Math.max(-1, Math.min(1, c))) / RAD
}

// ─── Полярная проекция ──────────────────────────────────────────────────

/** Край круга. Ниже этой широты сияние не наблюдается даже в сильную бурю. */
export const EDGE_LAT = 30

export type Hemisphere = 'north' | 'south'

/** Точка в единичном круге: центр (0,0), край радиуса 1. Нулевой меридиан — вниз от полюса. */
export function project(lat: number, lon: number, h: Hemisphere): { x: number; y: number } | null {
  const sign = h === 'north' ? 1 : -1
  const signed = lat * sign
  if (signed < EDGE_LAT) return null
  const r = (90 - signed) / (90 - EDGE_LAT)
  const a = (h === 'south' ? -lon : lon) * RAD
  return { x: r * Math.sin(a), y: r * Math.cos(a) }
}

function unproject(dx: number, dy: number, h: Hemisphere): { lat: number; lon: number } {
  const sign = h === 'north' ? 1 : -1
  const r = Math.hypot(dx, dy)
  let lon = Math.atan2(dx, dy) / RAD
  if (h === 'south') lon = -lon
  return { lat: sign * (90 - r * (90 - EDGE_LAT)), lon }
}

// ─── Растр карты ────────────────────────────────────────────────────────

export interface Texture {
  data: Uint8ClampedArray
  width: number
  height: number
}

let texturePromise: Promise<Texture> | null = null

/** Blue Marble NASA (общественное достояние), равнопромежуточная проекция. */
export function loadEarthTexture(url: string): Promise<Texture> {
  texturePromise ??= new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      ctx.drawImage(img, 0, 0)
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
      resolve({ data, width: canvas.width, height: canvas.height })
    }
    img.onerror = () => {
      texturePromise = null
      reject(new Error('Не загрузилась карта Земли'))
    }
    img.src = url
  })
  return texturePromise
}

/** Ход цвета повторяет реальное свечение: зелёный кислород, к жёлтому и малиновому при сильном высыпании. */
function auroraColor(probability: number, visibility: number): [number, number, number] {
  const f = Math.min(1, probability / 60)
  const k = (0.25 + f * 0.75) * visibility * 240
  let r: number, g: number, b: number
  if (f < 0.35) {
    const t = f / 0.35
    r = 0.16 + t * 0.3
    g = 0.9
    b = 0.5 - t * 0.18
  } else if (f < 0.7) {
    const t = (f - 0.35) / 0.35
    r = 0.46 + t * 0.5
    g = 0.9 - t * 0.14
    b = 0.32 - t * 0.14
  } else {
    const t = (f - 0.7) / 0.3
    r = 0.96
    g = 0.76 - t * 0.36
    b = 0.18 + t * 0.36
  }
  return [r * k, g * k, b * k]
}

export function renderAuroraMap(
  ctx: CanvasRenderingContext2D,
  side: number,
  grid: AuroraGrid,
  texture: Texture,
  hemisphere: Hemisphere,
  now: number,
): void {
  const image = ctx.createImageData(side, side)
  const px = image.data
  const center = side / 2
  const sub = subsolarPoint(now)
  const { data: tex, width: tw, height: th } = texture

  for (let y = 0; y < side; y++) {
    const dy = (y - center) / center
    for (let x = 0; x < side; x++) {
      const dx = (x - center) / center
      const radius = Math.hypot(dx, dy)
      if (radius > 1) continue
      const { lat, lon } = unproject(dx, dy, hemisphere)

      const sx = Math.min(tw - 1, Math.max(0, Math.floor(((lon + 180) / 360) * tw)))
      const sy = Math.min(th - 1, Math.max(0, Math.floor(((90 - lat) / 180) * th)))
      const so = (sy * tw + sx) * 4

      // Ночная сторона глушится сильнее — на ней и наблюдают сияние.
      const elevation = solarElevation(lat, lon, sub)
      const daylight = Math.min(1, Math.max(0, (elevation + 6) / 12))
      const earth = 0.24 + daylight * 0.34
      let r = tex[so] * earth
      let g = tex[so + 1] * earth
      let b = tex[so + 2] * earth + 10

      const p = auroraProbability(grid, lat, lon)
      if (p > 0) {
        // В светлое небо сияние не разглядеть — свечение гаснет вместе с сумерками.
        const [ar, ag, ab] = auroraColor(p, 1 - daylight * 0.8)
        r += ar
        g += ag
        b += ab
      }

      // Мягкий край круга вместо ступеньки.
      const edge = Math.min(1, Math.max(0, (1 - radius) / 0.015))
      const o = (y * side + x) * 4
      px[o] = Math.min(255, r) * edge
      px[o + 1] = Math.min(255, g) * edge
      px[o + 2] = Math.min(255, b) * edge
      px[o + 3] = 255 * edge
    }
  }
  ctx.putImageData(image, 0, 0)
}

// ─── Места ──────────────────────────────────────────────────────────────

export interface Place {
  name: string
  lat: number
  lon: number
}

export const PLACES: Place[] = [
  { name: 'Минск', lat: 53.9, lon: 27.567 },
  { name: 'Витебск', lat: 55.19, lon: 30.2 },
  { name: 'Гродно', lat: 53.68, lon: 23.83 },
  { name: 'Брест', lat: 52.1, lon: 23.69 },
  { name: 'Гомель', lat: 52.44, lon: 30.99 },
  { name: 'Вильнюс', lat: 54.69, lon: 25.28 },
  { name: 'Рига', lat: 56.95, lon: 24.11 },
  { name: 'Санкт-Петербург', lat: 59.94, lon: 30.31 },
  { name: 'Мурманск', lat: 68.97, lon: 33.07 },
  { name: 'Тромсё', lat: 69.65, lon: 18.96 },
  { name: 'Рейкьявик', lat: 64.15, lon: -21.94 },
]

/**
 * Земля «сбоку», как её видно со стороны: Солнце слева. Ортографическая проекция
 * по карте Blue Marble, дневная сторона освещена, ночная затемнена.
 */
export function renderGlobe(texture: Texture, size: number, now: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const image = ctx.createImageData(size, size)
  const px = image.data
  const { data: tex, width: tw, height: th } = texture
  const sub = subsolarPoint(now)
  const tilt = (sub.lat * Math.PI) / 180
  const c = size / 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x - c + 0.5) / c
      const v = -(y - c + 0.5) / c
      const rr = u * u + v * v
      if (rr > 1) continue
      const w = Math.sqrt(1 - rr)
      // Наклон оси к Солнцу — по склонению: зимой северный полюс отвёрнут от Солнца.
      const vy = v * Math.cos(tilt) + u * Math.sin(tilt)
      const vu = u * Math.cos(tilt) - v * Math.sin(tilt)
      const lat = Math.asin(Math.max(-1, Math.min(1, vy))) / RAD
      let lon = sub.lon + Math.atan2(w, -vu) / RAD
      lon = ((lon + 540) % 360) - 180
      const sx = Math.min(tw - 1, Math.floor(((lon + 180) / 360) * tw))
      const sy = Math.min(th - 1, Math.floor(((90 - lat) / 180) * th))
      const so = (sy * tw + sx) * 4
      const light = Math.max(0, Math.min(1, -u * 1.15 + 0.12))
      const k = 0.1 + light * 1.0
      const o = (y * size + x) * 4
      const edge = Math.min(1, (1 - Math.sqrt(rr)) * size * 0.5)
      px[o] = tex[so] * k + 6
      px[o + 1] = tex[so + 1] * k + 10
      px[o + 2] = tex[so + 2] * k + 24
      px[o + 3] = 255 * edge
    }
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}
