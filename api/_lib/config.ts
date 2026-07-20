// LLM provider + model config. ONE place to switch providers.
//
// This app can talk to two kinds of endpoint:
//   - 'openai'  : any OpenAI-COMPATIBLE endpoint (Bearer auth). Groq, OpenRouter,
//                 local Ollama/vLLM. Uses the `openai` SDK.
//   - 'gemini'  : Google's NATIVE Gemini API (x-goog-api-key auth). Required for the
//                 new "AQ." Gemini keys, which are rejected on Gemini's
//                 OpenAI-compatible Bearer path.
//
// The key is read from process.env.LLM_API_KEY inside api/_lib/llm.ts (server only,
// never bundled into the client). Base URLs + model IDs are not secret, so they
// live here.
//
// ---- FREE PROVIDER PRESETS (pick one; set LLM_PROVIDER + the models) --------
//
// Google Gemini  — DEFAULT. Free key (incl. new "AQ." keys): aistudio.google.com/apikey
//   LLM_PROVIDER = 'gemini'
//   scenario: 'gemini-2.5-flash-lite'   judge: 'gemini-2.5-flash'
//   Current model IDs: https://ai.google.dev/gemini-api/docs/models
//   NOTE: enabling billing on the project disables the free tier entirely.
//
// Groq  — fastest, no credit card: console.groq.com -> API Keys
//   LLM_PROVIDER = 'openai'   LLM_BASE_URL = 'https://api.groq.com/openai/v1'
//   scenario: 'llama-3.1-8b-instant'    judge: 'llama-3.3-70b-versatile'
//
// OpenRouter  — openrouter.ai/keys. Free model IDs end in ':free' and rotate.
//   LLM_PROVIDER = 'openai'   LLM_BASE_URL = 'https://openrouter.ai/api/v1'
//   e.g. 'meta-llama/llama-3.3-70b-instruct:free'
//
// Local (free + unlimited; dev only — not reachable by the public Vercel deploy):
//   LLM_PROVIDER = 'openai'
//   Ollama:  LLM_BASE_URL='http://localhost:11434/v1'  (LLM_API_KEY can be 'ollama')
//   vLLM:    LLM_BASE_URL='http://localhost:8000/v1'
// ----------------------------------------------------------------------------

export type LlmProvider = 'openai' | 'gemini'

export const LLM_PROVIDER: LlmProvider = 'openai'

// Used when LLM_PROVIDER === 'openai' (OpenAI-compatible base URL). Groq's free
// tier: ~1k requests/day, no card — far more headroom for demos than Gemini's
// 20/day free cap. Key from console.groq.com.
export const LLM_BASE_URL = 'https://api.groq.com/openai/v1'

// Used when LLM_PROVIDER === 'gemini' (native API — note: no /openai suffix).
export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

// Groq models. The judge does the reasoning-heavy grading, so it gets the 70B;
// scenario generation only needs varied, well-formed JSON, so it gets the fast 8B.
export const MODEL_SCENARIO = 'llama-3.1-8b-instant'
export const MODEL_JUDGE = 'llama-3.3-70b-versatile' // stronger model for the graded verdict

// Ask for a raw JSON object. Both transports support this (json_object / responseMimeType)
// and it makes parsing more reliable. If a model rejects it, set false — the defensive
// parser in parse.ts still handles fenced / prose-wrapped JSON.
export const USE_JSON_MODE = true

export const SCENARIO_MAX_TOKENS = 1024
export const JUDGE_MAX_TOKENS = 2048
// The rebuttal verdict is one score + two short strings — a small budget keeps it fast.
export const REBUTTAL_MAX_TOKENS = 512

// Higher temperature => more varied scenarios. Lower => more consistent grading.
export const SCENARIO_TEMPERATURE = 1
export const JUDGE_TEMPERATURE = 0.3
