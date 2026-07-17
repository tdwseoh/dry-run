import type { VercelRequest, VercelResponse } from '@vercel/node'

import { SCENARIO_SYSTEM_PROMPT, SCENARIO_USER_PROMPT } from '../src/prompts/scenario.js'
import {
  MODEL_SCENARIO,
  SCENARIO_MAX_TOKENS,
  SCENARIO_TEMPERATURE
} from './_lib/config.js'
import { complete } from './_lib/llm.js'
import { LlmOutputError, parseScenario } from './_lib/parse.js'

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

  try {
    const raw = await complete({
      model: MODEL_SCENARIO,
      system: SCENARIO_SYSTEM_PROMPT,
      user: SCENARIO_USER_PROMPT,
      maxTokens: SCENARIO_MAX_TOKENS,
      temperature: SCENARIO_TEMPERATURE
    })
    const scenario = parseScenario(raw)
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
