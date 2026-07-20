// Demo mode: one click seeds a believable sample season so a first-time
// visitor (or a hackathon judge) can explore the full competitor dashboard
// without running ten roleplays first. Clearly flagged, one click to erase,
// and it never mixes with real data — seeding overwrites, clearing removes.
//
// The same sample season feeds the landing's platform-showcase card, so the
// marketing page and the demo dashboard always agree.

import { clearHistory, replaceHistory, type RunRecord } from './history'
import {
  clearProfileAndLog,
  dayStamp,
  replaceLog,
  saveProfile,
  type CompetitorProfile,
  type LogEntry
} from './profile'

const DEMO_FLAG_KEY = 'dry-run-demo-v1'

const demoDay = (daysAgo: number): string =>
  dayStamp(new Date(Date.now() - daysAgo * 86_400_000))

export const DEMO_PROFILE: CompetitorProfile = {
  name: 'Avery Chen',
  school: 'Westmount SS',
  events: ['PMK', 'MTDM', 'PBM'],
  goal: 'icdc'
}

/**
 * A believable season: 16 takes over ~3 weeks, trending 58 → 93, fillers
 * falling as the reps add up, finishing on a 4-day streak.
 */
export const demoLog = (): LogEntry[] =>
  (
    [
      [24, 58, 9], [22, 61, 8], [21, 57, 9], [19, 66, 7], [17, 70, 6],
      [16, 68, 6], [14, 74, 5], [12, 77, 4], [10, 73, 5], [9, 81, 3],
      [7, 84, 3], [5, 80, 2], [3, 88, 1], [2, 86, 2], [1, 91, 0], [0, 93, 0]
    ] as Array<[number, number, number]>
  ).map(([daysAgo, score, fillers], i) => ({
    day: demoDay(daysAgo),
    event: (['PMK', 'PBM', 'MTDM'] as const)[i % 3] as string,
    score,
    minutes: 8 + (i % 4),
    fillers,
    ...(i % 5 === 4 ? { qna: 70 + i } : {})
  }))

/** Recent-takes strip matching the tail of the demo log. */
export const demoHistory = (): RunRecord[] =>
  demoLog()
    .slice(-8)
    .map((entry, i) => ({
      at: Date.now() - (7 - i) * 86_400_000,
      event: entry.event,
      overall: entry.score,
      words: 900 + i * 40,
      durationSeconds: entry.minutes * 60,
      wpm: 118 + i * 3
    }))
    .reverse()

export const isDemoActive = (): boolean => {
  try {
    return window.localStorage.getItem(DEMO_FLAG_KEY) === '1'
  } catch {
    return false
  }
}

/** Seed the sample season (overwrites profile, log, and history). */
export const seedDemo = (): void => {
  saveProfile(DEMO_PROFILE)
  replaceLog(demoLog())
  replaceHistory(demoHistory())
  try {
    window.localStorage.setItem(DEMO_FLAG_KEY, '1')
  } catch {
    // Storage blocked — session-only demo.
  }
}

/** Erase the demo season entirely (profile, log, history, flag). */
export const clearDemo = (): void => {
  clearProfileAndLog()
  clearHistory()
  try {
    window.localStorage.removeItem(DEMO_FLAG_KEY)
  } catch {
    // Storage blocked.
  }
}
