import { useEffect, useRef, useState, type ReactNode } from 'react'

import { personalBest, type RunRecord } from '../lib/history'
import {
  dayStamp,
  greetingFor,
  type CompetitorProfile,
  type LogEntry
} from '../lib/profile'
import { CompetitorCard } from './CompetitorCard'
import { Counters } from './Counters'
import { Reveal } from './Reveal'
import { ScrollFilm } from './ScrollFilm'
import { Tally } from './Tally'
import { Timecode } from './Timecode'

// The scroll landing shown at phase === 'home'. The film hero scrubs the tally
// sequence; below it, scroll-in reveals and a pinned sequence walk the visitor
// through a run. Starting a run now goes through the setup screen (event +
// tier + PDF upload live there) — the landing's job is the story.

interface LandingProps {
  /** Open the run-setup screen (event picker, tier, PDF upload). */
  onStartPracticing: () => void
  /** Past takes (newest first) — renders the recent-takes strip when non-empty. */
  history: RunRecord[]
  /** Competitor identity, once created — turns the hero into a greeting. */
  profile: CompetitorProfile | null
  /** Current practice streak in days (0 when none). */
  streakDays: number
  /** Open the create-profile onboarding (final CTA for new visitors). */
  onCreateProfile: () => void
}

/** Score → the same mint/amber/red encoding used everywhere else. */
const chipColor = (score: number): string =>
  score >= 75 ? 'var(--mint)' : score >= 50 ? 'var(--amber)' : 'var(--red)'

// ---------------------------------------------------------------------------
// SHOWCASE DATA — marketing sections only. The competitor card below renders
// the REAL CompetitorCard component fed with this sample season (so the
// showcase is the product, not a mockup); the leaderboard and stories are
// demo content until a backend exists.
// ---------------------------------------------------------------------------

const demoDay = (daysAgo: number): string =>
  dayStamp(new Date(Date.now() - daysAgo * 86_400_000))

const SHOWCASE_PROFILE: CompetitorProfile = {
  name: 'Avery Chen',
  school: 'Westmount SS',
  events: ['PMK', 'MTDM', 'PBM'],
  goal: 'icdc'
}

// A believable season: 16 takes over ~3 weeks, trending 58 → 93, fillers
// falling as the reps add up, finishing on a 4-day streak.
const SHOWCASE_LOG: LogEntry[] = [
  [24, 58, 9], [22, 61, 8], [21, 57, 9], [19, 66, 7], [17, 70, 6],
  [16, 68, 6], [14, 74, 5], [12, 77, 4], [10, 73, 5], [9, 81, 3],
  [7, 84, 3], [5, 80, 2], [3, 88, 1], [2, 86, 2], [1, 91, 0], [0, 93, 0]
].map(([daysAgo, score, fillers], i) => ({
  day: demoDay(daysAgo as number),
  event: (['PMK', 'PBM', 'MTDM'] as const)[i % 3] as string,
  score: score as number,
  minutes: 8 + (i % 4),
  fillers: fillers as number,
  ...(i % 5 === 4 ? { qna: 70 + i } : {})
}))

const SHOWCASE_HISTORY: RunRecord[] = SHOWCASE_LOG.slice(-8)
  .map((entry, i) => ({
    at: Date.now() - (7 - i) * 86_400_000,
    event: entry.event,
    overall: entry.score,
    words: 900 + i * 40,
    durationSeconds: entry.minutes * 60,
    wpm: 118 + i * 3
  }))
  .reverse()

const STORIES: Array<{ quote: string; who: string }> = [
  {
    quote:
      'Before this I was scared of roleplays — I would freeze the second the judge looked up. Fifty practice takes later, I walked into Provincials actually wanting the Q&A.',
    who: 'Marketing series competitor, Ontario'
  },
  {
    quote:
      'The judge doesn’t flatter you. My first take scored a 41 and it stung. Three weeks of streaks later I broke 90 — and I knew exactly which indicator earned it.',
    who: 'Principles of Business competitor'
  },
  {
    quote:
      'My partner and I ran the team events until the 30-minute prep felt slow. At the real thing we finished planning with time to spare.',
    who: 'HTDM team, first-year qualifiers'
  }
]

const LEADERBOARD: Array<{ school: string; takes: number }> = [
  { school: 'Westmount SS', takes: 312 },
  { school: 'Iroquois Ridge HS', takes: 287 },
  { school: 'Oakville Trafalgar HS', takes: 254 },
  { school: 'White Oaks SS', takes: 231 },
  { school: 'Abbey Park HS', takes: 198 }
]

interface Step {
  kicker: string
  /** The journey beat this step represents, in the competitor's voice. */
  journey: string
  title: string
  body: string
}

