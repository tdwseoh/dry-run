# Dry Run

Solo rehearsal for DECA roleplay events. Dry Run hands you a realistic business
scenario, runs a timed prep phase, lets you present out loud (captured by your
browser's speech-to-text), then scores your transcript against the event's
performance indicators using an LLM acting as a judge.

Built for high-school DECA members. Single user, no accounts, no database.

The whole thing is a small React client with **two LLM calls behind a thin
serverless proxy** — the proxy exists for exactly one reason: to keep the API key
off the browser.

> **No paid API key required.** Dry Run runs on a **free** provider. It ships
> configured for **Google Gemini** (free tier), and can switch to Groq, OpenRouter,
> or a local model by editing one config block.

---

## The flow

`home → prep → onair → verdict → (new take)`

1. **Home** — pick a format and start a run:
   - **Individual** — 10:00 prep, 10:00 on air (DECA individual-series timing).
   - **Team** — 30:00 prep, 15:00 on air (DECA team-decision-making timing).
   The app generates a scenario — **or upload the official event PDF** and
   rehearse the real roleplay, graded on its printed performance indicators.
   The PDF is read entirely in your browser (pdf.js, lazy-loaded); only its
   text is sent to the server for structuring.
2. **Prep** — read your role, the situation, and the performance indicators
   you'll be judged on. A STANDBY countdown ring depletes as you prep; skip the
   wait whenever you're ready. When prep expires an **alarm sounds** and you go
   on air automatically.
3. **On air** — the countdown and a pulsing ON AIR tally. Present out loud;
   your words stream into the transcript. End early whenever you're done (the
   alarm rings if the clock runs out first).
4. **Verdict** — the judge scores each performance indicator (score, one-line
   justification, one concrete fix) plus an overall score and summary.

### The coaching layer

Alongside the AI verdict, every take gets a locally computed delivery report and
a running record — no accounts, no server:

- **Live delivery HUD** — while you're on air, a live word count, words-per-minute
  read (with a pace verdict), and filler counter update as you speak, so you can
  correct course mid-take instead of finding out after.
- **Delivery stats** — time on air, word count, words-per-minute with a pace
  read (the healthy presenting band is roughly 120–160 wpm), and a filler-word
  count ("um", "you know", "kind of", …) computed from the transcript in
  `src/lib/delivery.ts`. Pure functions, unit-tested.
- **The judge's follow-up** — every verdict ends with the one probing question a
  real DECA judge would ask next, targeted at the weakest part of what you
  actually said. Answer it out loud — that's the Q&A rep.
- **Prep notes & the brief** — a scratchpad on the prep screen that stays visible
  while you present, plus the situation and indicators collapsible on the on-air
  screen, like the papers you carry into the real event. Don't like the draw?
  **Redraw the scenario** without leaving prep.
- **Run history** — your last 20 takes persist in `localStorage`
  (`src/lib/history.ts`). The landing page shows your recent scores and personal
  best, and each verdict tells you whether you beat your last take.
- **Read the tape** — the full transcript is reviewable (and copyable) under the
  scorecard with every detected filler highlighted in place, so you can see
  exactly what the judge saw.

---

## Providers & models

Everything provider-related lives in one file, `api/_lib/config.ts`. The app
supports two transports:

- **`gemini`** (default) — Google's **native** Gemini API, authenticated with
  `x-goog-api-key`. This is important: the newer Gemini keys (the ones that start
  with `AQ.` instead of `AIza`) are commonly rejected on Gemini's
  *OpenAI-compatible* endpoint, but work on the native API. Dry Run uses the native
  API so those keys just work.
- **`openai`** — any **OpenAI-compatible** endpoint via Bearer auth (Groq,
  OpenRouter, local Ollama/vLLM).

```ts
// api/_lib/config.ts
export const LLM_PROVIDER = 'gemini'                 // 'gemini' | 'openai'
export const MODEL_SCENARIO = 'gemini-2.5-flash-lite' // fast, cheap
export const MODEL_JUDGE   = 'gemini-2.5-flash'        // stronger judge
```

Presets for Groq / OpenRouter / local models are in that file's comment block.
Model IDs move around — if one is rejected, check the provider's models page
(Gemini: <https://ai.google.dev/gemini-api/docs/models>).

---

## Get a free API key

**Google Gemini (default, no credit card):**

1. Go to <https://aistudio.google.com/apikey> and create a key (a new `AQ.…` key is
   fine — the app uses the native endpoint that accepts it).
2. Put it in `.env` as `LLM_API_KEY=...` (see setup below).

> Heads-up: turning on **billing** for a Gemini project *disables* its free tier,
> so keep the project on the free plan while you're prototyping.

**Prefer Groq?** (fastest, also free, no card) Grab a key at
<https://console.groq.com>, then in `api/_lib/config.ts` set `LLM_PROVIDER = 'openai'`,
`LLM_BASE_URL = 'https://api.groq.com/openai/v1'`, and models
`llama-3.1-8b-instant` (scenario) / `llama-3.3-70b-versatile` (judge).

---

## Local setup

### Prerequisites

