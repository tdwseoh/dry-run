// Score-trend helpers: turn run history into plottable points. Pure and
// chart-library-free — the Sparkline component draws the SVG from these.

import type { RunRecord } from './history'

/**
 * Overall scores in chronological order (history arrives newest-first),
 * capped to the most recent `limit` runs.
 */
export const trendPoints = (history: RunRecord[], limit = 10): number[] =>
  history.slice(0, limit).map((run) => run.overall).reverse()

/** Average of the last `n` scores (chronological tail), or null when empty. */
export const recentAverage = (points: number[], n = 5): number | null => {
  const tail = points.slice(-n)
  if (tail.length === 0) return null
  return Math.round(tail.reduce((sum, p) => sum + p, 0) / tail.length)
}

/**
 * Trend direction: newest score minus the average of what came before it.
 * Positive = improving. Null until there are at least two points.
 */
export const trendDelta = (points: number[]): number | null => {
  if (points.length < 2) return null
  const latest = points[points.length - 1] as number
  const prior = points.slice(0, -1)
  const priorAvg = prior.reduce((sum, p) => sum + p, 0) / prior.length
  return Math.round(latest - priorAvg)
}

/**
 * Map points to SVG polyline coordinates in a `width` × `height` box with
 * `pad` inset. Scores use a fixed 0–100 scale so charts are comparable
 * across users and sessions.
 */
export const sparklinePath = (
  points: number[],
  width: number,
  height: number,
  pad = 4
): Array<{ x: number; y: number }> => {
  if (points.length === 0) return []
  const innerW = width - pad * 2
  const innerH = height - pad * 2
  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0
  return points.map((score, i) => ({
    x: pad + (points.length > 1 ? i * stepX : innerW / 2),
    y: pad + innerH * (1 - Math.min(100, Math.max(0, score)) / 100)
  }))
}
