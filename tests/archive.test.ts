import { describe, expect, it } from 'vitest'

import { newRunId, parseArchive, type ArchivedRun } from '../src/lib/archive'

const run = (over: Partial<ArchivedRun> = {}): ArchivedRun => ({
  id: 'a1',
  at: 1_700_000_000_000,
  eventCode: 'PBM',
  eventName: 'Principles of Business Management and Administration',
  difficulty: 'provincial',
  fromPdf: false,
  overall: 82,
  scenario: {
    event: 'PBM',
    cluster: 'Business Management + Administration',
    role: 'You are a shift lead.',
    situation: 'A staffing crunch.',
    judgeRole: 'your district manager',
    indicators: ['Explain the nature of effective communication']
  },
  transcript: 'Here is my plan.',
  verdict: {
    scores: [
      { indicator: 'Explain the nature of effective communication', score: 82, justification: 'j', suggestion: 's' }
    ],
    overall: 82,
    summary: 'Solid.'
  },
  delivery: { words: 120, durationSeconds: 90, wpm: 80, fillerTotal: 1, fillers: [{ phrase: 'um', count: 1 }] },
  ...over
})

describe('parseArchive', () => {
  it('round-trips valid runs (newest first)', () => {
    const raw = JSON.stringify([run({ id: 'a2', at: 2 }), run({ id: 'a1', at: 1 })])
    const parsed = parseArchive(raw)
    expect(parsed.map((r) => r.id)).toEqual(['a2', 'a1'])
    expect(parsed[0]?.verdict.scores).toHaveLength(1)
  })

  it('drops entries missing load-bearing fields', () => {
    const raw = JSON.stringify([
      run(),
      { id: 'bad', at: 1 }, // no scenario/verdict/eventName
      { ...run(), verdict: { overall: 5, summary: 'x' } } // verdict has no scores array
    ])
    expect(parseArchive(raw).map((r) => r.id)).toEqual(['a1'])
  })

  it('keeps an optional qnaScore and tolerates a null delivery', () => {
    const raw = JSON.stringify([run({ qnaScore: 77, delivery: null })])
    const parsed = parseArchive(raw)
    expect(parsed[0]?.qnaScore).toBe(77)
    expect(parsed[0]?.delivery).toBeNull()
  })

  it('degrades to [] on malformed JSON / non-array / null', () => {
    expect(parseArchive('{oops')).toEqual([])
    expect(parseArchive('{}')).toEqual([])
    expect(parseArchive(null)).toEqual([])
  })

  it('caps at 50 entries', () => {
    const many = Array.from({ length: 60 }, (_, i) => run({ id: `r${i}` }))
    expect(parseArchive(JSON.stringify(many))).toHaveLength(50)
  })
})

describe('newRunId', () => {
  it('produces distinct ids', () => {
    const ids = new Set(Array.from({ length: 200 }, () => newRunId()))
    expect(ids.size).toBe(200)
  })
})
