// LLM transport. This module is the ONLY place the API key is read, and it only runs
// inside serverless functions (nothing in src/ imports it, so the key can never reach
// the client bundle).
//
// Two transports, chosen by LLM_PROVIDER in config.ts:
//   - openai : OpenAI-compatible endpoint via the `openai` SDK (Groq, OpenRouter, local).
//   - gemini : Google's native API via fetch + x-goog-api-key (works with new "AQ." keys).
// Both expose the same `complete()` seam, so the handlers don't care which is active.

import OpenAI from 'openai'

import {
  GEMINI_BASE_URL,
  LLM_BASE_URL,
  LLM_PROVIDER,
  USE_JSON_MODE
} from './config.js'

export interface CompletionParams {
  model: string
  system: string
  user: string
  maxTokens: number
  temperature: number
}

/**
 * Read the provider key from the environment.
 *
 * @throws Error if LLM_API_KEY is absent (surfaces as a clean 5xx at call time
 *   rather than a crash at cold start, and keeps tests key-free).
 */
const getApiKey = (): string => {
  const apiKey = process.env.LLM_API_KEY
  if (!apiKey) {
    throw new Error('LLM_API_KEY is not set in the server environment')
  }
  return apiKey
}

// ---- OpenAI-compatible transport -----------------------------------------

let openaiClient: OpenAI | null = null

const getOpenAiClient = (): OpenAI => {
  if (openaiClient) return openaiClient
  openaiClient = new OpenAI({ apiKey: getApiKey(), baseURL: LLM_BASE_URL })
  return openaiClient
}

const openaiComplete = async (params: CompletionParams): Promise<string> => {
  const openai = getOpenAiClient()
  const responseFormat = USE_JSON_MODE
    ? ({ type: 'json_object' } as const)
    : ({ type: 'text' } as const)

  const response = await openai.chat.completions.create({
    model: params.model,
    max_tokens: params.maxTokens,
    temperature: params.temperature,
    response_format: responseFormat,
    messages: [
      { role: 'system', content: params.system },
      { role: 'user', content: params.user }
    ]
  })

  return response.choices[0]?.message.content ?? ''
}

// ---- Native Gemini transport ---------------------------------------------

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
}

const geminiComplete = async (params: CompletionParams): Promise<string> => {
  const url = `${GEMINI_BASE_URL}/models/${params.model}:generateContent`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // Native Gemini auth. The new "AQ." keys work here (unlike Bearer on the
      // OpenAI-compatible path).
      'x-goog-api-key': getApiKey()
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: params.system }] },
      contents: [{ role: 'user', parts: [{ text: params.user }] }],
      generationConfig: {
        temperature: params.temperature,
        maxOutputTokens: params.maxTokens,
        responseMimeType: USE_JSON_MODE ? 'application/json' : 'text/plain',
        // 2.5 models "think" by default, which can eat the output budget on a pure
        // JSON task. Turn it off for reliable, fast structured output.
        thinkingConfig: { thinkingBudget: 0 }
      }
    })
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Gemini API error ${response.status}: ${detail.slice(0, 300)}`)
  }

  const data = (await response.json()) as GeminiResponse
  return (
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('') ?? ''
  )
}

// ---- Public seam ----------------------------------------------------------

/**
 * Call the active provider and return its text content as a single string.
 *
 * On failure the thrown error is tagged with the active provider + base URL, so
 * a deployment's function logs make it obvious whether a bad key hit Groq or a
 * stale build is still calling Gemini — the exact ambiguity that bites when the
 * provider is switched but the env var or the build is out of sync.
 *
 * @throws Error on transport / API failures (the handler converts these to a 5xx
 *   so the browser can show an in-voice retry).
 */
export const complete = async (params: CompletionParams): Promise<string> => {
  try {
    return LLM_PROVIDER === 'gemini'
      ? await geminiComplete(params)
      : await openaiComplete(params)
  } catch (err) {
    const where =
      LLM_PROVIDER === 'gemini' ? 'gemini (native)' : `openai-compatible ${LLM_BASE_URL}`
    const detail = err instanceof Error ? err.message : String(err)
    throw new Error(`LLM call failed [provider=${LLM_PROVIDER}, ${where}, model=${params.model}]: ${detail}`)
  }
}
