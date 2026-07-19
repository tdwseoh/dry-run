// Run history — localStorage-backed record of past takes.
//
// No accounts, no database: history lives in the browser, capped at the most
// recent MAX_RUNS. The (de)serialization is a pure function (parseHistory) so the
// defensive parsing is unit-testable without mocking storage, and every storage
// touch is wrapped in try/catch — private-mode Safari throwing on setItem must
// never take down a run.

export interface RunRecord {
  /** Epoch milliseconds when the verdict landed. */
  at: number
  /** Event title of the scenario, e.g. "Principles of Business Management…". */
  event: string
  /** Overall judge score, 0-100. */
  overall: number
  /** Words spoken. */
  words: number
  /** Seconds on air. */
  durationSeconds: number
  /** Words per minute. */
  wpm: number
}

const STORAGE_KEY = 'dry-run-history-v1'
const MAX_RUNS = 20

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

/** Validate one stored entry; anything malformed is dropped, not repaired. */
const asRunRecord = (value: unknown): RunRecord | null => {
  if (!isRecord(value)) return null
  const { at, event, overall, words, durationSeconds, wpm } = value
  if (
    !isFiniteNumber(at) ||
    typeof event !== 'string' ||
    !isFiniteNumber(overall) ||
    !isFiniteNumber(words) ||
    !isFiniteNumber(durationSeconds) ||
    !isFiniteNumber(wpm)
  ) {
    return null
  }
  return { at, event, overall, words, durationSeconds, wpm }
}

/**
 * Parse a raw JSON string into a clean history array. Pure — this is the tested
 * surface. Malformed JSON, non-arrays, and bad entries all degrade to [] or a
 * filtered list rather than throwing.
 */
export const parseHistory = (raw: string | null): RunRecord[] => {
  if (!raw) return []
  try {
    const data: unknown = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    return data
      .map(asRunRecord)
      .filter((entry): entry is RunRecord => entry !== null)
      .slice(0, MAX_RUNS)
  } catch {
    return []
  }
}

/** Load history, newest first. Safe to call anywhere; returns [] on any failure. */
export const loadHistory = (): RunRecord[] => {
  try {
    return parseHistory(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    return []
  }
}

/**
 * Prepend a run and persist, keeping the newest MAX_RUNS.
 *
 * @returns the updated history (even if persisting failed — the UI can still
 *   show this session's runs).
 */
export const saveRun = (run: RunRecord): RunRecord[] => {
  const next = [run, ...loadHistory()].slice(0, MAX_RUNS)
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Storage full or blocked — in-memory result still returned.
  }
  return next
}

/** Highest overall in a history list, or null when empty. */
export const personalBest = (history: RunRecord[]): number | null =>
  history.length === 0
    ? null
    : history.reduce((best, run) => Math.max(best, run.overall), 0)
