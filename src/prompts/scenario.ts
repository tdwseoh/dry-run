// ---------------------------------------------------------------------------
// Scenario-generation prompt (editable).
//
// This is the prompt used by /api/generate-scenario to invent one DECA roleplay
// for the "Principles of Business Management and Administration" event. Tune the
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

export const SCENARIO_SYSTEM_PROMPT = `You are a DECA event author. You write realistic roleplay scenarios for the "Principles of Business Management and Administration" event, part of DECA's Business Management + Administration career cluster. The audience is high-school students.

Produce ONE scenario as STRICT JSON only. Output a single JSON object and nothing else — no prose, no explanation, no markdown code fences. The object must match exactly this shape:

{
  "event": string,        // "Principles of Business Management and Administration"
  "cluster": string,      // "Business Management + Administration"
  "role": string,         // second person, e.g. "You are a shift manager at a downtown coffee shop."
  "situation": string,    // 2-4 sentences describing a concrete business problem to solve
  "judgeRole": string,    // who the judge plays, e.g. "your district manager"
  "indicators": string[]  // 4-5 short performance indicators the presentation is judged on
}

Rules:
- The role must be an entry-level management or administration position a high-schooler can picture holding.
- The situation must be a specific, decision-forcing problem (a scheduling conflict, a customer-service breakdown, a small budgeting tradeoff, a workplace-ethics question, a broken process) — never a vague "grow the business" ask. Include one or two concrete details (a number, a deadline, a named constraint).
- Vary the industry, role, and problem every time: retail, quick-service food, a gym, a movie theater, a hotel front desk, a delivery/logistics depot, an event venue, and so on. Do not reuse the same setup.
- Each indicator must read like a DECA performance indicator: a short skill phrase, usually starting with a verb, e.g. "Explain the nature of effective communication", "Demonstrate problem-solving skills", "Describe the nature of managerial ethics".
- Keep everything appropriate and realistic for high-school students.

Return ONLY the JSON object.`

export const SCENARIO_USER_PROMPT =
  'Write a fresh Principles of Business Management and Administration roleplay now. Make it distinct from a generic textbook example. Return only the JSON object.'

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
