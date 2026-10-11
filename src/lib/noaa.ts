// Загрузка и разбор данных NOAA SWPC. Все запросы — напрямую к services.swpc.noaa.gov:
// NOAA отдаёт заголовок Access-Control-Allow-Origin: *, прокси не нужны.
// Демонстрационных данных нет: про космическую погоду нельзя врать.

import type {
  ActiveRegion,
  AlertKind,
  AuroraGrid,
  CyclePoint,
  CyclePrediction,
  FlareEvent,
  KpForecastPoint,
  NOAAScales,
  Point,
  ScalesDay,
  SWPCAlert,
  WindPoint,
} from './model'
import { fluxFromLabel } from './model'

const BASE = 'https://services.swpc.noaa.gov/'

export const ENDPOINTS = {
  kp: 'products/noaa-planetary-k-index.json',
  kp1m: 'json/planetary_k_index_1m.json',
  kpForecast: 'products/noaa-planetary-k-index-forecast.json',
  windPlasma: 'json/rtsw/rtsw_wind_1m.json',
  windMag: 'json/rtsw/rtsw_mag_1m.json',
  xray1d: 'json/goes/primary/xrays-1-day.json',
  xray3d: 'json/goes/primary/xrays-3-day.json',
  protons: 'json/goes/primary/integral-protons-1-day.json',
  flares: 'json/goes/primary/xray-flares-7-day.json',
  scales: 'products/noaa-scales.json',
  alerts: 'products/alerts.json',
  regions: 'json/solar_regions.json',
  aurora: 'json/ovation_aurora_latest.json',
  cycle: 'json/solar-cycle/observed-solar-cycle-indices.json',
  cyclePredicted: 'json/solar-cycle/predicted-solar-cycle.json',
} as const

