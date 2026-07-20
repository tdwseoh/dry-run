import { useEffect, useRef, useState } from 'react'

// Animated count-up stats for the community section. Each number eases from 0
// when it scrolls into view (IntersectionObserver + rAF, no libraries).
// Reduced-motion users get the final value immediately.

interface CounterProps {
  target: number
  suffix?: string
  label: string
}

const Counter = ({ target, suffix = '', label }: CounterProps): JSX.Element => {
  const ref = useRef<HTMLDivElement | null>(null)
  const [value, setValue] = useState(0)
  const startedRef = useRef(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced || typeof IntersectionObserver === 'undefined') {
      setValue(target)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || startedRef.current) continue
          startedRef.current = true
          observer.unobserve(entry.target)
          const startedAt = performance.now()
          const DURATION_MS = 1400
          const tick = (now: number): void => {
            const t = Math.min(1, (now - startedAt) / DURATION_MS)
            const eased = 1 - Math.pow(1 - t, 3)
            setValue(Math.round(target * eased))
            if (t < 1) requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        }
      },
      { threshold: 0.4 }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [target])

  return (
    <div className="counter" ref={ref}>
      <span className="counter-num">
        {value.toLocaleString()}
        {suffix}
      </span>
      <span className="counter-label">{label}</span>
    </div>
  )
}

/**
 * The community numbers. SHOWCASE DATA: these are season-one targets rendered
 * for the marketing page, not live telemetry — swap in real aggregates when a
 * backend exists (see the Supabase seam note in src/lib/profile.ts).
 */
export const Counters = (): JSX.Element => (
  <div className="counters">
    <Counter target={15000} suffix="+" label="roleplays completed" />
    <Counter target={3500} suffix="+" label="students training" />
    <Counter target={250000} suffix="+" label="minutes practiced" />
    <Counter target={500} suffix="+" label="schools represented" />
  </div>
)
