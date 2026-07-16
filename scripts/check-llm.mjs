// Quick connection test for your LLM setup — no app, no browser, no mic.
//   npm run check:llm
// It loads .env (via `node --env-file`) and makes one tiny call to Gemini's native
// API with your key, so you can confirm the key + model + endpoint work before
// running the full app. (This tester targets the default Gemini setup; if you
// switch to Groq/OpenRouter in config.ts, test with `vercel dev` instead.)

const apiKey = process.env.LLM_API_KEY
if (!apiKey) {
  console.error('✗ LLM_API_KEY is not set. Put it in .env (see .env.example).')
  process.exit(1)
}

const model = process.env.CHECK_MODEL ?? 'gemini-2.5-flash'
const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

try {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: 'Reply with this exact JSON object: {"ok": true}' }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: 50,
        thinkingConfig: { thinkingBudget: 0 }
      }
    })
  })

  if (!response.ok) {
    console.error(`✗ ${model} request failed: HTTP ${response.status}`)
    console.error((await response.text()).slice(0, 500))
    process.exit(1)
  }

  const data = await response.json()
  const text =
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  console.log(`✓ ${model} responded:`, text.trim() || '(empty)')
  console.log('Key + model + endpoint all work. Next: vercel dev')
} catch (err) {
  console.error('✗ Could not reach the Gemini API:', err.message)
  process.exit(1)
}
