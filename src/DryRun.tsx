import { useEffect, useMemo, useRef, useState } from 'react'

import { ErrorNote, LoadingDots } from './components/Feedback'
import { Landing } from './components/Landing'
import { Tally, type TallyMode } from './components/Tally'
import { Timecode } from './components/Timecode'
import { ApiError, generateScenario, judgeTranscript } from './lib/api'
import { isSpeechSupported, startSpeech, type SpeechSession } from './lib/speech'
import type { JudgeResult, Scenario } from './types'

// The whole app is one state machine keyed on `phase`. Everything else is derived.
type Phase = 'home' | 'prep' | 'onair' | 'verdict'

// How the presentation is being captured: live speech, or the typed fallback.
type InputMode = 'speech' | 'typed'

const PREP_SECONDS = 600 // 10:00 prep
const ONAIR_SECONDS = 600 // 10:00 presentation

/** Map a 0-100 score to its encoding colour: mint (strong) / amber (mid) / red (weak). */
const colorFor = (score: number): string =>
  score >= 75 ? 'var(--mint)' : score >= 50 ? 'var(--amber)' : 'var(--red)'

/**
 * Drift-free countdown. Resets to `seconds` whenever `running` flips true, ticks
 * down while running, and calls `onDone` once when it hits zero.
 *
 * `onDone` is read through a ref so the timer always sees the latest closure
 * (state, handlers) without re-subscribing every render.
 */
const useCountdown = (
  seconds: number,
  running: boolean,
  onDone: () => void
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
  }, [seconds, running])

  return remaining
}

export const DryRun = (): JSX.Element => {
  const speechSupported = useMemo(() => isSpeechSupported(), [])

  const [phase, setPhase] = useState<Phase>('home')
  const [scenario, setScenario] = useState<Scenario | null>(null)

  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Transcript capture.
  const [inputMode, setInputMode] = useState<InputMode>(
    speechSupported ? 'speech' : 'typed'
  )
  const [finalTranscript, setFinalTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [typed, setTyped] = useState('')

  // Verdict.
  const [submittedTranscript, setSubmittedTranscript] = useState('')
  const [verdict, setVerdict] = useState<JudgeResult | null>(null)
  const [judging, setJudging] = useState(false)
  const [judgeAttempt, setJudgeAttempt] = useState(0)

  const speechRef = useRef<SpeechSession | null>(null)

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
    setInputMode(speechSupported ? 'speech' : 'typed')
  }

  // ---- Transitions --------------------------------------------------------

  const startRun = (): void => {
    setError(null)
    setGenerating(true)
    generateScenario()
      .then((next) => {
        resetCapture()
        setVerdict(null)
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

  const goOnAir = (): void => {
    setPhase('onair')
  }

  const endAndScore = (): void => {
    setSubmittedTranscript(buildTranscript())
    setInterim('')
    setPhase('verdict')
  }

  const retryJudge = (): void => {
    setError(null)
    setVerdict(null)
    setJudgeAttempt((n) => n + 1)
  }

  const newTake = (): void => {
    setScenario(null)
    setVerdict(null)
    setError(null)
    setSubmittedTranscript('')
    resetCapture()
    setPhase('home')
  }

  // ---- Timers -------------------------------------------------------------

  const prepRemaining = useCountdown(PREP_SECONDS, phase === 'prep', goOnAir)
  const onairRemaining = useCountdown(ONAIR_SECONDS, phase === 'onair', endAndScore)

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
    judgeTranscript(scenario, submittedTranscript, controller.signal)
      .then((result) => {
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
          ? PREP_SECONDS
          : 0

  return (
    <div className="app">
      <header className={`rack${phase === 'home' ? ' rack--nav' : ''}`}>
        <div className="rack-left">
          <span className="rack-glyph" aria-hidden="true">
            &#9654;
          </span>
          <span className="wordmark">Dry Run</span>
        </div>
        {phase === 'home' ? (
          <>
            <div className="rack-center" />
            <div className="rack-right">
              <button
                className="nav-cta"
                onClick={startRun}
                disabled={generating}
              >
                Start a run
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="rack-center">
              <Timecode seconds={headerSeconds} />
            </div>
            <div className="rack-right">
              <Tally mode={tallyMode} />
            </div>
          </>
        )}
      </header>

      {phase === 'home' ? (
        <Landing
          onStart={startRun}
          starting={generating}
          error={error}
          onRetry={startRun}
        />
      ) : (
        <main className="stage">
          {phase === 'prep' && scenario && (
          <section className="screen prep">
            <div className="prep-grid">
              <div className="card scenario-card">
                <p className="label">The scenario</p>
                <h2 className="card-title">{scenario.event}</h2>
                <p className="cluster-tag">{scenario.cluster}</p>

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
                <div className="prep-actions">
                  <p className="standby-note">
                    Standby. You go on air automatically when prep runs out — or
                    jump in early whenever you&rsquo;re ready.
                  </p>
                  <button className="btn btn--primary" onClick={goOnAir}>
                    Go on air
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {phase === 'onair' && scenario && (
          <section className="screen onair">
            <div className="onair-head">
              <p className="label">
                {inputMode === 'speech'
                  ? 'Recording — present out loud'
                  : 'Type your presentation'}
              </p>
              <p className="onair-role">{scenario.role}</p>
            </div>

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
                  <span
                    className="overall-score"
                    style={{ color: colorFor(verdict.overall) }}
                  >
                    {verdict.overall}
                  </span>
                  <span className="overall-out">/ 100</span>
                </div>
                <p className="summary">{verdict.summary}</p>

                <ol className="score-list">
                  {verdict.scores.map((entry, i) => (
                    <li className="score-row" key={`${i}-${entry.indicator}`}>
                      <div className="score-row-head">
                        <span className="score-indicator">{entry.indicator}</span>
                        <span
                          className="score-num"
                          style={{ color: colorFor(entry.score) }}
                        >
                          {entry.score}
                        </span>
                      </div>
                      <div className="score-bar">
                        <div
                          className="score-bar-fill"
                          style={{
                            width: `${entry.score}%`,
                            background: colorFor(entry.score)
                          }}
                        />
                      </div>
                      <p className="score-just">{entry.justification}</p>
                      <p className="score-suggest">
                        <span className="suggest-tag">Fix</span>
                        {entry.suggestion}
                      </p>
                    </li>
                  ))}
                </ol>

                <div className="verdict-actions">
                  <button className="btn btn--primary" onClick={newTake}>
                    New take
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        )}
        </main>
      )}
    </div>
  )
}

