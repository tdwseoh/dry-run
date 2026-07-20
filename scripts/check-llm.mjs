// Quick connection test for your LLM setup — no app, no browser, no mic.
//   npm run check:llm
// It loads .env (via `node --env-file`) and reads the ACTIVE provider + models
// from api/_lib/config.ts, then makes one tiny call to that backend so you can
// confirm the key + model + endpoint work before running the full app. Works
// for both the native Gemini transport and any OpenAI-compatible one (Groq,
// OpenRouter, local). Override the model with CHECK_MODEL if you want.

import {
  GEMINI_BASE_URL,
  LLM_BASE_URL,
  LLM_PROVIDER,
  MODEL_JUDGE
} from '../api/_lib/config.js'

const apiKey = process.env.LLM_API_KEY
if (!apiKey) {
  console.error('✗ LLM_API_KEY is not set. Put it in .env (see .env.example).')
  process.exit(1)
}

const model = process.env.CHECK_MODEL ?? MODEL_JUDGE
const prompt = 'Reply with this exact JSON object and nothing else: {"ok": true}'

const checkGemini = async () => {
  const url = `${GEMINI_BASE_URL}/models/${model}:generateContent`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: 50,
        thinkingConfig: { thinkingBudget: 0 }
      }
    })
  })
  if (!response.ok) {
    return { ok: false, detail: `HTTP ${response.status}\n${(await response.text()).slice(0, 500)}` }
  }
  const data = await response.json()
  const text =
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  return { ok: true, text }
}

const checkOpenAiCompatible = async () => {
  const response = await fetch(`${LLM_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      max_tokens: 50,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }]
    })
  })
  if (!response.ok) {
    return { ok: false, detail: `HTTP ${response.status}\n${(await response.text()).slice(0, 500)}` }
  }
  const data = await response.json()
  return { ok: true, text: data?.choices?.[0]?.message?.content ?? '' }
}

try {
  const where = LLM_PROVIDER === 'gemini' ? 'Gemini (native)' : LLM_BASE_URL
  console.log(`Testing ${LLM_PROVIDER} → ${model} @ ${where}`)
  const result =
    LLM_PROVIDER === 'gemini' ? await checkGemini() : await checkOpenAiCompatible()
  if (!result.ok) {
    console.error(`✗ ${model} request failed: ${result.detail}`)
    process.exit(1)
  }
  console.log(`✓ ${model} responded:`, result.text.trim() || '(empty)')
  console.log('Key + model + endpoint all work. Next: vercel dev')
} catch (err) {
  console.error('✗ Could not reach the provider:', err.message)
  process.exit(1)
}
