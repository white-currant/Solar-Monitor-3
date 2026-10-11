// Состояние приложения: загружает данные, обновляет их и держит последний срез
// в localStorage. Без связи показываем последний реальный срез с отметкой времени.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AuroraGrid, CyclePoint, CyclePrediction, Snapshot } from './model'
import { emptySnapshot } from './model'
import * as noaa from './noaa'

const CACHE_KEY = 'solar-monitor:snapshot:v3'
const FAST_MS = 2 * 60_000 // минутные ряды
const SLOW_MS = 10 * 60_000 // прогнозы, события, сетка сияний

type Key = keyof Omit<Snapshot, 'capturedAt'>

export interface SourceStatus {
  failed: Set<string>
  updatedAt: number
}

function readCache(): Snapshot {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) return { ...emptySnapshot(), ...JSON.parse(raw) }
  } catch {
    /* пустой или повреждённый кэш — начнём с нуля */
  }
  return emptySnapshot()
}

function writeCache(s: Snapshot) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(s))
  } catch {
    /* приватный режим или переполнение — работаем без кэша */
  }
}

export function useSpaceWeather() {
  const [snapshot, setSnapshot] = useState<Snapshot>(readCache)
  const [aurora, setAurora] = useState<AuroraGrid | null>(null)
  const [cycle, setCycle] = useState<{ observed: CyclePoint[]; predicted: CyclePrediction[] } | null>(null)
  const [failed, setFailed] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const busy = useRef(false)

  const apply = useCallback(async (jobs: [Key, () => Promise<unknown>][]) => {
    const results = await Promise.allSettled(jobs.map(([, job]) => job()))
    setSnapshot((prev) => {
      const next: Snapshot = { ...prev }
      let changed = false
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          ;(next as unknown as Record<string, unknown>)[jobs[i][0]] = r.value
          changed = true
        }
      })
      if (changed) {
        next.capturedAt = Date.now()
        writeCache(next)
      }
      return next
    })
    setFailed((prev) => {
      const next = new Set(prev)
      results.forEach((r, i) => (r.status === 'rejected' ? next.add(jobs[i][0]) : next.delete(jobs[i][0])))
      return next
    })
  }, [])

  const refreshFast = useCallback(
    () =>
      apply([
        ['kpEstimated', noaa.loadKpEstimated],
        ['wind', noaa.loadWind],
        ['xray', () => noaa.loadXray(1)],
        ['protons', noaa.loadProtons],
        ['scales', noaa.loadScales],
      ]),
    [apply],
  )

  const refreshSlow = useCallback(async () => {
    await Promise.all([
      apply([
        ['kp', noaa.loadKp],
        ['kpForecast', noaa.loadKpForecast],
        ['flares', noaa.loadFlares],
        ['alerts', noaa.loadAlerts],
        ['regions', noaa.loadRegions],
      ]),
      noaa.loadAurora().then(setAurora, () => setFailed((f) => new Set(f).add('aurora'))),
    ])
  }, [apply])

  const refreshAll = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    setLoading(true)
    try {
      await Promise.all([refreshFast(), refreshSlow()])
    } finally {
      busy.current = false
      setLoading(false)
    }
  }, [refreshFast, refreshSlow])

  useEffect(() => {
    refreshAll()
    noaa.loadCycle().then(setCycle, () => setFailed((f) => new Set(f).add('cycle')))
    const fast = setInterval(() => document.visibilityState === 'visible' && refreshFast(), FAST_MS)
    const slow = setInterval(() => document.visibilityState === 'visible' && refreshSlow(), SLOW_MS)
    // Вернулись на вкладку после долгого перерыва — обновить сразу.
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshAll()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(fast)
      clearInterval(slow)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refreshAll, refreshFast, refreshSlow])

  return { snapshot, aurora, cycle, failed, loading, refresh: refreshAll }
}
