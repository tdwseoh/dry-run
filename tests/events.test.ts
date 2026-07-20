import { describe, expect, it } from 'vitest'

import {
  DECA_EVENTS,
  DEFAULT_EVENT_CODE,
  DIFFICULTIES,
  eventByCode,
  isDifficulty
} from '../src/lib/events'

describe('event catalog', () => {
  it('has unique codes and complete entries', () => {
    const codes = DECA_EVENTS.map((e) => e.code)
    expect(new Set(codes).size).toBe(codes.length)
    for (const event of DECA_EVENTS) {
      expect(event.name.length).toBeGreaterThan(0)
      expect(event.cluster.length).toBeGreaterThan(0)
      expect(['solo', 'team']).toContain(event.format)
    }
  })

  it('team decision-making events carry the team format', () => {
    for (const code of ['HTDM', 'MTDM', 'FTDM', 'BLTDM']) {
      expect(eventByCode(code).format).toBe('team')
    }
    for (const code of ['PBM', 'PMK', 'PFN', 'PHT', 'HRM']) {
      expect(eventByCode(code).format).toBe('solo')
    }
  })

  it('falls back to the default event for unknown codes', () => {
    expect(eventByCode('NOPE').code).toBe(DEFAULT_EVENT_CODE)
    expect(eventByCode(undefined).code).toBe(DEFAULT_EVENT_CODE)
  })
})

describe('difficulty tiers', () => {
  it('escalate the indicator count', () => {
    expect(DIFFICULTIES.regional.indicators).toBeLessThan(
      DIFFICULTIES.provincial.indicators
    )
    expect(DIFFICULTIES.provincial.indicators).toBeLessThan(
      DIFFICULTIES.icdc.indicators
    )
  })

  it('isDifficulty guards request-body strings', () => {
    expect(isDifficulty('regional')).toBe(true)
    expect(isDifficulty('icdc')).toBe(true)
    expect(isDifficulty('nationals')).toBe(false)
    expect(isDifficulty(42)).toBe(false)
    expect(isDifficulty(undefined)).toBe(false)
  })
})
