import { describe, expect, it } from 'vitest'

import {
  asJudgeResult,
  asRebuttalResult,
  extractJsonObject,
  LlmOutputError,
  parseJudgeResult,
  parseRebuttalResult,
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

  it('treats a missing followUp as absent, not an error', () => {
    const result = parseJudgeResult(validJudge)
    expect(result.followUp).toBeUndefined()
  })

  it('keeps a non-empty followUp and trims it', () => {
    const withFollowUp = JSON.stringify({
      ...JSON.parse(validJudge),
      followUp: '  What would this cost per week?  '
    })
    expect(parseJudgeResult(withFollowUp).followUp).toBe(
      'What would this cost per week?'
    )
  })

  it('drops a blank or non-string followUp', () => {
    const blank = JSON.stringify({ ...JSON.parse(validJudge), followUp: '   ' })
    expect(parseJudgeResult(blank).followUp).toBeUndefined()
    const wrongType = { ...JSON.parse(validJudge), followUp: 42 }
    expect(asJudgeResult(wrongType).followUp).toBeUndefined()
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

  it('strips list numbering the model echoes from the prompt', () => {
    // Observed live: the judge echoes "1. Describe the nature of…" because the
    // user message presents the indicators as a numbered list.
    const numbered = {
      ...JSON.parse(validJudge),
      scores: [
        { indicator: '1. Communication', score: 70, justification: 'j', suggestion: 's' },
        { indicator: '2) Problem solving', score: 60, justification: 'j', suggestion: 's' },
        { indicator: '(3) Ethics', score: 50, justification: 'j', suggestion: 's' },
        { indicator: 'Budgeting basics', score: 40, justification: 'j', suggestion: 's' }
      ]
    }
    expect(asJudgeResult(numbered).scores.map((s) => s.indicator)).toEqual([
      'Communication',
      'Problem solving',
      'Ethics',
      'Budgeting basics'
    ])
  })

  it('does not mangle indicators that legitimately start with digits', () => {
    const tricky = {
      ...JSON.parse(validJudge),
      scores: [
        { indicator: '30-day retention planning', score: 70, justification: 'j', suggestion: 's' }
      ]
    }
    expect(asJudgeResult(tricky).scores[0]?.indicator).toBe('30-day retention planning')
  })

  it('keeps clean strengths/improvements and trims entries', () => {
    const withLists = {
      ...JSON.parse(validJudge),
      strengths: ['  Clear open  ', 'Named the tradeoff'],
      improvements: ['Quantify the plan']
    }
    const result = asJudgeResult(withLists)
    expect(result.strengths).toEqual(['Clear open', 'Named the tradeoff'])
    expect(result.improvements).toEqual(['Quantify the plan'])
  })

  it('drops malformed strengths/improvements instead of failing the verdict', () => {
    const bad = {
      ...JSON.parse(validJudge),
      strengths: 'not an array',
      improvements: [42, '   ', 'Real advice']
    }
    const result = asJudgeResult(bad)
    expect(result.strengths).toBeUndefined()
    expect(result.improvements).toEqual(['Real advice'])
  })

  it('caps strengths/improvements at four entries', () => {
    const flood = {
      ...JSON.parse(validJudge),
      strengths: ['a', 'b', 'c', 'd', 'e', 'f']
    }
    expect(asJudgeResult(flood).strengths).toHaveLength(4)
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

describe('parseRebuttalResult', () => {
  const validRebuttal = JSON.stringify({
    score: 62,
    verdict: 'You engaged the question but never named a number.',
    tip: 'Commit to a specific budget figure and defend it.'
  })

  it('accepts a valid rebuttal result (even fenced)', () => {
    const result = parseRebuttalResult('```json\n' + validRebuttal + '\n```')
    expect(result.score).toBe(62)
    expect(result.tip).toContain('budget')
  })

  it('clamps out-of-range scores and rounds', () => {
    expect(asRebuttalResult({ score: 130.4, verdict: 'v', tip: 't' }).score).toBe(100)
    expect(asRebuttalResult({ score: -5, verdict: 'v', tip: 't' }).score).toBe(0)
  })

  it('rejects missing fields', () => {
    expect(() => parseRebuttalResult('{"score": 50}')).toThrow(LlmOutputError)
    expect(() =>
      parseRebuttalResult('{"score":"high","verdict":"v","tip":"t"}')
    ).toThrow(LlmOutputError)
  })

  it('rejects non-object output', () => {
    expect(() => parseRebuttalResult('[1, 2, 3]')).toThrow(LlmOutputError)
  })
})
