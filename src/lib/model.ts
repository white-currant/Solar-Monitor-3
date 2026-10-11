// Доменная модель: ряды телеметрии, шкалы NOAA и сводная оценка обстановки.
// Логика и тексты совпадают с нативным «Солнечным монитором» для iPhone.

export interface Point {
  t: number // время, мс UTC
  v: number
}

export interface KpForecastPoint {
  t: number
  kp: number
  origin: 'observed' | 'estimated' | 'predicted'
  scale: string | null
}

export interface WindPoint {
  t: number
  speed: number // км/с
  density: number // частиц/см³
  temperature: number // К
  bt: number // нТл
  bz: number // нТл, GSM
  source?: string // аппарат в L1: SOLAR1 (SWFO-L1), ACE или IMAP
}

export interface FlareEvent {
  begin: number
  max: number | null
  end: number | null
  maxClass: string
  peakFlux: number | null
}

export interface ActiveRegion {
  number: number
  latitude: number
  longitude: number
  location: string
  area: number
  spotClass: string | null
  magClass: string | null
  spotCount: number
  probC: number
  probM: number
  probX: number
}

export type AlertKind = 'alert' | 'warning' | 'watch' | 'summary' | 'other'

export interface SWPCAlert {
  id: string
  issued: number
  kind: AlertKind
  headline: string
  headlineRu: string
  body: string
}

export interface ScalesDay {
  date: string
  r: number | null
  s: number | null
  g: number | null
  rMinor: number | null // вероятность вспышки M, %
  rMajor: number | null // вероятность вспышки X, %
  sProb: number | null // вероятность протонного события, %
}

export interface NOAAScales {
  yesterday: ScalesDay | null
  now: ScalesDay | null
  forecast: ScalesDay[]
}

export interface AuroraGrid {
  observedAt: number
  forecastFor: number
  values: Uint8Array // индекс = долгота * 181 + (широта + 90)
}

export interface CyclePoint {
  t: number
  ssn: number
  smoothed: number | null
}

export interface CyclePrediction {
  t: number
  ssn: number
  low: number
  high: number
}

export interface Snapshot {
  capturedAt: number
  kp: Point[]
  kpEstimated: Point[]
  kpForecast: KpForecastPoint[]
  wind: WindPoint[]
  xray: Point[]
  protons: Point[]
  flares: FlareEvent[]
  regions: ActiveRegion[]
  alerts: SWPCAlert[]
  scales: NOAAScales | null
}

export const emptySnapshot = (): Snapshot => ({
  capturedAt: 0,
  kp: [],
  kpEstimated: [],
  kpForecast: [],
  wind: [],
  xray: [],
  protons: [],
  flares: [],
  regions: [],
  alerts: [],
  scales: null,
})

export const last = <T,>(items: T[]): T | undefined => items[items.length - 1]

/** Текущий Kp: минутная оценка точнее трёхчасовой ступеньки. */
export function currentKp(s: Snapshot): number | null {
  return last(s.kpEstimated)?.v ?? last(s.kp)?.v ?? null
}

export function auroraProbability(grid: AuroraGrid, latitude: number, longitude: number): number {
  const lon = ((longitude % 360) + 360) % 360
  const x = Math.min(359, Math.max(0, Math.floor(lon)))
  const y = Math.min(180, Math.max(0, Math.round(latitude + 90)))
  return grid.values[x * 181 + y]
}

// ─── Класс вспышки ───────────────────────────────────────────────────────

export type FlareLetter = 'A' | 'B' | 'C' | 'M' | 'X'

const FLARE_BOUND: Record<FlareLetter, number> = { A: 1e-8, B: 1e-7, C: 1e-6, M: 1e-5, X: 1e-4 }

export function flareLetter(flux: number): FlareLetter {
  if (flux < 1e-7) return 'A'
  if (flux < 1e-6) return 'B'
  if (flux < 1e-5) return 'C'
  if (flux < 1e-4) return 'M'
  return 'X'
}

export function flareLabel(flux: number): string {
  if (!(flux > 0)) return '—'
  const letter = flareLetter(flux)
  return `${letter}${(flux / FLARE_BOUND[letter]).toFixed(1)}`
}

export function fluxFromLabel(label: string): number | null {
  const letter = label.charAt(0).toUpperCase() as FlareLetter
  const mantissa = parseFloat(label.slice(1))
  if (!(letter in FLARE_BOUND) || isNaN(mantissa)) return null
  return mantissa * FLARE_BOUND[letter]
}

export const FLARE_MEANING: Record<FlareLetter, string> = {
  A: 'Фон. Влияния нет.',
  B: 'Фон. Влияния нет.',
  C: 'Слабая вспышка. Последствий на Земле обычно нет.',
  M: 'Средняя вспышка. Возможны сбои КВ-связи на дневной стороне.',
  X: 'Сильная вспышка. Радиозатемнение, риск для спутников и энергосетей.',
}

// ─── Шкала G ────────────────────────────────────────────────────────────

