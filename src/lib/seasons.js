// FRC seasons and their game pieces, drawn as inline SVG.
// Each piece renderer returns { svg, box, tone }:
//   box   – label safe area { x, y, w, h } (centre + size, % of the piece box)
//   tone  – 'd' = dark label (light piece), 'l' = light label (dark piece)

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

// Basketball seams sit near the edges so the centre panel stays clear for the label.
const bballSeams =
  '<path d="M4 22 Q50 30 96 22" stroke="#3a1600" stroke-width="2.2" fill="none"/>' +
  '<path d="M25 9 C5 36 5 66 25 93 M75 9 C95 36 95 66 75 93" stroke="#3a1600" stroke-width="2.2" fill="none"/>'

// Every piece declares its label "safe box" (centre x/y and width/height, in % of the
// 100×100 piece). The label is auto-shrunk until it fits entirely inside that box.
const box = (x, y, w, h) => ({ x, y, w, h })
const BALL = (r) => box(50, 50, r * 1.42, r * 1.32)

// ---- Shape helpers (older seasons reuse these with their own colours) ----
// Colour triples are [light, mid, dark].
const pentagon = (cx, cy, r, rot = 0) =>
  `<polygon points="${[0, 1, 2, 3, 4].map((k) => {
    const a = ((rot + k * 72 - 90) * Math.PI) / 180
    return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`
  }).join(' ')}" fill="#1c1c1c"/>`

// Soccer ball: black patches sit near the rim so the centre stays clear for the label.
const soccerBall = (r = 44) =>
  ball('#ffffff', '#eceff3', '#8e96a1', r,
    [0, 72, 144, 216, 288].map((a) => {
      const rad = ((a - 90) * Math.PI) / 180
      return pentagon(50 + Math.cos(rad) * r * 0.92, 50 + Math.sin(rad) * r * 0.92, r * 0.24, a)
    }).join(''), true)

// Tennis-style ball with a seam curving along both sides.
const seamBall = ([c0, c1, c2], seam, r = 42) =>
  ball(c0, c1, c2, r,
    `<path d="M32 11 C15 36 15 64 32 89 M68 11 C85 36 85 64 68 89" stroke="${seam}" stroke-width="3.5" fill="none" opacity=".95"/>`, true)

// Ring / inflated tube seen from above at an angle (label sits in the hole).
const ringPiece = ([c0, c1, c2], ry = 31) =>
  S(`<ellipse cx="50" cy="${50 + 6}" rx="42" ry="${ry}" fill="none" stroke="${c2}" stroke-width="14"/>` +
    `<ellipse cx="50" cy="50" rx="42" ry="${ry}" fill="none" stroke="${c1}" stroke-width="14"/>` +
    `<ellipse cx="50" cy="${50 - 7}" rx="42" ry="${ry - 1}" fill="none" stroke="${c0}" stroke-width="2" opacity=".55"/>`)

// Inflated tube bent into a flat shape (2011 logo pieces): circle, triangle or square.
const tubeShape = (kind, [c0, c1, c2]) => {
  const d = {
    circle: 'M50 10 a40 40 0 1 0 0.01 0Z',
    triangle: 'M50 10 L91 84 L9 84 Z',
    square: 'M13 13 H87 V87 H13 Z',
  }[kind]
  return S(`<path d="${d}" transform="translate(0 4)" fill="none" stroke="${c2}" stroke-width="15" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="${c1}" stroke-width="15" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="${c0}" stroke-width="3" stroke-linejoin="round" opacity=".6" transform="translate(-1.5 -2.5)"/>`)
}

// Tetrahedron built from tubes (2005).
const tetra = ([c0, c1, c2]) =>
  S(`<polygon points="50,8 92,86 8,86" fill="${c1}" opacity=".22"/>` +
    `<g stroke-linecap="round" stroke-width="9" fill="none">` +
    `<path d="M50 8 L62 64 M8 86 L62 64 M92 86 L62 64" stroke="${c2}"/>` +
    `<path d="M50 8 L92 86 L8 86 Z" stroke="${c1}" stroke-linejoin="round"/></g>` +
    `<path d="M50 8 L92 86" stroke="${c0}" stroke-width="2" opacity=".6"/>`)

