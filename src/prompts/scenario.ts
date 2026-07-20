// ---------------------------------------------------------------------------
// Scenario-generation prompt (editable).
//
// This is the prompt used by /api/generate-scenario to invent one DECA roleplay
// for a chosen event (src/lib/events.ts) at a chosen difficulty tier. Tune the
// wording freely — the only hard requirement is that the model returns STRICT
// JSON matching the `Scenario` shape in src/types.ts (the serverless handler
// validates it and returns a 502 on malformed output).
//
// NOTE ON PERFORMANCE INDICATORS: the `indicators` produced here are model-
// generated approximations written to *sound* like DECA performance indicators.
// Real DECA PIs come from DECA's published PI lists per event. If you want the
// trainer to grade against official PIs, replace the generated indicators with
// the real ones (either here in the prompt, or by post-processing the response).
// ---------------------------------------------------------------------------

import type { DecaEvent, DifficultySpec } from '../lib/events'

/**
 * Builds the scenario-author system prompt for a specific event + difficulty
 * tier. The event supplies the career area and format (solo vs. team roles);
 * the difficulty supplies the indicator count and complexity instruction;
 * `candidateIndicators` is a sampled slate of official-style PIs the model must
 * choose from VERBATIM (src/lib/indicators.ts) — it never invents its own.
 */
export const buildScenarioSystemPrompt = (
  event: DecaEvent,
  difficulty: DifficultySpec,
  candidateIndicators: string[]
): string => `You are a DECA event author. You write realistic roleplay scenarios for the "${event.name}" event, part of DECA's ${event.cluster} career cluster. The audience is high-school students.

Produce ONE scenario as STRICT JSON only. Output a single JSON object and nothing else — no prose, no explanation, no markdown code fences. The object must match exactly this shape:

{
  "event": string,        // "${event.name}"
  "cluster": string,      // "${event.cluster}"
  "role": string,         // second person, e.g. "You are a shift manager at a downtown coffee shop."
  "situation": string,    // 2-4 sentences describing a concrete business problem to solve
  "judgeRole": string,    // who the judge plays, e.g. "your district manager"
  "indicators": string[]  // exactly ${difficulty.indicators} short performance indicators the presentation is judged on
}

Rules:
- The role must be an entry-level position in this event's career area that a high-schooler can picture holding${
  event.format === 'team'
    ? '. This is a TEAM DECISION-MAKING event: write the role in second-person plural ("You and your partner are…") and make the problem big enough for two presenters'
    : ''
}.
- DIFFICULTY CALIBRATION (${difficulty.label} tier): ${difficulty.complexity}
- The situation must be decision-forcing — never a vague "grow the business" ask. Include concrete details (numbers, deadlines, named constraints) the student must actually address.
- Vary the industry, setting, and problem every time. Do not reuse the same setup.
- PERFORMANCE INDICATORS: choose exactly ${difficulty.indicators} from the OFFICIAL candidate list below — the ones a real judge could most plausibly grade against the situation you wrote. Copy each chosen indicator VERBATIM, character for character. Do NOT invent, reword, merge, or add indicators.
${candidateIndicators.map((pi) => `  - ${pi}`).join('\n')}
- Keep everything appropriate and realistic for high-school students.

Return ONLY the JSON object.`

/** The per-run ask that pairs with buildScenarioSystemPrompt. */
export const buildScenarioUserMessage = (event: DecaEvent): string =>
  `Write a fresh ${event.name} roleplay now. Make it distinct from a generic textbook example. Return only the JSON object.`

// ---------------------------------------------------------------------------
// Extraction prompt — used when the student uploads an OFFICIAL event PDF.
// The PDF's text arrives as sourceText; the job is to faithfully re-structure
// it into the Scenario shape, NOT to invent anything. In particular the
// performance indicators must be copied from the document verbatim — this is
// how the trainer grades against real DECA PIs instead of approximations.
// ---------------------------------------------------------------------------

export const SCENARIO_EXTRACT_SYSTEM_PROMPT = `You convert the raw extracted text of an official DECA roleplay event document into structured JSON for a rehearsal app. The text may contain page furniture (headers, footers, instructions to the judge, rubric tables) — ignore that noise and find the actual roleplay.

Produce ONE JSON object and nothing else — no prose, no markdown fences — matching exactly:

{
  "event": string,        // the event name as printed in the document
  "cluster": string,      // the career cluster as printed (or the closest stated grouping)
  "role": string,         // the participant's role, rewritten in second person ("You are ...")
  "situation": string,    // the situation/task exactly as the document describes it, condensed to 2-5 sentences, keeping every concrete number, name, and constraint
  "judgeRole": string,    // who the judge plays, as stated in the document
  "indicators": string[]  // the performance indicators listed in the document, copied VERBATIM, in order
}

Rules:
- Do NOT invent, add, or reword performance indicators. Copy the ones printed in the document exactly. If the document numbers them, drop the numbers but keep the wording.
- Preserve the document's specifics (figures, deadlines, product names) in "situation" — they are what the student must address.
- If the text is clearly not a DECA roleplay (no role, no situation, no performance indicators), return exactly: {"error": "not-a-roleplay"}

Return ONLY the JSON object.`

/** Wraps the uploaded document text for the extraction call. */
export const buildScenarioExtractUserMessage = (sourceText: string): string =>
  `Here is the extracted text of the official event PDF:\n"""\n${sourceText}\n"""\n\nStructure it as instructed. Return only the JSON object.`