async function getJSON<T = unknown>(path: string, timeoutMs = 20_000): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(BASE + path, { signal: controller.signal, cache: 'no-cache' })
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`)
    return (await response.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

/** NOAA пишет время без зоны, но всегда в UTC. */
export function parseTime(tag: string | null | undefined): number {
  if (!tag) return NaN
  let s = tag.trim().replace(' ', 'T')
  if (/^\d{4}-\d{2}$/.test(s)) s += '-01T00:00:00'
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) s += 'Z'
  return Date.parse(s)
}

const num = (v: unknown): number => (v === null || v === undefined || v === '' ? NaN : Number(v))
const ok = (v: number) => Number.isFinite(v)
type Row = Record<string, unknown>

/** Строки-массивы с заголовком в первой строке → объекты. Новый формат NOAA пропускаем как есть. */
function rows(data: unknown): Row[] {
  if (!Array.isArray(data) || data.length === 0) return []
  if (Array.isArray(data[0])) {
    const [header, ...body] = data as unknown[][]
    return body.map((r) => Object.fromEntries((header as string[]).map((h, i) => [h, r[i]])))
  }
  return data as Row[]
}

// ─── Kp ─────────────────────────────────────────────────────────────────

export async function loadKp(): Promise<Point[]> {
  return rows(await getJSON(ENDPOINTS.kp))
    .map((r) => ({ t: parseTime(r.time_tag as string), v: num(r.Kp ?? r.kp) }))
    .filter((p) => ok(p.t) && ok(p.v))
}

export async function loadKpEstimated(): Promise<Point[]> {
  return rows(await getJSON(ENDPOINTS.kp1m))
    .map((r) => ({ t: parseTime(r.time_tag as string), v: num(r.estimated_kp) }))
    .filter((p) => ok(p.t) && ok(p.v))
    .sort((a, b) => a.t - b.t)
}

export async function loadKpForecast(): Promise<KpForecastPoint[]> {
  return rows(await getJSON(ENDPOINTS.kpForecast))
    .map((r) => ({
      t: parseTime(r.time_tag as string),
      kp: num(r.kp ?? r.Kp),
      origin: (String(r.observed ?? 'predicted') as KpForecastPoint['origin']),
      scale: (r.noaa_scale as string | null) ?? null,
    }))
    .filter((p) => ok(p.t) && ok(p.kp))
}

// ─── Солнечный ветер ────────────────────────────────────────────────────

/**
 * Поминутные данные реального времени от ACE, DSCOVR и IMAP. NOAA помечает
 * «активный» аппарат — именно его ряд идёт в оперативные прогнозы.
 * Усредняем по 5 минут: суточный график не теряет формы, а точек в 5 раз меньше.
 */
export async function loadWind(): Promise<WindPoint[]> {
  const [plasma, mag] = await Promise.all([
    getJSON<Row[]>(ENDPOINTS.windPlasma),
    getJSON<Row[]>(ENDPOINTS.windMag),
  ])
  const bucket = 5 * 60_000
  type Acc = { n: number; speed: number; density: number; temp: number; m: number; bt: number; bz: number }
  const acc = new Map<number, Acc>()
  const slot = (t: number) => {
    const k = Math.floor(t / bucket) * bucket
    let a = acc.get(k)
    if (!a) acc.set(k, (a = { n: 0, speed: 0, density: 0, temp: 0, m: 0, bt: 0, bz: 0 }))
    return a
  }
  for (const r of plasma) {
    if (!r.active) continue
    const t = parseTime(r.time_tag as string)
    const speed = num(r.proton_speed)
    if (!ok(t) || !ok(speed)) continue
    const a = slot(t)
    a.n++
    a.speed += speed
    a.density += ok(num(r.proton_density)) ? num(r.proton_density) : 0
    a.temp += ok(num(r.proton_temperature)) ? num(r.proton_temperature) : 0
  }
  for (const r of mag) {
    if (!r.active) continue
    const t = parseTime(r.time_tag as string)
    const bt = num(r.bt)
    const bz = num(r.bz_gsm)
    if (!ok(t) || !ok(bt) || !ok(bz)) continue
    const a = slot(t)
    a.m++
    a.bt += bt
    a.bz += bz
  }
  return [...acc.entries()]
    .filter(([, a]) => a.n > 0 && a.m > 0)
    .sort(([a], [b]) => a - b)
    .map(([t, a]) => ({
      t: t + bucket / 2,
      speed: a.speed / a.n,
      density: a.density / a.n,
      temperature: a.temp / a.n,
      bt: a.bt / a.m,
      bz: a.bz / a.m,
    }))
}

// ─── Рентген, протоны, вспышки ──────────────────────────────────────────

export async function loadXray(days: 1 | 3 = 1): Promise<Point[]> {
  const data = await getJSON<Row[]>(days === 1 ? ENDPOINTS.xray1d : ENDPOINTS.xray3d)
  return data
    .filter((r) => r.energy === '0.1-0.8nm')
    .map((r) => ({ t: parseTime(r.time_tag as string), v: num(r.flux) }))
    // Провалы ниже A0.5 — это не Солнце, а сбои прибора (тень Земли, калибровка).
    .filter((p) => ok(p.t) && p.v > 5e-9)
    .sort((a, b) => a.t - b.t)
}

export async function loadProtons(): Promise<Point[]> {
  const data = await getJSON<Row[]>(ENDPOINTS.protons)
  return data
    .filter((r) => r.energy === '>=10 MeV')
    .map((r) => ({ t: parseTime(r.time_tag as string), v: num(r.flux) }))
    .filter((p) => ok(p.t) && p.v > 0)
    .sort((a, b) => a.t - b.t)
}

export async function loadFlares(): Promise<FlareEvent[]> {
  const data = await getJSON<Row[]>(ENDPOINTS.flares)
  return data
    .map((r) => {
      const maxClass = String(r.max_class ?? '')
      const peak = num(r.max_xrlong)
      return {
        begin: parseTime(r.begin_time as string),
        max: parseTime(r.max_time as string) || null,
        end: parseTime(r.end_time as string) || null,
        maxClass,
        peakFlux: ok(peak) && peak > 0 ? peak : fluxFromLabel(maxClass),
      }
    })
    .filter((f) => ok(f.begin) && f.maxClass)
    .sort((a, b) => a.begin - b.begin)
}

// ─── Шкалы, сообщения, области ──────────────────────────────────────────

function scalesDay(raw: Row | undefined): ScalesDay | null {
  if (!raw) return null
  const R = (raw.R ?? {}) as Row
  const S = (raw.S ?? {}) as Row
  const G = (raw.G ?? {}) as Row
  const n = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v))
  return {
    date: String(raw.DateStamp ?? ''),
    r: n(R.Scale),
    s: n(S.Scale),
    g: n(G.Scale),
    rMinor: n(R.MinorProb),
    rMajor: n(R.MajorProb),
    sProb: n(S.Prob),
  }
}

export async function loadScales(): Promise<NOAAScales> {
  const data = await getJSON<Record<string, Row>>(ENDPOINTS.scales)
  return {
    yesterday: scalesDay(data['-1']),
    now: scalesDay(data['0']),
    forecast: ['1', '2', '3'].map((k) => scalesDay(data[k])).filter((d): d is ScalesDay => !!d),
  }
}

const ALERT_KIND: [RegExp, AlertKind][] = [
  [/^ALERT/i, 'alert'],
  [/^(EXTENDED )?WARNING/i, 'warning'],
  [/^(CANCEL )?WATCH/i, 'watch'],
  [/^SUMMARY/i, 'summary'],
]

// Перевод типовых заголовков. Неизвестные оставляем по-английски — так честнее, чем гадать.
const HEADLINE_RU: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/Geomagnetic K-index of (\d) expected/i, (m) => `Ожидается K-индекс ${m[1]}`],
  [/Geomagnetic K-index of (\d)/i, (m) => `K-индекс достиг ${m[1]}`],
  [/Geomagnetic Storm Category (G\d) Predicted/i, (m) => `Прогноз: геомагнитная буря ${m[1]}`],
  [/Geomagnetic Sudden Impulse expected/i, () => 'Ожидается внезапный импульс поля'],
  [/Geomagnetic Sudden Impulse/i, () => 'Внезапный импульс геомагнитного поля'],
  [/X-ray Flux exceeded (\w+)/i, (m) => `Рентгеновский поток выше ${m[1]}`],
  [/Electron 2MeV Integral Flux exceeded (\d+)pfu/i, (m) => `Поток электронов >2 МэВ выше ${m[1]} pfu`],
  [/Proton 10MeV Integral Flux exceeded (\d+)pfu/i, (m) => `Поток протонов >10 МэВ выше ${m[1]} pfu`],
  [/Proton 100MeV Integral Flux exceeded (\d+)pfu/i, (m) => `Поток протонов >100 МэВ выше ${m[1]} pfu`],
  [/Type II Radio Emission/i, () => 'Радиовсплеск II типа — признак выброса массы'],
  [/Type IV Radio Emission/i, () => 'Радиовсплеск IV типа'],
  [/10cm Radio Burst/i, () => 'Всплеск радиоизлучения 10 см'],
]

export async function loadAlerts(): Promise<SWPCAlert[]> {
  const data = await getJSON<Row[]>(ENDPOINTS.alerts)
  return data
    .map((r) => {
      const message = String(r.message ?? '').replace(/\r/g, '')
      const lines = message.split('\n').map((l) => l.trim())
      const titleLine =
        lines.find((l) => /^(ALERT|WARNING|EXTENDED WARNING|WATCH|CANCEL WATCH|SUMMARY)\b/i.test(l)) ?? lines[0] ?? ''
      const kind = ALERT_KIND.find(([re]) => re.test(titleLine))?.[1] ?? 'other'
      const headline = titleLine.replace(/^[A-Z ]+:\s*/, '')
      let headlineRu = headline
      for (const [re, tr] of HEADLINE_RU) {
        const m = headline.match(re)
        if (m) {
          headlineRu = tr(m)
          break
        }
      }
      const bodyStart = lines.findIndex((l) => l === titleLine)
      const body = lines
        .slice(bodyStart + 1)
        .join('\n')
        .replace(/NOAA Space Weather Scale descriptions can be found at[\s\S]*?noaa-scales-explanation/i, '')
        .trim()
      return {
        id: `${r.product_id}-${r.issue_datetime}`,
        issued: parseTime(r.issue_datetime as string),
        kind,
        headline,
        headlineRu,
        body,
      }
    })
    .filter((a) => ok(a.issued))
    .sort((a, b) => b.issued - a.issued)
}

export async function loadRegions(): Promise<ActiveRegion[]> {
  const data = await getJSON<Row[]>(ENDPOINTS.regions)
  if (!data.length) return []
  const latest = data.reduce((m, r) => (String(r.observed_date) > m ? String(r.observed_date) : m), '')
  return data
    .filter((r) => r.observed_date === latest)
    .map((r) => ({
      number: num(r.region),
      latitude: num(r.latitude),
      longitude: num(r.longitude),
      location: String(r.location ?? ''),
      area: num(r.area) || 0,
      spotClass: (r.spot_class as string) ?? null,
      magClass: (r.mag_class as string) ?? null,
      spotCount: num(r.number_spots) || 0,
      probC: num(r.c_flare_probability) || 0,
      probM: num(r.m_flare_probability) || 0,
      probX: num(r.x_flare_probability) || 0,
    }))
    .filter((r) => ok(r.number))
    .sort((a, b) => b.probM - a.probM || b.area - a.area)
}

// ─── Сияния ─────────────────────────────────────────────────────────────

export async function loadAurora(): Promise<AuroraGrid> {
  const data = await getJSON<{ 'Observation Time': string; 'Forecast Time': string; coordinates: number[][] }>(
    ENDPOINTS.aurora,
    40_000,
  )
  const values = new Uint8Array(360 * 181)
  for (const [lon, lat, p] of data.coordinates) {
    const x = ((Math.round(lon) % 360) + 360) % 360
    const y = Math.round(lat) + 90
    if (y >= 0 && y <= 180) values[x * 181 + y] = Math.min(100, Math.max(0, p))
  }
  return {
    observedAt: parseTime(data['Observation Time']),
    forecastFor: parseTime(data['Forecast Time']),
    values,
  }
}

// ─── Солнечный цикл ─────────────────────────────────────────────────────

export async function loadCycle(): Promise<{ observed: CyclePoint[]; predicted: CyclePrediction[] }> {
  const [obs, pred] = await Promise.all([
    getJSON<Row[]>(ENDPOINTS.cycle),
    getJSON<Row[]>(ENDPOINTS.cyclePredicted).catch(() => [] as Row[]),
  ])
  const observed = obs
    .map((r) => {
      const smoothed = num(r.smoothed_ssn)
      return { t: parseTime(r['time-tag'] as string), ssn: num(r.ssn), smoothed: smoothed >= 0 ? smoothed : null }
    })
    .filter((p) => ok(p.t) && ok(p.ssn) && p.ssn >= 0)
  const predicted = pred
    .map((r) => ({
      t: parseTime(r['time-tag'] as string),
      ssn: num(r.predicted_ssn),
      low: num(r.low_ssn),
      high: num(r.high_ssn),
    }))
    .filter((p) => ok(p.t) && ok(p.ssn))
  return { observed, predicted }
}