export interface GeomagneticLevel {
  rank: number // 0 спокойно, 1 возмущённо, 2…6 → G1…G5
  g: number // номер по шкале NOAA
  title: string
  severity: string
  meaning: string
  boundary: number // граница видимости сияния, геомагнитная широта
}

const G_LEVELS: GeomagneticLevel[] = [
  { rank: 0, g: 0, title: 'Спокойно', severity: 'спокойное поле', boundary: 66,
    meaning: 'Магнитосфера невозмущена. Сияния — только в приполярных широтах.' },
  { rank: 1, g: 0, title: 'Возмущённо', severity: 'слабое возмущение', boundary: 63,
    meaning: 'Поле возмущено, но порог бури не достигнут. Сияния возможны у полярного круга.' },
  { rank: 2, g: 1, title: 'Буря G1', severity: 'слабая', boundary: 60,
    meaning: 'Слабые колебания в энергосетях. Сияния видны на широте 60°.' },
  { rank: 3, g: 2, title: 'Буря G2', severity: 'умеренная', boundary: 55,
    meaning: 'Возможны сбои спутниковой навигации. Сияния опускаются до 55°.' },
  { rank: 4, g: 3, title: 'Буря G3', severity: 'сильная', boundary: 50,
    meaning: 'Требуется коррекция орбит спутников, ошибки навигации. Сияния до 50°.' },
  { rank: 5, g: 4, title: 'Буря G4', severity: 'очень сильная', boundary: 45,
    meaning: 'Проблемы с управлением энергосетями, сбои связи. Сияния до 45°.' },
  { rank: 6, g: 5, title: 'Буря G5', severity: 'экстремальная', boundary: 40,
    meaning: 'Возможны аварии трансформаторов и длительные отказы связи. Сияния до 40°.' },
]

export function geomagneticLevel(kp: number): GeomagneticLevel {
  if (kp < 4) return G_LEVELS[0]
  if (kp < 5) return G_LEVELS[1]
  if (kp < 6) return G_LEVELS[2]
  if (kp < 7) return G_LEVELS[3]
  if (kp < 8) return G_LEVELS[4]
  if (kp < 9) return G_LEVELS[5]
  return G_LEVELS[6]
}

// ─── Шкалы S и R ────────────────────────────────────────────────────────

export function radiationScale(flux: number): number {
  if (flux < 10) return 0
  if (flux < 100) return 1
  if (flux < 1_000) return 2
  if (flux < 10_000) return 3
  if (flux < 100_000) return 4
  return 5
}

export const RADIATION_MEANING = [
  'Поток протонов на фоновом уровне.',
  'Слабое событие. Возможны помехи КВ-связи в полярных областях.',
  'Умеренное. Риск для экипажей высотных полярных рейсов.',
  'Сильное. Сбои бортовой электроники спутников.',
  'Очень сильное. Отказ полярной радиосвязи, деградация солнечных батарей.',
  'Экстремальное. Серьёзная радиационная опасность вне магнитосферы.',
]

export function radioBlackoutScale(flux: number): number {
  if (flux < 1e-5) return 0
  if (flux < 5e-5) return 1
  if (flux < 1e-4) return 2
  if (flux < 1e-3) return 3
  if (flux < 2e-3) return 4
  return 5
}

export const RADIO_MEANING = [
  'Ионосфера невозмущена.',
  'Слабое затемнение КВ на дневной стороне, до часа.',
  'Умеренное. Потеря КВ-связи на десятки минут.',
  'Сильное. Затемнение КВ на всей освещённой стороне около часа.',
  'Очень сильное. Отказ КВ-связи на один-два часа.',
  'Экстремальное. Полное отсутствие КВ-связи на несколько часов.',
]

// ─── Сводка ─────────────────────────────────────────────────────────────

export type ConditionLevel = 'calm' | 'active' | 'storm' | 'severe'

export const CONDITION_TITLE: Record<ConditionLevel, string> = {
  calm: 'Спокойно',
  active: 'Активно',
  storm: 'Буря',
  severe: 'Сильная буря',
}

export interface Conditions {
  level: ConditionLevel
  kp: number | null
  geomagnetic: GeomagneticLevel
  radiation: number
  radio: number
  headline: string
  summary: string
}

const HOUR = 3_600_000

export function conditions(s: Snapshot, now = Date.now()): Conditions {
  const kp = currentKp(s)
  const geomagnetic = geomagneticLevel(kp ?? 0)

  // Шкалы NOAA главные: если сводка пришла, берём её, иначе выводим из телеметрии.
  const radiation = s.scales?.now?.s
    ? s.scales.now.s
    : radiationScale(last(s.protons)?.v ?? 0)

  let radio = s.scales?.now?.r ?? 0
  if (!radio) {
    const recent = s.flares.filter((f) => f.begin > now - 6 * HOUR).map((f) => f.peakFlux ?? 0)
    const peak = recent.length ? Math.max(...recent) : last(s.xray)?.v ?? 0
    radio = radioBlackoutScale(peak)
  }

  const worst = Math.max(geomagnetic.g, radiation, radio)
  const level: ConditionLevel =
    worst === 0 ? (geomagnetic.rank === 1 ? 'active' : 'calm') : worst <= 2 ? 'storm' : 'severe'

  return {
    level,
    kp,
    geomagnetic,
    radiation,
    radio,
    headline: geomagnetic.title,
    summary: makeSummary(s, geomagnetic, radiation, radio, now),
  }
}

