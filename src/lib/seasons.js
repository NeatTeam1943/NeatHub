// FRC seasons and their game pieces, drawn as inline SVG.
// Each piece renderer returns { svg, x, y, tone, maxW }:
//   x/y   – where the label (image/text) is centred, in % of the piece box
//   tone  – 'd' = dark label (light piece), 'l' = light label (dark piece)
//   maxW  – optional max label width in px

let uid = 0
const grad = (c0, c1, c2) => {
  const id = `g${uid++}`
  return {
    id,
    def: `<radialGradient id="${id}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="${c0}"/><stop offset=".45" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>`,
  }
}
const S = (inner, defs = '') =>
  `<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true"><defs>${defs}</defs>${inner}</svg>`

const ball = (c0, c1, c2, r = 42, extra = '', clip = false) => {
  const g = grad(c0, c1, c2)
  const cp = clip ? `<clipPath id="${g.id}c"><circle cx="50" cy="50" r="${r}"/></clipPath>` : ''
  const ex = clip ? `<g clip-path="url(#${g.id}c)">${extra}</g>` : extra
  return S(`<circle cx="50" cy="50" r="${r}" fill="url(#${g.id})"/>${ex}`, g.def + cp)
}

const gearPath = (cx, cy, ro, ri, n) => {
  let d = ''
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n
    const w = Math.PI / n
    ;[[ri, a - w * 0.55], [ro, a - w * 0.3], [ro, a + w * 0.3], [ri, a + w * 0.55]].forEach((p, j) => {
      d += `${i === 0 && j === 0 ? 'M' : 'L'}${(cx + p[0] * Math.cos(p[1])).toFixed(1)} ${(cy + p[0] * Math.sin(p[1])).toFixed(1)}`
    })
  }
  return d + 'Z'
}

