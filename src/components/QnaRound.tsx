import { useEffect, useRef, useState } from 'react'

import { ApiError, judgeRebuttal } from '../lib/api'
import { isSpeechSupported, startSpeech, type SpeechSession } from '../lib/speech'
import type { RebuttalResult, Scenario } from '../types'
import { ErrorNote, LoadingDots } from './Feedback'

/** Same score → colour encoding as the main scorecard. */
const colorFor = (score: number): string =>
  score >= 75 ? 'var(--mint)' : score >= 50 ? 'var(--amber)' : 'var(--red)'

interface QnaRoundProps {
  scenario: Scenario
  transcript: string
  question: string
}

/**
 * The scored Q&A round: the judge's follow-up question, an answer box (spoken
 * via the mic or typed), and a rebuttal verdict from one more judge call.
 *
 * Owns all of its own state; DryRun mounts it once a verdict with a followUp
 * exists and unmounting (new take / re-judge) resets it.
 */
export const QnaRound = ({
  scenario,
  transcript,
  question
}: QnaRoundProps): JSX.Element => {
  const [answer, setAnswer] = useState('')
  const [interim, setInterim] = useState('')
  const [listening, setListening] = useState(false)
  const [judging, setJudging] = useState(false)
  const [result, setResult] = useState<RebuttalResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const speechRef = useRef<SpeechSession | null>(null)

  const stopListening = (): void => {
    speechRef.current?.stop()
    speechRef.current = null
    setListening(false)
    // Fold whatever was mid-utterance into the answer so nothing is lost.
    setInterim((tail) => {
      const clean = tail.trim()
      if (clean) setAnswer((prev) => (prev ? `${prev} ${clean}` : clean))
      return ''
    })
  }

  // Never leave the mic running if the verdict screen goes away mid-answer.
  useEffect(() => () => speechRef.current?.stop(), [])

  const toggleMic = (): void => {
    if (listening) {
      stopListening()
      return
    }
    const session = startSpeech({
      onFinal: (text) =>
        setAnswer((prev) => {
          const clean = text.trim()
          if (!clean) return prev
          return prev ? `${prev} ${clean}` : clean
        }),
      onInterim: (text) => setInterim(text),
      onError: (kind) => {
        // Denied mic or unsupported => stay in the textarea; typing still works.
        if (kind === 'not-allowed' || kind === 'unsupported') {
          speechRef.current = null
          setListening(false)
          setInterim('')
        }
      }
    })
    if (session) {
      speechRef.current = session
      setListening(true)
    }
  }

  const submit = (): void => {
    const tail = interim.trim()
    const fullAnswer = (answer + (tail ? ` ${tail}` : '')).trim()
    if (!fullAnswer || judging) return
    if (listening) stopListening()
    setJudging(true)
    setError(null)
    judgeRebuttal(scenario, transcript, question, fullAnswer)
      .then((verdict) => {
        setResult(verdict)
        setJudging(false)
      })
      .catch((err: unknown) => {
        setJudging(false)
        setError(
          err instanceof ApiError
            ? err.message
            : 'Could not score your answer. Try again.'
        )
      })
  }

  const revise = (): void => {
    setResult(null)
    setError(null)
  }

  const canSubmit = (answer + interim).trim().length > 0

  return (
    <div className="followup">
      <p className="label">The judge looks up and asks</p>
      <p className="followup-q">&ldquo;{question}&rdquo;</p>

      {judging ? (
        <div className="qa-judging">
          <p className="followup-hint">The judge is weighing your answer…</p>
          <LoadingDots />
        </div>
      ) : error ? (
        <ErrorNote message={error} onRetry={submit} />
      ) : result ? (
        <div className="qa-result">
          <div className="qa-result-head">
            <span className="qa-score" style={{ color: colorFor(result.score) }}>
              {result.score}
            </span>
            <span className="qa-score-out">/ 100 on the Q&amp;A</span>
          </div>
          <p className="qa-verdict">{result.verdict}</p>
          <p className="score-suggest">
            <span className="suggest-tag">Fix</span>
            {result.tip}
          </p>
          <button className="btn btn--ghost btn--sm" onClick={revise}>
            Revise your answer
          </button>
        </div>
      ) : (
        <div className="qa-answer">
          <p className="followup-hint">
            This is the Q&amp;A moment of the real event — answer it and get
            scored on how you hold up under pressure.
          </p>
          <textarea
            className="qa-input"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={
              isSpeechSupported()
                ? 'Tap the mic and answer out loud, or type your answer here…'
                : 'Type your answer to the judge here…'
            }
            aria-label="Your answer to the judge's question"
          />
          {listening && (
            <p className="qa-interim" aria-live="polite">
              {interim.trim() ? interim : 'Listening — start talking…'}
            </p>
          )}
          <div className="qa-actions">
            {isSpeechSupported() && (
              <button
                className={`btn btn--ghost btn--sm${listening ? ' qa-mic--live' : ''}`}
                onClick={toggleMic}
              >
                {listening ? 'Stop the mic' : 'Answer out loud'}
              </button>
            )}
            <button
              className="btn btn--primary"
              onClick={submit}
              disabled={!canSubmit}
            >
              Submit to the judge
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
