import { describe, expect, it } from 'vitest'

import {
  asJudgeResult,
  extractJsonObject,
  LlmOutputError,
  parseJudgeResult,
  parseScenario
} from '../api/_lib/parse'

// These cover the risky part of the app: turning messy model text into trusted,
// typed JSON. No network — pure functions in, assertions out.

describe('extractJsonObject', () => {
  it('passes a bare JSON object straight through', () => {
    expect(extractJsonObject('{"a":1}')).toBe('{"a":1}')
  })

  it('strips ```json fences', () => {
    expect(extractJsonObject('```json\n{"a":1}\n```')).toBe('{"a":1}')
  })

  it('strips plain ``` fences', () => {
    expect(extractJsonObject('```\n{"a":1}\n```')).toBe('{"a":1}')
  })

  it('slices an object out of surrounding prose', () => {
    expect(extractJsonObject('Sure! {"a":1} hope that helps')).toBe('{"a":1}')
  })

  it('throws LlmOutputError when there is no object', () => {
    expect(() => extractJsonObject('no json here')).toThrow(LlmOutputError)
  })
})

describe('parseScenario', () => {
  const validScenario = JSON.stringify({
    event: 'Principles of Business Management and Administration',
    cluster: 'Business Management + Administration',
    role: 'You are a shift manager at a downtown coffee shop.',
    situation: 'Two baristas called in sick during the morning rush.',
    judgeRole: 'your district manager',
    indicators: [
      'Explain the nature of effective communication',
      'Demonstrate problem-solving skills'
    ]
  })

  it('parses a valid scenario even when fenced', () => {
    const scenario = parseScenario('```json\n' + validScenario + '\n```')
    expect(scenario.indicators).toHaveLength(2)
    expect(scenario.event).toContain('Principles')
  })

  it('rejects a scenario missing required fields', () => {
    expect(() => parseScenario('{"event":"x"}')).toThrow(LlmOutputError)
  })

  it('rejects a scenario with no indicators', () => {
    const noIndicators = JSON.stringify({
      event: 'e',
      cluster: 'c',
      role: 'r',
      situation: 's',
      judgeRole: 'j',
      indicators: []
    })
    expect(() => parseScenario(noIndicators)).toThrow(LlmOutputError)
  })

  it('rejects non-JSON output', () => {
    expect(() => parseScenario('definitely not json')).toThrow(LlmOutputError)
  })
})

describe('parseJudgeResult', () => {
  const validJudge = JSON.stringify({
    scores: [
      {
        indicator: 'Communication',
        score: 82,
        justification: 'Opened with a clear plan.',
        suggestion: 'Name the tradeoff explicitly.'
      }
    ],
    overall: 78,
    summary: 'Specific and well structured, but light on the numbers.'
  })

  it('parses a valid judge result', () => {
    const result = parseJudgeResult(validJudge)
    expect(result.scores[0]?.score).toBe(82)
    expect(result.overall).toBe(78)
  })

  it('clamps out-of-range scores and rounds', () => {
    const wild = {
      scores: [
        { indicator: 'x', score: 140, justification: 'a', suggestion: 'b' }
      ],
      overall: -20.6,
      summary: 's'
    }
    const result = asJudgeResult(wild)
    expect(result.scores[0]?.score).toBe(100)
    expect(result.overall).toBe(0)
  })

  it('rejects a result with no scores', () => {
    expect(() =>
      parseJudgeResult('{"scores":[],"overall":50,"summary":"x"}')
    ).toThrow(LlmOutputError)
  })

  it('rejects malformed score entries', () => {
    expect(() =>
      parseJudgeResult('{"scores":[{"indicator":"x"}],"overall":50,"summary":"y"}')
    ).toThrow(LlmOutputError)
  })
})