// Open-top plastic bin / crate in a given colour.
const binShape = ([c0, c1, c2]) =>
  S(`<polygon points="8,28 92,28 84,94 16,94" fill="${c1}"/><rect x="3" y="16" width="94" height="14" rx="2" fill="${c0}"/>` +
    `<polygon points="8,30 92,30 91,36 9,36" fill="${c2}" opacity=".5"/>` +
    `<line x1="22" y1="38" x2="25" y2="92" stroke="rgba(0,0,0,.18)"/><line x1="78" y1="38" x2="75" y2="92" stroke="rgba(0,0,0,.18)"/>`)

// Soccer-style ball in any colour (patches near the rim).
const patchBall = ([c0, c1, c2], patch, r = 44) =>
  ball(c0, c1, c2, r,
    [0, 72, 144, 216, 288].map((a) => {
      const rad = ((a - 90) * Math.PI) / 180
      return pentagon(50 + Math.cos(rad) * r * 0.92, 50 + Math.sin(rad) * r * 0.92, r * 0.24, a).replace('#1c1c1c', patch)
    }).join(''), true)

// Woven "orbit ball" (2009): a sphere of crossing strips.
const wovenBall = ([c0, c1, c2], strip, r = 43) => {
  const m = `m${uid++}`
  return ball(c0, c1, c2, r,
    `<mask id="${m}"><rect width="100" height="100" fill="#fff"/><circle cx="50" cy="50" r="${r * 0.58}" fill="#000"/></mask>` +
    `<g stroke="${strip}" stroke-width="5" fill="none" opacity=".5" mask="url(#${m})">` +
    `<ellipse cx="50" cy="50" rx="${r}" ry="${r * 0.35}"/><ellipse cx="50" cy="50" rx="${r * 0.35}" ry="${r}"/>` +
    `<ellipse cx="50" cy="50" rx="${r}" ry="${r * 0.35}" transform="rotate(45 50 50)"/><ellipse cx="50" cy="50" rx="${r}" ry="${r * 0.35}" transform="rotate(-45 50 50)"/></g>`, true)
}

// Frisbee / disc in any colour.
const disc = ([c0, c1, c2]) =>
  S(`<ellipse cx="50" cy="57" rx="47" ry="32" fill="${c2}"/><ellipse cx="50" cy="51" rx="46" ry="31" fill="${c1}" stroke="${c2}"/>` +
    `<ellipse cx="50" cy="51" rx="34" ry="22" fill="none" stroke="${c0}" stroke-width="1.5" opacity=".8"/>`)

// Pipe / pool-noodle seen from the side, open end on the right.
const pipe = ([c0, c1, c2], hole) => {
  const id = `p${uid++}`
  return S(`<rect x="6" y="27" width="78" height="46" rx="6" fill="url(#${id})"/><ellipse cx="84" cy="50" rx="10" ry="23" fill="${c1}" stroke="${c2}"/><ellipse cx="84" cy="50" rx="6" ry="15" fill="${hole}"/>`,
    `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c0}"/><stop offset=".6" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>`)
}

// Soft pillow-like piece with stitched edge.
const pillow = ([c0, c1, c2]) => {
  const g = grad(c0, c1, c2)
  return S(`<path d="M14 18 Q50 8 86 18 Q96 50 86 82 Q50 92 14 82 Q4 50 14 18Z" fill="url(#${g.id})"/>` +
    `<path d="M20 24 Q50 15 80 24 Q88 50 80 76 Q50 85 20 76 Q12 50 20 24Z" fill="none" stroke="${c2}" stroke-width="1.5" stroke-dasharray="4 3" opacity=".7"/>`, g.def)
}

