import { describe, expect, it } from 'vitest'

import { computeDelivery, paceLabel, segmentFillers } from '../src/lib/delivery'

describe('computeDelivery', () => {
  it('returns zeros for an empty transcript', () => {
    const stats = computeDelivery('', 120)
    expect(stats.words).toBe(0)
    expect(stats.wpm).toBe(0)
    expect(stats.fillers).toEqual([])
    expect(stats.fillerTotal).toBe(0)
  })

  it('counts words and computes wpm from duration', () => {
    // 30 words over 15 seconds = 120 wpm.
    const words = Array.from({ length: 30 }, (_, i) => `word${i}`).join(' ')
    const stats = computeDelivery(words, 15)
    expect(stats.words).toBe(30)
    expect(stats.wpm).toBe(120)
  })

  it('handles zero and bogus durations without dividing by zero', () => {
    expect(computeDelivery('some words here', 0).wpm).toBe(0)
    expect(computeDelivery('some words here', Number.NaN).wpm).toBe(0)
    expect(computeDelivery('some words here', -5).wpm).toBe(0)
  })

  it('counts single-word fillers as whole tokens only', () => {
    const stats = computeDelivery('Um, so the plan is, um, drummer summit', 30)
    const um = stats.fillers.find((f) => f.phrase === 'um')
    expect(um?.count).toBe(2) // "drummer" and "summit" must not match
  })

  it('counts multi-word filler phrases', () => {
    const stats = computeDelivery(
      'You know, we could, you know, kind of expand the loyalty program',
      30
    )
    expect(stats.fillers.find((f) => f.phrase === 'you know')?.count).toBe(2)
    expect(stats.fillers.find((f) => f.phrase === 'kind of')?.count).toBe(1)
    expect(stats.fillerTotal).toBe(3)
  })

  it('is punctuation- and case-insensitive', () => {
    const stats = computeDelivery('UM... UH! um?', 10)
    expect(stats.fillerTotal).toBe(3)
  })
})

describe('segmentFillers', () => {
  it('returns no segments for an empty transcript', () => {
    expect(segmentFillers('')).toEqual([])
  })

  it('returns one plain segment when there are no fillers', () => {
    expect(segmentFillers('a clean take')).toEqual([
      { text: 'a clean take', filler: false }
    ])
  })

  it('flags fillers in place and preserves the original text exactly', () => {
    const raw = 'So, um, we could, you know, expand.'
    const segments = segmentFillers(raw)
    expect(segments.map((s) => s.text).join('')).toBe(raw)
    expect(segments.filter((s) => s.filler).map((s) => s.text)).toEqual([
      'um',
      'you know'
    ])
  })

  it('does not flag filler substrings inside real words', () => {
    const segments = segmentFillers('the drummer hit the summit')
    expect(segments.every((s) => !s.filler)).toBe(true)
  })

  it('matches fillers case-insensitively', () => {
    const segments = segmentFillers('Um. You Know.')
    expect(segments.filter((s) => s.filler).map((s) => s.text)).toEqual([
      'Um',
      'You Know'
    ])
  })
})

describe('paceLabel', () => {
  it('labels the healthy presenting band as on pace', () => {
    expect(paceLabel(140)).toBe('On pace')
  })

  it('flags extremes', () => {
    expect(paceLabel(80)).toMatch(/Slow/)
    expect(paceLabel(200)).toMatch(/Rushed/)
    expect(paceLabel(0)).toBe('No pace data')
  })
})
