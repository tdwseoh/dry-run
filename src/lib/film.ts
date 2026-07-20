// Pure helpers for the landing film (the scroll-scrubbed frame sequence).
// Kept free of DOM/React so the mapping logic is unit-testable.

export const FRAME_COUNT = 89

/** Public path of a film frame (1-based on disk: frame_0001.webp …). */
export const framePath = (index: number): string =>
  `/sequence/frame_${String(index + 1).padStart(4, '0')}.webp`

/** Map scroll progress (0–1) to a frame index, clamped to the sequence. */
export const frameForProgress = (
  progress: number,
  count: number = FRAME_COUNT
): number =>
  Math.min(count - 1, Math.max(0, Math.round(progress * (count - 1))))

/**
 * Clamped piecewise-linear interpolation: maps `input` through matching
 * `points` → `values` keyframes. Outside the range it holds the end values —
 * never extrapolates (scroll-linked styles must settle, not wrap or overshoot).
 */
export const ramp = (
  input: number,
  points: number[],
  values: number[]
): number => {
  if (points.length !== values.length || points.length < 2) {
    throw new Error('ramp needs matching points/values arrays (length >= 2)')
  }
  const first = points[0] as number
  const last = points[points.length - 1] as number
  if (input <= first) return values[0] as number
  if (input >= last) return values[values.length - 1] as number
  for (let i = 1; i < points.length; i += 1) {
    const p1 = points[i] as number
    if (input <= p1) {
      const p0 = points[i - 1] as number
      const v0 = values[i - 1] as number
      const v1 = values[i] as number
      const span = p1 - p0
      return span === 0 ? v1 : v0 + ((input - p0) / span) * (v1 - v0)
    }
  }
  return values[values.length - 1] as number
}
