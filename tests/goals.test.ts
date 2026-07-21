import { describe, expect, it } from 'vitest'

import { dailyFocus, goalProgress } from '../src/lib/goals'
import { dayStamp, type LogEntry } from '../src/lib/profile'

const at = (day: string, score = 70, over: Partial<LogEntry> = {}): LogEntry => ({
  day,
  event: 'PBM',
  score,
  minutes: 8,
  fillers: 2,
  ...over
})

const now = new Date('2026-07-20T12:00:00')
const d = (offset: number): string => {
  const date = new Date(now)
  date.setDate(date.getDate() - offset)
  return dayStamp(date)
}

describe('goalProgress', () => {
  it('is all-incomplete with no runs', () => {
    const p = goalProgress('icdc', [], now)
    expect(p.completed).toBe(0)
    expect(p.pct).toBe(0)
    expect(p.next).toBe(p.steps[0]?.label)
  })

  it('marks milestones the log actually satisfies', () => {
    // 5 takes, one break-85, a 75+ Q&A → first three ICDC milestones done.
    const log = [
      at(d(4), 70),
      at(d(3), 88, { qna: 80 }),
      at(d(2), 72),
      at(d(1), 70),
      at(d(0), 74)
    ]
    const p = goalProgress('icdc', log, now)
    const byId = Object.fromEntries(p.steps.map((s) => [s.id, s.done]))
    expect(byId.five).toBe(true)
    expect(byId.break85).toBe(true)
    expect(byId.qna).toBe(true)
    expect(byId.streak7).toBe(false)
    expect(p.completed).toBeGreaterThanOrEqual(3)
    expect(p.next).toBeTruthy()
  })

  it('completes the consistency track on a long streak + volume', () => {
    const log = Array.from({ length: 20 }, (_, i) => at(d(19 - i), 70))
    const p = goalProgress('consistency', log, now)
    expect(p.pct).toBe(100)
    expect(p.next).toBeNull()
  })
})

describe('dailyFocus', () => {
  it('flags the streak and whether today is already done', () => {
    const f = dailyFocus(['PBM'], [at(d(0), 70), at(d(1), 70)], now)
    expect(f.doneToday).toBe(true)
    expect(f.streakLine).toMatch(/locked in/)

    const f2 = dailyFocus(['PBM'], [at(d(1), 70)], now)
    expect(f2.doneToday).toBe(false)
    expect(f2.streakLine).toMatch(/keep your/)
  })

  it('recommends an untrained event the competitor picked', () => {
    // Trained PBM only; picked PMK too → PMK is the untrained pick.
    const f = dailyFocus(['PBM', 'PMK'], [at(d(2), 70), at(d(1), 70)], now)
    expect(['PBM', 'PMK']).toContain(f.eventCode)
  })

  it('steps difficulty up with volume', () => {
    const few = dailyFocus(['PBM'], [at(d(0))], now)
    expect(few.difficulty).toBe('provincial')
    const many = dailyFocus(['PBM'], Array.from({ length: 22 }, (_, i) => at(d(i), 70)), now)
    expect(many.difficulty).toBe('icdc')
  })

  it('always returns a real event code', () => {
    const f = dailyFocus([], [], now)
    expect(f.eventCode.length).toBeGreaterThan(0)
  })

  it('is deterministic for a given day', () => {
    const log = [at(d(1), 70)]
    expect(dailyFocus(['PBM', 'PMK', 'PFN'], log, now).eventCode).toBe(
      dailyFocus(['PBM', 'PMK', 'PFN'], log, now).eventCode
    )
  })
})
