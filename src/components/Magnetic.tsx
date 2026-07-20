import { useRef, type ReactNode } from 'react'

// Magnetic hover: the wrapped element leans a few pixels toward the cursor and
// springs back on leave. Subtle by design — pull is capped at `pull` px.

const canHover = (): boolean =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(hover: hover)').matches

interface MagneticProps {
  children: ReactNode
  /** Maximum translation in px. */
  pull?: number
}

export const Magnetic = ({ children, pull = 7 }: MagneticProps): JSX.Element => {
  const ref = useRef<HTMLSpanElement | null>(null)

  const onMove = (e: React.PointerEvent): void => {
    const el = ref.current
    if (!el || !canHover()) return
    const rect = el.getBoundingClientRect()
    const nx = (e.clientX - rect.left) / rect.width - 0.5
    const ny = (e.clientY - rect.top) / rect.height - 0.5
    el.style.transform = `translate(${(nx * pull * 2).toFixed(1)}px, ${(ny * pull * 2).toFixed(1)}px)`
  }

  const onLeave = (): void => {
    const el = ref.current
    if (el) el.style.transform = ''
  }

  return (
    <span
      ref={ref}
      className="magnetic"
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      {children}
    </span>
  )
}
