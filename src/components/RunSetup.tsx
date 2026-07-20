import { useRef, useState } from 'react'

import { primeAlarm } from '../lib/alarm'
import { DECA_EVENTS, DIFFICULTIES, eventByCode } from '../lib/events'
import type { Difficulty, RunMode } from '../types'
import { ErrorNote, LoadingDots } from './Feedback'
import { Tally } from './Tally'

// The pre-run setup screen: pick your event, pick the tier you're training
// for, and go — or hand in the official event PDF instead. This is where a run
// starts feeling like a competition draw, not a form.

const DIFFICULTY_ORDER: Difficulty[] = ['regional', 'provincial', 'icdc']

interface RunSetupProps {
  eventCode: string
  onEventCode: (code: string) => void
  difficulty: Difficulty
  onDifficulty: (difficulty: Difficulty) => void
  /** Format used for official-PDF runs (generated runs derive it from the event). */
  pdfMode: RunMode
  onPdfMode: (mode: RunMode) => void
  starting: boolean
  error: string | null
  /** Launch a run: no args = generated from the selections; sourceText = PDF run. */
  onLaunch: (sourceText?: string, modeOverride?: RunMode) => void
  onBack: () => void
}

export const RunSetup = ({
  eventCode,
  onEventCode,
  difficulty,
  onDifficulty,
  pdfMode,
  onPdfMode,
  starting,
  error,
  onLaunch,
  onBack
}: RunSetupProps): JSX.Element => {
  const selected = eventByCode(eventCode)
  const tier = DIFFICULTIES[difficulty]
  const timing =
    selected.format === 'team' ? '30:00 prep · 15:00 on air' : '10:00 prep · 10:00 on air'

  // PDF extraction runs here in the browser (pdf.js, lazy-loaded); only the
  // text goes up. Same flow the landing used to own.
  const [reading, setReading] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const lastPdfTextRef = useRef<string | undefined>(undefined)

  const launchGenerated = (): void => {
    primeAlarm() // user gesture — unlocks the alarm for later
    lastPdfTextRef.current = undefined
    onLaunch()
  }

  const handleFile = (file: File | null): void => {
    if (!file) return
    primeAlarm()
    setPdfError(null)
    setReading(true)
    import('../lib/pdf')
      .then(async ({ extractPdfText, PdfReadError }) => {
        try {
          const text = await extractPdfText(file)
          lastPdfTextRef.current = text
          onLaunch(text, pdfMode)
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
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const retry = (): void => {
    if (pdfError) {
      setPdfError(null)
      return
    }
    onLaunch(lastPdfTextRef.current, lastPdfTextRef.current ? pdfMode : undefined)
  }

  return (
    <section className="screen setup">
      <div className="setup-head">
        <p className="label">Build your simulation</p>
        <h2 className="setup-title">Draw your event.</h2>
        <p className="setup-sub">
          Pick the event you compete in and the tier you&rsquo;re training for.
          The scenario, timing, and judging standard all follow.
        </p>
      </div>

      <div className="event-grid" role="radiogroup" aria-label="Choose your event">
        {DECA_EVENTS.map((event) => (
          <button
            key={event.code}
            className={`event-card${event.code === selected.code ? ' is-active' : ''}`}
            role="radio"
            aria-checked={event.code === selected.code}
            onClick={() => onEventCode(event.code)}
          >
            <span className="event-top">
              <span className="event-code">{event.code}</span>
              <span className={`event-format event-format--${event.format}`}>
                {event.format === 'team' ? 'Team' : 'Individual'}
              </span>
            </span>
            <span className="event-name">{event.name}</span>
            <span className="event-blurb">{event.blurb}</span>
          </button>
        ))}
      </div>

      <div className="setup-row">
        <div
          className="tier-toggle"
          role="radiogroup"
          aria-label="Competition tier"
        >
          {DIFFICULTY_ORDER.map((key) => (
            <button
              key={key}
              className={`tier-opt${key === difficulty ? ' is-active' : ''}`}
              role="radio"
              aria-checked={key === difficulty}
              onClick={() => onDifficulty(key)}
            >
              <span className="tier-name">{DIFFICULTIES[key].label}</span>
              <span className="tier-pis">{DIFFICULTIES[key].indicators} PIs</span>
            </button>
          ))}
        </div>
        <p className="tier-blurb">{tier.blurb}</p>
      </div>

      <div className="setup-launch">
        <p className="setup-timing">
          {selected.code} · {tier.label} · {timing}
        </p>
        <button
          className="btn btn--primary btn--lg"
          onClick={launchGenerated}
          disabled={starting || reading}
        >
          {starting ? 'Cueing…' : 'Start simulation'}
        </button>
        <button className="btn btn--ghost btn--sm" onClick={onBack} disabled={starting}>
          Back
        </button>
      </div>

      <div className="setup-pdf">
        <p className="label">Have the official roleplay?</p>
        <p className="setup-pdf-hint">
          Upload the event PDF and rehearse the real scenario — graded on its
          printed performance indicators, at your selected tier.
        </p>
        <div className="setup-pdf-row">
          <div className="mode-toggle" role="radiogroup" aria-label="PDF run format">
            <button
              className={`mode-opt${pdfMode === 'solo' ? ' is-active' : ''}`}
              role="radio"
              aria-checked={pdfMode === 'solo'}
              onClick={() => onPdfMode('solo')}
            >
              <span className="mode-name">Individual</span>
              <span className="mode-timing">10:00 · 10:00</span>
            </button>
            <button
              className={`mode-opt${pdfMode === 'team' ? ' is-active' : ''}`}
              role="radio"
              aria-checked={pdfMode === 'team'}
              onClick={() => onPdfMode('team')}
            >
              <span className="mode-name">Team</span>
              <span className="mode-timing">30:00 · 15:00</span>
            </button>
          </div>
          <button
            className="btn btn--ghost"
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
      </div>

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
                  : `Writing a ${tier.label}-tier ${selected.code} scenario.`}
              </p>
              <LoadingDots />
            </div>
          )}
        </div>
      )}
    </section>
  )
}
