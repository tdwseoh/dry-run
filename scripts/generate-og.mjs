// Generates public/og.png — the 1200×630 social-preview card. Composites a
// frame from the landing film with the wordmark and tagline.
//
// Run: npm run og   (re-run after regenerating frames)

import path from 'node:path'
import sharp from 'sharp'

const W = 1200
const H = 630

const overlay = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0e1119" stop-opacity="0.25"/>
      <stop offset="70%" stop-color="#0e1119" stop-opacity="0.72"/>
      <stop offset="100%" stop-color="#0e1119" stop-opacity="0.92"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#shade)"/>
  <g font-family="Helvetica, Arial, sans-serif">
    <polygon points="84,84 102,95 84,106" fill="#ff3b30"/>
    <text x="120" y="103" font-size="26" font-weight="800" letter-spacing="10" fill="#f1eee7">DRY RUN</text>
    <text x="80" y="330" font-size="96" font-weight="800" letter-spacing="-2" fill="#f1eee7">Train like</text>
    <text x="80" y="432" font-size="96" font-weight="800" letter-spacing="-2" fill="#f1eee7">a champion.</text>
    <text x="82" y="500" font-size="28" fill="#8b93a7">The DECA roleplay trainer — real events, real timing, an honest judge.</text>
    <text x="82" y="566" font-size="18" font-weight="700" letter-spacing="6" fill="#f6b23d">SCENARIO · PREP · ON AIR · VERDICT</text>
  </g>
</svg>`

const frame = path.join(process.cwd(), 'public', 'sequence', 'frame_0032.webp')
await sharp(frame)
  .resize(W, H, { fit: 'cover' })
  .composite([{ input: Buffer.from(overlay) }])
  .png()
  .toFile(path.join(process.cwd(), 'public', 'og.png'))
console.log('wrote public/og.png')
