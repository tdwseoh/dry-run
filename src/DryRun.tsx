import { useEffect, useMemo, useRef, useState } from 'react'

import { ErrorNote, LoadingDots } from './components/Feedback'
import { Landing } from './components/Landing'
import { Onboarding } from './components/Onboarding'
import { Profile } from './components/Profile'
import { QnaRound } from './components/QnaRound'
import { RunSetup } from './components/RunSetup'
import { ScoreBurst } from './components/ScoreBurst'
import { Settings } from './components/Settings'
import { Sparkline } from './components/Sparkline'
import { Tally, type TallyMode } from './components/Tally'
import { Timecode } from './components/Timecode'
import { TrainingLog } from './components/TrainingLog'
import { VerdictBody, Tape } from './components/VerdictBody'
import { ApiError, generateScenario, judgeTranscript } from './lib/api'
import { playAlarm } from './lib/alarm'
import {
  DEFAULT_DIFFICULTY,
  DEFAULT_EVENT_CODE,
  DIFFICULTIES,
  eventByCode
} from './lib/events'
import { trendPoints } from './lib/trend'
import {
  attachQnaToArchive,
  loadArchive,
  newRunId,
  saveArchivedRun,
  type ArchivedRun
} from './lib/archive'
import { clearDemo, isDemoActive, seedDemo } from './lib/demo'
import { computeDelivery, paceLabel, type DeliveryStats } from './lib/delivery'
import {
  loadHistory,
  personalBest,
  saveRun,
  type RunRecord
} from './lib/history'
import {
  appendLog,
  attachQnaToLatest,
  currentStreak,
  dayStamp,
  levelFor,
  loadLog,
  loadProfile,
  newlyEarned,
  saveProfile,
  totalXp,
  type Achievement,
  type CompetitorProfile,
  type LogEntry
} from './lib/profile'
import { isSpeechSupported, startSpeech, type SpeechSession } from './lib/speech'
import type { Difficulty, JudgeResult, RunMode, Scenario } from './types'

// The whole app is one state machine keyed on `phase`. Everything else is derived.
type Phase = 'home' | 'setup' | 'prep' | 'onair' | 'verdict' | 'profile' | 'log'

/** The gamification beats of the run that just finished, shown on the verdict. */
interface RunMoments {
  streak: number
  unlocked: Achievement[]
}

// How the presentation is being captured: live speech, or the typed fallback.
type InputMode = 'speech' | 'typed'

// Real DECA timing: individual events run 10:00 prep + 10:00 presentation;
// team decision-making events run 30:00 prep + 15:00 presentation.
const TIMINGS: Record<RunMode, { prep: number; onair: number }> = {
  solo: { prep: 600, onair: 600 },
  team: { prep: 1800, onair: 900 }
}

/** Map a 0-100 score to its encoding colour: mint (strong) / amber (mid) / red (weak). */
const colorFor = (score: number): string =>
  score >= 75 ? 'var(--mint)' : score >= 50 ? 'var(--amber)' : 'var(--red)'

/** How this run compares to the record — computed before the run is saved. */
interface RunContext {
  prevLast: number | null
  prevBest: number | null
}

/**
 * Drift-free countdown. Resets to `seconds` whenever `running` flips true, ticks
 * down while running, and calls `onDone` once when it hits zero.
 *
 * `onDone` is read through a ref so the timer always sees the latest closure
 * (state, handlers) without re-subscribing every render.
 *
 * Bumping `resetKey` restarts the countdown from `seconds` without leaving the
 * phase — used when a scenario is redrawn mid-prep.
 */
const useCountdown = (
  seconds: number,
  running: boolean,
  onDone: () => void,
  resetKey = 0
): number => {
  const [remaining, setRemaining] = useState(seconds)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    if (!running) return
    setRemaining(seconds)
    const startedAt = Date.now()
    const id = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000)
      const next = Math.max(0, seconds - elapsed)
      setRemaining(next)
      if (next <= 0) {
        window.clearInterval(id)
        onDoneRef.current()
      }
    }, 250)
    return () => window.clearInterval(id)
  }, [seconds, running, resetKey])

  return remaining
}

/**
 * The big verdict number, counting up from 0 with an ease-out so the reveal has
 * some drama. Reduced-motion users get the final number immediately.
 */
