import type { VercelRequest, VercelResponse } from '@vercel/node'

import { buildRebuttalUserMessage, REBUTTAL_SYSTEM_PROMPT } from '../src/prompts/rebuttal.js'
import type { Scenario } from '../src/types'
import { JUDGE_TEMPERATURE, MODEL_JUDGE, REBUTTAL_MAX_TOKENS } from './_lib/config.js'
import { complete } from './_lib/llm.js'
import { asScenario, isRecord, LlmOutputError, parseRebuttalResult } from './_lib/parse.js'

interface RebuttalBody {
  scenario: Scenario
  transcript: string
  question: string
  answer: string
}

/** Validate the request body: scenario + original transcript + question + answer. */
const readBody = (body: unknown): RebuttalBody => {
  const parsed: unknown = typeof body === 'string' ? JSON.parse(body) : body
  if (
    !isRecord(parsed) ||
    typeof parsed.transcript !== 'string' ||
    typeof parsed.question !== 'string' ||
    typeof parsed.answer !== 'string'
  ) {
    throw new SyntaxError('Request must include transcript, question and answer strings')
  }
  // asScenario throws LlmOutputError on a bad shape; re-label it as a bad request.
  const scenario = asScenario(parsed.scenario)
  return {
    scenario,
    transcript: parsed.transcript,
    question: parsed.question,
    answer: parsed.answer
  }
}

// Proxies the Q&A round to the LLM: the judge scores the student's answer to the
// follow-up question. Same key-hiding purpose as judge.
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  let payload: RebuttalBody
  try {
    payload = readBody(req.body)
  } catch (err) {
    console.error('[rebuttal] bad request body:', err)
    res.status(400).json({ error: 'The rebuttal request was malformed.' })
    return
  }

  try {
    const raw = await complete({
      model: MODEL_JUDGE,
      system: REBUTTAL_SYSTEM_PROMPT,
      user: buildRebuttalUserMessage(
        payload.scenario,
        payload.transcript,
        payload.question,
        payload.answer
      ),
      maxTokens: REBUTTAL_MAX_TOKENS,
      temperature: JUDGE_TEMPERATURE
    })
    const result = parseRebuttalResult(raw)
    res.status(200).json(result)
  } catch (err) {
    if (err instanceof LlmOutputError) {
      console.error('[rebuttal] unreadable model output:', err.message)
      res.status(502).json({
        error: 'The judge returned something unreadable. Try submitting again.'
      })
      return
    }
    console.error('[rebuttal] failed:', err)
    res.status(500).json({
      error: 'Could not reach the judge. Try submitting again in a moment.'
    })
  }
}