export const PIECES = {
  fuel26: { he: 'Fuel', draw: () => ({ svg: ball('#fff7b0', '#f2cf00', '#9c7d00', 44), box: BALL(44), tone: 'd' }) },
  coral: {
    he: 'Coral',
    draw: () => ({
      svg: S(
        '<rect x="6" y="27" width="78" height="46" rx="6" fill="url(#coralG)"/><ellipse cx="84" cy="50" rx="10" ry="23" fill="#eef0f2" stroke="#a9afb7"/><ellipse cx="84" cy="50" rx="6" ry="16" fill="#7d848e"/>',
        '<linearGradient id="coralG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#e3e6ea"/><stop offset="1" stop-color="#aeb4bc"/></linearGradient>',
      ),
      box: box(42, 50, 66, 38), tone: 'd',
    }),
  },
  algae: { he: 'Algae', draw: () => ({ svg: ball('#c8fff3', '#22b8a0', '#0a5b50', 42), box: BALL(42), tone: 'l' }) },
  note: {
    he: 'Note',
    draw: () => ({
      svg: S('<ellipse cx="50" cy="56" rx="42" ry="31" fill="none" stroke="#a85700" stroke-width="14"/><ellipse cx="50" cy="50" rx="42" ry="31" fill="none" stroke="#ff8c12" stroke-width="14"/><ellipse cx="50" cy="43" rx="42" ry="30" fill="none" stroke="#ffb35c" stroke-width="2" opacity=".55"/>'),
      box: box(50, 50, 54, 36), tone: 'l',
    }),
  },
  cone: {
    he: 'Cone',
    draw: () => ({
      svg: S(
        '<rect x="8" y="84" width="84" height="12" rx="2" fill="#c9a400"/><polygon points="50,2 92,86 8,86" fill="url(#coneG)"/>',
        '<linearGradient id="coneG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b89200"/><stop offset=".4" stop-color="#ffe45c"/><stop offset="1" stop-color="#c9a000"/></linearGradient>',
      ),
      box: box(50, 69, 58, 28), tone: 'd',
    }),
  },
  cube23: {
    he: 'Cube',
    draw: () => ({
      svg: S('<g stroke-linejoin="round" stroke-width="6"><polygon points="8,28 24,12 92,12 76,28" fill="#9d6bff" stroke="#9d6bff"/><polygon points="76,28 92,12 92,80 76,96" fill="#5526b0" stroke="#5526b0"/><polygon points="8,28 76,28 76,96 8,96" fill="#7a3df0" stroke="#7a3df0"/></g>'),
      box: box(42, 62, 60, 60), tone: 'l',
    }),
  },
  cargoR: { he: 'Cargo אדום', draw: () => ({ svg: ball('#ffb3b3', '#e03131', '#7a1010', 44), box: BALL(44), tone: 'l' }) },
  cargoB: { he: 'Cargo כחול', draw: () => ({ svg: ball('#b3ccff', '#2f6fe0', '#0e2c7a', 44), box: BALL(44), tone: 'l' }) },
  cell: { he: 'Power Cell', draw: () => ({ svg: ball('#fff4a0', '#ecc800', '#8f7300', 44), box: BALL(44), tone: 'd' }) },
  cargo19: { he: 'Cargo', draw: () => ({ svg: ball('#ffd0a0', '#ff8a1f', '#9a4300', 44), box: BALL(44), tone: 'd' }) },
  hatch: {
    he: 'Hatch Panel',
    draw: () => ({
      svg: S('<circle cx="50" cy="53" r="46" fill="#8f949b"/><circle cx="50" cy="49" r="46" fill="#d3d6da" stroke="#9aa0a8" stroke-width="3"/><circle cx="50" cy="49" r="38" fill="none" stroke="#b8bdc4" stroke-width="1.5"/>'),
      box: box(50, 49, 60, 56), tone: 'd',
    }),
  },
  pcube: {
    he: 'Power Cube',
    draw: () => ({
      svg: S('<g stroke-linejoin="round" stroke-width="5"><polygon points="8,28 24,12 92,12 76,28" fill="#ffe14d" stroke="#ffe14d"/><polygon points="76,28 92,12 92,80 76,96" fill="#c49e00" stroke="#c49e00"/><polygon points="8,28 76,28 76,96 8,96" fill="#f2c800" stroke="#f2c800"/></g><rect x="14" y="34" width="56" height="56" fill="none" stroke="#b08e00" stroke-dasharray="3 2"/>'),
      box: box(42, 62, 50, 50), tone: 'd',
    }),
  },
  fuel17: { he: 'Fuel', draw: () => ({ svg: ball('#fffbd0', '#f5e030', '#a88f00', 42, fuelHoles), box: BALL(42), tone: 'd' }) },
  gear: {
    he: 'Gear',
    draw: () => ({
      svg: S(`<path d="${gearPath(50, 53, 48, 40, 12)}" fill="#9c7d00"/><path d="${gearPath(50, 49, 48, 40, 12)}" fill="#f2c800" stroke="#c49e00" stroke-width="1.5"/><circle cx="50" cy="49" r="32" fill="#e8c300"/>`),
      box: box(50, 49, 50, 46), tone: 'd',
    }),
  },
  boulder: { he: 'Boulder', draw: () => ({ svg: ball('#d6d6d6', '#8c8c8c', '#3f3f3f', 46), box: BALL(46), tone: 'l' }) },
  tote15: {
    he: 'Tote',
    draw: () => ({
      svg: S('<polygon points="8,28 92,28 84,94 16,94" fill="#8a8981"/><rect x="3" y="16" width="94" height="14" rx="2" fill="#9d9c95"/><line x1="22" y1="32" x2="25" y2="92" stroke="rgba(0,0,0,.2)"/><line x1="78" y1="32" x2="75" y2="92" stroke="rgba(0,0,0,.2)"/>'),
      box: box(50, 61, 60, 52), tone: 'l',
    }),
  },
  bin: {
    he: 'Recycling Container',
    draw: () => ({
      svg: S(
        '<rect x="18" y="8" width="64" height="88" rx="7" fill="url(#binG)"/><ellipse cx="50" cy="9" rx="32" ry="7" fill="#145a25"/>',
        '<linearGradient id="binG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1f6e30"/><stop offset=".4" stop-color="#3fae55"/><stop offset="1" stop-color="#1b5e2a"/></linearGradient>',
      ),
      box: box(50, 55, 54, 70), tone: 'l',
    }),
  },
  bigR: { he: 'כדור אדום', draw: () => ({ svg: ball('#ffb3b3', '#d92b2b', '#6e0d0d', 48), box: BALL(48), tone: 'l' }) },
  bigB: { he: 'כדור כחול', draw: () => ({ svg: ball('#b3ccff', '#2b5fd9', '#0c2470', 48), box: BALL(48), tone: 'l' }) },
  frisbee: {
    he: 'Frisbee',
    draw: () => ({
      svg: S('<ellipse cx="50" cy="57" rx="47" ry="32" fill="#a9aeb6"/><ellipse cx="50" cy="51" rx="46" ry="31" fill="#f4f5f7" stroke="#c3c7cd"/><ellipse cx="50" cy="51" rx="34" ry="22" fill="none" stroke="#d6dae0"/>'),
      box: box(50, 51, 60, 38), tone: 'd',
    }),
  },
  frisbeeR: { he: 'Frisbee אדום', draw: () => ({ svg: disc(['#ffb3b3', '#e03131', '#8a1414']), box: box(50, 51, 60, 38), tone: 'l' }) },
  frisbeeB: { he: 'Frisbee כחול', draw: () => ({ svg: disc(['#b3ccff', '#2f6fe0', '#13357d']), box: box(50, 51, 60, 38), tone: 'l' }) },
  tote15y: { he: 'Tote צהוב', draw: () => ({ svg: binShape(['#ffe680', '#f2c800', '#a88a00']), box: box(50, 61, 60, 52), tone: 'd' }) },
  noodle: { he: 'Litter (פול נודל)', draw: () => ({ svg: pipe(['#b6f5a0', '#3fbf3f', '#1f6e22'], '#0f3d12'), box: box(42, 50, 66, 38), tone: 'd' }) },
  // ---- Not a game piece: a sub-hub shown inside another tote's peek / search results.
  // A closed kit tote with its lid on, so it never looks like 2015's open Tote piece.
  hubTote: {
    he: 'ארגז',
    draw: () => ({
      svg: S('<polygon points="10,34 90,34 83,95 17,95" fill="#8a8981"/>' +
        '<line x1="26" y1="40" x2="29" y2="93" stroke="rgba(0,0,0,.2)"/><line x1="74" y1="40" x2="71" y2="93" stroke="rgba(0,0,0,.2)"/>' +
        '<path d="M4 20 L50 12 L96 20 L96 34 L4 34 Z" fill="#9d9c95"/><path d="M4 20 L50 12 L96 20" fill="none" stroke="#b9b8b1" stroke-width="2"/>' +
        '<line x1="50" y1="12" x2="50" y2="34" stroke="rgba(0,0,0,.35)" stroke-width="1.5"/>' +
        '<rect x="18" y="31" width="9" height="12" rx="1.5" fill="#9d9c95" stroke="rgba(0,0,0,.25)"/><rect x="73" y="31" width="9" height="12" rx="1.5" fill="#9d9c95" stroke="rgba(0,0,0,.25)"/>' +
        '<rect x="4" y="32" width="92" height="3" fill="rgba(0,0,0,.3)"/>'),
      box: box(50, 66, 56, 44), tone: 'l',
    }),
  },
  // ---- 2011 Logo Motion
  tubeTri: { he: 'משולש אדום', draw: () => ({ svg: tubeShape('triangle', ['#ffb3b3', '#e03131', '#8a1414']), box: box(50, 64, 40, 26), tone: 'l' }) },
  tubeCirc: { he: 'עיגול לבן', draw: () => ({ svg: tubeShape('circle', ['#ffffff', '#eef0f3', '#9aa1ab']), box: box(50, 50, 44, 44), tone: 'l' }) },
  tubeSq: { he: 'ריבוע כחול', draw: () => ({ svg: tubeShape('square', ['#b3ccff', '#2f6fe0', '#13357d']), box: box(50, 50, 56, 56), tone: 'l' }) },
  uber: { he: 'Ubertube', draw: () => ({ svg: tubeShape('circle', ['#fff7b0', '#f2cf00', '#9c7d00']), box: box(50, 50, 44, 44), tone: 'l' }) },
  // ---- 2010 Breakaway
  soccer10: { he: 'כדורגל', draw: () => ({ svg: soccerBall(44), box: BALL(44), tone: 'd' }) },
  // ---- 2009 Lunacy (orbit balls; colours approximate)
  moonrock: { he: 'Moon Rock', draw: () => ({ svg: wovenBall(['#e2d6ff', '#8e6fd6', '#3f2a7a'], '#2a1a5c'), box: BALL(43), tone: 'l' }) },
  emptycell: { he: 'Empty Cell', draw: () => ({ svg: wovenBall(['#ffffff', '#e4e7ec', '#9097a3'], '#6b7380'), box: BALL(43), tone: 'd' }) },
  supercell: { he: 'Super Cell', draw: () => ({ svg: wovenBall(['#d6ffb0', '#5fd12a', '#2a6e0e'], '#1d4f08'), box: BALL(43), tone: 'd' }) },
  // ---- 2008 FIRST Overdrive
  track08R: { he: 'Trackball אדום', draw: () => ({ svg: ball('#ffc2c2', '#d92b2b', '#5e0b0b', 48), box: BALL(48), tone: 'l' }) },
  track08B: { he: 'Trackball כחול', draw: () => ({ svg: ball('#c2d6ff', '#2b5fd9', '#0a1f5e', 48), box: BALL(48), tone: 'l' }) },
  // ---- 2007 Rack 'n' Roll
  ringR: { he: 'טבעת אדומה', draw: () => ({ svg: ringPiece(['#ffb3b3', '#e03131', '#8a1414']), box: box(50, 50, 54, 36), tone: 'l' }) },
  ringB: { he: 'טבעת כחולה', draw: () => ({ svg: ringPiece(['#b3ccff', '#2f6fe0', '#13357d']), box: box(50, 50, 54, 36), tone: 'l' }) },
  spoiler: { he: 'Spoiler', draw: () => ({ svg: ringPiece(['#7a7f88', '#2b2e33', '#0d0e10']), box: box(50, 50, 54, 36), tone: 'l' }) },
  // ---- 2006 Aim High
  poof06: { he: 'כדור ספוג', draw: () => ({ svg: ball('#fff9c4', '#f7d81e', '#a38a00', 40), box: BALL(40), tone: 'd' }) },
  // ---- 2005 Triple Play
  tetraR: { he: 'טטרה אדומה', draw: () => ({ svg: tetra(['#ffb3b3', '#e03131', '#8a1414']), box: box(50, 68, 46, 24), tone: 'l' }) },
  tetraB: { he: 'טטרה כחולה', draw: () => ({ svg: tetra(['#b3ccff', '#2f6fe0', '#13357d']), box: box(50, 68, 46, 24), tone: 'l' }) },
  // ---- 2004 FIRST Frenzy
  ball04: { he: 'כדור', draw: () => ({ svg: ball('#e2ccff', '#8a3fe0', '#3c1475', 40), box: BALL(40), tone: 'l' }) },
  bonus04: { he: 'כדור בונוס', draw: () => ({ svg: ball('#fff4a0', '#ecc800', '#8f7300', 40), box: BALL(40), tone: 'd' }) },
  doubler04: { he: 'כדור מכפיל', draw: () => ({ svg: ball('#8a8f99', '#2b2e33', '#0b0c0e', 48), box: BALL(48), tone: 'l' }) },
  // ---- 2003 Stack Attack
  bin03: { he: 'ארגז אחסון', draw: () => ({ svg: binShape(['#e9edf2', '#c6ccd4', '#8c95a1']), box: box(50, 61, 60, 52), tone: 'd' }) },
  // ---- 2002 Zone Zeal
  ball02y: { he: 'כדור צהוב', draw: () => ({ svg: ball('#fff4a0', '#ecc800', '#8f7300', 43), box: BALL(43), tone: 'd' }) },
  ball02o: { he: 'כדור כתום', draw: () => ({ svg: ball('#ffd0a0', '#ff8a1f', '#9a4300', 43), box: BALL(43), tone: 'd' }) },
  // ---- 2001 Diabolical Dynamics (colours approximate)
  small01: { he: 'כדור קטן', draw: () => ({ svg: ball('#ffe0c2', '#f2902a', '#8a4600', 34), box: BALL(34), tone: 'd' }) },
  large01: { he: 'כדור גדול', draw: () => ({ svg: ball('#d6e4ff', '#5b86d9', '#1d3a7a', 48), box: BALL(48), tone: 'l' }) },
  // ---- 2000 Co-Opertition FIRST
  ball00y: { he: 'כדור צהוב', draw: () => ({ svg: ball('#fff4a0', '#ecc800', '#8f7300', 42), box: BALL(42), tone: 'd' }) },
  ball00k: { he: 'כדור שחור', draw: () => ({ svg: ball('#8a8f99', '#2b2e33', '#0b0c0e', 42), box: BALL(42), tone: 'l' }) },
  // ---- 1999 Double Trouble
  floppyR: { he: 'Floppy אדום', draw: () => ({ svg: pillow(['#ffb3b3', '#e03131', '#8a1414']), box: box(50, 50, 62, 56), tone: 'l' }) },
  floppyB: { he: 'Floppy כחול', draw: () => ({ svg: pillow(['#b3ccff', '#2f6fe0', '#13357d']), box: box(50, 50, 62, 56), tone: 'l' }) },
  // ---- 1998 Ladder Logic (colour approximate)
  ball98: { he: 'כדור גומי', draw: () => ({ svg: ball('#c8f5d6', '#2fae5a', '#105c28', 42), box: BALL(42), tone: 'l' }) },
  // ---- 1997 Toroid Terror
  tube97: { he: 'צמיג פנימי', draw: () => ({ svg: ringPiece(['#7a7f88', '#33363c', '#111214'], 30), box: box(50, 50, 54, 34), tone: 'l' }) },
  // ---- 1996 Hexagon Havoc (colours approximate)
  small96: { he: 'כדור קטן', draw: () => ({ svg: ball('#c8f5ee', '#22b8a0', '#0a5b50', 34), box: BALL(34), tone: 'l' }) },
  big96: { he: 'כדור גדול', draw: () => ({ svg: ball('#c8f5ee', '#22b8a0', '#0a5b50', 48), box: BALL(48), tone: 'l' }) },
  // ---- 1995 Ramp 'n Roll (colour approximate)
  vinyl95: { he: 'כדור ויניל', draw: () => ({ svg: ball('#ffd6e8', '#e0479a', '#7a1248', 47), box: BALL(47), tone: 'l' }) },
  // ---- 1994 Tower Power
  soccerR: { he: 'כדורגל אדום', draw: () => ({ svg: patchBall(['#ffc2c2', '#e03131', '#7a1010'], '#5a0b0b'), box: BALL(44), tone: 'l' }) },
  soccerW: { he: 'כדורגל לבן', draw: () => ({ svg: soccerBall(44), box: BALL(44), tone: 'd' }) },
  soccerB: { he: 'כדורגל כחול', draw: () => ({ svg: patchBall(['#c2d6ff', '#2f6fe0', '#0e2c7a'], '#0a1f5e'), box: BALL(44), tone: 'l' }) },
  // ---- 1993 Rug Rage
  kick93: { he: 'כדור בעיטה אדום', draw: () => ({ svg: ball('#ffc2c2', '#e03131', '#7a1010', 45), box: BALL(45), tone: 'l' }) },
  water93: { he: 'כדור מים כחול', draw: () => ({ svg: ball('#c2e4ff', '#2f8fe0', '#0e3f7a', 34), box: BALL(34), tone: 'l' }) },
  // ---- 1992 Maize Craze
  tennis: { he: 'כדור טניס', draw: () => ({ svg: seamBall(['#f6ffb0', '#d6e81a', '#7d8a00'], '#ffffff', 40), box: box(50, 50, 44, 54), tone: 'd' }) },
  bball: {
    he: 'כדורסל',
    draw: () => ({ svg: ball('#ffc08a', '#e8641c', '#7a2a00', 45, bballSeams, true), box: box(50, 58, 52, 54), tone: 'd' }),
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
  { year: 2015, name: 'RECYCLE RUSH', pieces: ['tote15', 'bin', 'tote15y', 'noodle'] },
  { year: 2014, name: 'AERIAL ASSIST', pieces: ['bigR', 'bigB'] },
  { year: 2013, name: 'ULTIMATE ASCENT', pieces: ['frisbee', 'frisbeeR', 'frisbeeB'] },
  { year: 2012, name: 'REBOUND RUMBLE', pieces: ['bball'] },
  { year: 2011, name: 'LOGO MOTION', pieces: ['tubeTri', 'tubeCirc', 'tubeSq', 'uber'] },
  { year: 2010, name: 'BREAKAWAY', pieces: ['soccer10'] },
  { year: 2009, name: 'LUNACY', pieces: ['moonrock', 'emptycell', 'supercell'] },
  { year: 2008, name: 'FIRST OVERDRIVE', pieces: ['track08R', 'track08B'] },
  { year: 2007, name: "RACK 'N' ROLL", pieces: ['ringR', 'ringB', 'spoiler'] },
  { year: 2006, name: 'AIM HIGH', pieces: ['poof06'] },
  { year: 2005, name: 'TRIPLE PLAY', pieces: ['tetraR', 'tetraB'] },
  { year: 2004, name: 'FIRST FRENZY', pieces: ['ball04', 'bonus04', 'doubler04'] },
  { year: 2003, name: 'STACK ATTACK', pieces: ['bin03'] },
  { year: 2002, name: 'ZONE ZEAL', pieces: ['ball02y', 'ball02o'] },
  { year: 2001, name: 'DIABOLICAL DYNAMICS', pieces: ['small01', 'large01'] },
  { year: 2000, name: 'CO-OPERTITION FIRST', pieces: ['ball00y', 'ball00k'] },
  { year: 1999, name: 'DOUBLE TROUBLE', pieces: ['floppyR', 'floppyB'] },
  { year: 1998, name: 'LADDER LOGIC', pieces: ['ball98'] },
  { year: 1997, name: 'TOROID TERROR', pieces: ['tube97'] },
  { year: 1996, name: 'HEXAGON HAVOC', pieces: ['small96', 'big96'] },
  { year: 1995, name: "RAMP 'N ROLL", pieces: ['vinyl95'] },
  { year: 1994, name: 'TOWER POWER', pieces: ['soccerR', 'soccerW', 'soccerB'] },
  { year: 1993, name: 'RUG RAGE', pieces: ['kick93', 'water93'] },
  { year: 1992, name: 'MAIZE CRAZE', pieces: ['tennis'] },
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
