import { describe, expect, it } from 'vitest'

import { FRAME_COUNT, framePath, frameForProgress, ramp } from '../src/lib/film'

describe('framePath', () => {
  it('pads to the on-disk 1-based names', () => {
    expect(framePath(0)).toBe('/sequence/frame_0001.webp')
    expect(framePath(88)).toBe('/sequence/frame_0089.webp')
  })
})

describe('frameForProgress', () => {
  it('maps the ends of the scroll to the ends of the sequence', () => {
    expect(frameForProgress(0)).toBe(0)
    expect(frameForProgress(1)).toBe(FRAME_COUNT - 1)
  })

  it('clamps out-of-range progress instead of overshooting', () => {
    expect(frameForProgress(-0.5)).toBe(0)
    expect(frameForProgress(1.7)).toBe(FRAME_COUNT - 1)
  })

  it('rounds to the nearest frame', () => {
    expect(frameForProgress(0.5)).toBe(44)
  })
})

describe('ramp', () => {
  it('interpolates linearly inside a segment', () => {
    expect(ramp(0.1, [0, 0.2], [0, 1])).toBeCloseTo(0.5)
    expect(ramp(0.38, [0.24, 0.32, 0.44, 0.52], [0, 1, 1, 0])).toBe(1)
  })

  it('holds the end values outside the range — never wraps or extrapolates', () => {
    // The regression this guards against: a fade-out that ends mid-progress
    // must STAY faded for the rest of the scroll.
    expect(ramp(0.9, [0, 0.05, 0.18], [1, 1, 0])).toBe(0)
    expect(ramp(-1, [0, 0.05, 0.18], [1, 1, 0])).toBe(1)
    expect(ramp(2, [0.24, 0.52], [-36, 20])).toBe(20)
  })

  it('treats a zero-width segment as a step (boundary belongs to the left side)', () => {
    expect(ramp(0.5, [0, 0.5, 0.5, 1], [0, 0, 1, 1])).toBe(0)
    expect(ramp(0.51, [0, 0.5, 0.5, 1], [0, 0, 1, 1])).toBe(1)
  })

  it('rejects mismatched keyframe arrays', () => {
    expect(() => ramp(0.5, [0, 1], [1])).toThrow()
    expect(() => ramp(0.5, [0], [1])).toThrow()
  })
})
