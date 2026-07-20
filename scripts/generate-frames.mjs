// Generates the landing film: 89 WebP frames of the studio tally scene,
// deterministic per frame so the scroll scrub is perfectly smooth. The colour
// story follows a run — amber (standby) → red (on air) → mint (verdict) — using
// the same palette as src/index.css.
//
// Run: npm run frames   (output: public/sequence/frame_0001..0089.webp)

import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const FRAME_COUNT = 89
const W = 1600
const H = 900
const OUT_DIR = path.join(process.cwd(), 'public', 'sequence')

const TAU = Math.PI * 2

// Deterministic pseudo-random in [0, 1) — stable across runs.
const rand = (seed) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

const lerp = (a, b, t) => a + (b - a) * t

/** Piecewise hue across the run: amber 38° → red 4° → mint 160°. */
const hueAt = (t) => {
  if (t < 0.35) return 38
  if (t < 0.5) return lerp(38, 4, (t - 0.35) / 0.15)
  if (t < 0.7) return 4
  if (t < 0.85) return lerp(4, 160, (t - 0.7) / 0.15)
  return 160
}

/** One frame of the scene as SVG. t goes 0 → 1 across the sequence. */
const frameSvg = (t) => {
  const cx = W / 2
  const cy = H / 2

  const hue = hueAt(t)
  const accent = `hsl(${hue}, 88%, 58%)`

  // Two starfield layers drifting at different speeds — cheap parallax depth.
  const stars = [0, 1]
    .map((layer) =>
      Array.from({ length: 70 }, (_, i) => {
        const seed = i + layer * 500 + 700
        const drift = t * (layer === 0 ? 26 : 60)
        const sx = ((rand(seed) * (W + 120) + drift) % (W + 120)) - 60
        const sy = rand(seed + 1) * H
        const size = 0.6 + rand(seed + 2) * (layer === 0 ? 1 : 1.6)
        const op = (0.08 + rand(seed + 3) * (layer === 0 ? 0.16 : 0.3)).toFixed(2)
        return `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${size.toFixed(1)}" fill="#cdd6ea" opacity="${op}"/>`
      }).join('\n')
    )
    .join('\n')

  // The tally ring tilts open and rotates as the run progresses.
  const ringTilt = lerp(10, 74, Math.sin(t * Math.PI) ** 1.2)
  const ringSpin = t * 150 - 15
  const ringR = lerp(220, 305, t)

  const rings = [0, 1, 2]
    .map((i) => {
      const r = ringR + i * 34
      const ry = r * Math.sin((ringTilt * Math.PI) / 180)
      const opacity = 0.8 - i * 0.26
      return `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${ry.toFixed(1)}"
        fill="none" stroke="url(#ringGrad)" stroke-width="${2.4 - i * 0.6}"
        opacity="${opacity}" transform="rotate(${ringSpin + i * 8} ${cx} ${cy})"/>`
    })
    .join('\n')

  // A wide counter-rotating outer plane — depth without clutter.
  const counterR = ringR + 130
  const counterRy = counterR * Math.sin(((90 - ringTilt) * Math.PI) / 360)
  const counterPlane = `<ellipse cx="${cx}" cy="${cy}" rx="${counterR}" ry="${counterRy.toFixed(1)}"
    fill="none" stroke="${accent}" stroke-width="0.8" opacity="0.18"
    stroke-dasharray="3 14" transform="rotate(${-ringSpin * 0.6} ${cx} ${cy})"/>`

  // Orbiting particles with motion trails: each dot drags a short arc of its
  // own orbit behind it, so scrubbing reads as movement even in a still.
  const tiltSin = Math.sin((ringTilt * Math.PI) / 180)
  const particles = Array.from({ length: 24 }, (_, i) => {
    const orbit = ringR + rand(i) * 120 - 36
    const speed = 0.3 + rand(i + 200) * 0.5
    const phase = rand(i + 100) * TAU + t * TAU * speed
    const px = cx + Math.cos(phase) * orbit
    const py = cy + Math.sin(phase) * orbit * tiltSin
    const size = 1.2 + rand(i + 300) * 2.4
    const op = 0.2 + rand(i + 400) * 0.55
    // Trail: sampled points a few degrees back along the same ellipse.
    const trailLen = 0.18 + speed * 0.1
    const steps = 6
    const trail = Array.from({ length: steps }, (_, s) => {
      const a = phase - ((s + 1) / steps) * trailLen
      return `${(cx + Math.cos(a) * orbit).toFixed(1)},${(cy + Math.sin(a) * orbit * tiltSin).toFixed(1)}`
    }).join(' ')
    return `<polyline points="${px.toFixed(1)},${py.toFixed(1)} ${trail}" fill="none"
      stroke="${accent}" stroke-width="${(size * 0.7).toFixed(1)}" stroke-linecap="round"
      opacity="${(op * 0.35).toFixed(2)}"/>
    <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${size.toFixed(1)}" fill="${accent}" opacity="${op.toFixed(2)}"/>`
  }).join('\n')

  // A faint waveform strip that swells during the on-air stretch of the film.
  const waveAmp = Math.max(0, Math.sin((t - 0.35) * Math.PI / 0.45)) * 60
  const bars = Array.from({ length: 36 }, (_, i) => {
    const bx = cx - 340 + i * 19
    const bh = 4 + waveAmp * rand(i + 500) * Math.sin((i / 36) * Math.PI)
    return `<rect x="${bx}" y="${(H - 130 - bh / 2).toFixed(1)}" width="7" height="${Math.max(3, bh).toFixed(1)}" rx="3" fill="${accent}" opacity="${(0.12 + (bh / 70) * 0.4).toFixed(2)}"/>`
  }).join('\n')

  // The tally light itself breathes at the center.
  const orbR = lerp(66, 104, Math.sin(t * Math.PI))

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="45%" r="75%">
      <stop offset="0%" stop-color="hsl(${hue}, 30%, 12%)"/>
      <stop offset="60%" stop-color="#0e1119"/>
      <stop offset="100%" stop-color="#090b11"/>
    </radialGradient>
    <radialGradient id="orb" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="hsl(${hue}, 92%, 76%)"/>
      <stop offset="55%" stop-color="${accent}"/>
      <stop offset="100%" stop-color="hsl(${hue}, 88%, 38%)" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${accent}"/>
      <stop offset="100%" stop-color="hsl(${(hue + 30) % 360}, 85%, 62%)"/>
    </linearGradient>
    <filter id="glow" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="26"/>
    </filter>
    <radialGradient id="horizon" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="hsl(${hue}, 70%, 30%)" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="hsl(${hue}, 70%, 20%)" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  ${stars}
  <ellipse cx="${cx}" cy="${H + 60}" rx="${W * 0.75}" ry="170" fill="url(#horizon)" opacity="${(0.5 + Math.sin(t * Math.PI) * 0.3).toFixed(2)}"/>
  <circle cx="${cx}" cy="${cy}" r="${(orbR * 1.9).toFixed(1)}" fill="url(#orb)" opacity="0.32" filter="url(#glow)"/>
  ${counterPlane}
  ${rings}
  ${particles}
  ${bars}
  <circle cx="${cx}" cy="${cy}" r="${orbR.toFixed(1)}" fill="url(#orb)"/>
</svg>`
}

await mkdir(OUT_DIR, { recursive: true })

for (let i = 0; i < FRAME_COUNT; i += 1) {
  const t = i / (FRAME_COUNT - 1)
  const name = `frame_${String(i + 1).padStart(4, '0')}.webp`
  await sharp(Buffer.from(frameSvg(t)))
    .webp({ quality: 82 })
    .toFile(path.join(OUT_DIR, name))
}
console.log(`rendered ${FRAME_COUNT} frames → ${OUT_DIR}`)
