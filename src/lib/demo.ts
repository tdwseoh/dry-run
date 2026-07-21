// Demo mode: one click seeds a believable sample season so a first-time
// visitor (or a hackathon judge) can explore the full competitor dashboard
// without running ten roleplays first. Clearly flagged, one click to erase,
// and it never mixes with real data — seeding overwrites, clearing removes.
//
// The same sample season feeds the landing's platform-showcase card, so the
// marketing page and the demo dashboard always agree.

import { clearArchive, replaceArchive, type ArchivedRun } from './archive'
import { clearHistory, replaceHistory, type RunRecord } from './history'
import {
  clearProfileAndLog,
  dayStamp,
  replaceLog,
  saveProfile,
  type CompetitorProfile,
  type LogEntry
} from './profile'
import { eventByCode } from './events'

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

/**
 * A handful of full archived runs so the training log and run-review are
 * populated in demo mode — built from the tail of the demo season with
 * plausible verdicts. Clearly demo content; erased on Clear demo.
 */
export const demoArchive = (): ArchivedRun[] => {
  const recent = demoLog().slice(-5).reverse() // newest first
  return recent.map((entry, i) => {
    const event = eventByCode(entry.event)
    const strong = entry.score >= 82
    return {
      id: `demo-${i}`,
      at: Date.now() - i * 86_400_000,
      eventCode: entry.event,
      eventName: event.name,
      difficulty: 'provincial' as const,
      fromPdf: false,
      overall: entry.score,
      scenario: {
        event: event.name,
        cluster: event.cluster,
        role: 'You are the assistant manager of a mid-sized retailer facing a same-week staffing and sales problem.',
        situation:
          'Two team members gave notice, weekend sales are down 12%, and the district manager wants a recovery plan that holds the labour budget.',
        judgeRole: 'your district manager',
        indicators: [
          'Explain the nature of effective communication',
          'Demonstrate problem-solving skills',
          'Describe the nature of budgets',
          'Explain the nature of positive customer relations',
          'Make oral presentations'
        ]
      },
      transcript:
        'Thank you for the time. My plan has three parts: cover the immediate shifts by cross-training two floor staff, protect the weekend rush with our strongest sellers scheduled to peak hours, and post the openings today while fast-tracking a referral. I would keep the labour budget flat by trimming mid-week overlap.',
      verdict: {
        scores: [
          { indicator: 'Explain the nature of effective communication', score: strong ? 88 : 62, justification: 'Opened with a clear, structured plan.', suggestion: 'Name the audience for each message.' },
          { indicator: 'Demonstrate problem-solving skills', score: strong ? 90 : 66, justification: 'Identified root causes and concrete actions.', suggestion: 'Add a fallback if referrals fall through.' },
          { indicator: 'Describe the nature of budgets', score: strong ? 84 : 58, justification: 'Committed to holding the labour budget flat.', suggestion: 'Show the dollar math behind the trim.' },
          { indicator: 'Explain the nature of positive customer relations', score: strong ? 80 : 55, justification: 'Linked staffing to the weekend rush.', suggestion: 'Tie coverage explicitly to wait times.' },
          { indicator: 'Make oral presentations', score: strong ? 86 : 60, justification: 'Confident, organized delivery.', suggestion: 'Vary pace on the key recommendation.' }
        ],
        overall: entry.score,
        summary: strong
          ? 'A specific, well-structured plan that held the budget and addressed the staffing crunch directly.'
          : 'A workable plan that stayed general; the biggest gap was quantitative detail.',
        strengths: strong
          ? ['Clear three-part structure', 'Held the labour budget', 'Concrete staffing actions']
          : ['Identified the core problem', 'Proposed a coverage plan'],
        improvements: strong
          ? ['Show the budget math', 'Add a referral fallback']
          : ['Add specific numbers', 'Explain the customer-service impact'],
        followUp: 'How would your plan change if the referral hire falls through this week?'
      },
      delivery: {
        words: 300 + i * 20,
        durationSeconds: entry.minutes * 60,
        wpm: 120 + i * 4,
        fillerTotal: entry.fillers,
        fillers: entry.fillers > 0 ? [{ phrase: 'um', count: entry.fillers }] : []
      },
      ...(entry.qna !== undefined ? { qnaScore: entry.qna } : {})
    }
  })
}

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
  replaceArchive(demoArchive())
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
  clearArchive()
  try {
    window.localStorage.removeItem(DEMO_FLAG_KEY)
  } catch {
    // Storage blocked.
  }
}
