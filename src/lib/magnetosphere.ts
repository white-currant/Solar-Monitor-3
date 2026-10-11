// Физика для сцены: давление солнечного ветра и форма магнитопаузы.
// Модель Shue et al. (1998), J. Geophys. Res. 103, 17691 — стандарт для оперативной оценки.

/** Динамическое давление ветра, нПа: p = m_p · n · v². n — см⁻³, v — км/с. */
export function dynamicPressure(density: number, speed: number): number {
  return 1.6726e-6 * Math.max(0.1, density) * speed * speed
}

/** Расстояние от центра Земли до носа магнитопаузы, радиусы Земли. */
export function standoff(pressure: number, bz: number): number {
  const p = Math.max(0.05, pressure)
  const r0 = (10.22 + 1.29 * Math.tanh(0.184 * (bz + 8.14))) * Math.pow(p, -1 / 6.6)
  return Math.min(16, Math.max(4, r0))
}

/** Показатель раскрытия хвоста магнитосферы. */
export function flaring(pressure: number, bz: number): number {
  return (0.58 - 0.007 * bz) * (1 + 0.024 * Math.log(Math.max(0.05, pressure)))
}

/** Радиус магнитопаузы под углом θ от направления на Солнце, радиусы Земли. */
export function magnetopauseRadius(theta: number, r0: number, alpha: number): number {
  return r0 * Math.pow(2 / (1 + Math.cos(theta)), alpha)
}

/** Геостационарная орбита (GOES, SDO), радиусы Земли. */
export const GEO_RADIUS = 6.6

/** Оценка: что значит такое положение магнитопаузы. */
export function standoffMeaning(r0: number): string {
  if (r0 < GEO_RADIUS)
    return 'Магнитосфера поджата внутрь геостационарной орбиты: спутники GOES оказались прямо в солнечном ветре.'
  if (r0 < 8) return 'Сильное сжатие магнитосферы — напор ветра высокий.'
  if (r0 < 9.5) return 'Магнитосфера заметно поджата.'
  if (r0 > 12) return 'Ветер слабый, магнитосфера раздута.'
  return 'Обычное положение: около десяти радиусов Земли.'
}
