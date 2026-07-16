import type { VercelRequest, VercelResponse } from '@vercel/node'

import { buildJudgeUserMessage, JUDGE_SYSTEM_PROMPT } from '../src/prompts/judge'
import type { Scenario } from '../src/types'
import { JUDGE_MAX_TOKENS, JUDGE_TEMPERATURE, MODEL_JUDGE } from './_lib/config'
import { complete } from './_lib/llm'
import { asScenario, isRecord, LlmOutputError, parseJudgeResult } from './_lib/parse'

interface JudgeBody {
  scenario: Scenario
  transcript: string
}

/** Validate the request body: it must carry a valid scenario and a transcript string. */
const readBody = (body: unknown): JudgeBody => {
  const parsed: unknown = typeof body === 'string' ? JSON.parse(body) : body
  if (!isRecord(parsed) || typeof parsed.transcript !== 'string') {
    throw new SyntaxError('Request must include a transcript string')
  }
  // asScenario throws LlmOutputError on a bad shape; re-label it as a bad request.
  const scenario = asScenario(parsed.scenario)
  return { scenario, transcript: parsed.transcript }
}

// Proxies judging to the LLM. Receives the scenario + transcript, returns a
// validated JudgeResult. Same key-hiding purpose as generate-scenario.
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  let payload: JudgeBody
  try {
    payload = readBody(req.body)
  } catch (err) {
    console.error('[judge] bad request body:', err)
    res.status(400).json({ error: 'The judge request was malformed.' })
    return
  }

  try {
    const raw = await complete({
      model: MODEL_JUDGE,
      system: JUDGE_SYSTEM_PROMPT,
      user: buildJudgeUserMessage(payload.scenario, payload.transcript),
      maxTokens: JUDGE_MAX_TOKENS,
      temperature: JUDGE_TEMPERATURE
    })
    const result = parseJudgeResult(raw)
    res.status(200).json(result)
  } catch (err) {
    if (err instanceof LlmOutputError) {
      console.error('[judge] unreadable model output:', err.message)
      res.status(502).json({
        error: 'The judge returned something unreadable. Try scoring again.'
      })
      return
    }
    console.error('[judge] failed:', err)
    res.status(500).json({
      error: 'Could not reach the judge. Try scoring again in a moment.'
    })
  }
}