const STEPS: Step[] = [
  {
    kicker: '01 — Scenario',
    journey: '“I want to improve.”',
    title: 'A real business problem, made on the spot.',
    body: 'Every run opens on a fresh Principles of Business Management roleplay: your role, the situation, the judge you answer to, and the performance indicators you will be graded on.'
  },
  {
    kicker: '02 — Prep',
    journey: '“I’m getting better.”',
    title: 'Ten minutes. Standby light on.',
    body: 'The amber tally means the clock is running and you are getting ready. Read the brief, plan your angle, decide how you will hit each indicator — then go on air whenever you are set.'
  },
  {
    kicker: '03 — On air',
    journey: '“I’m ready.”',
    title: 'The light goes red. You present.',
    body: 'Speak your response out loud like the real event. Your words stream into the transcript live. No mic? It falls back to typing, so the run never dead-ends.'
  },
  {
    kicker: '04 — Verdict',
    journey: '“I proved myself.”',
    title: 'An honest score on every indicator.',
    body: 'The judge grades each performance indicator on its own — a score, a one-line reason grounded in what you actually said, and one concrete fix. Then it asks you the follow-up question a real judge would. No empty praise.'
  }
]

// One scroll step. Reports itself as "active" when it passes through the middle
// band of the viewport, which drives the pinned visual.
const SeqStep = ({
  index,
  onActive,
  children
}: {
  index: number
  onActive: (index: number) => void
  children: ReactNode
}): JSX.Element => {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const element = ref.current
    if (!element || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) onActive(index)
        }
      },
      // Fire when the step sits in the middle 10% band of the viewport.
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [index, onActive])

  return (
    <div className="seq-step" ref={ref}>
      {children}
    </div>
  )
}

