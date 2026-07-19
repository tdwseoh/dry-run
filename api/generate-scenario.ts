import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  buildScenarioExtractUserMessage,
  SCENARIO_EXTRACT_SYSTEM_PROMPT,
  SCENARIO_SYSTEM_PROMPT,
  SCENARIO_USER_PROMPT
} from '../src/prompts/scenario.js'
import {
  MODEL_SCENARIO,
  SCENARIO_MAX_TOKENS,
  SCENARIO_TEMPERATURE
} from './_lib/config.js'
import { complete } from './_lib/llm.js'
import {
  asScenario,
  isRecord,
  LlmOutputError,
  parseJson
} from './_lib/parse.js'

// Longest document text we'll forward to the model (roleplays are 2-4 pages).
const MAX_SOURCE_CHARS = 24_000

/**
 * Optional request body: `{ sourceText }` carries the extracted text of an
 * official event PDF; when present the handler extracts instead of inventing.
 * Returns null for absent/empty, throws SyntaxError when malformed.
 */
const readSourceText = (body: unknown): string | null => {
  if (body === undefined || body === null || body === '') return null
  const parsed: unknown = typeof body === 'string' ? JSON.parse(body) : body
  if (!isRecord(parsed) || parsed.sourceText === undefined) return null
  if (typeof parsed.sourceText !== 'string') {
    throw new SyntaxError('sourceText must be a string')
  }
  const text = parsed.sourceText.trim()
  if (!text) return null
  if (text.length > MAX_SOURCE_CHARS) {
    throw new SyntaxError('sourceText is too long')
  }
  return text
}

// Proxies scenario generation to the LLM. Exists for one reason: to read the API
// key (LLM_API_KEY) server-side so it never reaches the client bundle.
//
// NOTE: the `indicators` produced here are model-generated approximations of DECA
// performance indicators. Real PIs come from DECA's published lists — swap them in
// (here or in src/prompts/scenario.ts) if you want official indicators.
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  let sourceText: string | null
  try {
    sourceText = readSourceText(req.body)
  } catch (err) {
    console.error('[generate-scenario] bad request body:', err)
    res.status(400).json({ error: 'The uploaded document could not be used.' })
    return
  }

  try {
    const raw = await complete({
      model: MODEL_SCENARIO,
      system: sourceText ? SCENARIO_EXTRACT_SYSTEM_PROMPT : SCENARIO_SYSTEM_PROMPT,
      user: sourceText
        ? buildScenarioExtractUserMessage(sourceText)
        : SCENARIO_USER_PROMPT,
      maxTokens: SCENARIO_MAX_TOKENS,
      // Extraction should be faithful, not creative.
      temperature: sourceText ? 0.2 : SCENARIO_TEMPERATURE
    })
    const parsed = parseJson(raw)
    // The extraction prompt returns {"error":"not-a-roleplay"} for non-roleplay
    // documents — surface that as a clear 400, not a mysterious 502.
    if (sourceText && isRecord(parsed) && typeof parsed.error === 'string') {
      res.status(400).json({
        error:
          "That PDF doesn't look like a DECA roleplay — no role, situation, or performance indicators found."
      })
      return
    }
    const scenario = asScenario(parsed)
    res.status(200).json(scenario)
  } catch (err) {
    // Malformed model output is expected occasionally: 502 so the client retries.
    if (err instanceof LlmOutputError) {
      console.error('[generate-scenario] unreadable model output:', err.message)
      res.status(502).json({
        error: 'The scenario generator returned something unreadable. Try again.'
      })
      return
    }
    // Anything else (missing key, network, API error) is a server-side 500.
    console.error('[generate-scenario] failed:', err)
    res.status(500).json({
      error: 'Could not reach the scenario generator. Try again in a moment.'
    })
  }
}
