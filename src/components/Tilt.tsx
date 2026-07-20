import { useRef, type ReactNode } from 'react'

// 3D tilt-on-hover with a specular glare that tracks the cursor. Pure DOM
// writes (no re-renders); inert on touch / no-hover devices, and the global
// reduced-motion kill-switch removes the transition.

const canHover = (): boolean =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(hover: hover)').matches

interface TiltProps {
  children: ReactNode
  className?: string
  /** Max rotation in degrees. */
  strength?: number
}

export const Tilt = ({
  children,
  className = '',
  strength = 7
}: TiltProps): JSX.Element => {
  const ref = useRef<HTMLDivElement | null>(null)

  const onMove = (e: React.PointerEvent): void => {
    const el = ref.current
    if (!el || !canHover()) return
    const rect = el.getBoundingClientRect()
    const nx = (e.clientX - rect.left) / rect.width
    const ny = (e.clientY - rect.top) / rect.height
    el.style.transform = `perspective(750px) rotateX(${((0.5 - ny) * strength).toFixed(2)}deg) rotateY(${((nx - 0.5) * strength * 1.2).toFixed(2)}deg)`
    el.style.setProperty('--mx', `${(nx * 100).toFixed(1)}%`)
    el.style.setProperty('--my', `${(ny * 100).toFixed(1)}%`)
  }

  const onLeave = (): void => {
    const el = ref.current
    if (el) el.style.transform = ''
  }

  return (
    <div
      ref={ref}
      className={`tilt ${className}`.trim()}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      {children}
      <span className="tilt-glare" aria-hidden="true" />
    </div>
  )
}
