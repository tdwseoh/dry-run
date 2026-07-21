import { eventByCode } from '../lib/events'
import type { RunRecord } from '../lib/history'
import {
  achievements,
  currentStreak,
  greetingFor,
  levelFor,
  perEventStats,
  readinessScore,
  totalXp,
  type CompetitorProfile,
  type LogEntry
} from '../lib/profile'
import type { ArchivedRun } from '../lib/archive'
import { eventByCode as lookupEvent } from '../lib/events'
import { dailyFocus, goalProgress } from '../lib/goals'
import { downloadShareCard } from '../lib/sharecard'
import { trendPoints } from '../lib/trend'
import type { Difficulty } from '../types'
import { CompetitorCard } from './CompetitorCard'

// The competitor dashboard (phase === 'profile'): identity card, the honest
// numbers behind it, the achievements wall, and a recommended next move.
// Every figure derives from the practice log — nothing is invented.

const colorFor = (score: number): string =>
  score >= 75 ? 'var(--mint)' : score >= 50 ? 'var(--amber)' : 'var(--red)'

const formatDay = (at: number): string =>
  new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

interface ProfileProps {
  profile: CompetitorProfile
  log: LogEntry[]
  history: RunRecord[]
  /** Full archived runs (newest first) — powers the clickable recent takes. */
  archive: ArchivedRun[]
  onStartPracticing: () => void
  /** Launch a run with a specific event + tier pre-selected (daily focus). */
  onStartDrill: (eventCode: string, difficulty: Difficulty) => void
  onEditProfile: () => void
  /** Open one archived run in the training log. */
  onOpenRun: (id: string) => void
  /** Open the full training log. */
  onOpenLog: () => void
  /** Open the settings / data overlay. */
  onOpenSettings: () => void
  /** True when the dashboard is showing the seeded sample season. */
  demoActive: boolean
  onClearDemo: () => void
}

