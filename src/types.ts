// Shared response shapes for the two LLM calls.
//
// These are the single source of truth for the contract between the serverless
// validators (api/_lib/parse.ts) and the React UI. If you change a shape here,
// update the matching validator so malformed model output is still caught.

export interface Scenario {
  event: string
  cluster: string
  role: string // second person, e.g. "You are a shift manager at ..."
  situation: string // 2-4 sentences describing a concrete business problem
  judgeRole: string // the role the judge plays in the roleplay
  indicators: string[] // 4-5 performance indicators the run is judged on
}

export interface IndicatorScore {
  indicator: string
  score: number // 0-100
  justification: string // one sentence, grounded in what was actually said
  suggestion: string // one concrete improvement
}

export interface JudgeResult {
  scores: IndicatorScore[]
  overall: number // 0-100
  summary: string // 2-3 sentences
  /** The one probing question a real judge would ask next. Optional so older
   *  model output (without the field) still validates. */
  followUp?: string
}

// Request body sent from the browser to /api/judge.
export interface JudgeRequest {
  scenario: Scenario
  transcript: string
}

// Uniform error envelope returned by both serverless functions on failure.
export interface ApiErrorBody {
  error: string
}