const ScoreCount = ({ value }: { value: number }): JSX.Element => {
  const [shown, setShown] = useState(0)

  useEffect(() => {
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setShown(value)
      return
    }
    const startedAt = performance.now()
    const DURATION_MS = 900
    let raf = 0
    const tick = (now: number): void => {
      const t = Math.min(1, (now - startedAt) / DURATION_MS)
      const eased = 1 - Math.pow(1 - t, 3) // cubic ease-out
      setShown(Math.round(value * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])

  return (
    <span className="overall-score" style={{ color: colorFor(value) }}>
      {shown}
    </span>
  )
}

/** MM:SS for the delivery strip (duplicating Timecode's format keeps it a span-free string). */
const formatDuration = (totalSeconds: number): string => {
  const clamped = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(clamped / 60)
  const s = clamped % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * The standby ring — the visual centerpiece of the prep wait. An SVG ring that
 * depletes with the countdown (the sweep animates via a CSS transition on the
 * dash offset), amber while there's time, red and pulsing in the final minute.
 */
const StandbyRing = ({
  remaining,
  total
}: {
  remaining: number
  total: number
}): JSX.Element => {
  const R = 84
  const C = 2 * Math.PI * R
  const frac = total > 0 ? remaining / total : 0
  const urgent = remaining <= 60
  return (
    <div
      className={`ring${urgent ? ' ring--urgent' : ''}`}
      role="timer"
      aria-label={`Prep time remaining ${formatDuration(remaining)}`}
    >
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <circle className="ring-track" cx="100" cy="100" r={R} />
        <circle
          className="ring-fill"
          cx="100"
          cy="100"
          r={R}
          strokeDasharray={C}
          strokeDashoffset={C * (1 - frac)}
          transform="rotate(-90 100 100)"
        />
      </svg>
      <div className="ring-center">
        <span className="ring-time">{formatDuration(remaining)}</span>
        <span className="ring-cap">{urgent ? 'going on air' : 'standby'}</span>
      </div>
    </div>
  )
}

export const DryRun = (): JSX.Element => {
  const speechSupported = useMemo(() => isSpeechSupported(), [])

  const [phase, setPhase] = useState<Phase>('home')
  const [mode, setMode] = useState<RunMode>('solo')
  // Run setup: which event the simulation draws from, and the tier it's judged at.
  const [eventCode, setEventCode] = useState(DEFAULT_EVENT_CODE)
  const [difficulty, setDifficulty] = useState<Difficulty>(DEFAULT_DIFFICULTY)
  const [scenario, setScenario] = useState<Scenario | null>(null)
  // True when the scenario came from an uploaded official PDF (fixed — no redraw).
  const [fromPdf, setFromPdf] = useState(false)

  const [generating, setGenerating] = useState(false)
  const [redrawing, setRedrawing] = useState(false)
  const [prepResetKey, setPrepResetKey] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Transcript capture.
  const [inputMode, setInputMode] = useState<InputMode>(
    speechSupported ? 'speech' : 'typed'
  )
  const [finalTranscript, setFinalTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [typed, setTyped] = useState('')

  // Prep notes — the scratchpad you write during standby and keep on air,
  // exactly like the note paper you carry into the real event.
  const [notes, setNotes] = useState('')

  // Verdict.
  const [submittedTranscript, setSubmittedTranscript] = useState('')
  const [verdict, setVerdict] = useState<JudgeResult | null>(null)
  const [judging, setJudging] = useState(false)
  const [judgeAttempt, setJudgeAttempt] = useState(0)

  // Delivery + history.
  const [delivery, setDelivery] = useState<DeliveryStats | null>(null)
  const [history, setHistory] = useState<RunRecord[]>(() => loadHistory())
  const [runContext, setRunContext] = useState<RunContext | null>(null)

  // Competitor identity + persistent practice log (gamification source of truth).
  const [profile, setProfile] = useState<CompetitorProfile | null>(() => loadProfile())
  const [log, setLog] = useState<LogEntry[]>(() => loadLog())
  const [runMoments, setRunMoments] = useState<RunMoments | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)

  // Full-run archive (reviewable training log) and the run being opened from it.
  const [archive, setArchive] = useState<ArchivedRun[]>(() => loadArchive())
  const [logSelection, setLogSelection] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  const speechRef = useRef<SpeechSession | null>(null)
  const onairStartedAtRef = useRef<number | null>(null)

  // Assemble the transcript we actually send to the judge.
  const buildTranscript = (): string => {
    if (inputMode === 'typed') return typed.trim()
    const tail = interim.trim()
    return (finalTranscript + (tail ? ` ${tail}` : '')).trim()
  }

  const resetCapture = (): void => {
    setFinalTranscript('')
    setInterim('')
    setTyped('')
    setNotes('')
    setInputMode(speechSupported ? 'speech' : 'typed')
  }

  // ---- Transitions --------------------------------------------------------

  // Launch a run from the setup screen. Generated runs derive their format from
  // the selected event; official-PDF runs carry an explicit format override.
  // (The alarm is primed inside RunSetup's click handlers — a user gesture.)
  const startRun = (sourceText?: string, modeOverride?: RunMode): void => {
    const runMode = modeOverride ?? eventByCode(eventCode).format
    setError(null)
    setGenerating(true)
    generateScenario(sourceText ? { sourceText } : { eventCode, difficulty })
      .then((next) => {
        resetCapture()
        setVerdict(null)
        setDelivery(null)
        setRunContext(null)
        setMode(runMode)
        setFromPdf(sourceText !== undefined)
        setScenario(next)
        setGenerating(false)
        setPhase('prep')
      })
      .catch((err: unknown) => {
        setGenerating(false)
        setError(
          err instanceof ApiError
            ? err.message
            : 'Could not start the run. Try again.'
        )
      })
  }

  // Swap in a fresh scenario without leaving prep. Notes are cleared (they were
  // written against the old brief) and the prep clock restarts from 10:00.
  const redrawScenario = (): void => {
    if (redrawing) return
    setRedrawing(true)
    generateScenario({ eventCode, difficulty })
      .then((next) => {
        setScenario(next)
        setNotes('')
        setPrepResetKey((n) => n + 1)
        setRedrawing(false)
      })
      .catch(() => {
        // Keep the current scenario — a failed redraw should never kill the run.
        setRedrawing(false)
      })
  }

  const goOnAir = (): void => {
    onairStartedAtRef.current = Date.now()
    setPhase('onair')
  }

  const endAndScore = (): void => {
    const transcript = buildTranscript()
    const startedAt = onairStartedAtRef.current
    const elapsed =
      startedAt === null
        ? 0
        : Math.min(TIMINGS[mode].onair, (Date.now() - startedAt) / 1000)
    setDelivery(computeDelivery(transcript, elapsed))
    setSubmittedTranscript(transcript)
    setInterim('')
    setPhase('verdict')
  }

  const retryJudge = (): void => {
    setError(null)
    setVerdict(null)
    setJudgeAttempt((n) => n + 1)
  }

  // Back into the training loop: a new take returns to setup, not the landing.
  const newTake = (target: 'setup' | 'home' = 'setup'): void => {
    setScenario(null)
    setVerdict(null)
    setError(null)
    setSubmittedTranscript('')
    setDelivery(null)
    setRunContext(null)
    setRunMoments(null)
    resetCapture()
    setPhase(target)
  }

  // The Q&A rebuttal lands after the run was logged — attach its score to the
  // latest entry and surface any unlock it triggers (e.g. Under pressure).
  const recordQna = (score: number): void => {
    const before = loadLog()
    const after = attachQnaToLatest(score)
    setLog(after)
    setArchive(attachQnaToArchive(score))
    const unlocked = newlyEarned(before, after)
    if (unlocked.length > 0) {
      setRunMoments((prev) => ({
        streak: prev?.streak ?? currentStreak(after, new Date()),
        unlocked: [...(prev?.unlocked ?? []), ...unlocked]
      }))
    }
  }

  const completeOnboarding = (next: CompetitorProfile): void => {
    saveProfile(next)
    setProfile(next)
    setShowOnboarding(false)
  }

  // Re-sync every store into state after an import or wipe (Settings).
  const reloadFromStorage = (): void => {
    const nextProfile = loadProfile()
    setProfile(nextProfile)
    setLog(loadLog())
    setHistory(loadHistory())
    setArchive(loadArchive())
    if (!nextProfile && phase === 'profile') setPhase('home')
  }

  // Open the training log — optionally deep-linked to one archived run.
  const openLog = (runId: string | null = null): void => {
    setArchive(loadArchive())
    setLogSelection(runId)
    setRunMoments(null)
    setPhase('log')
  }

  // Demo mode: seed the sample season (judge-explorable dashboard in one
  // click), or erase it entirely. Both re-sync all state from storage.
  const exploreDemo = (): void => {
    seedDemo()
    setProfile(loadProfile())
    setLog(loadLog())
    setHistory(loadHistory())
    setArchive(loadArchive())
    setPhase('profile')
  }

  const leaveDemo = (): void => {
    clearDemo()
    setProfile(null)
    setLog([])
    setHistory([])
    setArchive([])
    setPhase('home')
  }

  // ---- Timers -------------------------------------------------------------

  const timings = TIMINGS[mode]

  // When a countdown expires on its own the alarm rings; skipping ahead manually
  // (the buttons call goOnAir/endAndScore directly) stays silent.
  const prepRemaining = useCountdown(
    timings.prep,
    phase === 'prep',
    () => {
      playAlarm('standby-over')
      goOnAir()
    },
    prepResetKey
  )
  const onairRemaining = useCountdown(timings.onair, phase === 'onair', () => {
    playAlarm('time-up')
    endAndScore()
  })

  // Live delivery read while on air, recomputed as words land. Cheap enough to
  // run per render; wpm is hidden for the first few seconds while it's all noise.
  const liveElapsed = timings.onair - onairRemaining
  const liveStats =
    phase === 'onair'
      ? computeDelivery(
          inputMode === 'typed'
            ? typed
            : `${finalTranscript} ${interim}`.trim(),
          liveElapsed
        )
      : null

  // ---- Speech capture (only while on air, only in speech mode) ------------

  useEffect(() => {
    if (phase !== 'onair' || inputMode !== 'speech') return
    const session = startSpeech({
      onFinal: (text) =>
        setFinalTranscript((prev) => {
          const clean = text.trim()
          if (!clean) return prev
          return prev ? `${prev} ${clean}` : clean
        }),
      onInterim: (text) => setInterim(text),
      onError: (kind) => {
        // Denied mic or unsupported => fall back to the typed textarea so the
        // flow never dead-ends. Re-running the effect then no-ops (mode changed).
        if (kind === 'not-allowed' || kind === 'unsupported') {
          setInputMode('typed')
        }
      }
    })
    speechRef.current = session
    return () => {
      session?.stop()
      speechRef.current = null
      setInterim('')
    }
  }, [phase, inputMode])

  // ---- Judging (on entering verdict, or on retry) -------------------------

  useEffect(() => {
    if (phase !== 'verdict' || !scenario) return
    const controller = new AbortController()
    setJudging(true)
    setError(null)
    judgeTranscript(scenario, submittedTranscript, difficulty, controller.signal)
      .then((result) => {
        // Snapshot the record BEFORE saving so we can say "beat your best" honestly.
        const prev = loadHistory()
        setRunContext({
          prevLast: prev[0]?.overall ?? null,
          prevBest: personalBest(prev)
        })
        const stats =
          delivery ?? computeDelivery(submittedTranscript, TIMINGS[mode].onair)
        setHistory(
          saveRun({
            at: Date.now(),
            event: scenario.event,
            overall: result.overall,
            words: stats.words,
            durationSeconds: stats.durationSeconds,
            wpm: stats.wpm
          })
        )
        // Append to the persistent practice log and capture the gamification
        // beats (streak day, fresh unlocks) for the verdict screen.
        const before = loadLog()
        const after = appendLog({
          day: dayStamp(new Date()),
          event: fromPdf ? scenario.event : eventCode,
          score: result.overall,
          minutes: Math.max(1, Math.round(stats.durationSeconds / 60)),
          fillers: stats.fillerTotal
        })
        setLog(after)
        setRunMoments({
          streak: currentStreak(after, new Date()),
          unlocked: newlyEarned(before, after)
        })
        // Archive the FULL run so it can be reopened and studied later.
        setArchive(
          saveArchivedRun({
            id: newRunId(),
            at: Date.now(),
            eventCode: fromPdf ? '' : eventCode,
            eventName: scenario.event,
            difficulty,
            fromPdf,
            overall: result.overall,
            scenario,
            transcript: submittedTranscript,
            verdict: result,
            delivery: stats
          })
        )
        setVerdict(result)
        setJudging(false)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setJudging(false)
        setError(
          err instanceof ApiError
            ? err.message
            : 'Could not score this take. Try again.'
        )
      })
    return () => controller.abort()
    // `delivery` is set together with `submittedTranscript` in endAndScore, so it
    // is intentionally read (not depended on) here to avoid double-judging.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, scenario, submittedTranscript, judgeAttempt])

  // ---- Derived header state ----------------------------------------------

  const tallyMode: TallyMode =
    phase === 'prep' ? 'standby' : phase === 'onair' ? 'onair' : 'off'

  const headerSeconds =
    phase === 'prep'
      ? prepRemaining
      : phase === 'onair'
        ? onairRemaining
        : phase === 'home'
          ? timings.prep
          : phase === 'setup'
            ? TIMINGS[eventByCode(eventCode).format].prep
            : 0

  // One line comparing this take to the record, shown next to the verdict score.
  const compareLine = ((): { text: string; tone: 'up' | 'down' | 'flat' } | null => {
    if (!verdict || !runContext) return null
    if (runContext.prevBest === null) {
      return { text: 'First take on record', tone: 'flat' }
    }
    if (verdict.overall > runContext.prevBest) {
      return { text: 'New personal best', tone: 'up' }
    }
    if (runContext.prevLast !== null) {
      const diff = verdict.overall - runContext.prevLast
      if (diff > 0) return { text: `Up ${diff} on your last take`, tone: 'up' }
      if (diff < 0) return { text: `Down ${-diff} on your last take`, tone: 'down' }
      return { text: 'Level with your last take', tone: 'flat' }
    }
    return null
  })()

  return (
    <div className="app">
      <header
        className={`rack${phase === 'home' || phase === 'profile' || phase === 'log' ? ' rack--nav' : ''}`}
      >
        <div className="rack-left">
          <span className="rack-glyph" aria-hidden="true">
            &#9654;
          </span>
          <span className="wordmark">Dry Run</span>
        </div>
        {phase === 'home' || phase === 'profile' || phase === 'log' ? (
          <>
            <div className="rack-center" />
            <div className="rack-right">
              {profile ? (
                <button
                  className="profile-chip"
                  onClick={() =>
                    setPhase(phase === 'profile' ? 'home' : 'profile')
                  }
                  aria-label={`Open ${profile.name}'s competitor profile`}
                >
                  <span className="profile-chip-name">{profile.name.split(' ')[0]}</span>
                  <span className="profile-chip-level">
                    {levelFor(totalXp(log)).name}
                    {currentStreak(log, new Date()) > 0 &&
                      ` · 🔥${currentStreak(log, new Date())}`}
                  </span>
                </button>
              ) : (
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => setShowOnboarding(true)}
                >
                  Create profile
                </button>
              )}
              <button
                className="icon-btn"
                onClick={() => setShowSettings(true)}
                aria-label="Settings and data"
                title="Settings"
              >
                &#9881;
              </button>
              <button
                className="nav-cta"
                onClick={() => setPhase('setup')}
                disabled={generating}
              >
                Start practicing
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="rack-center">
              <Timecode
                seconds={headerSeconds}
                urgent={
                  (phase === 'prep' || phase === 'onair') && headerSeconds <= 60
                }
              />
            </div>
            <div className="rack-right">
              <Tally mode={tallyMode} />
            </div>
          </>
        )}
      </header>

      {phase === 'home' ? (
        <Landing
          onStartPracticing={() => setPhase('setup')}
          history={history}
          profile={profile}
          streakDays={currentStreak(log, new Date())}
          onCreateProfile={() => setShowOnboarding(true)}
          onExploreDemo={exploreDemo}
        />
      ) : (
        <main className="stage">
          {phase === 'profile' && profile && (
            <Profile
              profile={profile}
              log={log}
              history={history}
              archive={archive}
              onStartPracticing={() => setPhase('setup')}
              onStartDrill={(code, tier) => {
                setEventCode(code)
                setDifficulty(tier)
                setPhase('setup')
              }}
              onEditProfile={() => setShowOnboarding(true)}
              onOpenRun={(id) => openLog(id)}
              onOpenLog={() => openLog()}
              onOpenSettings={() => setShowSettings(true)}
              demoActive={isDemoActive()}
              onClearDemo={leaveDemo}
            />
          )}

          {phase === 'log' && (
            <TrainingLog
              runs={archive}
              initialRunId={logSelection}
              onBack={() => setPhase(profile ? 'profile' : 'home')}
              onStartPracticing={() => setPhase('setup')}
            />
          )}

          {phase === 'setup' && (
            <RunSetup
              eventCode={eventCode}
              onEventCode={setEventCode}
              difficulty={difficulty}
              onDifficulty={setDifficulty}
              pdfMode={mode}
              onPdfMode={setMode}
              starting={generating}
              error={error}
              onLaunch={startRun}
              onBack={() => {
                setError(null)
                setPhase('home')
              }}
            />
          )}

          {phase === 'prep' && scenario && (
          <section className="screen prep">
            <div className="prep-grid">
              <div className="card scenario-card">
                <p className="label">The scenario</p>
                <h2 className="card-title">{scenario.event}</h2>
                <p className="cluster-tag">
                  {scenario.cluster}
                  {fromPdf && <span className="official-tag">Official PDF</span>}
                </p>

                <div className="scenario-block">
                  <p className="label">Your role</p>
                  <p className="scenario-text">{scenario.role}</p>
                </div>
                <div className="scenario-block">
                  <p className="label">The situation</p>
                  <p className="scenario-text">{scenario.situation}</p>
                </div>
                <div className="scenario-block">
                  <p className="label">The judge plays</p>
                  <p className="scenario-text">{scenario.judgeRole}</p>
                </div>
              </div>

              <div className="card indicators-card">
                <p className="label">Judged on</p>
                <h2 className="card-title">Performance indicators</h2>
                <ol className="indicator-list">
                  {scenario.indicators.map((indicator, i) => (
                    <li key={`${i}-${indicator}`}>
                      <span className="pi-num">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span>{indicator}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="card standby-card">
                <StandbyRing remaining={prepRemaining} total={timings.prep} />
                <div className="prep-actions">
                  <p className="standby-note">
                    {mode === 'team'
                      ? 'Team format: 30:00 to prep, 15:00 on air.'
                      : 'Individual format: 10:00 to prep, 10:00 on air.'}{' '}
                    An alarm sounds and you go on air automatically when prep
                    runs out.
                  </p>
                  <button
                    className="btn btn--primary"
                    onClick={goOnAir}
                    disabled={redrawing}
                  >
                    Skip the wait — go on air
                  </button>
                  {!fromPdf && (
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={redrawScenario}
                      disabled={redrawing}
                    >
                      {redrawing ? 'Drawing…' : 'Redraw scenario'}
                    </button>
                  )}
                </div>
              </div>

              <div className="card notes-card">
                <p className="label">Scratchpad</p>
                <h2 className="card-title">Your notes</h2>
                <p className="notes-hint">
                  Plan your open, your structure, one point per indicator. Your
                  notes stay on screen while you present — just like the note
                  paper in the real event.
                </p>
                <textarea
                  className="notes-input"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={'1. Open: greet the judge, restate the problem\n2. …'}
                  aria-label="Prep notes"
                  spellCheck={false}
                />
              </div>
            </div>
          </section>
        )}

        {phase === 'onair' && scenario && (
          <section className="screen onair">
            <div className="rec-vignette" aria-hidden="true" />
            <div className="onair-head">
              <p className="label">
                {inputMode === 'speech'
                  ? 'Recording — present out loud'
                  : 'Type your presentation'}
              </p>
              <p className="onair-role">{scenario.role}</p>
            </div>

            <details className="onair-notes">
              <summary>The brief — situation &amp; indicators</summary>
              <div className="onair-brief">
                <p className="onair-brief-text">{scenario.situation}</p>
                <ul className="onair-brief-list">
                  {scenario.indicators.map((indicator, i) => (
                    <li key={`${i}-${indicator}`}>{indicator}</li>
                  ))}
                </ul>
              </div>
            </details>

            {notes.trim() && (
              <details className="onair-notes" open>
                <summary>Your notes</summary>
                <pre className="onair-notes-text">{notes}</pre>
              </details>
            )}

            {inputMode === 'speech' ? (
              <div
                className="transcript"
                aria-label="Live transcript of your presentation"
              >
                {finalTranscript && <span>{finalTranscript} </span>}
                {interim && <span className="transcript-interim">{interim}</span>}
                {!finalTranscript && !interim && (
                  <span className="transcript-placeholder">
                    Start talking — your words appear here as you present. Address{' '}
                    {scenario.judgeRole} directly.
                  </span>
                )}
              </div>
            ) : (
              <div className="fallback">
                <p className="fallback-note">
                  {speechSupported
                    ? 'Microphone access was blocked, so type your take instead. To speak next time, allow mic access and start a new take.'
                    : "Live speech isn't available in this browser. Type your take here — for speech-to-text, use Chrome on desktop or Android."}
                </p>
                <textarea
                  className="fallback-input"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="Type your presentation as if you were speaking to the judge…"
                  aria-label="Type your presentation"
                  autoFocus
                />
              </div>
            )}

            <div className="onair-actions">
              {liveStats && (
                <div className="live-hud" aria-label="Live delivery read">
                  <span className="live-stat">
                    <strong>{liveStats.words}</strong> words
                  </span>
                  {liveElapsed >= 15 && liveStats.words >= 10 && (
                    <span
                      className={`live-stat${
                        liveStats.wpm >= 100 && liveStats.wpm <= 165
                          ? ' live-stat--good'
                          : ' live-stat--warn'
                      }`}
                    >
                      <strong>{liveStats.wpm}</strong> wpm ·{' '}
                      {paceLabel(liveStats.wpm).toLowerCase()}
                    </span>
                  )}
                  <span
                    className={`live-stat${
                      liveStats.fillerTotal === 0 ? ' live-stat--good' : ''
                    }`}
                  >
                    <strong>{liveStats.fillerTotal}</strong> fillers
                  </span>
                </div>
              )}
              <button className="btn btn--danger" onClick={endAndScore}>
                End and get scored
              </button>
            </div>
          </section>
        )}

        {phase === 'verdict' && (
          <section className="screen verdict">
            {judging ? (
              <div className="loading-stage">
                <p className="loading-big">Scoring the tape…</p>
                <p className="loading-line">
                  Reviewing your presentation against each indicator.
                </p>
                <LoadingDots />
              </div>
            ) : error ? (
              <ErrorNote message={error} onRetry={retryJudge} />
            ) : verdict ? (
              <div className="scorecard">
                <p className="label">The verdict</p>
                <div className="overall">
                  {compareLine?.text === 'New personal best' && <ScoreBurst />}
                  <ScoreCount value={verdict.overall} />
                  <span className="overall-out">/ 100</span>
                </div>
                <p className="calibration">
                  Judged at the {DIFFICULTIES[difficulty].label} standard
                  {fromPdf ? ' · Official PDF' : ''}
                </p>
                {compareLine && (
                  <p className={`compare compare--${compareLine.tone}`}>
                    {compareLine.text}
                  </p>
                )}
                {runMoments &&
                  (runMoments.streak > 1 || runMoments.unlocked.length > 0) && (
                    <div className="moments" aria-label="Progress from this take">
                      {runMoments.streak > 1 && (
                        <span className="moment moment--streak">
                          🔥 Streak extended — day {runMoments.streak}
                        </span>
                      )}
                      {runMoments.unlocked.map((a, i) => (
                        <span
                          className="moment moment--unlock"
                          key={a.id}
                          style={{ animationDelay: `${(i + 1) * 140}ms` }}
                        >
                          {a.emoji} Unlocked: {a.title}
                        </span>
                      ))}
                    </div>
                  )}
                <VerdictBody verdict={verdict} delivery={delivery} animateScores />

                {verdict.followUp && scenario && (
                  <QnaRound
                    key={verdict.followUp}
                    scenario={scenario}
                    transcript={submittedTranscript}
                    question={verdict.followUp}
                    onScored={recordQna}
                  />
                )}

                <Tape transcript={submittedTranscript} />

                {history.length >= 2 && (
                  <div className="trend" aria-label="Score trend">
                    <p className="label">Your last {Math.min(history.length, 10)} takes</p>
                    <Sparkline points={trendPoints(history)} />
                  </div>
                )}

                <div className="verdict-actions">
                  <button className="btn btn--primary" onClick={() => newTake()}>
                    New take
                  </button>
                  {profile ? (
                    <button
                      className="btn btn--ghost"
                      onClick={() => {
                        setRunMoments(null)
                        setPhase('profile')
                      }}
                    >
                      View your profile
                    </button>
                  ) : (
                    <button
                      className="btn btn--ghost"
                      onClick={() => setShowOnboarding(true)}
                    >
                      Create your competitor profile
                    </button>
                  )}
                  <button className="btn btn--ghost" onClick={() => openLog()}>
                    Training log
                  </button>
                  <button
                    className="btn btn--ghost"
                    onClick={() => newTake('home')}
                  >
                    Back to home
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        )}
        </main>
      )}

      {showOnboarding && (
        <Onboarding
          initial={profile}
          onComplete={completeOnboarding}
          onDismiss={() => setShowOnboarding(false)}
        />
      )}

      {showSettings && (
        <Settings
          onDataChanged={reloadFromStorage}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
