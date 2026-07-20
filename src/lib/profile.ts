// Competitor profile + persistent practice log.
//
// Two localStorage stores, same defensive-parse pattern as history.ts:
//   - dry-run-profile-v1 : who the competitor is (written by onboarding)
//   - dry-run-log-v1     : append-only, compact record of every scored run —
//     unlike history (capped at 20 for the recent-takes UI), the log keeps
//     everything, because streaks and totals must survive that cap.
//
// Everything below the storage section is a PURE derivation over LogEntry[]
// (streaks, XP/levels, readiness, achievements) — no fake numbers anywhere:
// every stat the UI shows is computed from runs that actually happened.
//
// FUTURE (Supabase): these two modules are the only ones that touch storage.
// Swapping localStorage for a synced backend means reimplementing load/save
// here behind the same signatures; components never touch storage directly.

export type Goal = 'provincials' | 'icdc' | 'communication' | 'consistency'

export interface CompetitorProfile {
  name: string
  school: string
  /** Event codes from src/lib/events.ts the competitor trains for. */
  events: string[]
  goal: Goal
}

export interface LogEntry {
  /** Local calendar day of the run, YYYY-MM-DD. */
  day: string
  /** Event code (or event title for official-PDF runs). */
  event: string
  /** Overall judge score, 0-100. */
  score: number
  /** Minutes on air (rounded up, min 1). */
  minutes: number
  /** Filler-word count from the delivery stats. */
  fillers: number
  /** Q&A rebuttal score, added if the student answered the follow-up. */
  qna?: number
}

const PROFILE_KEY = 'dry-run-profile-v1'
const LOG_KEY = 'dry-run-log-v1'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const GOALS: Goal[] = ['provincials', 'icdc', 'communication', 'consistency']

// ---- Profile store ---------------------------------------------------------

/** Pure parse of a stored profile; anything malformed degrades to null. */
export const parseProfile = (raw: string | null): CompetitorProfile | null => {
  if (!raw) return null
  try {
    const data: unknown = JSON.parse(raw)
    if (!isRecord(data)) return null
    const { name, school, events, goal } = data
    if (
      typeof name !== 'string' ||
      name.trim().length === 0 ||
      typeof school !== 'string' ||
      !Array.isArray(events) ||
      !events.every((e): e is string => typeof e === 'string') ||
      !GOALS.includes(goal as Goal)
    ) {
      return null
    }
    return { name: name.trim(), school: school.trim(), events, goal: goal as Goal }
  } catch {
    return null
  }
}

export const loadProfile = (): CompetitorProfile | null => {
  try {
    return parseProfile(window.localStorage.getItem(PROFILE_KEY))
  } catch {
    return null
  }
}

export const saveProfile = (profile: CompetitorProfile): void => {
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
  } catch {
    // Storage blocked — the in-memory profile still drives this session.
  }
}

// ---- Practice log store ----------------------------------------------------

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

const asLogEntry = (value: unknown): LogEntry | null => {
  if (!isRecord(value)) return null
  const { day, event, score, minutes, fillers, qna } = value
  if (
    typeof day !== 'string' ||
    !DAY_RE.test(day) ||
    typeof event !== 'string' ||
    !isFiniteNumber(score) ||
    !isFiniteNumber(minutes) ||
    !isFiniteNumber(fillers)
  ) {
    return null
  }
  const entry: LogEntry = { day, event, score, minutes, fillers }
  return isFiniteNumber(qna) ? { ...entry, qna } : entry
}

/** Pure parse of the stored log (chronological, oldest first). */
export const parseLog = (raw: string | null): LogEntry[] => {
  if (!raw) return []
  try {
    const data: unknown = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    return data
      .map(asLogEntry)
      .filter((entry): entry is LogEntry => entry !== null)
  } catch {
    return []
  }
}

export const loadLog = (): LogEntry[] => {
  try {
    return parseLog(window.localStorage.getItem(LOG_KEY))
  } catch {
    return []
  }
}

/** Append a run to the log and persist. Returns the updated log. */
export const appendLog = (entry: LogEntry): LogEntry[] => {
  const next = [...loadLog(), entry]
  try {
    window.localStorage.setItem(LOG_KEY, JSON.stringify(next))
  } catch {
    // Storage blocked — in-memory result still returned.
  }
  return next
}

/** Replace the whole log (used by demo seeding). Ignores storage failures. */
export const replaceLog = (entries: LogEntry[]): void => {
  try {
    window.localStorage.setItem(LOG_KEY, JSON.stringify(entries))
  } catch {
    // Storage blocked.
  }
}

/** Remove the stored profile and log (demo teardown). */
export const clearProfileAndLog = (): void => {
  try {
    window.localStorage.removeItem(PROFILE_KEY)
    window.localStorage.removeItem(LOG_KEY)
  } catch {
    // Storage blocked.
  }
}

