import { describe, expect, it } from 'vitest'

import { parseBackup, type Backup } from '../src/lib/backup'

const validBackup = (): Backup => ({
  app: 'dry-run',
  version: 1,
  exportedAt: 1_700_000_000_000,
  profile: { name: 'Jamie', school: 'Ridge HS', events: ['PBM'], goal: 'icdc' },
  log: [{ day: '2026-07-20', event: 'PBM', score: 80, minutes: 8, fillers: 1 }],
  archive: [],
  history: [
    { at: 1, event: 'PBM', overall: 80, words: 100, durationSeconds: 60, wpm: 100 }
  ]
})

describe('parseBackup', () => {
  it('round-trips a valid backup', () => {
    const parsed = parseBackup(JSON.stringify(validBackup()))
    expect(parsed?.profile?.name).toBe('Jamie')
    expect(parsed?.log).toHaveLength(1)
    expect(parsed?.history).toHaveLength(1)
  })

  it('rejects non-Dry-Run files and bad JSON', () => {
    expect(parseBackup('{oops')).toBeNull()
    expect(parseBackup(JSON.stringify({ app: 'something-else' }))).toBeNull()
    expect(parseBackup(JSON.stringify({ version: 1 }))).toBeNull()
  })

  it('drops corrupt sections instead of failing the whole import', () => {
    const mixed = {
      app: 'dry-run',
      version: 1,
      profile: { name: '', school: 's', events: [], goal: 'nope' }, // invalid → null
      log: [
        { day: '2026-07-20', event: 'PBM', score: 70, minutes: 5, fillers: 0 },
        { day: 'not-a-day', event: 'x', score: 1, minutes: 1, fillers: 0 } // dropped
      ],
      archive: 'not an array', // → []
      history: [{ at: 1, event: 'PBM', overall: 60, words: 50, durationSeconds: 30, wpm: 100 }]
    }
    const parsed = parseBackup(JSON.stringify(mixed))
    expect(parsed).not.toBeNull()
    expect(parsed?.profile).toBeNull()
    expect(parsed?.log).toHaveLength(1)
    expect(parsed?.archive).toEqual([])
    expect(parsed?.history).toHaveLength(1)
  })

  it('tolerates a null profile and missing sections', () => {
    const parsed = parseBackup(JSON.stringify({ app: 'dry-run', profile: null }))
    expect(parsed?.profile).toBeNull()
    expect(parsed?.log).toEqual([])
    expect(parsed?.archive).toEqual([])
    expect(parsed?.history).toEqual([])
  })
})