export const Landing = ({
  onStartPracticing,
  history,
  profile,
  streakDays,
  onCreateProfile
}: LandingProps): JSX.Element => {
  const [activeStep, setActiveStep] = useState(0)
  const best = personalBest(history)

  const explore = (): void => {
    document.querySelector('.statement')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="landing">
      {/* Hero — rides on the scroll film as its 0% beat */}
      <ScrollFilm
        hero={
        <div className="hero-inner">
          <div className="hero-tally">
            <Tally mode="onair" />
          </div>
          {profile && (
            <p className="hero-greeting">
              {greetingFor(new Date().getHours())}, {profile.name.split(' ')[0]}
              {streakDays > 0 ? ` — 🔥 day ${streakDays}` : ''}. Ready for
              today&rsquo;s take?
            </p>
          )}
          <h1 className="hero-title">
            Train like
            <br />a champion.
          </h1>
          <p className="hero-sub">
            Dry Run is where DECA competitors sharpen up: a fresh roleplay,
            competition timing, and a judge that scores every performance
            indicator honestly. Rehearse the room before the room.
          </p>
          <div className="hero-actions">
            <button
              className="btn btn--primary btn--lg"
              onClick={onStartPracticing}
            >
              Start practicing
            </button>
            <button className="btn btn--ghost btn--lg" onClick={explore}>
              Explore the platform
            </button>
          </div>
          {history.length > 0 && best !== null && (
            <div className="recent" aria-label="Your recent takes">
              <span className="recent-label">Recent takes</span>
              <div className="recent-chips">
                {history.slice(0, 6).map((run, i) => (
                  <span
                    className="recent-chip"
                    key={`${run.at}-${i}`}
                    style={{ color: chipColor(run.overall) }}
                    title={`${run.overall}/100 · ${run.wpm} wpm`}
                  >
                    {run.overall}
                  </span>
                ))}
              </div>
              <span className="recent-best">
                Best <strong>{best}</strong>/100
              </span>
            </div>
          )}
        </div>
        }
      />

      {/* Statement */}
      <section className="statement">
        <Reveal>
          <p className="statement-text">
            DECA roleplay rewards <em>specificity, structure, and nerve.</em> You
            don&rsquo;t build those reading a rubric. You build them by doing a take —
            out loud, on the clock, under the light.
          </p>
        </Reveal>
      </section>

      {/* Pinned four-phase sequence */}
      <section className="seq">
        <div className="seq-inner">
          <div className="seq-sticky">
            <div className="seq-visual" data-step={activeStep}>
              <div className={`sv sv--scenario ${activeStep === 0 ? 'is-active' : ''}`}>
                <div className="sv-card">
                  <p className="label">The scenario</p>
                  <p className="sv-role">
                    You are the weekend shift lead at a 12-screen movie theater…
                  </p>
                  <div className="sv-lines">
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="sv-pills">
                    <span>Communication</span>
                    <span>Problem-solving</span>
                    <span>Ethics</span>
                  </div>
                </div>
              </div>

              <div className={`sv sv--prep ${activeStep === 1 ? 'is-active' : ''}`}>
                <Tally mode="standby" />
                <Timecode seconds={600} />
                <p className="sv-cap">Standby — 10:00 to prep</p>
              </div>

              <div className={`sv sv--onair ${activeStep === 2 ? 'is-active' : ''}`}>
                <Tally mode="onair" />
                <div className="wave" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <p className="sv-cap">On air — present out loud</p>
              </div>

              <div className={`sv sv--verdict ${activeStep === 3 ? 'is-active' : ''}`}>
                <p className="sv-score">
                  87<span>/100</span>
                </p>
                <div className="sv-bars">
                  <i style={{ width: '88%' }} />
                  <i style={{ width: '71%' }} />
                  <i style={{ width: '93%' }} />
                  <i style={{ width: '64%' }} />
                </div>
                <p className="sv-cap">The verdict — scored on every indicator</p>
              </div>
            </div>
          </div>

          <div className="seq-steps">
            {STEPS.map((step, i) => (
              <SeqStep key={step.kicker} index={i} onActive={setActiveStep}>
                <p className="seq-journey">{step.journey}</p>
                <p className="seq-kicker">{step.kicker}</p>
                <h3 className="seq-title">{step.title}</h3>
                <p className="seq-body">{step.body}</p>
              </SeqStep>
            ))}
          </div>
        </div>
      </section>

      {/* Platform showcase: the real competitor card, sample season */}
      <section className="showcase">
        <div className="showcase-inner">
          <Reveal>
            <p className="features-kicker">Your competitor identity</p>
            <h2 className="showcase-title">
              Every take builds
              <br />
              your record.
            </h2>
            <p className="showcase-sub">
              Streaks, levels, readiness, achievements — all computed from
              roleplays you actually ran, indicator by indicator. This is a
              real profile card from a sample season.
            </p>
          </Reveal>
          <Reveal delay={120} className="showcase-card">
            <CompetitorCard
              profile={SHOWCASE_PROFILE}
              log={SHOWCASE_LOG}
              history={SHOWCASE_HISTORY}
            />
          </Reveal>
        </div>
      </section>

      {/* Community numbers */}
      <section className="community">
        <Reveal>
          <p className="features-kicker">The community</p>
          <h2 className="community-title">DECA is a team sport.</h2>
        </Reveal>
        <Counters />
        <p className="community-note">Season-one targets — join early.</p>
      </section>

      {/* Student stories */}
      <section className="stories">
        <div className="stories-grid">
          {STORIES.map((story, i) => (
            <Reveal key={story.who} delay={i * 110} className="story">
              <p className="story-quote">{story.quote}</p>
              <p className="story-who">— {story.who}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* School leaderboard showcase */}
      <section className="board">
        <Reveal>
          <p className="features-kicker">School leaderboard</p>
          <h2 className="board-title">Rep your school.</h2>
          <p className="board-sub">
            Takes logged this season, school against school. Showcase preview —
            live standings arrive with accounts.
          </p>
        </Reveal>
        <Reveal delay={120}>
          <ol className="board-list">
            {LEADERBOARD.map((row, i) => (
              <li key={row.school} className={i === 0 ? 'is-leader' : ''}>
                <span className="board-rank">{i + 1}</span>
                <span className="board-school">{row.school}</span>
                <span className="board-takes">{row.takes} takes</span>
              </li>
            ))}
          </ol>
        </Reveal>
      </section>

      {/* Feature cards */}
      <section className="features">
        <Reveal>
          <p className="features-kicker">Why it works</p>
        </Reveal>
        <div className="feature-grid">
          <Reveal className="feature" delay={0}>
            <h4 className="feature-title">Never the same twice</h4>
            <p className="feature-body">
              Scenarios are generated fresh every run, so you practice thinking on
              your feet instead of memorizing one case.
            </p>
          </Reveal>
          <Reveal className="feature" delay={90}>
            <h4 className="feature-title">Speak, don&rsquo;t type</h4>
            <p className="feature-body">
              Real speech-to-text captures your presentation the way a judge hears
              it — pauses, filler and all — with a typed fallback when you need it.
            </p>
          </Reveal>
          <Reveal className="feature" delay={180}>
            <h4 className="feature-title">A judge that won&rsquo;t flatter you</h4>
            <p className="feature-body">
              Every indicator is graded on its own evidence, so a confident answer
              with nothing behind it gets the score it deserves.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Final CTA */}
      <section className="final">
        <Reveal>
          <h2 className="final-title">Your next competition starts now.</h2>
          <p className="final-sub">Draw an event. Beat the clock. See where you stand.</p>
          <div className="final-actions">
            <button
              className="btn btn--primary btn--lg"
              onClick={onStartPracticing}
            >
              Start practicing
            </button>
            {!profile && (
              <button
                className="btn btn--ghost btn--lg"
                onClick={onCreateProfile}
              >
                Create your competitor profile
              </button>
            )}
          </div>
        </Reveal>
      </section>
    </div>
  )
}