function makeSummary(
  s: Snapshot,
  geomagnetic: GeomagneticLevel,
  radiation: number,
  radio: number,
  now: number,
): string {
  const parts: string[] = [geomagnetic.meaning]

  const wind = last(s.wind)
  if (wind) {
    const speed = Math.round(wind.speed)
    if (wind.speed >= 700) parts.push(`Солнечный ветер ${speed} км/с — высокоскоростной поток.`)
    else if (wind.speed >= 500) parts.push(`Скорость ветра повышена: ${speed} км/с.`)
    else parts.push(`Ветер спокойный, ${speed} км/с.`)

    if (wind.bz <= -5)
      parts.push(`Поле южное, Bz ${fmt1(wind.bz)} нТл — магнитосфера открыта для энергии ветра.`)
    else if (wind.bz >= 5)
      parts.push(`Bz северное, ${fmt1(wind.bz)} нТл — связь с магнитосферой слабая.`)
  }

  const recent = s.flares.filter((f) => f.begin > now - 24 * HOUR)
  if (recent.length) {
    const strongest = recent.reduce((a, b) => ((b.peakFlux ?? 0) > (a.peakFlux ?? 0) ? b : a))
    const significant = /^[MX]/.test(strongest.maxClass)
    parts.push(
      significant
        ? `За сутки зарегистрирована вспышка ${strongest.maxClass}.`
        : `Вспышечная активность фоновая, максимум ${strongest.maxClass}.`,
    )
  } else {
    parts.push('Вспышек за сутки не зарегистрировано.')
  }

  if (radiation) parts.push(`Протонное событие уровня S${radiation}.`)
  if (radio) parts.push(`Радиозатемнение уровня R${radio}.`)
  return parts.join(' ')
}

/** Время от точки L1 до Земли — столько остаётся после сигнала спутника. */
export function leadTimeFromL1(speed: number): number | null {
  return speed > 50 ? (1_500_000 / speed) * 1000 : null
}

/** Время пути возмущения от Солнца до Земли при текущей скорости ветра. */
export function travelTimeFromSun(speed: number): number | null {
  return speed > 50 ? (149_600_000 / speed) * 1000 : null
}

// ─── Цвета ──────────────────────────────────────────────────────────────

export const FLARE_COLOR: Record<FlareLetter, string> = {
  A: '#9aa6bf',
  B: '#4fb6ff',
  C: '#2ee88a',
  M: '#ffb21a',
  X: '#ff4d4d',
}

export function kpColor(kp: number): string {
  if (kp < 4) return '#2ee88a'
  if (kp < 5) return '#d4f03a'
  if (kp < 6) return '#ffc21a'
  if (kp < 7) return '#ff8a1f'
  if (kp < 8) return '#ff4d4d'
  return '#ff2e8a'
}

export function scaleColor(value: number): string {
  return ['#2ee88a', '#e2ef3a', '#ffc21a', '#ff8a1f', '#ff4d4d', '#ff2e8a'][Math.min(5, Math.max(0, value))]
}

// ─── Форматирование ─────────────────────────────────────────────────────

export const fmt1 = (v: number) => v.toFixed(1).replace('.', ',').replace('-', '−')

const SUPER = '⁰¹²³⁴⁵⁶⁷⁸⁹'

export function scientific(value: number): string {
  if (!(value > 0)) return '—'
  const exp = Math.floor(Math.log10(value))
  const mantissa = value / 10 ** exp
  const sup = (exp < 0 ? '⁻' : '') + String(Math.abs(exp)).split('').map((d) => SUPER[+d]).join('')
  return `${mantissa.toFixed(1).replace('.', ',')}·10${sup}`
}

export function duration(ms: number): string {
  const total = Math.floor(ms / 60_000)
  const days = Math.floor(total / 1440)
  const hours = Math.floor(total / 60) % 24
  const minutes = total % 60
  if (days > 0) return `${days} сут ${hours} ч`
  if (hours > 0) return `${hours} ч ${minutes} мин`
  return `${minutes} мин`
}

export function age(since: number, now = Date.now()): string {
  const seconds = Math.floor((now - since) / 1000)
  if (seconds < 90) return 'только что'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} мин назад`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ч назад`
  return `${Math.floor(hours / 24)} сут назад`
}

const timeFmt = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' })
const dayTimeFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const dayFmt = new Intl.DateTimeFormat('ru-RU', { weekday: 'short', day: 'numeric' })

export const formatTime = (t: number) => timeFmt.format(t)
export const formatDayTime = (t: number) => dayTimeFmt.format(t)
export const formatDay = (t: number) => dayFmt.format(t)
