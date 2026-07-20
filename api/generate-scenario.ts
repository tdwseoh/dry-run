import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  DEFAULT_DIFFICULTY,
  DIFFICULTIES,
  eventByCode,
  isDifficulty
} from '../src/lib/events.js'
import { sampleIndicators } from '../src/lib/indicators.js'
import {
  buildScenarioExtractUserMessage,
  buildScenarioSystemPrompt,
  buildScenarioUserMessage,
  SCENARIO_EXTRACT_SYSTEM_PROMPT
} from '../src/prompts/scenario.js'
import type { Difficulty } from '../src/types'
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

interface ScenarioRequest {
  /** Extracted official-PDF text; when present the handler extracts, not invents. */
  sourceText: string | null
  /** Event code from src/lib/events.ts; unknown codes fall back to the default. */
  eventCode: string | undefined
  difficulty: Difficulty
}

/**
 * Optional request body: `{ sourceText }` (official PDF path) or
 * `{ event, difficulty }` (generated path). All fields optional; malformed
 * shapes throw SyntaxError → 400.
 */
const readRequest = (body: unknown): ScenarioRequest => {
  const empty: ScenarioRequest = {
    sourceText: null,
    eventCode: undefined,
    difficulty: DEFAULT_DIFFICULTY
  }
  if (body === undefined || body === null || body === '') return empty
  const parsed: unknown = typeof body === 'string' ? JSON.parse(body) : body
  if (!isRecord(parsed)) return empty

  let sourceText: string | null = null
  if (parsed.sourceText !== undefined) {
    if (typeof parsed.sourceText !== 'string') {
      throw new SyntaxError('sourceText must be a string')
    }
    sourceText = parsed.sourceText.trim() || null
    if (sourceText && sourceText.length > MAX_SOURCE_CHARS) {
      throw new SyntaxError('sourceText is too long')
    }
  }

  if (parsed.event !== undefined && typeof parsed.event !== 'string') {
    throw new SyntaxError('event must be a string code')
  }
  if (parsed.difficulty !== undefined && !isDifficulty(parsed.difficulty)) {
    throw new SyntaxError('difficulty must be regional | provincial | icdc')
  }

  return {
    sourceText,
    eventCode: parsed.event as string | undefined,
    difficulty: isDifficulty(parsed.difficulty) ? parsed.difficulty : DEFAULT_DIFFICULTY
  }
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

  let request: ScenarioRequest
  try {
    request = readRequest(req.body)
  } catch (err) {
    console.error('[generate-scenario] bad request body:', err)
    res.status(400).json({ error: 'The scenario request was malformed.' })
    return
  }

  const { sourceText } = request
  const event = eventByCode(request.eventCode)
  const tier = DIFFICULTIES[request.difficulty]

  try {
    const raw = await complete({
      model: MODEL_SCENARIO,
      system: sourceText
        ? SCENARIO_EXTRACT_SYSTEM_PROMPT
        : // Sampled slate of official-style PIs (a few spares beyond the tier's
          // count) the model must choose from verbatim.
          buildScenarioSystemPrompt(
            event,
            tier,
            sampleIndicators(event.cluster, tier.indicators + 4)
          ),
      user: sourceText
        ? buildScenarioExtractUserMessage(sourceText)
        : buildScenarioUserMessage(event),
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