- Node 20.6+ and npm (Node 18+ runs the app; the `check:llm` helper uses
  `node --env-file`, which needs 20.6+)
- A free `LLM_API_KEY` (see above)
- The Vercel CLI: `npm i -g vercel`

### Steps

```bash
git clone <your-repo-url> dry-run
cd dry-run
npm install

cp .env.example .env        # then paste your key into .env
# .env should contain:  LLM_API_KEY=...

npm run check:llm           # optional: confirm your key + model work in one call
vercel dev                  # http://localhost:3000
```

> **Important:** run the app with **`vercel dev`**, not `vite`.
>
> `vite` alone serves the frontend but does **not** run the `/api/*` serverless
> functions, so scenario generation and judging will 404. `vercel dev` runs the
> SPA and the serverless routes together, which is what the browser expects.
>
> The first `vercel dev` will ask you to link the directory to a Vercel project —
> that's a one-time local link and is fine to accept.

### Handy scripts

```bash
npm run check:llm   # one tiny call to your provider — verifies key/model/endpoint
npm run typecheck   # tsc --noEmit across src/, api/, and tests/
npm test            # vitest — smoke tests for the serverless JSON handling
npm run build       # typecheck + production build to dist/
```

---

## Environment variables

| Variable      | Where it's read                   | Notes                                                        |
| ------------- | --------------------------------- | ----------------------------------------------------------- |
| `LLM_API_KEY` | server-side only, inside `/api/*` | Your provider key. Never prefix with `VITE_`. Never in `src/`. |

The key is read only in `api/_lib/llm.ts` via `process.env`. Nothing in `src/`
imports it, so it cannot land in the client bundle. Verify after a build:

```bash
npm run build
grep -r "LLM_API_KEY" dist/    # should print nothing
```

---

## Deploy to Vercel

1. Push this repo to GitHub/GitLab/Bitbucket.
2. In Vercel, **New Project → Import** the repo. Vercel auto-detects Vite
   (`vercel.json` also declares it), builds the SPA, and deploys `api/*.ts` as
   Node serverless functions — one deploy, no extra config.
3. Add the environment variable **`LLM_API_KEY`** in
   **Project → Settings → Environment Variables** (Production, and Preview if you
   want preview deploys to work).
4. Deploy. Opening the URL and clicking **Start a run** should complete a full
   scenario → prep → present → verdict cycle.

Or from the CLI: `vercel` for a preview, `vercel --prod` for production. Set the
env var first with `vercel env add LLM_API_KEY`.

---

## Browser support (speech-to-text)

Live speech-to-text uses the Web Speech API, which is **not** universally
supported:

- ✅ **Chrome (desktop)** and **Chrome (Android)** — fully supported, the target.
- ✅ Edge (desktop) — supported.
- ⚠️ **Safari / Firefox** — support is partial or absent.

Dry Run **degrades gracefully**: if the browser can't do speech recognition, or
if the user denies microphone access, the On-air screen swaps the live transcript
for a **typed textarea** so the flow never dead-ends. The verdict step treats the
typed text exactly like a spoken transcript.

---

## Project structure

```
dry-run/
├── api/                       # Vercel serverless functions (server-side only)
│   ├── _lib/                  # shared helpers ("_" folders are not routes)
│   │   ├── config.ts          # provider + model IDs (one place to switch)
│   │   ├── llm.ts             # transports (OpenAI-compat + native Gemini); ONLY reader of the key
│   │   └── parse.ts           # defensive JSON extraction + validation (pure, tested)
│   ├── generate-scenario.ts   # POST → a validated Scenario
│   └── judge.ts               # POST { scenario, transcript } → a validated JudgeResult
├── scripts/
│   └── check-llm.mjs          # `npm run check:llm` — one-call connection tester
├── src/
│   ├── components/            # Tally, Timecode
│   ├── lib/
│   │   ├── api.ts             # typed fetch wrappers for /api/*
│   │   └── speech.ts          # Web Speech API wrapper + fallback detection
│   ├── prompts/
│   │   ├── scenario.ts        # scenario-generation prompt (editable)
│   │   └── judge.ts           # THE JUDGE PROMPT — yours to iterate on
│   ├── types.ts               # Scenario, IndicatorScore, JudgeResult
│   ├── DryRun.tsx             # the phase state machine + all four screens
│   ├── App.tsx
│   └── main.tsx
├── tests/                     # vitest smoke tests (LLM call is mocked)
├── .env.example
└── vercel.json
```

---

## Two things left for you (on purpose)

1. **Tune `src/prompts/judge.ts`.** The plumbing is done; the prompt is the
   product. Feed it one obviously strong transcript and one obviously weak one — if
   the scores land close together, the prompt isn't discriminating yet. Tighten the
   RUBRIC band and the anti-inflation language until the gap is defensible. The
   known failure mode (and the fix) is documented at the top of that file.
2. **The performance indicators are model-generated approximations.** Real DECA
   PIs come from DECA's published lists per event. Swap them in (in
   `src/prompts/scenario.ts` or by post-processing the response) when you want the
   trainer graded against official indicators.
