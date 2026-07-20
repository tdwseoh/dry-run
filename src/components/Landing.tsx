import { useEffect, useRef, useState, type ReactNode } from 'react'

import { primeAlarm } from '../lib/alarm'
import { personalBest, type RunRecord } from '../lib/history'
import type { RunMode } from '../types'
import { ErrorNote, LoadingDots } from './Feedback'
import { Reveal } from './Reveal'
import { ScrollFilm } from './ScrollFilm'
import { Tally } from './Tally'
import { Timecode } from './Timecode'

// The Apple-style scroll landing shown at phase === 'home'. Big type, scroll-in
// reveals, and a pinned sequence whose visual changes state (scenario → prep →
// on air → verdict) as the captions scroll past it. `onStart` kicks off the real
// run; while it's generating (or if it errors) a full-screen launch overlay covers
// the page so the transition into the app feels intentional.
//
// Two ways in: generate a fresh scenario, or upload the OFFICIAL event PDF —
// the PDF is read entirely in the browser (pdf.js, lazy-loaded) and only its
// text goes to the server for structuring.

interface LandingProps {
  onStart: (mode: RunMode, sourceText?: string) => void
  starting: boolean
  error: string | null
  /** Selected run format; lives in the parent so the header CTA matches. */
  mode: RunMode
  onModeChange: (mode: RunMode) => void
  /** Past takes (newest first) — renders the recent-takes strip when non-empty. */
  history: RunRecord[]
}

/** Score → the same mint/amber/red encoding used everywhere else. */
const chipColor = (score: number): string =>
  score >= 75 ? 'var(--mint)' : score >= 50 ? 'var(--amber)' : 'var(--red)'

interface Step {
  kicker: string
  title: string
  body: string
}

const STEPS: Step[] = [
  {
    kicker: '01 — Scenario',
    title: 'A real business problem, made on the spot.',
    body: 'Every run opens on a fresh Principles of Business Management roleplay: your role, the situation, the judge you answer to, and the performance indicators you will be graded on.'
  },
  {
    kicker: '02 — Prep',
    title: 'Ten minutes. Standby light on.',
    body: 'The amber tally means the clock is running and you are getting ready. Read the brief, plan your angle, decide how you will hit each indicator — then go on air whenever you are set.'
  },
  {
    kicker: '03 — On air',
    title: 'The light goes red. You present.',
    body: 'Speak your response out loud like the real event. Your words stream into the transcript live. No mic? It falls back to typing, so the run never dead-ends.'
  },
  {
    kicker: '04 — Verdict',
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
  onStart,
  starting,
  error,
  mode,
  onModeChange,
  history
}: LandingProps): JSX.Element => {
  const [activeStep, setActiveStep] = useState(0)
  const best = personalBest(history)

  // PDF-upload flow: extraction happens here in the browser; only the text is
  // handed up. `reading` covers the extraction wait, `pdfError` local failures.
  const [reading, setReading] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  // Kept so "Try again" after a server-side failure can resend the same text.
  const lastPdfTextRef = useRef<string | undefined>(undefined)

  const startGenerated = (): void => {
    lastPdfTextRef.current = undefined
    onStart(mode)
  }

  const handleFile = (file: File | null): void => {
    if (!file) return
    primeAlarm() // picking a file is the user gesture that unlocks audio
    setPdfError(null)
    setReading(true)
    import('../lib/pdf')
      .then(async ({ extractPdfText, PdfReadError }) => {
        try {
          const text = await extractPdfText(file)
          lastPdfTextRef.current = text
          onStart(mode, text)
        } catch (err) {
          setPdfError(
            err instanceof PdfReadError
              ? err.message
              : "Couldn't read that PDF. Try a different file."
          )
        } finally {
          setReading(false)
        }
      })
      .catch(() => {
        setReading(false)
        setPdfError('The PDF reader failed to load. Check your connection and try again.')
      })
    // Allow re-picking the same file after an error.
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const retry = (): void => {
    if (pdfError) {
      setPdfError(null)
      return
    }
    onStart(mode, lastPdfTextRef.current)
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
          <h1 className="hero-title">
            Rehearse the room
            <br />
            before the room.
          </h1>
          <p className="hero-sub">
            Dry Run is a solo trainer for DECA roleplay. One realistic scenario, ten
            minutes on the clock, then an honest, indicator-by-indicator verdict — no
            partner required.
          </p>
          <div
            className="mode-toggle"
            role="radiogroup"
            aria-label="Run format"
          >
            <button
              className={`mode-opt${mode === 'solo' ? ' is-active' : ''}`}
              role="radio"
              aria-checked={mode === 'solo'}
              onClick={() => onModeChange('solo')}
            >
              <span className="mode-name">Individual</span>
              <span className="mode-timing">10:00 prep · 10:00 on air</span>
            </button>
            <button
              className={`mode-opt${mode === 'team' ? ' is-active' : ''}`}
              role="radio"
              aria-checked={mode === 'team'}
              onClick={() => onModeChange('team')}
            >
              <span className="mode-name">Team</span>
              <span className="mode-timing">30:00 prep · 15:00 on air</span>
            </button>
          </div>
          <div className="hero-actions">
            <button
              className="btn btn--primary btn--lg"
              onClick={startGenerated}
              disabled={starting || reading}
            >
              {starting ? 'Cueing…' : 'Start a run'}
            </button>
            <button
              className="btn btn--ghost btn--lg"
              onClick={() => fileInputRef.current?.click()}
              disabled={starting || reading}
            >
              Upload the event PDF
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="visually-hidden"
              aria-label="Upload an official DECA roleplay PDF"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <p className="upload-hint">
            Have the official roleplay? Upload the event PDF and rehearse the
            real scenario — graded on its printed performance indicators.
          </p>
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
                <p className="seq-kicker">{step.kicker}</p>
                <h3 className="seq-title">{step.title}</h3>
                <p className="seq-body">{step.body}</p>
              </SeqStep>
            ))}
          </div>
        </div>
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
          <h2 className="final-title">Your take is waiting.</h2>
          <p className="final-sub">Pick nothing. Start a run. See where you stand.</p>
          <button
            className="btn btn--primary btn--lg"
            onClick={startGenerated}
            disabled={starting || reading}
          >
            {starting ? 'Cueing…' : 'Start a run'}
          </button>
        </Reveal>
      </section>

      {/* Launch overlay: covers the page during PDF reading / generation, or on failure. */}
      {(starting || reading || error || pdfError) && (
        <div className="launch-overlay" role="status" aria-live="polite">
          {pdfError || error ? (
            <ErrorNote message={pdfError ?? error ?? ''} onRetry={retry} />
          ) : (
            <div className="launch-inner">
              <Tally mode="onair" />
              <p className="launch-text">
                {reading ? 'Reading the brief…' : 'Rolling camera…'}
              </p>
              <p className="launch-sub">
                {reading
                  ? 'Extracting the official scenario from your PDF.'
                  : 'Setting the scene.'}
              </p>
              <LoadingDots />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
