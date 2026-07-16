import type { VercelRequest, VercelResponse } from '@vercel/node'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Scenario } from '../src/types'

// Mock the LLM at the `complete()` seam — this keeps the handler tests independent
// of which transport/provider is active (OpenAI-compatible vs native Gemini) and
// guarantees no network call. vi.hoisted exposes the spy to the hoisted factory.
const { completeMock } = vi.hoisted(() => ({ completeMock: vi.fn() }))

vi.mock('../api/_lib/llm', () => ({ complete: completeMock }))

// Import the handlers AFTER the mock is registered.
import scenarioHandler from '../api/generate-scenario'
import judgeHandler from '../api/judge'

// Minimal typed stand-ins for the Vercel req/res objects the handlers use.
const makeRes = (): {
  state: { statusCode: number; body: unknown }
  res: VercelResponse
} => {
  const state: { statusCode: number; body: unknown } = {
    statusCode: 0,
    body: undefined
  }
  const res = {
    status(code: number) {
      state.statusCode = code
      return res
    },
    json(payload: unknown) {
      state.body = payload
      return res
    },
    setHeader(_name: string, _value: string) {
      return res
    }
  }
  return { state, res: res as unknown as VercelResponse }
}

const asReq = (init: { method?: string; body?: unknown }): VercelRequest =>
  ({ method: 'POST', ...init }) as unknown as VercelRequest

const VALID_SCENARIO = {
  event: 'Principles of Business Management and Administration',
  cluster: 'Business Management + Administration',
  role: 'You are a shift manager at a downtown coffee shop.',
  situation: 'Two baristas called in sick during the morning rush.',
  judgeRole: 'your district manager',
  indicators: ['Explain the nature of effective communication']
}

const VALID_JUDGE = JSON.stringify({
  scores: [
    {
      indicator: 'Explain the nature of effective communication',
      score: 71,
      justification: 'Gave a clear coverage plan.',
      suggestion: 'Confirm the plan back to the team.'
    }
  ],
  overall: 68,
  summary: 'Practical and calm, if a little thin on specifics.'
})

beforeEach(() => {
  completeMock.mockReset()
  // Handlers log to console.error on the failure paths — keep test output clean.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('generate-scenario handler', () => {
  it('returns 200 with a parsed scenario (even when the model fences its JSON)', async () => {
    completeMock.mockResolvedValue('```json\n' + JSON.stringify(VALID_SCENARIO) + '\n```')
    const { state, res } = makeRes()
    await scenarioHandler(asReq({}), res)
    expect(state.statusCode).toBe(200)
    expect((state.body as Scenario).indicators.length).toBeGreaterThan(0)
  })

  it('returns 502 when the model output is unparseable', async () => {
    completeMock.mockResolvedValue('sorry, here is no json')
    const { state, res } = makeRes()
    await scenarioHandler(asReq({}), res)
    expect(state.statusCode).toBe(502)
  })

  it('rejects non-POST with 405', async () => {
    const { state, res } = makeRes()
    await scenarioHandler(asReq({ method: 'GET' }), res)
    expect(state.statusCode).toBe(405)
    expect(completeMock).not.toHaveBeenCalled()
  })
})

describe('judge handler', () => {
  it('returns 200 with a parsed verdict', async () => {
    completeMock.mockResolvedValue(VALID_JUDGE)
    const { state, res } = makeRes()
    await judgeHandler(
      asReq({ body: { scenario: VALID_SCENARIO, transcript: 'I would cover the bar myself.' } }),
      res
    )
    expect(state.statusCode).toBe(200)
  })

  it('returns 400 when the transcript is missing (and never calls the model)', async () => {
    const { state, res } = makeRes()
    await judgeHandler(asReq({ body: { scenario: VALID_SCENARIO } }), res)
    expect(state.statusCode).toBe(400)
    expect(completeMock).not.toHaveBeenCalled()
  })

  it('returns 502 when the judge output is unparseable', async () => {
    completeMock.mockResolvedValue('not a verdict')
    const { state, res } = makeRes()
    await judgeHandler(
      asReq({ body: { scenario: VALID_SCENARIO, transcript: 'anything' } }),
      res
    )
    expect(state.statusCode).toBe(502)
  })
})