/** Attach a Q&A score to the most recent log entry (the run just judged). */
export const attachQnaToLatest = (qna: number): LogEntry[] => {
  const log = loadLog()
  const latest = log[log.length - 1]
  if (!latest) return log
  const next = [...log.slice(0, -1), { ...latest, qna }]
  try {
    window.localStorage.setItem(LOG_KEY, JSON.stringify(next))
  } catch {
    // Storage blocked.
  }
  return next
}

/** Local calendar day of a Date as YYYY-MM-DD. */
export const dayStamp = (date: Date): string => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ---- Streaks ---------------------------------------------------------------

const previousDay = (stamp: string): string => {
  const [y, m, d] = stamp.split('-').map(Number)
  const date = new Date(y as number, (m as number) - 1, (d as number) - 1)
  return dayStamp(date)
}

/**
 * Consecutive practice days ending today or yesterday (a streak survives
 * until a full day is missed — practicing tonight keeps yesterday's alive).
 */
export const currentStreak = (log: LogEntry[], now: Date): number => {
  const days = new Set(log.map((entry) => entry.day))
  const today = dayStamp(now)
  let cursor = days.has(today) ? today : previousDay(today)
  if (!days.has(cursor)) return 0
  let streak = 0
  while (days.has(cursor)) {
    streak += 1
    cursor = previousDay(cursor)
  }
  return streak
}

/** The longest run of consecutive practice days anywhere in the log. */
export const longestStreak = (log: LogEntry[]): number => {
  const days = [...new Set(log.map((entry) => entry.day))].sort()
  let best = 0
  let current = 0
  let prev: string | null = null
  for (const day of days) {
    current = prev !== null && previousDay(day) === prev ? current + 1 : 1
    best = Math.max(best, current)
    prev = day
  }
  return best
}

// ---- Levels ----------------------------------------------------------------

export interface Level {
  name: string
  index: number
  /** XP still needed for the next level, or null at the top. */
  toNext: number | null
  /** 0-1 progress through the current band (1 at the top level). */
  progress: number
}

/** XP for one run: showing up earns 20, strong scores earn more. */
export const xpForEntry = (entry: LogEntry): number =>
  20 + (entry.score >= 90 ? 20 : entry.score >= 75 ? 10 : 0)

export const totalXp = (log: LogEntry[]): number =>
  log.reduce((sum, entry) => sum + xpForEntry(entry), 0)

// Thresholds are cumulative XP. ~10 solid runs to Competitor, ~30 to Elite,
// ~60 to ICDC Ready — a season of real practice, not an afternoon.
const LEVELS: Array<{ name: string; at: number }> = [
  { name: 'Rookie', at: 0 },
  { name: 'Competitor', at: 240 },
  { name: 'Elite Presenter', at: 800 },
  { name: 'ICDC Ready', at: 1600 }
]

export const levelFor = (xp: number): Level => {
  let index = 0
  for (let i = LEVELS.length - 1; i >= 0; i -= 1) {
    if (xp >= (LEVELS[i] as { at: number }).at) {
      index = i
      break
    }
  }
  const current = LEVELS[index] as { name: string; at: number }
  const next = LEVELS[index + 1]
  if (!next) return { name: current.name, index, toNext: null, progress: 1 }
  const span = next.at - current.at
  return {
    name: current.name,
    index,
    toNext: next.at - xp,
    progress: Math.min(1, Math.max(0, (xp - current.at) / span))
  }
}

// ---- Readiness -------------------------------------------------------------

/**
 * Competition readiness, 0-100. An honest blend, documented so nobody
 * mistakes it for magic:
 *   50% recent scoring level (average of the last 5 runs)
 *   20% trajectory (last run vs. the average of the 4 before it, ±10 → 0-20)
 *   20% consistency (current streak, capped at 10 days)
 *   10% volume (total runs, capped at 20)
 * Null until there is at least one scored run.
 */
export const readinessScore = (log: LogEntry[], now: Date): number | null => {
  if (log.length === 0) return null
  const scores = log.map((entry) => entry.score)
  const recent = scores.slice(-5)
  const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length

  let trajectory = 10 // neutral when there's no history to compare against
  if (scores.length >= 2) {
    const latest = scores[scores.length - 1] as number
    const prior = scores.slice(-5, -1)
    const priorAvg = prior.reduce((s, v) => s + v, 0) / prior.length
    trajectory = Math.min(20, Math.max(0, 10 + (latest - priorAvg)))
  }

  const consistency = (Math.min(currentStreak(log, now), 10) / 10) * 20
  const volume = (Math.min(log.length, 20) / 20) * 10

  return Math.round(recentAvg * 0.5 + trajectory + consistency + volume)
}

// ---- Achievements ----------------------------------------------------------

