import { describe, expect, it } from 'vitest'

import { parseHistory, personalBest, type RunRecord } from '../src/lib/history'

const run = (overrides: Partial<RunRecord> = {}): RunRecord => ({
  at: 1_700_000_000_000,
  event: 'Principles of Business Management and Administration',
  overall: 72,
  words: 480,
  durationSeconds: 210,
  wpm: 137,
  ...overrides
})

describe('parseHistory', () => {
  it('returns [] for null, malformed JSON, and non-arrays', () => {
    expect(parseHistory(null)).toEqual([])
    expect(parseHistory('not json {')).toEqual([])
    expect(parseHistory('{"a":1}')).toEqual([])
  })

  it('round-trips valid records', () => {
    const records = [run(), run({ overall: 88 })]
    expect(parseHistory(JSON.stringify(records))).toEqual(records)
  })

  it('drops malformed entries but keeps the good ones', () => {
    const good = run()
    const raw = JSON.stringify([good, { overall: 'ninety' }, null, 42])
    expect(parseHistory(raw)).toEqual([good])
  })

  it('caps the list at 20 entries', () => {
    const many = Array.from({ length: 30 }, (_, i) => run({ at: i }))
    expect(parseHistory(JSON.stringify(many))).toHaveLength(20)
  })
})

describe('personalBest', () => {
  it('is null for an empty history', () => {
    expect(personalBest([])).toBeNull()
  })

  it('returns the highest overall score', () => {
    const history = [run({ overall: 61 }), run({ overall: 87 }), run({ overall: 74 })]
    expect(personalBest(history)).toBe(87)
  })
})
