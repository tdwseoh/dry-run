import { useState } from 'react'

import type { ArchivedRun } from '../lib/archive'
import { DIFFICULTIES } from '../lib/events'
import { Tape, VerdictBody } from './VerdictBody'

// The training log: every past take, kept in full and reopenable. The list is
// the "training regimen" view; clicking a run reopens its complete verdict —
// the scorecard, the strengths/fixes, the delivery read, and the tape — exactly
// as it was scored, so a competitor can actually study their own history.

const colorFor = (score: number): string =>
  score >= 75 ? 'var(--mint)' : score >= 50 ? 'var(--amber)' : 'var(--red)'

const formatDate = (at: number): string =>
  new Date(at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })

interface TrainingLogProps {
  runs: ArchivedRun[]
  /** Deep-link: open straight to this run's detail (from a "recent takes" click). */
  initialRunId?: string | null
  onBack: () => void
  onStartPracticing: () => void
}

export const TrainingLog = ({
  runs,
  initialRunId,
  onBack,
  onStartPracticing
}: TrainingLogProps): JSX.Element => {
  const [selectedId, setSelectedId] = useState<string | null>(initialRunId ?? null)
  const selected = selectedId ? runs.find((r) => r.id === selectedId) : undefined

  // ---- Detail view --------------------------------------------------------
  if (selected) {
    const tier = DIFFICULTIES[selected.difficulty]
    return (
      <section className="screen review">
        <button className="btn btn--ghost btn--sm review-back" onClick={() => setSelectedId(null)}>
          ← All takes
        </button>

        <div className="review-head">
          <div>
            <p className="label">
              {selected.eventCode || 'Official PDF'} · {tier.label} ·{' '}
              {formatDate(selected.at)}
            </p>
            <h2 className="card-title">{selected.eventName}</h2>
          </div>
          <div className="review-score">
            <span className="review-score-num" style={{ color: colorFor(selected.overall) }}>
              {selected.overall}
            </span>
            <span className="review-score-out">/ 100</span>
          </div>
        </div>

        <details className="onair-notes review-brief">
          <summary>The brief — role, situation &amp; indicators</summary>
          <div className="onair-brief">
            <p className="scenario-text">{selected.scenario.role}</p>
            <p className="onair-brief-text">{selected.scenario.situation}</p>
            <ul className="onair-brief-list">
              {selected.scenario.indicators.map((indicator, i) => (
                <li key={`${i}-${indicator}`}>{indicator}</li>
              ))}
            </ul>
          </div>
        </details>

        <VerdictBody verdict={selected.verdict} delivery={selected.delivery} />

        {selected.verdict.followUp && (
          <div className="followup review-followup">
            <p className="label">The judge asked</p>
            <p className="followup-q">&ldquo;{selected.verdict.followUp}&rdquo;</p>
            {selected.qnaScore !== undefined && (
              <p className="review-qna">
                You scored{' '}
                <strong style={{ color: colorFor(selected.qnaScore) }}>
                  {selected.qnaScore}
                </strong>{' '}
                on the Q&amp;A.
              </p>
            )}
          </div>
        )}

        <Tape transcript={selected.transcript} />

        <div className="verdict-actions">
          <button className="btn btn--primary" onClick={onStartPracticing}>
            Run another take
          </button>
          <button className="btn btn--ghost" onClick={() => setSelectedId(null)}>
            Back to the log
          </button>
        </div>
      </section>
    )
  }

  // ---- List view ----------------------------------------------------------
  return (
    <section className="screen traininglog">
      <div className="log-head">
        <div>
          <p className="label">Training log</p>
          <h2 className="setup-title">Every take on record.</h2>
          <p className="setup-sub">
            {runs.length === 0
              ? 'Your scored takes will collect here — reopen any of them to study the full verdict.'
              : `${runs.length} take${runs.length === 1 ? '' : 's'} archived. Open any one to re-read the judge’s scorecard, strengths, and the tape.`}
          </p>
        </div>
        <div className="log-head-actions">
          <button className="btn btn--primary" onClick={onStartPracticing}>
            Start practicing
          </button>
          <button className="btn btn--ghost btn--sm" onClick={onBack}>
            Back
          </button>
        </div>
      </div>

      {runs.length === 0 ? (
        <div className="log-empty">
          <p>No takes yet. Run your first simulation and it lands here.</p>
        </div>
      ) : (
        <ul className="log-list">
          {runs.map((run) => (
            <li key={run.id}>
              <button className="log-row" onClick={() => setSelectedId(run.id)}>
                <span className="log-score" style={{ color: colorFor(run.overall) }}>
                  {run.overall}
                </span>
                <span className="log-main">
                  <span className="log-event">{run.eventName}</span>
                  <span className="log-meta">
                    {run.eventCode || 'PDF'} · {DIFFICULTIES[run.difficulty].label}
                    {run.qnaScore !== undefined ? ' · Q&A answered' : ''}
                  </span>
                </span>
                <span className="log-date">{formatDate(run.at)}</span>
                <span className="log-open" aria-hidden="true">
                  →
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
