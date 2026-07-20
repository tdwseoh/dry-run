// Typed client-side wrappers around our own /api/* routes. The browser NEVER talks
// to the LLM directly — it calls these, which call the serverless proxy, which
// holds the key. Both wrappers surface a clean ApiError message for the UI.

import type {
  Difficulty,
  JudgeRequest,
  JudgeResult,
  RebuttalRequest,
  RebuttalResult,
  Scenario
} from '../types'

/** A user-safe error whose message is already phrased for display. */
export class ApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

/** Pull the `{ error }` message out of a failed response, with a safe fallback. */
const readErrorMessage = async (res: Response): Promise<string> => {
  try {
    const data: unknown = await res.json()
    if (isRecord(data) && typeof data.error === 'string') {
      return data.error
    }
  } catch {
    // Non-JSON error body — fall through to the generic message.
  }
  return 'Something went wrong. Please try again.'
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export interface GenerateOptions {
  /** Extracted text of an official event PDF — the server structures THAT roleplay. */
  sourceText?: string
  /** Event code from src/lib/events.ts (generated path only). */
  eventCode?: string
  /** Competition tier (generated path only). */
  difficulty?: Difficulty
}

/**
 * Ask the proxy for a scenario. With no options the server invents one for the
 * default event; pass `eventCode` + `difficulty` to steer generation, or
 * `sourceText` to faithfully structure an official PDF instead.
 *
 * @param signal optional AbortSignal to cancel an in-flight request.
 * @throws ApiError with a display-ready message on any non-2xx response.
 */
export const generateScenario = async (
  options: GenerateOptions = {},
  signal?: AbortSignal
): Promise<Scenario> => {
  const body = {
    ...(options.sourceText !== undefined && { sourceText: options.sourceText }),
    ...(options.eventCode !== undefined && { event: options.eventCode }),
    ...(options.difficulty !== undefined && { difficulty: options.difficulty })
  }
  const res = await fetch('/api/generate-scenario', {
    method: 'POST',
    signal,
    ...(Object.keys(body).length > 0
      ? {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }
      : {})
  })
  if (!res.ok) throw new ApiError(await readErrorMessage(res))
  return (await res.json()) as Scenario
}

/**
 * Send the scenario + transcript to the proxy and get back a scored verdict.
 *
 * @throws ApiError with a display-ready message on any non-2xx response.
 */
export const judgeTranscript = async (
  scenario: Scenario,
  transcript: string,
  difficulty?: Difficulty,
  signal?: AbortSignal
): Promise<JudgeResult> => {
  const body: JudgeRequest = { scenario, transcript, difficulty }
  const res = await fetch('/api/judge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal
  })
  if (!res.ok) throw new ApiError(await readErrorMessage(res))
  return (await res.json()) as JudgeResult
}

/**
 * Send the student's answer to the judge's follow-up question and get back a
 * scored rebuttal verdict. The original transcript rides along as context.
 *
 * @throws ApiError with a display-ready message on any non-2xx response.
 */
export const judgeRebuttal = async (
  scenario: Scenario,
  transcript: string,
  question: string,
  answer: string,
  signal?: AbortSignal
): Promise<RebuttalResult> => {
  const body: RebuttalRequest = { scenario, transcript, question, answer }
  const res = await fetch('/api/rebuttal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal
  })
  if (!res.ok) throw new ApiError(await readErrorMessage(res))
  return (await res.json()) as RebuttalResult
}
