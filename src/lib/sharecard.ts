// Share card: renders the competitor's record as a 1200×630 social image on a
// plain <canvas> (no libraries) and downloads it as a PNG. Same palette and
// honesty rules as the app — every number comes from the real practice log.

export interface ShareCardData {
  name: string
  school: string
  events: string[]
  levelName: string
  readiness: number | null
  streak: number
  runs: number
  average: number | null
  best: number | null
  /** Chronological recent scores for the mini trend line. */
  points: number[]
  /** Earned achievement emojis. */
  badges: string[]
}

const W = 1200
const H = 630
const SCALE = 2 // export at 2x for crispness

const INK = '#0e1119'
const BONE = '#f1eee7'
const SLATE = '#8b93a7'
const AMBER = '#f6b23d'
const LINE = '#2a3242'

const colorFor = (score: number): string =>
  score >= 75 ? '#37d9a9' : score >= 50 ? AMBER : '#ff3b30'

const seededRand = (seed: number): number => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

const drawBackdrop = (ctx: CanvasRenderingContext2D): void => {
  ctx.fillStyle = INK
  ctx.fillRect(0, 0, W, H)

  const glow = ctx.createRadialGradient(950, 180, 40, 950, 180, 520)
  glow.addColorStop(0, 'rgba(246, 178, 61, 0.14)')
  glow.addColorStop(1, 'rgba(246, 178, 61, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  // Starfield + a pair of orbital arcs, echoing the landing film.
  for (let i = 0; i < 60; i += 1) {
    ctx.fillStyle = `rgba(205, 214, 234, ${0.05 + seededRand(i) * 0.2})`
    ctx.beginPath()
    ctx.arc(seededRand(i + 90) * W, seededRand(i + 180) * H, 0.8 + seededRand(i + 270) * 1.4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.strokeStyle = 'rgba(246, 178, 61, 0.25)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.ellipse(985, 185, 300, 110, -0.35, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(55, 217, 169, 0.18)'
  ctx.beginPath()
  ctx.ellipse(985, 185, 360, 140, -0.35, 0, Math.PI * 2)
  ctx.stroke()
}

const drawReadinessRing = (
  ctx: CanvasRenderingContext2D,
  value: number | null
): void => {
  const cx = 985
  const cy = 185
  const r = 92
  ctx.lineWidth = 14
  ctx.lineCap = 'round'
  ctx.strokeStyle = LINE
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()
  if (value !== null) {
    ctx.strokeStyle = colorFor(value)
    ctx.beginPath()
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (value / 100) * Math.PI * 2)
    ctx.stroke()
  }
  ctx.fillStyle = BONE
  ctx.font = '700 64px "JetBrains Mono Variable", monospace'
  ctx.textAlign = 'center'
  ctx.fillText(value === null ? '—' : String(value), cx, cy + 14)
  ctx.fillStyle = SLATE
  ctx.font = '600 16px "JetBrains Mono Variable", monospace'
  ctx.fillText('R E A D Y', cx, cy + 48)
  ctx.textAlign = 'left'
}

const drawTrend = (ctx: CanvasRenderingContext2D, points: number[]): void => {
  if (points.length < 2) return
  const x0 = 70
  const y0 = 470
  const w = 300
  const h = 70
  ctx.strokeStyle = SLATE
  ctx.lineWidth = 3
  ctx.lineJoin = 'round'
  ctx.beginPath()
  points.forEach((score, i) => {
    const x = x0 + (i / (points.length - 1)) * w
    const y = y0 + h * (1 - score / 100)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.stroke()
  const last = points[points.length - 1] as number
  ctx.fillStyle = colorFor(last)
  ctx.beginPath()
  ctx.arc(x0 + w, y0 + h * (1 - last / 100), 7, 0, Math.PI * 2)
  ctx.fill()
}

/** Render the full card into a fresh canvas and return it. */
export const renderShareCard = (data: ShareCardData): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')
  canvas.width = W * SCALE
  canvas.height = H * SCALE
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.scale(SCALE, SCALE)

  drawBackdrop(ctx)
  drawReadinessRing(ctx, data.readiness)

  // Wordmark + level
  ctx.fillStyle = '#ff3b30'
  ctx.beginPath()
  ctx.moveTo(70, 62)
  ctx.lineTo(84, 70)
  ctx.lineTo(70, 78)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = BONE
  ctx.font = '800 24px "Archivo Variable", sans-serif'
  ctx.fillText('D R Y  R U N', 98, 79)
  ctx.fillStyle = AMBER
  ctx.font = '700 20px "JetBrains Mono Variable", monospace'
  ctx.fillText(data.levelName.toUpperCase(), 70, 130)

  // Identity
  ctx.fillStyle = BONE
  ctx.font = '800 84px "Archivo Variable", sans-serif'
  ctx.fillText(data.name, 66, 225, 700)
  ctx.fillStyle = SLATE
  ctx.font = '500 28px "Archivo Variable", sans-serif'
  const identityLine = [data.school, data.events.join(' · ')]
    .filter(Boolean)
    .join('  —  ')
  if (identityLine) ctx.fillText(identityLine, 70, 270, 700)

  // Stats row
  const stats: Array<[string, string, string]> = [
    [String(data.runs), 'ROLEPLAYS', BONE],
    [data.streak > 0 ? `${data.streak}🔥` : '—', 'DAY STREAK', BONE],
    [
      data.average === null ? '—' : String(data.average),
      'AVG SCORE',
      data.average === null ? BONE : colorFor(data.average)
    ],
    [
      data.best === null ? '—' : String(data.best),
      'BEST',
      data.best === null ? BONE : colorFor(data.best)
    ]
  ]
  stats.forEach(([num, cap, color], i) => {
    const x = 70 + i * 185
    ctx.fillStyle = color
    ctx.font = '700 54px "JetBrains Mono Variable", monospace'
    ctx.fillText(num, x, 380)
    ctx.fillStyle = SLATE
    ctx.font = '600 15px "JetBrains Mono Variable", monospace'
    ctx.fillText(cap, x, 410)
  })

  drawTrend(ctx, data.points)

  // Badges
  ctx.font = '40px sans-serif'
  data.badges.slice(0, 8).forEach((emoji, i) => {
    ctx.fillText(emoji, 430 + i * 58, 505)
  })

  // Footer
  ctx.strokeStyle = LINE
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(70, 560)
  ctx.lineTo(1130, 560)
  ctx.stroke()
  ctx.fillStyle = SLATE
  ctx.font = '600 18px "JetBrains Mono Variable", monospace'
  ctx.fillText('TRAIN LIKE A CHAMPION', 70, 596)
  ctx.textAlign = 'right'
  ctx.fillText('EVERY NUMBER EARNED, NEVER INVENTED', 1130, 596)
  ctx.textAlign = 'left'

  return canvas
}

/** Render and download the card as a PNG. */
export const downloadShareCard = (data: ShareCardData): void => {
  const canvas = renderShareCard(data)
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dry-run-${data.name.toLowerCase().replace(/\s+/g, '-')}.png`
    a.click()
    URL.revokeObjectURL(url)
  }, 'image/png')
}
