# Judge calibration — live output

Every result below came from the real pipeline (`/api/generate-scenario` →
`/api/judge` → `/api/rebuttal`) on 2026-07-20 — not from fixtures. It is the
evidence that the judge discriminates instead of handing out participation
scores.

The scores below were captured on **`gemini-2.5-flash`**. The app has since
switched to **Groq** (`llama-3.3-70b-versatile` judge) for its far larger free
tier; the spread holds and is if anything *stricter* — see "Provider swap"
at the bottom.

## The scenario (generated, HTDM @ ICDC tier)

> **Hospitality Services Team Decision Making** — Hospitality + Tourism
>
> You and your partner are the Co-Directors of Guest Experiences at "The Summit Retreat," a newly opened boutique hotel nestled in a popular mountain resort town. Your hotel prides itself on personalized service and eco-friendly practices.
>
> It's peak season, and your occupancy rates are at 95%. However, a critical review was just posted online by a high-profile travel influencer, citing slow check-in times (averaging 25 minutes due to a new digital key system glitch), a lack of hot water on their floor for an hour one morning, and a perceived impersonal response from a front-desk agent. This review is already impacting your booking engine's conversion rate, which has dropped 10% in the last 24 hours. Your general manager needs a comprehensive plan outlining immediate corrective actions for the influencer's specific complaints, a strategy to prevent recurrence, and a public relations response to mitigate further damage, all while staying within your allocated emergency budget of $5,000 for guest recovery and system fixes for the remainder of the quarter.

**Performance indicators (7 — ICDC tier, chosen verbatim from the
official-style bank in `src/lib/indicators.ts`):**

- Describe the nature of quality-service standards in hospitality
- Describe strategies for managing guest complaints
- Explain the nature of effective communication
- Describe the nature of budgets
- Explain the nature of positive customer relations
- Demonstrate problem-solving skills
- Make oral presentations

## Three transcripts, same scenario, same rubric

| Transcript | Overall |
| --- | --- |
| **Strong** — three-part plan, costed against the $5,000 budget, addresses every named complaint | **85** |
| **Off-topic** — well structured and confident, but solves a *different* problem | **50** |
| **Weak** — vague filler, business buzzwords, no specifics | **25** |

A 60-point spread between a real answer and a confident-sounding empty one is
the whole product.

### Strong

- **Overall: 85/100** — per-indicator: 85, 90, 75, 95, 80, 90, 70
- Strengths: Clear three-part structure (fix, prevention, public response); Detailed cost breakdown and budget adherence; Specific, actionable solutions for each complaint; Identified vendor breach for digital key fix
- Improvements: Elaborate on the 'why' behind quality service standards and customer relations; Add more nuance to communication strategies (tone, specific language); Vary vocal delivery for greater impact

> Judge's follow-up: *"You mentioned empowering agents to comp up to $100 without a manager. How would you ensure this authority is used consistently and appropriately across your front desk team, and what training would support that?"*

### Off-topic (structured, confident, wrong problem)

- **Overall: 50/100** — per-indicator: 30, 55, 25, 65, 60, 50, 60
- Strengths: Structured presentation with 'three parts'; Awareness of budget and financial trade-offs (e.g., 'eight hundred dollars tonight than a corporate account'); Consideration of long-term relationships
- Improvements: Address the influencer's specific complaints (check-in, hot water, front desk) directly.; Develop a clear public relations strategy for the online review.; Explain how proposed solutions fit within the $5,000 emergency budget.

> Judge's follow-up: *"Your plan focuses on double-booked rooms and conference guests, but the influencer's review specifically mentioned slow check-in due to a digital key glitch, a lack of hot water, and an impersonal front desk agent. How would your plan directly address these specific issues?"*

The judge noticed the mismatch unprompted — it scored budget awareness and
structure fairly while refusing credit for the indicators the answer never
touched.

### Weak

- **Overall: 25/100** — per-indicator: 30, 20, 45, 10, 35, 25, 30
- Strengths: *(none returned — the rubric forbids inventing praise)*
- Improvements: Address each specific complaint from the influencer with a concrete solution.; Develop a structured plan for immediate actions, prevention, and public relations.; Incorporate the $5,000 emergency budget into the proposed solutions.

## The Q&A round

Answering the follow-up evasively — pivoting back to the original talking
points instead of engaging the question — scored **25/100**:

> Your answer completely pivoted away from the specific issues I asked about – slow check-in, hot water, and an impersonal agent. Instead, you focused on double-booked rooms and partner property capacity, which were not part of my question or the influencer's specific complaints. This shows a lack of engagement with the actual follow-up.
>
> **Fix:** Directly address the specific issues raised in the question, rather than reverting to points from your initial presentation or unrelated concerns.

## Notes

- Per-indicator scores spread (70–95 on the strong take) rather than
  clustering on one number, which is what the rubric's anti-inflation language
  is for.
- The weak transcript returned **zero** strengths. The prompt forbids inventing
  praise when the transcript offers no evidence, and the parser treats an empty
  list as absent.
- Indicator text is normalised in `api/_lib/parse.ts`: live output revealed the
  model echoing the prompt's list numbering ("1. Describe the nature of…"), so
  the parser strips it while leaving genuine leading digits ("30-day retention
  planning") intact.

## The standing A/B harness

`npm run test:judge` replays three fixed transcripts for one generated scenario
against the live model. Run on 2026-07-20, after every prompt change in this
redesign:

| Fixture | Overall |
| --- | --- |
| Strong — specific, structured | **88** |
| Middle — competent but general | **55** |
| Weak — vague, rambling | **25** |

A healthy result is a wide, monotonic spread. If the three land close together
the rubric has stopped discriminating and needs tightening — that check is the
reason the harness exists.

Reproduce everything here with `npm run test:judge`, or by running the app and
presenting a deliberately vague take.

## Provider swap — same discrimination on Groq

On 2026-07-20 the app moved from Gemini to Groq (`llama-3.3-70b-versatile`
judge, `llama-3.1-8b-instant` scenarios) for the larger free tier. A fresh live
A/B on a generated Provincial **Principles of Marketing** scenario:

| Transcript | Overall | Per-indicator |
| --- | --- | --- |
| Strong — full 4-P plan, costed to the $20k goal, honest scarcity | **50** | 70, 20, 40, 60, 30 |
| Middle — general "promote more, do bundles" | **35** | 40, 20, 10, 30, 50 |
| Weak — vague filler | **10** | 20, 0, 0, 10, 0 |

Monotonic and wide, weak take earns zero strengths — the same shape as Gemini.
The 70B Llama judge is notably **stricter** at the top: it refused to credit
"Explain the concept of management" and "Explain the nature of effective
communication" for an answer that delivered strong *tactics* but never
*explained the concepts* those PIs name — which is exactly how a real DECA
judge reads them. Strictness that's grounded in the indicator wording is the
feature, not a regression.
