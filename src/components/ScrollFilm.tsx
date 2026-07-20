import { useEffect, useRef, type ReactNode } from 'react'

import { FRAME_COUNT, framePath, frameForProgress, ramp } from '../lib/film'

// The landing film: a tall scroll runway with a sticky full-viewport canvas that
// scrubs the 89-frame tally sequence as you scroll. The hero (interactive: mode
// toggle, CTAs) rides on top as the 0% beat, with two narrative beats at ~30%
// (left) and ~60% (right). Dependency-free by design — one passive scroll
// listener, rAF-coalesced, writing styles straight to the DOM so nothing
// re-renders at scroll speed.

interface ScrollFilmProps {
  /** The interactive hero content, shown centered at 0% and faded out by ~18%. */
  hero: ReactNode
}

export const ScrollFilm = ({ hero }: ScrollFilmProps): JSX.Element => {
  const sectionRef = useRef<HTMLElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const heroRef = useRef<HTMLDivElement | null>(null)
  const leftRef = useRef<HTMLDivElement | null>(null)
  const rightRef = useRef<HTMLDivElement | null>(null)
  const cueRef = useRef<HTMLDivElement | null>(null)

  const imagesRef = useRef<HTMLImageElement[]>([])
  const frameRef = useRef(-1)

  useEffect(() => {
    const canvas = canvasRef.current
    const section = sectionRef.current
    if (!canvas || !section) return

    /** Draw a frame with cover semantics, honoring devicePixelRatio. */
    const draw = (index: number): void => {
      const image = imagesRef.current[index]
      if (!image || !image.complete || image.naturalWidth === 0) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const cw = canvas.clientWidth
      const ch = canvas.clientHeight
      if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) {
        canvas.width = cw * dpr
        canvas.height = ch * dpr
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const scale = Math.max(cw / image.naturalWidth, ch / image.naturalHeight)
      const dw = image.naturalWidth * scale
      const dh = image.naturalHeight * scale
      ctx.clearRect(0, 0, cw, ch)
      ctx.drawImage(image, (cw - dw) / 2, (ch - dh) / 2, dw, dh)
    }

    /** Current scroll progress through the runway, 0–1. */
    const progress = (): number => {
      const runway = section.offsetHeight - window.innerHeight
      if (runway <= 0) return 0
      const y = window.scrollY - section.offsetTop
      return Math.min(1, Math.max(0, y / runway))
    }

    // All keyframe ranges cover the full 0–1 progress and settle on an end
    // value — ramp() clamps, so beats can never "come back" past their window.
    const apply = (): void => {
      const p = progress()

      const index = frameForProgress(p)
      if (index !== frameRef.current) {
        frameRef.current = index
        draw(index)
      }

      const heroEl = heroRef.current
      if (heroEl) {
        const op = ramp(p, [0, 0.05, 0.18], [1, 1, 0])
        heroEl.style.opacity = String(op)
        heroEl.style.transform = `translateY(${ramp(p, [0, 0.2], [0, -220])}px)`
        // Fading buttons must stop swallowing clicks meant for later beats.
        heroEl.style.pointerEvents = op > 0.35 ? 'auto' : 'none'
      }
      const leftEl = leftRef.current
      if (leftEl) {
        leftEl.style.opacity = String(
          ramp(p, [0.24, 0.32, 0.44, 0.52], [0, 1, 1, 0])
        )
        leftEl.style.transform = `translate(${ramp(p, [0.24, 0.52], [-36, 20])}px, ${ramp(p, [0.24, 0.52], [60, -60])}px)`
      }
      const rightEl = rightRef.current
      if (rightEl) {
        rightEl.style.opacity = String(
          ramp(p, [0.54, 0.62, 0.74, 0.82], [0, 1, 1, 0])
        )
        rightEl.style.transform = `translate(${ramp(p, [0.54, 0.82], [36, -20])}px, ${ramp(p, [0.54, 0.82], [60, -60])}px)`
      }
      const cueEl = cueRef.current
      if (cueEl) {
        cueEl.style.opacity = String(ramp(p, [0, 0.06], [1, 0]))
      }
    }

    // Preload the whole sequence (small frames); repaint when the current one lands.
    imagesRef.current = Array.from({ length: FRAME_COUNT }, (_, i) => {
      const img = new Image()
      img.src = framePath(i)
      img.onload = () => {
        if (i === frameRef.current || frameRef.current === -1) {
          frameRef.current = -1
          apply()
        }
      }
      return img
    })

    // Coalesce scroll/resize into one rAF write per frame.
    let scheduled = false
    const schedule = (): void => {
      if (scheduled) return
      scheduled = true
      requestAnimationFrame(() => {
        scheduled = false
        apply()
      })
    }
    const onResize = (): void => {
      frameRef.current = -1 // canvas size changed — force a redraw
      schedule()
    }
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', onResize)
    apply()

    // Pointer parallax: the canvas drifts gently against the cursor (kept at a
    // slight overscale so edges never show). Hover-capable devices only; the
    // CSS transition smooths it and reduced-motion kills the transition.
    const hoverable =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(hover: hover)').matches
    const onPointer = (e: PointerEvent): void => {
      if (!hoverable) return
      const nx = e.clientX / window.innerWidth - 0.5
      const ny = e.clientY / window.innerHeight - 0.5
      canvas.style.transform = `scale(1.06) translate(${(-nx * 16).toFixed(1)}px, ${(-ny * 12).toFixed(1)}px)`
    }
    const sticky = canvas.parentElement
    sticky?.addEventListener('pointermove', onPointer)

    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', onResize)
      sticky?.removeEventListener('pointermove', onPointer)
      imagesRef.current = []
    }
  }, [])

  return (
    <section className="film" ref={sectionRef}>
      <div className="film-sticky">
        <canvas
          ref={canvasRef}
          className="film-canvas"
          aria-hidden="true"
        />
        <div className="film-vignette" aria-hidden="true" />
        <div className="film-fade" aria-hidden="true" />

        <div className="film-beat film-beat--hero" ref={heroRef}>
          {hero}
        </div>

        <div className="film-beat film-beat--left" ref={leftRef} aria-hidden="true">
          <div>
            <p className="beat-kicker">Standby</p>
            <p className="beat-title">
              Ten minutes to
              <br />
              find your angle.
            </p>
            <p className="beat-body">
              The amber light means the clock is already running. Read the
              brief, pick your structure, note one point per indicator.
            </p>
          </div>
        </div>

        <div className="film-beat film-beat--right" ref={rightRef} aria-hidden="true">
          <div>
            <p className="beat-kicker">On air</p>
            <p className="beat-title">
              The light goes red.
              <br />
              You talk.
            </p>
            <p className="beat-body">
              Out loud, on the clock, straight at the judge — and every word
              lands in the transcript that gets scored.
            </p>
          </div>
        </div>

        <div className="scroll-cue film-cue" ref={cueRef} aria-hidden="true">
          <span>Scroll</span>
          <span className="chev">&#8964;</span>
        </div>
      </div>
    </section>
  )
}
