import { eventByCode } from '../lib/events'
import type { RunRecord } from '../lib/history'
import {
  achievements,
  currentStreak,
  levelFor,
  readinessScore,
  totalXp,
  type CompetitorProfile,
  type LogEntry
} from '../lib/profile'
import { trendPoints } from '../lib/trend'
import { Sparkline } from './Sparkline'

// The competitor identity card: LinkedIn's "this is who I am" plus a gaming
// progress readout, derived entirely from real practice data. Rendered on the
// profile screen AND (with sample data) in the landing's platform showcase —
// the showcase shows the real component, not a mockup.

const colorFor = (score: number): string =>
  score >= 75 ? 'var(--mint)' : score >= 50 ? 'var(--amber)' : 'var(--red)'

/** Small SVG ring for the readiness readout (same family as the standby ring). */
const ReadinessRing = ({ value }: { value: number | null }): JSX.Element => {
  const R = 52
  const C = 2 * Math.PI * R
  const frac = value === null ? 0 : value / 100
  const color = value === null ? 'var(--line)' : colorFor(value)
  return (
    <div className="ready-ring" role="img" aria-label={`Competition readiness ${value ?? 'not yet rated'}`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="ready-track" cx="60" cy="60" r={R} />
        <circle
          className="ready-fill"
          cx="60"
          cy="60"
          r={R}
          stroke={color}
          strokeDasharray={C}
          strokeDashoffset={C * (1 - frac)}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div className="ready-center">
        <span className="ready-num">{value ?? '—'}</span>
        <span className="ready-cap">ready</span>
      </div>
    </div>
  )
}

interface CompetitorCardProps {
  profile: CompetitorProfile
  log: LogEntry[]
  history: RunRecord[]
  /** Frozen clock for showcase rendering; defaults to now. */
  now?: Date
}

export const CompetitorCard = ({
  profile,
  log,
  history,
  now = new Date()
}: CompetitorCardProps): JSX.Element => {
  const level = levelFor(totalXp(log))
  const streak = currentStreak(log, now)
  const ready = readinessScore(log, now)
  const earned = achievements(log).filter((a) => a.earnedOn !== null)
  const points = trendPoints(history)
  const scores = log.map((e) => e.score)
  const best = scores.length ? Math.max(...scores) : null
  const avg = scores.length
    ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
    : null

  return (
    <article className="comp-card">
      <div className="comp-head">
        <div className="comp-id">
          <h3 className="comp-name">{profile.name}</h3>
          {profile.school && <p className="comp-school">{profile.school}</p>}
          <div className="comp-events">
            {profile.events.map((code) => (
              <span className="comp-event" key={code} title={eventByCode(code).name}>
                {code}
              </span>
            ))}
          </div>
        </div>
        <ReadinessRing value={ready} />
      </div>

      <div className="comp-level">
        <span className="comp-level-name">{level.name}</span>
        <div className="comp-level-bar" aria-hidden="true">
          <div
            className="comp-level-fill"
            style={{ width: `${Math.round(level.progress * 100)}%` }}
          />
        </div>
        <span className="comp-level-next">
          {level.toNext === null ? 'Top level' : `${level.toNext} XP to next`}
        </span>
      </div>

      <div className="comp-stats">
        <div className="comp-stat">
          <span className="comp-num">{log.length}</span>
          <span className="comp-cap">roleplays</span>
        </div>
        <div className="comp-stat">
          <span className="comp-num">{streak > 0 ? `🔥 ${streak}` : '—'}</span>
          <span className="comp-cap">day streak</span>
        </div>
        <div className="comp-stat">
          <span className="comp-num" style={avg !== null ? { color: colorFor(avg) } : undefined}>
            {avg ?? '—'}
          </span>
          <span className="comp-cap">avg score</span>
        </div>
        <div className="comp-stat">
          <span className="comp-num" style={best !== null ? { color: colorFor(best) } : undefined}>
            {best ?? '—'}
          </span>
          <span className="comp-cap">best</span>
        </div>
      </div>

      {points.length >= 2 && (
        <div className="comp-trend">
          <span className="comp-cap">last {points.length} takes</span>
          <Sparkline points={points} width={180} height={44} />
        </div>
      )}

      {earned.length > 0 && (
        <div className="comp-badges" aria-label="Achievements earned">
          {earned.slice(0, 6).map((a) => (
            <span className="comp-badge" key={a.id} title={`${a.title} — ${a.detail}`}>
              {a.emoji}
            </span>
          ))}
          {earned.length > 6 && (
            <span className="comp-badge comp-badge--more">+{earned.length - 6}</span>
          )}
        </div>
      )}
    </article>
  )
}
