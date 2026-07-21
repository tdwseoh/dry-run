// The training archive: every scored run kept in FULL — scenario, transcript,
// the complete judge verdict, delivery stats, and the Q&A score if answered.
//
// history.ts keeps a tiny record for streaks/sparklines; this keeps everything
// so a past take can be reopened and re-read like the day you ran it. Same
// defensive-parse + storage-guard pattern as the other stores, capped at the
// most recent RUNS so localStorage never grows without bound.
//
// FUTURE (Supabase): like history/profile, this module is the only thing that
// touches its store — swap the load/save internals and nothing else changes.

import type { DeliveryStats } from './delivery'
import type { Difficulty, JudgeResult, Scenario } from '../types'

export interface ArchivedRun {
  /** Stable unique id (also the review deep-link key). */
  id: string
  /** Epoch milliseconds when the verdict landed. */
  at: number
  /** Event code (e.g. "PBM"); empty string for official-PDF runs. */
  eventCode: string
  /** Printed event name from the scenario. */
  eventName: string
  difficulty: Difficulty
  fromPdf: boolean
  /** Overall judge score, mirrored to the top level for cheap list rendering. */
  overall: number
  scenario: Scenario
  transcript: string
  verdict: JudgeResult
  delivery: DeliveryStats | null
  /** Q&A rebuttal score, if the student answered the follow-up. */
  qnaScore?: number
}

const STORAGE_KEY = 'dry-run-archive-v1'
const MAX_RUNS = 50

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

/**
 * Validate one stored entry. This is our own data, so nested shapes (verdict,
 * scenario) are trusted once the load-bearing top-level fields are present;
 * anything missing those is dropped rather than repaired.
 */
const asArchivedRun = (value: unknown): ArchivedRun | null => {
  if (!isRecord(value)) return null
  const { id, at, eventName, difficulty, overall, scenario, verdict, transcript } = value
  if (
    typeof id !== 'string' ||
    !isFiniteNumber(at) ||
    typeof eventName !== 'string' ||
    typeof difficulty !== 'string' ||
    !isFiniteNumber(overall) ||
    !isRecord(scenario) ||
    !isRecord(verdict) ||
    !Array.isArray((verdict as { scores?: unknown }).scores) ||
    typeof transcript !== 'string'
  ) {
    return null
  }
  return {
    id,
    at,
    eventCode: typeof value.eventCode === 'string' ? value.eventCode : '',
    eventName,
    difficulty: difficulty as Difficulty,
    fromPdf: value.fromPdf === true,
    overall,
    scenario: scenario as unknown as Scenario,
    transcript,
    verdict: verdict as unknown as JudgeResult,
    delivery: isRecord(value.delivery) ? (value.delivery as unknown as DeliveryStats) : null,
    ...(isFiniteNumber(value.qnaScore) ? { qnaScore: value.qnaScore } : {})
  }
}

/** Pure parse of the raw JSON string (newest first). Tested surface. */
export const parseArchive = (raw: string | null): ArchivedRun[] => {
  if (!raw) return []
  try {
    const data: unknown = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    return data
      .map(asArchivedRun)
      .filter((entry): entry is ArchivedRun => entry !== null)
      .slice(0, MAX_RUNS)
  } catch {
    return []
  }
}

export const loadArchive = (): ArchivedRun[] => {
  try {
    return parseArchive(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    return []
  }
}

/** Prepend a run and persist, keeping the newest MAX_RUNS. Returns the new list. */
export const saveArchivedRun = (run: ArchivedRun): ArchivedRun[] => {
  const next = [run, ...loadArchive()].slice(0, MAX_RUNS)
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Storage full or blocked — in-memory result still returned.
  }
  return next
}

/** Attach a Q&A score to the most recent archived run (the one just judged). */
export const attachQnaToArchive = (qnaScore: number): ArchivedRun[] => {
  const archive = loadArchive()
  const latest = archive[0]
  if (!latest) return archive
  const next = [{ ...latest, qnaScore }, ...archive.slice(1)]
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Storage blocked.
  }
  return next
}

export const getArchivedRun = (id: string): ArchivedRun | undefined =>
  loadArchive().find((run) => run.id === id)

/** Replace the whole archive (demo seeding). */
export const replaceArchive = (runs: ArchivedRun[]): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(runs.slice(0, MAX_RUNS)))
  } catch {
    // Storage blocked.
  }
}

/** Remove the archive entirely (demo teardown). */
export const clearArchive = (): void => {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage blocked.
  }
}

/** A short, stable id for a new run. */
export const newRunId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
