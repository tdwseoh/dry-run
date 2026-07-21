import type { DeliveryStats } from '../lib/delivery'
import { paceLabel, segmentFillers } from '../lib/delivery'
import type { JudgeResult } from '../types'

// The shared body of a verdict — summary, strengths/improvements, delivery
// stats, and the per-indicator score list. Used by BOTH the live verdict
// screen and the training-log review, so the two can never drift. The
// interactive/animated chrome around it (score reveal, burst, Q&A round,
// trend) stays with each caller.

const colorFor = (score: number): string =>
  score >= 75 ? 'var(--mint)' : score >= 50 ? 'var(--amber)' : 'var(--red)'

const formatDuration = (totalSeconds: number): string => {
  const clamped = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(clamped / 60)
  const s = clamped % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

interface VerdictBodyProps {
  verdict: JudgeResult
  delivery: DeliveryStats | null
  /** Stagger the score rows on entry (live verdict) vs. show them at rest (review). */
  animateScores?: boolean
}

export const VerdictBody = ({
  verdict,
  delivery,
  animateScores = false
}: VerdictBodyProps): JSX.Element => (
  <>
    <p className="summary">{verdict.summary}</p>

    {((verdict.strengths?.length ?? 0) > 0 ||
      (verdict.improvements?.length ?? 0) > 0) && (
      <div className="verdict-lists">
        {(verdict.strengths?.length ?? 0) > 0 && (
          <div className="vlist vlist--good">
            <p className="label">What worked</p>
            <ul>
              {verdict.strengths?.map((item, i) => (
                <li key={i}>
                  <span className="vlist-mark">&#10003;</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
        {(verdict.improvements?.length ?? 0) > 0 && (
          <div className="vlist vlist--fix">
            <p className="label">Raise the score</p>
            <ul>
              {verdict.improvements?.map((item, i) => (
                <li key={i}>
                  <span className="vlist-mark">&#8594;</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )}

    {delivery && (
      <div className="delivery" aria-label="Delivery statistics">
        <div className="delivery-stat">
          <span className="delivery-num">{formatDuration(delivery.durationSeconds)}</span>
          <span className="delivery-cap">on air</span>
        </div>
        <div className="delivery-stat">
          <span className="delivery-num">{delivery.words}</span>
          <span className="delivery-cap">words</span>
        </div>
        <div className="delivery-stat">
          <span className="delivery-num">{delivery.wpm}</span>
          <span className="delivery-cap">wpm · {paceLabel(delivery.wpm)}</span>
        </div>
        <div className="delivery-stat">
          <span className="delivery-num">{delivery.fillerTotal}</span>
          <span className="delivery-cap">
            {delivery.fillerTotal === 0
              ? 'fillers — clean take'
              : `fillers · ${delivery.fillers
                  .slice(0, 3)
                  .map((f) => `${f.phrase} ×${f.count}`)
                  .join(', ')}`}
          </span>
        </div>
      </div>
    )}

    <ol className="score-list">
      {verdict.scores.map((entry, i) => (
        <li
          className={`score-row${animateScores ? '' : ' score-row--static'}`}
          key={`${i}-${entry.indicator}`}
          style={animateScores ? { animationDelay: `${i * 90}ms` } : undefined}
        >
          <div className="score-row-head">
            <span className="score-indicator">{entry.indicator}</span>
            <span className="score-num" style={{ color: colorFor(entry.score) }}>
              {entry.score}
            </span>
          </div>
          <div className="score-bar">
            <div
              className="score-bar-fill"
              style={{ width: `${entry.score}%`, background: colorFor(entry.score) }}
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
  </>
)

/** The reviewable transcript ("the tape") with fillers highlighted + copy. Self-contained. */
export const Tape = ({ transcript }: { transcript: string }): JSX.Element | null => {
  if (!transcript) return null
  const copy = (): void => {
    try {
      void navigator.clipboard.writeText(transcript)
    } catch {
      // Clipboard unavailable (insecure context) — the text is on screen anyway.
    }
  }
  return (
    <details className="tape">
      <summary>Read the tape — full transcript, fillers highlighted</summary>
      <p className="tape-text">
        {segmentFillers(transcript).map((seg, i) =>
          seg.filler ? (
            <mark className="filler-mark" key={i}>
              {seg.text}
            </mark>
          ) : (
            <span key={i}>{seg.text}</span>
          )
        )}
      </p>
      <button className="btn btn--ghost btn--sm" onClick={copy}>
        Copy transcript
      </button>
    </details>
  )
}
