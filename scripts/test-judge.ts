// A/B harness for tuning src/prompts/judge.ts.
//
//   npm run test:judge
//
// Runs the REAL judge (same JUDGE_SYSTEM_PROMPT, model, transport, and parser as
// production) against four answers to the same scenario, then prints each scorecard
// and a ranked summary.
//
// The four cases are chosen to expose the judge's failure modes:
//   STRONG          - specific, structured, addresses every indicator.
//   MIDDLE          - competent but general; touches indicators without depth.
//   WEAK            - vague, rambling, barely on-topic.
//   CONFIDENT-EMPTY - polished, confident delivery, ZERO substance. This is the
//                     inflation bait: a weak judge rewards the tone and scores it
//                     near STRONG. A good judge sees through it and scores it low.
//
// A healthy judge ranks them STRONG > MIDDLE > WEAK, with CONFIDENT-EMPTY down near
// WEAK. If CONFIDENT-EMPTY floats up near MIDDLE/STRONG, the prompt is rewarding
// confidence over evidence — tighten the RUBRIC in src/prompts/judge.ts and re-run.
//
// Everything below (scenario + transcripts) is yours to edit.

import { JUDGE_MAX_TOKENS, JUDGE_TEMPERATURE, MODEL_JUDGE } from '../api/_lib/config.js'
import { complete } from '../api/_lib/llm.js'
import { parseJudgeResult } from '../api/_lib/parse.js'
import { buildJudgeUserMessage, JUDGE_SYSTEM_PROMPT } from '../src/prompts/judge.js'
import type { Scenario } from '../src/types'

const scenario: Scenario = {
  event: 'Principles of Business Management and Administration',
  cluster: 'Business Management + Administration',
  role: 'You are the weekend shift lead at a 12-screen movie theater.',
  situation:
    'Concession sales (your highest-margin revenue) are down 15% over the last month, and two of your six concession staff just gave two weeks notice. Your general manager wants your plan to protect revenue and keep the stand fully staffed this weekend.',
  judgeRole: 'your general manager',
  indicators: [
    'Explain the nature of effective communication',
    'Demonstrate problem-solving skills',
    'Explain the role of staffing and scheduling in operations',
    'Describe the nature of customer service',
    'Demonstrate ethical decision-making'
  ]
}

// STRONG: greets the judge, restates the problem, gives a structured plan with
// specifics tied to each indicator, closes with follow-up.
const STRONG_TRANSCRIPT =
  "Good afternoon, thanks for making time. I looked at both problems together: the 15% concession drop and losing two of our six staff before the weekend. Here is my plan. First, staffing: I will cross-train two of our box-office team on the concession register today so we never drop below three people at the stand during peak showings, and I will post the two openings and fast-track staff referrals with a small signing bonus. Second, the revenue drop: our sales data shows it is concentrated in the six-to-nine p.m. rush, so I will schedule our two strongest sellers onto those shifts and run a combo upsell, a drink and popcorn refill for a dollar more, which lifts the average ticket without discounting our margin. Third, customer service: the drop lines up with longer wait times, so I will open the second register during rushes and pre-bag popcorn ten minutes before the big showings so the line moves. On ethics, I want the upsell to be honest, we suggest, we do not pressure, and I will build the schedule fairly so nobody is stuck with every closing shift. I will report back Monday with the weekend numbers and adjust from there. What questions can I answer?"

// MIDDLE: competent, on-topic, mentions the right areas, but stays general — no
// numbers, no specifics, no ethics angle.
const MIDDLE_TRANSCRIPT =
  "Hi, thanks for meeting. So our concession sales are down and we lost two staff. My plan is to get people trained and cover the shifts, and to encourage the team to upsell more so we bring revenue back up. I would move some people around so the busy times are covered, and remind everyone to give good customer service since that keeps people coming back. I would also start hiring to replace the two who left. I think if we keep the team motivated and focus on selling combos we can get the numbers back up. I will keep an eye on it over the next couple of weeks."

