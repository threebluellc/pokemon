// Generates the PWA icon set into public/. Run with: npm run icons
// Simple original artwork: a tilted card with a scan ring, in the accent color.
import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'

const BG = '#0D1017'
const SURFACE = '#161B26'
const ACCENT = '#6A9BFF'

// The art stays inside the central 80% circle so the same file also works as a maskable icon.
function art(size, { rounded }) {
  const s = size
  const cardW = s * 0.36
  const cardH = s * 0.504 // 5:7, like a real card
  const stroke = s * 0.03
  const radius = rounded ? s * 0.22 : 0
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" rx="${radius}" fill="${BG}"/>
  <g transform="rotate(-8 ${s / 2} ${s / 2})">
    <rect x="${(s - cardW) / 2}" y="${(s - cardH) / 2}" width="${cardW}" height="${cardH}" rx="${s * 0.045}"
          fill="${SURFACE}" stroke="${ACCENT}" stroke-width="${stroke}"/>
    <circle cx="${s / 2}" cy="${s / 2 + s * 0.02}" r="${s * 0.085}" fill="none" stroke="${ACCENT}" stroke-width="${stroke}"/>
    <circle cx="${s / 2}" cy="${s / 2 + s * 0.02}" r="${s * 0.03}" fill="${ACCENT}"/>
  </g>
</svg>`
}

const outputs = [
  { file: 'apple-touch-icon.png', size: 180, rounded: false }, // iOS rounds the corners itself
  { file: 'icon-192.png', size: 192, rounded: true },
  { file: 'icon-512.png', size: 512, rounded: true },
  { file: 'icon-maskable-512.png', size: 512, rounded: false }, // full-bleed for maskable
]

await mkdir('public', { recursive: true })
for (const { file, size, rounded } of outputs) {
  await sharp(Buffer.from(art(size, { rounded }))).png().toFile(`public/${file}`)
  console.log('wrote public/' + file)
}
await writeFile('public/favicon.svg', art(64, { rounded: true }))
console.log('wrote public/favicon.svg')
