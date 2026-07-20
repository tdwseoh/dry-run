import { describe, expect, it } from 'vitest'

import type { RunRecord } from '../src/lib/history'
import { recentAverage, sparklinePath, trendDelta, trendPoints } from '../src/lib/trend'

const run = (overall: number, at = 0): RunRecord => ({
  at,
  event: 'PBM',
  overall,
  words: 100,
  durationSeconds: 60,
  wpm: 100
})

describe('trendPoints', () => {
  it('reverses newest-first history into chronological order', () => {
    const history = [run(90, 3), run(80, 2), run(70, 1)]
    expect(trendPoints(history)).toEqual([70, 80, 90])
  })

  it('caps at the limit (keeping the most recent runs)', () => {
    // history is newest-first: history[0] scored 50, the oldest scored 64.
    const history = Array.from({ length: 15 }, (_, i) => run(50 + i, 15 - i))
    const points = trendPoints(history, 10)
    expect(points).toHaveLength(10)
    expect(points[points.length - 1]).toBe(50) // chronological tail = newest run
    expect(points[0]).toBe(59) // oldest run inside the 10-run window
  })
})

describe('recentAverage / trendDelta', () => {
  it('averages the chronological tail', () => {
    expect(recentAverage([60, 70, 80], 2)).toBe(75)
    expect(recentAverage([], 5)).toBeNull()
  })

  it('delta compares the newest score to the prior average', () => {
    expect(trendDelta([60, 70, 89])).toBe(24) // 89 - avg(60,70)=65
    expect(trendDelta([80])).toBeNull()
  })
})

describe('sparklinePath', () => {
  it('maps scores onto the fixed 0-100 scale inside the padded box', () => {
    const coords = sparklinePath([0, 100], 100, 50, 5)
    expect(coords[0]).toEqual({ x: 5, y: 45 }) // score 0 → bottom
    expect(coords[1]).toEqual({ x: 95, y: 5 }) // score 100 → top
  })

  it('handles a single point and empty input', () => {
    expect(sparklinePath([], 100, 50)).toEqual([])
    expect(sparklinePath([50], 100, 50)).toHaveLength(1)
  })
})
