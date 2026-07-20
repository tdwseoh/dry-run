import { useState } from 'react'

import { DECA_EVENTS } from '../lib/events'
import type { CompetitorProfile, Goal } from '../lib/profile'

// "Create your competitor profile" — a four-beat onboarding overlay, not a
// registration form. One question per screen, everything stored locally
// (see src/lib/profile.ts; this never touches the network).

interface OnboardingProps {
  /** Pre-filled when editing an existing profile. */
  initial: CompetitorProfile | null
  onComplete: (profile: CompetitorProfile) => void
  onDismiss: () => void
}

const GOAL_OPTIONS: Array<{ id: Goal; title: string; detail: string }> = [
  {
    id: 'provincials',
    title: 'Qualify for Provincials',
    detail: 'Make it out of regionals this season.'
  },
  {
    id: 'icdc',
    title: 'Reach ICDC',
    detail: 'Train at international-final standard.'
  },
  {
    id: 'communication',
    title: 'Sharpen my communication',
    detail: 'Speak with structure and confidence anywhere.'
  },
  {
    id: 'consistency',
    title: 'Practice consistently',
    detail: 'Build the habit — a streak that survives the season.'
  }
]

const STEP_COUNT = 4

export const Onboarding = ({
  initial,
  onComplete,
  onDismiss
}: OnboardingProps): JSX.Element => {
  const [step, setStep] = useState(0)
  const [name, setName] = useState(initial?.name ?? '')
  const [school, setSchool] = useState(initial?.school ?? '')
  const [events, setEvents] = useState<string[]>(initial?.events ?? [])
  const [goal, setGoal] = useState<Goal | null>(initial?.goal ?? null)

  const canAdvance =
    step === 0 ? name.trim().length > 0 : step === 3 ? goal !== null : true

  const advance = (): void => {
    if (!canAdvance) return
    if (step < STEP_COUNT - 1) {
      setStep(step + 1)
      return
    }
    onComplete({
      name: name.trim(),
      school: school.trim(),
      events,
      goal: goal as Goal
    })
  }

  const toggleEvent = (code: string): void => {
    setEvents((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    )
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') advance()
  }

  return (
    <div className="launch-overlay onboarding" role="dialog" aria-modal="true" aria-label="Create your competitor profile">
      <div className="onboard-card" key={step}>
        <p className="onboard-progress" aria-hidden="true">
          {Array.from({ length: STEP_COUNT }, (_, i) => (
            <span key={i} className={`onboard-dot${i <= step ? ' is-done' : ''}`} />
          ))}
        </p>

        {step === 0 && (
          <>
            <p className="label">Your competitor profile</p>
            <h2 className="onboard-title">What&rsquo;s your name?</h2>
            <input
              className="onboard-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="First name works"
              aria-label="Your name"
              autoFocus
            />
          </>
        )}

        {step === 1 && (
          <>
            <p className="label">Represent</p>
            <h2 className="onboard-title">What school do you compete for?</h2>
            <input
              className="onboard-input"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Optional — skip if you'd rather not say"
              aria-label="Your school"
              autoFocus
            />
          </>
        )}

        {step === 2 && (
          <>
            <p className="label">Your events</p>
            <h2 className="onboard-title">What do you compete in?</h2>
            <div className="onboard-events" role="group" aria-label="Your events">
              {DECA_EVENTS.map((event) => (
                <button
                  key={event.code}
                  className={`onboard-chip${events.includes(event.code) ? ' is-active' : ''}`}
                  aria-pressed={events.includes(event.code)}
                  onClick={() => toggleEvent(event.code)}
                >
                  {event.code}
                </button>
              ))}
            </div>
            <p className="onboard-hint">Pick any number — you can train them all.</p>
          </>
        )}

        {step === 3 && (
          <>
            <p className="label">The goal</p>
            <h2 className="onboard-title">What are you training for?</h2>
            <div className="onboard-goals" role="radiogroup" aria-label="Your goal">
              {GOAL_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  className={`onboard-goal${goal === option.id ? ' is-active' : ''}`}
                  role="radio"
                  aria-checked={goal === option.id}
                  onClick={() => setGoal(option.id)}
                >
                  <span className="onboard-goal-title">{option.title}</span>
                  <span className="onboard-goal-detail">{option.detail}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <div className="onboard-actions">
          {step > 0 && (
            <button className="btn btn--ghost btn--sm" onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
          <button className="btn btn--primary" onClick={advance} disabled={!canAdvance}>
            {step === STEP_COUNT - 1 ? 'Create my profile' : 'Next'}
          </button>
          <button className="btn btn--ghost btn--sm onboard-skip" onClick={onDismiss}>
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}