export const Profile = ({
  profile,
  log,
  history,
  archive,
  onStartPracticing,
  onStartDrill,
  onEditProfile,
  onOpenRun,
  onOpenLog,
  onOpenSettings,
  demoActive,
  onClearDemo
}: ProfileProps): JSX.Element => {
  const now = new Date()
  const streak = currentStreak(log, now)
  const all = achievements(log)
  const byEvent = perEventStats(log)
  const totalMinutes = log.reduce((sum, e) => sum + e.minutes, 0)
  const goal = goalProgress(profile.goal, log, now)
  const focus = dailyFocus(profile.events, log, now)
  const focusEvent = lookupEvent(focus.eventCode)

  const shareCard = (): void => {
    const scores = log.map((e) => e.score)
    downloadShareCard({
      name: profile.name,
      school: profile.school,
      events: profile.events,
      levelName: levelFor(totalXp(log)).name,
      readiness: readinessScore(log, now),
      streak,
      runs: log.length,
      average: scores.length
        ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
        : null,
      best: scores.length ? Math.max(...scores) : null,
      points: trendPoints(history),
      badges: all.filter((a) => a.earnedOn !== null).map((a) => a.emoji)
    })
  }

  // Recommended next move: the trained event with the weakest average (2+ runs
  // so one rough take doesn't define it), else just extending the streak.
  const weakest = byEvent
    .filter((e) => e.runs >= 2)
    .sort((a, b) => a.average - b.average)[0]

  return (
    <section className="screen profile">
      {demoActive && (
        <div className="demo-banner" role="status">
          <span>
            Sample season — this is demo data so you can explore the dashboard.
          </span>
          <button className="btn btn--ghost btn--sm" onClick={onClearDemo}>
            Clear demo &amp; start fresh
          </button>
        </div>
      )}

      <div className="profile-head">
        <div>
          <p className="label">Competitor dashboard</p>
          <h2 className="profile-greeting">
            {greetingFor(now.getHours())}, {profile.name.split(' ')[0]}.
          </h2>
          <p className="profile-line">
            {streak > 0
              ? `🔥 ${streak}-day streak — keep it alive with one take today.`
              : 'No streak running. One take today starts a new one.'}
          </p>
        </div>
        <div className="profile-head-actions">
          <button className="btn btn--primary" onClick={onStartPracticing}>
            Start practicing
          </button>
          <button className="btn btn--ghost btn--sm" onClick={onOpenLog}>
            Training log
          </button>
          <button className="btn btn--ghost btn--sm" onClick={shareCard}>
            Share card
          </button>
          <button className="btn btn--ghost btn--sm" onClick={onEditProfile}>
            Edit profile
          </button>
          <button className="btn btn--ghost btn--sm" onClick={onOpenSettings}>
            Settings
          </button>
        </div>
      </div>

      <div className="focus-goal">
        <div className="card focus-card">
          <div className="focus-head">
            <p className="label">Today&rsquo;s focus</p>
            {focus.doneToday && <span className="focus-done">✓ done today</span>}
          </div>
          <p className="focus-drill">
            Drill <strong>{focus.eventCode}</strong> · {focusEvent.name}
          </p>
          <p className="focus-reason">{focus.reason}</p>
          <p className="focus-streak">{focus.streakLine}</p>
          <button
            className="btn btn--primary btn--sm"
            onClick={() => onStartDrill(focus.eventCode, focus.difficulty)}
          >
            {focus.doneToday ? 'Run it again' : "Start today's drill"}
          </button>
        </div>

        <div className="card goal-card">
          <div className="goal-head">
            <p className="label">{goal.label}</p>
            <span className="goal-pct">{goal.pct}%</span>
          </div>
          <div className="goal-bar" aria-hidden="true">
            <div className="goal-bar-fill" style={{ width: `${goal.pct}%` }} />
          </div>
          <ul className="goal-steps">
            {goal.steps.map((s) => (
              <li key={s.id} className={s.done ? 'is-done' : ''}>
                <span className="goal-check" aria-hidden="true">
                  {s.done ? '✓' : '○'}
                </span>
                {s.label}
              </li>
            ))}
          </ul>
          {goal.next && <p className="goal-next">Next: {goal.next}</p>}
        </div>
      </div>

      <div className="profile-grid">
        <CompetitorCard profile={profile} log={log} history={history} />

        <div className="profile-col">
          <div className="card profile-panel">
            <p className="label">Recommended practice</p>
            {weakest ? (
              <p className="profile-reco">
                Sharpen <strong>{weakest.event}</strong> — you&rsquo;re averaging{' '}
                <span style={{ color: colorFor(weakest.average) }}>
                  {weakest.average}
                </span>{' '}
                across {weakest.runs} takes there.
              </p>
            ) : (
              <p className="profile-reco">
                Run two takes in the same event and the trainer will start
                spotting your weak points.
              </p>
            )}
            <p className="profile-minutes">
              {totalMinutes > 0
                ? `${totalMinutes} minutes on air so far.`
                : 'Your first minute on air is waiting.'}
            </p>
          </div>

          {byEvent.length > 0 && (
            <div className="card profile-panel">
              <p className="label">By event</p>
              <ul className="event-stats">
                {byEvent.map((e) => (
                  <li key={e.event}>
                    <span className="event-stats-code" title={eventByCode(e.event).name}>
                      {e.event}
                    </span>
                    <div className="event-stats-bar">
                      <div
                        className="event-stats-fill"
                        style={{
                          width: `${e.average}%`,
                          background: colorFor(e.average)
                        }}
                      />
                    </div>
                    <span className="event-stats-avg" style={{ color: colorFor(e.average) }}>
                      {e.average}
                    </span>
                    <span className="event-stats-runs">×{e.runs}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="card profile-panel">
        <p className="label">Achievements</p>
        <ul className="badge-wall">
          {all.map((a) => (
            <li
              key={a.id}
              className={`badge-tile${a.earnedOn ? '' : ' badge-tile--locked'}`}
            >
              <span className="badge-emoji" aria-hidden="true">
                {a.emoji}
              </span>
              <span className="badge-title">{a.title}</span>
              <span className="badge-detail">
                {a.earnedOn ? `Earned ${a.earnedOn}` : a.detail}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {archive.length > 0 ? (
        <div className="card profile-panel">
          <div className="panel-head">
            <p className="label">Recent takes</p>
            {archive.length > 8 && (
              <button className="btn btn--ghost btn--sm" onClick={onOpenLog}>
                View all {archive.length}
              </button>
            )}
          </div>
          <ul className="take-list take-list--clickable">
            {archive.slice(0, 8).map((run) => (
              <li key={run.id}>
                <button className="take-row" onClick={() => onOpenRun(run.id)}>
                  <span className="take-score" style={{ color: colorFor(run.overall) }}>
                    {run.overall}
                  </span>
                  <span className="take-event">{run.eventName}</span>
                  <span className="take-meta">
                    {run.eventCode || 'PDF'} · {formatDay(run.at)}
                    {run.qnaScore !== undefined ? ' · Q&A' : ''}
                  </span>
                  <span className="take-open" aria-hidden="true">→</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        history.length > 0 && (
          <div className="card profile-panel">
            <p className="label">Recent takes</p>
            <ul className="take-list">
              {history.slice(0, 8).map((run, i) => (
                <li key={`${run.at}-${i}`}>
                  <span className="take-score" style={{ color: colorFor(run.overall) }}>
                    {run.overall}
                  </span>
                  <span className="take-event">{run.event}</span>
                  <span className="take-meta">
                    {formatDay(run.at)} · {run.wpm} wpm · {run.words} words
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )
      )}
    </section>
  )
}
