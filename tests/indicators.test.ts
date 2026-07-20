import { describe, expect, it } from 'vitest'

import { DECA_EVENTS } from '../src/lib/events'
import { indicatorsForCluster, sampleIndicators } from '../src/lib/indicators'

describe('indicator bank', () => {
  it('covers every cluster used by the event catalog', () => {
    for (const event of DECA_EVENTS) {
      const bank = indicatorsForCluster(event.cluster)
      expect(bank.length).toBeGreaterThanOrEqual(14)
    }
  })

  it('has no duplicate indicators within a cluster', () => {
    for (const cluster of [
      'Business Management + Administration',
      'Marketing',
      'Finance',
      'Hospitality + Tourism'
    ]) {
      const bank = indicatorsForCluster(cluster)
      expect(new Set(bank).size).toBe(bank.length)
    }
  })

  it('falls back to the core cluster for unknown clusters', () => {
    expect(indicatorsForCluster('Underwater Basket Weaving')).toEqual(
      indicatorsForCluster('Business Management + Administration')
    )
  })
})

describe('sampleIndicators', () => {
  it('returns the requested number of distinct bank members', () => {
    const sample = sampleIndicators('Marketing', 9)
    expect(sample).toHaveLength(9)
    expect(new Set(sample).size).toBe(9)
    const bank = indicatorsForCluster('Marketing')
    for (const pi of sample) expect(bank).toContain(pi)
  })

  it('is deterministic with an injected rng and varied without one', () => {
    let seed = 42
    const rng = (): number => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    let seed2 = 42
    const rng2 = (): number => {
      seed2 = (seed2 * 16807) % 2147483647
      return seed2 / 2147483647
    }
    expect(sampleIndicators('Finance', 5, rng)).toEqual(
      sampleIndicators('Finance', 5, rng2)
    )
  })

  it('caps at the bank size', () => {
    const bank = indicatorsForCluster('Finance')
    expect(sampleIndicators('Finance', 999)).toHaveLength(bank.length)
  })
})
