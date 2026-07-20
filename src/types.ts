// Shared response shapes for the two LLM calls.
//
// These are the single source of truth for the contract between the serverless
// validators (api/_lib/parse.ts) and the React UI. If you change a shape here,
// update the matching validator so malformed model output is still caught.

// Which DECA format the run follows. Individual events give 10:00 prep and
// 10:00 on air; team decision-making events give 30:00 prep and 15:00 on air.
export type RunMode = 'solo' | 'team'

// Competition tier the run simulates. Drives scenario complexity, how many
// performance indicators are generated, and the judge's calibration line.
export type Difficulty = 'regional' | 'provincial' | 'icdc'

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
  /** 2-3 short phrases naming what actually worked. Optional + tolerant, like followUp. */
  strengths?: string[]
  /** 2-3 short phrases: the highest-leverage concrete changes. Optional + tolerant. */
  improvements?: string[]
  /** The one probing question a real judge would ask next. Optional so older
   *  model output (without the field) still validates. */
  followUp?: string
}

// Request body sent from the browser to /api/judge.
export interface JudgeRequest {
  scenario: Scenario
  transcript: string
  /** Competition tier for judge calibration; omitted for PDF runs started before selection existed. */
  difficulty?: Difficulty
}

// The judge's verdict on the student's answer to the follow-up question.
export interface RebuttalResult {
  score: number // 0-100
  verdict: string // 2-3 sentences on how well the answer held up
  tip: string // one concrete improvement for the answer
}

// Request body sent from the browser to /api/rebuttal.
export interface RebuttalRequest {
  scenario: Scenario
  transcript: string // the original presentation, for context
  question: string // the follow-up the judge asked
  answer: string // what the student said back
}

// Uniform error envelope returned by both serverless functions on failure.
export interface ApiErrorBody {
  error: string
}
