// Typed client-side wrappers around our own /api/* routes. The browser NEVER talks
// to the LLM directly — it calls these, which call the serverless proxy, which
// holds the key. Both wrappers surface a clean ApiError message for the UI.

import type { JudgeRequest, JudgeResult, Scenario } from '../types'

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

/**
 * Ask the proxy for a scenario. With no arguments the server invents one; pass
 * `sourceText` (the extracted text of an official event PDF) to have the server
 * faithfully structure THAT roleplay instead.
 *
 * @param signal optional AbortSignal to cancel an in-flight request.
 * @throws ApiError with a display-ready message on any non-2xx response.
 */
export const generateScenario = async (
  sourceText?: string,
  signal?: AbortSignal
): Promise<Scenario> => {
  const res = await fetch('/api/generate-scenario', {
    method: 'POST',
    signal,
    ...(sourceText
      ? {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceText })
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
  signal?: AbortSignal
): Promise<JudgeResult> => {
  const body: JudgeRequest = { scenario, transcript }
  const res = await fetch('/api/judge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal
  })
  if (!res.ok) throw new ApiError(await readErrorMessage(res))
  return (await res.json()) as JudgeResult
}
