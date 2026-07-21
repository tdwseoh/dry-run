// Goal-driven progression + a daily training focus.
//
// Onboarding captures a Goal (Provincials / ICDC / communication /
// consistency); this turns it into a concrete, honest milestone track and a
// "what to drill today" nudge. Pure over the practice log — every milestone is
// something the competitor actually did, and the daily pick is deterministic
// per calendar day so it's stable but rotates.

import { DECA_EVENTS, DEFAULT_EVENT_CODE, DEFAULT_DIFFICULTY } from './events'
import {
  currentStreak,
  dayStamp,
  perEventStats,
  readinessScore,
  type Goal,
  type LogEntry
} from './profile'
import type { Difficulty } from '../types'

// ---- Goal milestone tracks -------------------------------------------------

export interface Milestone {
  id: string
  label: string
  done: (log: LogEntry[], now: Date) => boolean
}

export interface GoalTrack {
  label: string
  blurb: string
  milestones: Milestone[]
}

const runs = (log: LogEntry[]): number => log.length
const recentAvg = (log: LogEntry[], n = 5): number => {
  const tail = log.slice(-n)
  if (tail.length === 0) return 0
  return tail.reduce((s, e) => s + e.score, 0) / tail.length
}
const bestScore = (log: LogEntry[]): number =>
  log.reduce((b, e) => Math.max(b, e.score), 0)
const anyClean = (log: LogEntry[]): boolean =>
  log.some((e) => e.fillers === 0 && e.score >= 50)
const anyQnaAtLeast = (log: LogEntry[], n: number): boolean =>
  log.some((e) => (e.qna ?? 0) >= n)

export const GOAL_TRACKS: Record<Goal, GoalTrack> = {
  provincials: {
    label: 'Road to Provincials',
    blurb: 'Qualify out of regionals this season.',
    milestones: [
      { id: 'first', label: 'Run your first take', done: (l) => runs(l) >= 1 },
      { id: 'five', label: 'Complete 5 takes', done: (l) => runs(l) >= 5 },
      { id: 'avg70', label: 'Average 70+ across your last 5', done: (l) => recentAvg(l) >= 70 },
      { id: 'break80', label: 'Break 80 on a take', done: (l) => bestScore(l) >= 80 },
      { id: 'streak3', label: 'Hold a 3-day streak', done: (l, n) => currentStreak(l, n) >= 3 },
      { id: 'ready', label: 'Reach 70 readiness with 10+ takes', done: (l, n) => runs(l) >= 10 && (readinessScore(l, n) ?? 0) >= 70 }
    ]
  },
  icdc: {
    label: 'Road to ICDC',
    blurb: 'Train to international-final standard.',
    milestones: [
      { id: 'five', label: 'Complete 5 takes', done: (l) => runs(l) >= 5 },
      { id: 'break85', label: 'Break 85 on a take', done: (l) => bestScore(l) >= 85 },
      { id: 'qna', label: 'Score 75+ on a Q&A follow-up', done: (l) => anyQnaAtLeast(l, 75) },
      { id: 'avg80', label: 'Average 80+ across your last 5', done: (l) => recentAvg(l) >= 80 },
      { id: 'streak7', label: 'Hold a 7-day streak', done: (l, n) => currentStreak(l, n) >= 7 },
      { id: 'ready', label: 'Reach 85 readiness with 20+ takes', done: (l, n) => runs(l) >= 20 && (readinessScore(l, n) ?? 0) >= 85 }
    ]
  },
  communication: {
    label: 'Sharper communication',
    blurb: 'Speak with structure and control anywhere.',
    milestones: [
      { id: 'first', label: 'Run your first take', done: (l) => runs(l) >= 1 },
      { id: 'clean', label: 'Deliver a clean take (zero fillers)', done: (l) => anyClean(l) },
      { id: 'qna', label: 'Handle a Q&A follow-up (75+)', done: (l) => anyQnaAtLeast(l, 75) },
      { id: 'break80', label: 'Break 80 on a take', done: (l) => bestScore(l) >= 80 },
      { id: 'ten', label: 'Complete 10 takes', done: (l) => runs(l) >= 10 }
    ]
  },
  consistency: {
    label: 'Build the habit',
    blurb: 'A practice streak that survives the season.',
    milestones: [
      { id: 'first', label: 'Run your first take', done: (l) => runs(l) >= 1 },
      { id: 'streak3', label: 'Hold a 3-day streak', done: (l, n) => currentStreak(l, n) >= 3 },
      { id: 'streak7', label: 'Hold a 7-day streak', done: (l, n) => currentStreak(l, n) >= 7 },
      { id: 'streak14', label: 'Hold a 14-day streak', done: (l, n) => currentStreak(l, n) >= 14 },
      { id: 'twenty', label: 'Complete 20 takes', done: (l) => runs(l) >= 20 }
    ]
  }
}

