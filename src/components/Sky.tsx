// Фон: градиент неба, окрашенный обстановкой, и мерцающие звёзды.
// Положения звёзд детерминированы — они не «прыгают» при перерисовке.

import { useEffect, useRef } from 'react'
import type { ConditionLevel } from '../lib/model'

export const PALETTE: Record<ConditionLevel, { top: string; bottom: string; accent: string; glow: string }> = {
  calm: { top: '#040a1f', bottom: '#0b2150', accent: '#4fd2ff', glow: '#2f8fff' },
  active: { top: '#060b1c', bottom: '#14324a', accent: '#3dffa8', glow: '#2ee88a' },
  storm: { top: '#0d0718', bottom: '#521a3f', accent: '#ffbb1f', glow: '#ff7a3d' },
  severe: { top: '#16040e', bottom: '#6e0d27', accent: '#ff4d5e', glow: '#ff2e55' },
}

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const STARS = (() => {
  const r = rng(0x5eed5747)
  return Array.from({ length: 220 }, () => ({
    x: r(),
    y: r(),
    radius: 0.35 + r() * 1.25,
    base: 0.2 + r() * 0.65,
    phase: r() * Math.PI * 2,
  }))
})()

export function Sky({ level }: { level: ConditionLevel }) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const ctx = el.getContext('2d')!
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0
    let lastDraw = 0

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      el.width = window.innerWidth * dpr
      el.height = window.innerHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      draw(performance.now())
    }

    const draw = (now: number) => {
      const w = window.innerWidth
      const h = window.innerHeight
      ctx.clearRect(0, 0, w, h)
      const t = now / 1000
      for (const s of STARS) {
        const flicker = reduce ? 1 : 0.75 + 0.25 * Math.sin(t * 0.7 + s.phase)
        ctx.globalAlpha = s.base * flicker
        ctx.fillStyle = '#fff'
        ctx.beginPath()
        ctx.arc(s.x * w, s.y * h, s.radius, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const loop = (now: number) => {
      // 20 кадров в секунду достаточно для мерцания и бережёт батарею.
      if (now - lastDraw > 50) {
        draw(now)
        lastDraw = now
      }
      frame = requestAnimationFrame(loop)
    }

    resize()
    window.addEventListener('resize', resize)
    if (!reduce) frame = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
    }
  }, [])

  const p = PALETTE[level]
  return (
    <div className="sky" aria-hidden="true" style={{ background: `linear-gradient(${p.top}, ${p.bottom})` }}>
      <div className="sky-glow" style={{ background: `radial-gradient(ellipse at 50% 105%, ${p.glow}${level === 'calm' ? '2e' : '52'}, transparent 62%)` }} />
      <canvas ref={canvas} />
    </div>
  )
}
