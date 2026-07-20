import { sparklinePath } from '../lib/trend'

// Dependency-free SVG sparkline for score trends. Fixed 0–100 scale (from
// sparklinePath) so two charts are always comparable; the newest point gets a
// dot in the score's traffic-light colour.

const colorFor = (score: number): string =>
  score >= 75 ? 'var(--mint)' : score >= 50 ? 'var(--amber)' : 'var(--red)'

interface SparklineProps {
  /** Scores in chronological order (see trendPoints). */
  points: number[]
  width?: number
  height?: number
}

export const Sparkline = ({
  points,
  width = 220,
  height = 56
}: SparklineProps): JSX.Element | null => {
  if (points.length < 2) return null
  const coords = sparklinePath(points, width, height)
  const last = coords[coords.length - 1]
  const lastScore = points[points.length - 1] as number
  const path = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')

  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={`Score trend across ${points.length} takes, latest ${lastScore}`}
    >
      <polyline
        points={path}
        fill="none"
        stroke="var(--slate)"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.7"
      />
      {last && (
        <circle cx={last.x} cy={last.y} r="3.4" fill={colorFor(lastScore)} />
      )}
    </svg>
  )
}