export interface GoalProgress {
  label: string
  blurb: string
  steps: Array<{ id: string; label: string; done: boolean }>
  completed: number
  total: number
  pct: number
  /** The first not-yet-done milestone label, or null when the track is complete. */
  next: string | null
}

/** Evaluate a goal track against the practice log. */
export const goalProgress = (goal: Goal, log: LogEntry[], now: Date): GoalProgress => {
  const track = GOAL_TRACKS[goal]
  const steps = track.milestones.map((m) => ({
    id: m.id,
    label: m.label,
    done: m.done(log, now)
  }))
  const completed = steps.filter((s) => s.done).length
  const next = steps.find((s) => !s.done)?.label ?? null
  return {
    label: track.label,
    blurb: track.blurb,
    steps,
    completed,
    total: steps.length,
    pct: Math.round((completed / steps.length) * 100),
    next
  }
}

// ---- Daily focus -----------------------------------------------------------

export interface DailyFocus {
  eventCode: string
  difficulty: Difficulty
  reason: string
  /** True once a take has already been logged today. */
  doneToday: boolean
  /** Streak nudge line tuned to whether today's already done. */
  streakLine: string
}

/** Stable hash of a day stamp → non-negative int, so the pick rotates by day. */
const dayHash = (stamp: string): number => {
  let h = 0
  for (let i = 0; i < stamp.length; i += 1) h = (h * 31 + stamp.charCodeAt(i)) | 0
  return Math.abs(h)
}

/**
 * Today's recommended drill. Prefers an event the competitor trains but is
 * weakest at (2+ takes), then an event they picked at onboarding but haven't
 * trained, otherwise rotates deterministically by day. Difficulty steps up
 * with volume so the target grows with the competitor.
 */
export const dailyFocus = (
  events: string[],
  log: LogEntry[],
  now: Date
): DailyFocus => {
  const today = dayStamp(now)
  const doneToday = log.some((e) => e.day === today)
  const streak = currentStreak(log, now)

  const stats = perEventStats(log)
  const weakest = stats.filter((s) => s.runs >= 2).sort((a, b) => a.average - b.average)[0]
  const trained = new Set(log.map((e) => e.event))
  const untrained = events.filter((code) => !trained.has(code))

  let eventCode: string
  let reason: string
  if (weakest && dayHash(today) % 2 === 0) {
    eventCode = weakest.event
    reason = `Your weakest event — averaging ${weakest.average}. Close the gap.`
  } else if (untrained.length > 0) {
    eventCode = untrained[dayHash(today) % untrained.length] as string
    reason = "You picked this event but haven't drilled it yet."
  } else {
    const pool = events.length > 0 ? events : [DEFAULT_EVENT_CODE]
    eventCode = pool[dayHash(today) % pool.length] as string
    reason = 'Keep the rotation fresh — a different event today.'
  }
  // Confirm the code is real; fall back to default otherwise.
  if (!DECA_EVENTS.some((e) => e.code === eventCode)) eventCode = DEFAULT_EVENT_CODE

  const total = log.length
  const difficulty: Difficulty =
    total >= 20 ? 'icdc' : total >= 8 ? 'provincial' : DEFAULT_DIFFICULTY

  const streakLine = doneToday
    ? `Done for today — 🔥 ${streak}-day streak locked in.`
    : streak > 0
      ? `Practice today to keep your 🔥 ${streak}-day streak alive.`
      : 'One take today starts a new streak.'

  return { eventCode, difficulty, reason, doneToday, streakLine }
}