// WEAK: vague, rambling, generic, barely addresses the indicators.
const WEAK_TRANSCRIPT =
  "Yeah so, concessions are kind of down and some people quit which is bad. I think we should probably just sell more stuff, like tell people to buy popcorn and drinks and whatever. And we need to hire more people obviously. Customers like it when things are good so we should make it good. Money is really important for the business so making more money should be the goal. I will try some things and see what happens. That is pretty much my plan I guess."

// CONFIDENT-EMPTY: fluent, confident, buzzword-heavy, and completely hollow — no
// plan, no specifics, addresses none of the indicators. The inflation trap.
const CONFIDENT_EMPTY_TRANSCRIPT =
  "Thanks so much for the opportunity to present. I am really excited about this challenge, because I believe every problem is an opportunity in disguise. My approach centers on three pillars: people, performance, and passion. I am going to leverage synergies across the team, drive a culture of excellence, and think outside the box to move the needle on our KPIs. At the end of the day it is about execution and buy-in, and when everyone is rowing in the same direction the results take care of themselves. I am confident that with the right mindset and a relentless focus on our customers, we will not just hit our targets, we will exceed them. Let us make it happen."

interface CaseResult {
  label: string
  overall: number
}

const runOne = async (label: string, transcript: string): Promise<number> => {
  const raw = await complete({
    model: MODEL_JUDGE,
    system: JUDGE_SYSTEM_PROMPT,
    user: buildJudgeUserMessage(scenario, transcript),
    maxTokens: JUDGE_MAX_TOKENS,
    temperature: JUDGE_TEMPERATURE
  })
  const result = parseJudgeResult(raw)

  console.log(`\n=== ${label} — overall ${result.overall}/100 ===`)
  for (const score of result.scores) {
    console.log(`  ${String(score.score).padStart(3)}  ${score.indicator}`)
    console.log(`       ${score.justification}`)
  }
  console.log(`  summary: ${result.summary}`)
  return result.overall
}

const cases: Array<{ key: string; label: string; transcript: string }> = [
  { key: 'strong', label: 'STRONG (specific, structured)', transcript: STRONG_TRANSCRIPT },
  { key: 'middle', label: 'MIDDLE (competent but general)', transcript: MIDDLE_TRANSCRIPT },
  { key: 'weak', label: 'WEAK (vague, rambling)', transcript: WEAK_TRANSCRIPT },
  { key: 'empty', label: 'CONFIDENT-EMPTY (polished, no substance)', transcript: CONFIDENT_EMPTY_TRANSCRIPT }
]

const results: CaseResult[] = []
for (const testCase of cases) {
  const overall = await runOne(testCase.label, testCase.transcript)
  results.push({ label: testCase.label, overall })
}

const score = (key: string): number =>
  results[cases.findIndex((c) => c.key === key)]?.overall ?? 0

console.log('\n========== SUMMARY (high to low) ==========')
for (const result of [...results].sort((a, b) => b.overall - a.overall)) {
  console.log(`  ${String(result.overall).padStart(3)}  ${result.label}`)
}

console.log('\n---- discrimination checks ----')
const strongVsWeak = score('strong') - score('weak')
console.log(
  strongVsWeak >= 25
    ? `✓ STRONG beats WEAK by ${strongVsWeak}. Healthy spread.`
    : `✗ STRONG only beats WEAK by ${strongVsWeak}. Judge is compressing scores — tighten the RUBRIC.`
)
console.log(
  score('empty') < score('middle')
    ? `✓ CONFIDENT-EMPTY (${score('empty')}) scored below MIDDLE (${score('middle')}). The judge saw through the fluff.`
    : `✗ CONFIDENT-EMPTY (${score('empty')}) scored at/above MIDDLE (${score('middle')}). The judge is rewarding confidence over evidence — this is the inflation failure mode. Push harder on "cite evidence from the transcript" in src/prompts/judge.ts.`
)
