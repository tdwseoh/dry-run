// Defensive parsing + validation for LLM output.
//
// Everything here is PURE (no network, no SDK) so it can be unit-tested directly
// against strings — see tests/parse.test.ts. The handlers call parseScenario /
// parseJudgeResult and turn a thrown LlmOutputError into a 502 for the client.

import type {
  IndicatorScore,
  JudgeResult,
  RebuttalResult,
  Scenario
} from '../../src/types'

/** Raised when the model returns output we cannot trust as the expected shape. */
export class LlmOutputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LlmOutputError'
  }
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

/** Clamp a model-supplied score to an integer in [0, 100]. */
const clampScore = (value: number): number =>
  Math.max(0, Math.min(100, Math.round(value)))

/**
 * Pull a single JSON object out of raw model text. Handles the two things models
 * do even when told not to: wrap the JSON in ```json ... ``` fences, and add a
 * stray sentence before or after it. We strip fences, then slice from the first
 * "{" to the last "}".
 *
 * @throws LlmOutputError if no object-looking span is present.
 */
export const extractJsonObject = (raw: string): string => {
  let text = raw.trim()

  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text)
  if (fenced && typeof fenced[1] === 'string') {
    text = fenced[1].trim()
  }

  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  if (first === -1 || last === -1 || last < first) {
    throw new LlmOutputError('No JSON object found in model output')
  }
  return text.slice(first, last + 1)
}

/** Extract and JSON.parse model text, normalising failures to LlmOutputError. */
export const parseJson = (raw: string): unknown => {
  const jsonText = extractJsonObject(raw)
  try {
    return JSON.parse(jsonText)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    throw new LlmOutputError(`Model output was not valid JSON: ${detail}`)
  }
}

/** Validate an already-parsed value as a Scenario (used for LLM output AND request bodies). */
export const asScenario = (data: unknown): Scenario => {
  if (!isRecord(data)) {
    throw new LlmOutputError('Scenario is not a JSON object')
  }
  const { event, cluster, role, situation, judgeRole, indicators } = data
  if (
    typeof event !== 'string' ||
    typeof cluster !== 'string' ||
    typeof role !== 'string' ||
    typeof situation !== 'string' ||
    typeof judgeRole !== 'string' ||
    !isStringArray(indicators)
  ) {
    throw new LlmOutputError('Scenario JSON is missing required fields')
  }
  if (indicators.length < 1) {
    throw new LlmOutputError('Scenario has no performance indicators')
  }
  return { event, cluster, role, situation, judgeRole, indicators }
}

export const parseScenario = (raw: string): Scenario => asScenario(parseJson(raw))

/** Validate an already-parsed value as a JudgeResult, clamping scores to [0, 100]. */
export const asJudgeResult = (data: unknown): JudgeResult => {
  if (!isRecord(data)) {
    throw new LlmOutputError('Judge result is not a JSON object')
  }
  const { scores, overall, summary } = data
  if (
    !Array.isArray(scores) ||
    typeof overall !== 'number' ||
    typeof summary !== 'string'
  ) {
    throw new LlmOutputError('Judge JSON is missing required fields')
  }

  const parsedScores: IndicatorScore[] = scores.map((entry, i) => {
    if (!isRecord(entry)) {
      throw new LlmOutputError(`Judge score #${i} is not an object`)
    }
    const { indicator, score, justification, suggestion } = entry
    if (
      typeof indicator !== 'string' ||
      typeof score !== 'number' ||
      typeof justification !== 'string' ||
      typeof suggestion !== 'string'
    ) {
      throw new LlmOutputError(`Judge score #${i} is missing required fields`)
    }
    return {
      indicator,
      score: clampScore(score),
      justification,
      suggestion
    }
  })

  if (parsedScores.length < 1) {
    throw new LlmOutputError('Judge returned no indicator scores')
  }

  // Optional field: a real judge's follow-up question. Tolerate its absence so a
  // model that drops it never fails the whole verdict.
  const followUp =
    typeof data.followUp === 'string' && data.followUp.trim().length > 0
      ? data.followUp.trim()
      : undefined

  const result: JudgeResult = {
    scores: parsedScores,
    overall: clampScore(overall),
    summary
  }
  return followUp === undefined ? result : { ...result, followUp }
}

export const parseJudgeResult = (raw: string): JudgeResult =>
  asJudgeResult(parseJson(raw))

/** Validate an already-parsed value as a RebuttalResult, clamping the score. */
export const asRebuttalResult = (data: unknown): RebuttalResult => {
  if (!isRecord(data)) {
    throw new LlmOutputError('Rebuttal result is not a JSON object')
  }
  const { score, verdict, tip } = data
  if (
    typeof score !== 'number' ||
    typeof verdict !== 'string' ||
    typeof tip !== 'string'
  ) {
    throw new LlmOutputError('Rebuttal JSON is missing required fields')
  }
  return { score: clampScore(score), verdict, tip }
}

export const parseRebuttalResult = (raw: string): RebuttalResult =>
  asRebuttalResult(parseJson(raw))
