import { describe, expect, it } from 'vitest'

import {
  achievements,
  currentStreak,
  dayStamp,
  levelFor,
  longestStreak,
  newlyEarned,
  parseLog,
  parseProfile,
  perEventStats,
  readinessScore,
  totalXp,
  type LogEntry
} from '../src/lib/profile'

const entry = (day: string, score = 70, extras: Partial<LogEntry> = {}): LogEntry => ({
  day,
  event: 'PBM',
  score,
  minutes: 8,
  fillers: 3,
  ...extras
})

describe('parseProfile', () => {
  it('accepts a complete profile and trims strings', () => {
    const raw = JSON.stringify({
      name: '  Jamie  ',
      school: 'Iroquois Ridge HS',
      events: ['PBM', 'HTDM'],
      goal: 'icdc'
    })
    expect(parseProfile(raw)?.name).toBe('Jamie')
  })

  it('rejects blank names, bad goals, malformed JSON', () => {
    expect(parseProfile(JSON.stringify({ name: '  ', school: 's', events: [], goal: 'icdc' }))).toBeNull()
    expect(parseProfile(JSON.stringify({ name: 'J', school: 's', events: [], goal: 'win' }))).toBeNull()
    expect(parseProfile('{oops')).toBeNull()
    expect(parseProfile(null)).toBeNull()
  })
})

describe('parseLog', () => {
  it('drops malformed entries and keeps optional qna', () => {
    const raw = JSON.stringify([
      entry('2026-07-01'),
      { day: 'yesterday', event: 'PBM', score: 50, minutes: 5, fillers: 0 },
      entry('2026-07-02', 80, { qna: 88 })
    ])
    const log = parseLog(raw)
    expect(log).toHaveLength(2)
    expect(log[1]?.qna).toBe(88)
  })
})

describe('streaks', () => {
  const noon = (stamp: string): Date => new Date(`${stamp}T12:00:00`)

  it('counts consecutive days ending today', () => {
    const log = [entry('2026-07-18'), entry('2026-07-19'), entry('2026-07-20')]
    expect(currentStreak(log, noon('2026-07-20'))).toBe(3)
  })

  it("keeps yesterday's streak alive until a full day is missed", () => {
    const log = [entry('2026-07-18'), entry('2026-07-19')]
    expect(currentStreak(log, noon('2026-07-20'))).toBe(2)
    expect(currentStreak(log, noon('2026-07-21'))).toBe(0)
  })

  it('multiple runs in one day count once; gaps reset', () => {
    const log = [
      entry('2026-07-15'),
      entry('2026-07-15'),
      entry('2026-07-17'),
      entry('2026-07-18')
    ]
    expect(currentStreak(log, noon('2026-07-18'))).toBe(2)
    expect(longestStreak(log)).toBe(2)
  })

  it('crosses month boundaries', () => {
    const log = [entry('2026-06-30'), entry('2026-07-01')]
    expect(longestStreak(log)).toBe(2)
  })
})

describe('levels + xp', () => {
  it('awards more xp for stronger takes', () => {
    expect(totalXp([entry('2026-07-01', 60)])).toBe(20)
    expect(totalXp([entry('2026-07-01', 80)])).toBe(30)
    expect(totalXp([entry('2026-07-01', 95)])).toBe(40)
  })

  it('maps xp to bands with progress', () => {
    expect(levelFor(0).name).toBe('Rookie')
    expect(levelFor(239).name).toBe('Rookie')
    expect(levelFor(240).name).toBe('Competitor')
    expect(levelFor(1600).name).toBe('ICDC Ready')
    expect(levelFor(1600).toNext).toBeNull()
    expect(levelFor(120).progress).toBeCloseTo(0.5)
  })
})

describe('readinessScore', () => {
  const now = new Date('2026-07-20T12:00:00')

  it('is null with no runs', () => {
    expect(readinessScore([], now)).toBeNull()
  })

  it('rewards scoring, streak, trajectory and volume honestly', () => {
    // One mediocre run today: 60*0.5 + neutral 10 + streak 2 + volume 0.5 = 42.5
    expect(readinessScore([entry(dayStamp(now), 60)], now)).toBe(43)
  })

  it('improving beats declining on the same scores', () => {
    const improving = [entry('2026-07-18', 60), entry('2026-07-19', 80)]
    const declining = [entry('2026-07-18', 80), entry('2026-07-19', 60)]
    const up = readinessScore(improving, now) as number
    const down = readinessScore(declining, now) as number
    expect(up).toBeGreaterThan(down)
  })
})

describe('achievements', () => {
  it('derives earned/locked with earn days', () => {
    const log = [
      entry('2026-07-01', 92, { fillers: 0 }),
      entry('2026-07-02', 55, { event: 'PMK' }),
      entry('2026-07-03', 71, { event: 'HTDM', qna: 80 })
    ]
    const byId = new Map(achievements(log).map((a) => [a.id, a]))
    expect(byId.get('first-take')?.earnedOn).toBe('2026-07-01')
    expect(byId.get('ninety-club')?.earnedOn).toBe('2026-07-01')
    expect(byId.get('clean-take')?.earnedOn).toBe('2026-07-01')
    expect(byId.get('event-explorer')?.earnedOn).toBe('2026-07-03')
    expect(byId.get('under-pressure')?.earnedOn).toBe('2026-07-03')
    expect(byId.get('comeback')?.earnedOn).toBe('2026-07-03') // 71 vs 55 = +16
    expect(byId.get('five-takes')?.earnedOn).toBeNull()
  })

  it('newlyEarned reports exactly the unlock moment', () => {
    const before = [entry('2026-07-01', 60)]
    const after = [...before, entry('2026-07-02', 91)]
    const ids = newlyEarned(before, after).map((a) => a.id)
    expect(ids).toContain('ninety-club')
    expect(ids).toContain('comeback')
    expect(ids).not.toContain('first-take')
  })
})

describe('perEventStats', () => {
  it('groups, averages, and sorts by volume', () => {
    const log = [
      entry('2026-07-01', 60),
      entry('2026-07-02', 80),
      entry('2026-07-03', 90, { event: 'HTDM' })
    ]
    expect(perEventStats(log)).toEqual([
      { event: 'PBM', runs: 2, average: 70 },
      { event: 'HTDM', runs: 1, average: 90 }
    ])
  })
})