const fuelHoles = [[30, 30], [52, 22], [72, 34], [24, 54], [76, 58], [36, 76], [60, 78]]
  .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="rgba(90,60,0,.45)"/>`).join('')

// Basketball seams are rotated up-and-right so the seam crossing sits away
// from the label, which is moved down-left into the clear panel.
const bballSeams =
  '<path d="M74 -16 C56 6 56 46 74 68 M74 -16 C92 6 92 46 74 68 M0 26 H100" stroke="#3a1600" stroke-width="2.2" fill="none"/>'

export const PIECES = {
  fuel26: { he: 'Fuel', draw: () => ({ svg: ball('#fff7b0', '#f2cf00', '#9c7d00', 40), x: 50, y: 50, tone: 'd' }) },
  coral: {
    he: 'Coral',
    draw: () => ({
      svg: S(
        '<rect x="10" y="34" width="74" height="32" rx="4" fill="url(#coralG)"/><ellipse cx="84" cy="50" rx="8" ry="16" fill="#eef0f2" stroke="#a9afb7"/><ellipse cx="84" cy="50" rx="5" ry="11" fill="#7d848e"/>',
        '<linearGradient id="coralG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#e3e6ea"/><stop offset="1" stop-color="#aeb4bc"/></linearGradient>',
      ),
      x: 46, y: 50, tone: 'd',
    }),
  },
  algae: { he: 'Algae', draw: () => ({ svg: ball('#c8fff3', '#22b8a0', '#0a5b50', 38), x: 50, y: 50, tone: 'l' }) },
  note: {
    he: 'Note',
    draw: () => ({
      svg: S('<ellipse cx="50" cy="58" rx="40" ry="21" fill="none" stroke="#a85700" stroke-width="15"/><ellipse cx="50" cy="52" rx="40" ry="21" fill="none" stroke="#ff8c12" stroke-width="15"/><ellipse cx="50" cy="45" rx="40" ry="20" fill="none" stroke="#ffb35c" stroke-width="2" opacity=".6"/>'),
      x: 50, y: 54, tone: 'l',
    }),
  },
  cone: {
    he: 'Cone',
    draw: () => ({
      svg: S(
        '<rect x="16" y="78" width="68" height="12" rx="2" fill="#c9a400"/><polygon points="50,8 75,80 25,80" fill="url(#coneG)"/>',
        '<linearGradient id="coneG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b89200"/><stop offset=".4" stop-color="#ffe45c"/><stop offset="1" stop-color="#c9a000"/></linearGradient>',
      ),
      x: 50, y: 60, tone: 'd', maxW: 46,
    }),
  },
  cube23: {
    he: 'Cube',
    draw: () => ({
      svg: S('<g stroke-linejoin="round" stroke-width="6"><polygon points="20,36 36,20 80,20 64,36" fill="#9d6bff" stroke="#9d6bff"/><polygon points="64,36 80,20 80,66 64,82" fill="#5526b0" stroke="#5526b0"/><polygon points="20,36 64,36 64,82 20,82" fill="#7a3df0" stroke="#7a3df0"/></g>'),
      x: 42, y: 59, tone: 'l', maxW: 50,
    }),
  },
  cargoR: { he: 'Cargo אדום', draw: () => ({ svg: ball('#ffb3b3', '#e03131', '#7a1010', 40), x: 50, y: 50, tone: 'l' }) },
  cargoB: { he: 'Cargo כחול', draw: () => ({ svg: ball('#b3ccff', '#2f6fe0', '#0e2c7a', 40), x: 50, y: 50, tone: 'l' }) },
  cell: { he: 'Power Cell', draw: () => ({ svg: ball('#fff4a0', '#ecc800', '#8f7300', 40), x: 50, y: 50, tone: 'd' }) },
  cargo19: { he: 'Cargo', draw: () => ({ svg: ball('#ffd0a0', '#ff8a1f', '#9a4300', 40), x: 50, y: 50, tone: 'd' }) },
  hatch: {
    he: 'Hatch Panel',
    draw: () => ({
      svg: S('<circle cx="50" cy="52" r="43" fill="#8f949b"/><circle cx="50" cy="49" r="43" fill="#c9ccd1" stroke="#9aa0a8" stroke-width="3"/><circle cx="50" cy="49" r="30" fill="none" stroke="#aeb3ba" stroke-width="1.5"/><circle cx="50" cy="49" r="11" fill="rgba(0,0,0,.45)"/>'),
      x: 50, y: 49, tone: 'd',
    }),
  },
  pcube: {
    he: 'Power Cube',
    draw: () => ({
      svg: S('<g stroke-linejoin="round" stroke-width="5"><polygon points="18,36 34,20 82,20 66,36" fill="#ffe14d" stroke="#ffe14d"/><polygon points="66,36 82,20 82,68 66,84" fill="#c49e00" stroke="#c49e00"/><polygon points="18,36 66,36 66,84 18,84" fill="#f2c800" stroke="#f2c800"/></g><rect x="24" y="42" width="36" height="36" fill="none" stroke="#9c7d00" stroke-dasharray="3 2"/>'),
      x: 42, y: 60, tone: 'd', maxW: 50,
    }),
  },
  fuel17: { he: 'Fuel', draw: () => ({ svg: ball('#fffbd0', '#f5e030', '#a88f00', 36, fuelHoles), x: 50, y: 50, tone: 'd' }) },
  gear: {
    he: 'Gear',
    draw: () => ({
      svg: S(`<path d="${gearPath(50, 52, 44, 36, 12)}" fill="#9c7d00"/><path d="${gearPath(50, 48, 44, 36, 12)}" fill="#f2c800" stroke="#c49e00" stroke-width="1.5"/><circle cx="50" cy="48" r="22" fill="#e0b800"/>`),
      x: 50, y: 48, tone: 'd',
    }),
  },
  boulder: { he: 'Boulder', draw: () => ({ svg: ball('#d6d6d6', '#8c8c8c', '#3f3f3f', 43), x: 50, y: 50, tone: 'l' }) },
  tote15: {
    he: 'Tote',
    draw: () => ({
      svg: S('<polygon points="18,34 82,34 76,88 24,88" fill="#8a8981"/><rect x="13" y="24" width="74" height="12" rx="2" fill="#9d9c95"/><line x1="30" y1="38" x2="32" y2="86" stroke="rgba(0,0,0,.2)"/><line x1="70" y1="38" x2="68" y2="86" stroke="rgba(0,0,0,.2)"/>'),
      x: 50, y: 62, tone: 'l',
    }),
  },
  bin: {
    he: 'Recycling Container',
    draw: () => ({
      svg: S(
        '<rect x="26" y="12" width="48" height="80" rx="6" fill="url(#binG)"/><ellipse cx="50" cy="13" rx="24" ry="6" fill="#145a25"/>',
        '<linearGradient id="binG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1f6e30"/><stop offset=".4" stop-color="#3fae55"/><stop offset="1" stop-color="#1b5e2a"/></linearGradient>',
      ),
      x: 50, y: 54, tone: 'l', maxW: 44,
    }),
  },
  bigR: { he: 'כדור אדום', draw: () => ({ svg: ball('#ffb3b3', '#d92b2b', '#6e0d0d', 47), x: 50, y: 50, tone: 'l' }) },
  bigB: { he: 'כדור כחול', draw: () => ({ svg: ball('#b3ccff', '#2b5fd9', '#0c2470', 47), x: 50, y: 50, tone: 'l' }) },
  frisbee: {
    he: 'Frisbee',
    draw: () => ({
      svg: S('<ellipse cx="50" cy="58" rx="46" ry="17" fill="#a9aeb6"/><ellipse cx="50" cy="53" rx="45" ry="16" fill="#f4f5f7" stroke="#c3c7cd"/><ellipse cx="50" cy="53" rx="30" ry="10" fill="none" stroke="#d0d4da"/>'),
      x: 50, y: 53, tone: 'd',
    }),
  },
  bball: {
    he: 'כדורסל',
    draw: () => ({ svg: ball('#ffc08a', '#e8641c', '#7a2a00', 41, bballSeams, true), x: 40, y: 64, tone: 'd', maxW: 48 }),
  },
}

export const SEASONS = [
  { year: 2026, name: 'REBUILT', pieces: ['fuel26'] },
  { year: 2025, name: 'REEFSCAPE', pieces: ['coral', 'algae'] },
  { year: 2024, name: 'CRESCENDO', pieces: ['note'] },
  { year: 2023, name: 'CHARGED UP', pieces: ['cone', 'cube23'] },
  { year: 2022, name: 'RAPID REACT', pieces: ['cargoR', 'cargoB'] },
  { year: 2020, name: 'INFINITE RECHARGE', pieces: ['cell'], label: '2020/21' },
  { year: 2019, name: 'DEEP SPACE', pieces: ['cargo19', 'hatch'] },
  { year: 2018, name: 'POWER UP', pieces: ['pcube'] },
  { year: 2017, name: 'STEAMWORKS', pieces: ['fuel17', 'gear'] },
  { year: 2016, name: 'STRONGHOLD', pieces: ['boulder'] },
  { year: 2015, name: 'RECYCLE RUSH', pieces: ['tote15', 'bin'] },
  { year: 2014, name: 'AERIAL ASSIST', pieces: ['bigR', 'bigB'] },
  { year: 2013, name: 'ULTIMATE ASCENT', pieces: ['frisbee'] },
  { year: 2012, name: 'REBOUND RUMBLE', pieces: ['bball'] },
]

export const DEFAULT_SEASON = 2026

export const seasonOf = (year) => SEASONS.find((s) => s.year === year) || SEASONS[0]
export const seasonLabel = (s) => `${s.label || s.year} · ${s.name}`

// Cache rendered SVG strings per piece key (gradients get unique ids once).
const cache = {}
export function drawPiece(key) {
  if (!PIECES[key]) key = 'fuel26'
  if (!cache[key]) cache[key] = PIECES[key].draw()
  return cache[key]
}