export interface Achievement {
  id: string
  emoji: string
  title: string
  detail: string
  /** Day earned (YYYY-MM-DD), or null while still locked. */
  earnedOn: string | null
}

interface AchievementRule {
  id: string
  emoji: string
  title: string
  detail: string
  /** The day the rule is first satisfied, given the chronological log. */
  earned: (log: LogEntry[]) => string | null
}

const nthDay = (log: LogEntry[], n: number): string | null =>
  log.length >= n ? (log[n - 1] as LogEntry).day : null

const firstWhere = (
  log: LogEntry[],
  test: (entry: LogEntry, i: number) => boolean
): string | null => {
  for (let i = 0; i < log.length; i += 1) {
    if (test(log[i] as LogEntry, i)) return (log[i] as LogEntry).day
  }
  return null
}

const RULES: AchievementRule[] = [
  {
    id: 'first-take',
    emoji: '🎬',
    title: 'First take',
    detail: 'Complete your first roleplay.',
    earned: (log) => nthDay(log, 1)
  },
  {
    id: 'five-takes',
    emoji: '🎯',
    title: 'Five on the board',
    detail: 'Complete 5 roleplays.',
    earned: (log) => nthDay(log, 5)
  },
  {
    id: 'twenty-five-takes',
    emoji: '🏋️',
    title: 'Training arc',
    detail: 'Complete 25 roleplays.',
    earned: (log) => nthDay(log, 25)
  },
  {
    id: 'seven-day-streak',
    emoji: '🔥',
    title: 'Seven straight',
    detail: 'Practice 7 days in a row.',
    earned: (log) => {
      // Earned on the 7th day of the first 7-day run of consecutive days.
      const days = [...new Set(log.map((e) => e.day))].sort()
      let run = 0
      let prev: string | null = null
      for (const day of days) {
        run = prev !== null && previousDay(day) === prev ? run + 1 : 1
        if (run >= 7) return day
        prev = day
      }
      return null
    }
  },
  {
    id: 'ninety-club',
    emoji: '🏆',
    title: 'The 90 club',
    detail: 'Score 90 or higher on a take.',
    earned: (log) => firstWhere(log, (e) => e.score >= 90)
  },
  {
    id: 'clean-take',
    emoji: '🎤',
    title: 'Clean take',
    detail: 'A scored take with zero filler words.',
    earned: (log) => firstWhere(log, (e) => e.fillers === 0 && e.score >= 50)
  },
  {
    id: 'comeback',
    emoji: '📈',
    title: 'The comeback',
    detail: 'Beat your previous take by 15+ points.',
    earned: (log) =>
      firstWhere(
        log,
        (e, i) => i > 0 && e.score - (log[i - 1] as LogEntry).score >= 15
      )
  },
  {
    id: 'event-explorer',
    emoji: '🧭',
    title: 'Event explorer',
    detail: 'Practice 3 different events.',
    earned: (log) => {
      const seen = new Set<string>()
      for (const entry of log) {
        seen.add(entry.event)
        if (seen.size >= 3) return entry.day
      }
      return null
    }
  },
  {
    id: 'under-pressure',
    emoji: '💬',
    title: 'Under pressure',
    detail: "Score 75+ on the judge's follow-up question.",
    earned: (log) => firstWhere(log, (e) => (e.qna ?? 0) >= 75)
  }
]

/** Every achievement with its earned/locked state, derived from the log. */
export const achievements = (log: LogEntry[]): Achievement[] =>
  RULES.map((rule) => ({
    id: rule.id,
    emoji: rule.emoji,
    title: rule.title,
    detail: rule.detail,
    earnedOn: rule.earned(log)
  }))

/** IDs earned in `after` that were not earned in `before` — the unlock moment. */
export const newlyEarned = (
  before: LogEntry[],
  after: LogEntry[]
): Achievement[] => {
  const earlier = new Set(
    achievements(before)
      .filter((a) => a.earnedOn !== null)
      .map((a) => a.id)
  )
  return achievements(after).filter(
    (a) => a.earnedOn !== null && !earlier.has(a.id)
  )
}

/** Per-event run counts and average scores, for the profile breakdown. */
export const perEventStats = (
  log: LogEntry[]
): Array<{ event: string; runs: number; average: number }> => {
  const byEvent = new Map<string, { runs: number; total: number }>()
  for (const entry of log) {
    const bucket = byEvent.get(entry.event) ?? { runs: 0, total: 0 }
    bucket.runs += 1
    bucket.total += entry.score
    byEvent.set(entry.event, bucket)
  }
  return [...byEvent.entries()]
    .map(([event, { runs, total }]) => ({
      event,
      runs,
      average: Math.round(total / runs)
    }))
    .sort((a, b) => b.runs - a.runs)
}

/** Time-of-day greeting for the dashboard voice. */
export const greetingFor = (hour: number): string =>
  hour < 5 ? 'Burning the midnight oil' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
