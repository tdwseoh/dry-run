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
