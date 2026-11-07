import { drawPiece } from '../lib/seasons.js'

const imgOf = (n) => n.imageData || n.imageUrl || null
const modeOf = (n) => (imgOf(n) ? n.labelMode || 'both' : 'txt')
const textOf = (n) => (n.labelText ?? '').trim() || n.title
const longWord = (t) => Math.max(0, ...t.split(/\s+/).map((w) => w.length))

// ---------------------------------------------------------------- Tote (hub)
function LidTop({ hole }) {
  return (
    <div className="fic lidtop">
      <div className="kn" style={{ left: '8%' }} />
      <div className="kn" style={{ left: '30%' }} />
      <div className="kn" style={{ left: '62%' }} />
      <div className="kn" style={{ left: '84%' }} />
      <div className="pad" style={{ left: 9 }} />
      <div className="pad" style={{ right: 9 }} />
      <div className="rec" />
      <div className="hole" style={{ left: `${hole}%` }} />
    </div>
  )
}

export function Tote({ node, season }) {
  const img = imgOf(node)
  const mode = modeOf(node)
  return (
    <div className="tote">
      <div className="fc bt" />
      <div className="fc bk" />
      <div className="fc lf"><div className="hd" /></div>
      <div className="fc rt"><div className="hd" /></div>
      <div className="fc fr">
        <div className="tab" style={{ left: 26 }} />
        <div className="tab" style={{ left: 101 }} />
        <div className="pr">
          {mode !== 'txt' && <img className={mode === 'img' ? 'big' : ''} src={img} alt="" draggable="false" />}
          {mode !== 'img' && <span className="pr-t">{textOf(node)}</span>}
          {season && <small>{season.label || season.year}</small>}
        </div>
      </div>
      <div className="fl fb">
        <div className="face"><LidTop hole={30} /></div>
        <div className="face flip"><div className="fic under" /></div>
      </div>
      <div className="fl ff">
        <div className="face flip"><LidTop hole={50} /></div>
        <div className="face"><div className="fic under" /></div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Piece (link inside a hub)
export function Piece({ node, pieceKey }) {
  const p = drawPiece(pieceKey)
  const img = imgOf(node)
  const mode = modeOf(node)
  return (
    <>
      <div className="piece-svg" dangerouslySetInnerHTML={{ __html: p.svg }} />
      <div
        className={`lab ${p.tone === 'd' ? 'd' : 'l'} m-${mode} ${longWord(textOf(node)) > 9 ? 'long' : ''}`}
        style={{ left: `${p.x}%`, top: `${p.y}%`, maxWidth: p.maxW || 70 }}
      >
        {mode !== 'txt' && <img src={img} alt="" draggable="false" />}
        {mode !== 'img' && <span>{textOf(node)}</span>}
      </div>
    </>
  )
}

// ---------------------------------------------------------------- Cube (link on the home page)
export function Cube({ node }) {
  const img = imgOf(node)
  const mode = modeOf(node)
  return (
    <div className="cube">
      <div className="cf c2" />
      <div className="cf c3" />
      <div className="cf c1">
        {mode !== 'txt' && <img className={mode === 'img' ? 'big' : ''} src={img} alt="" draggable="false" />}
        {mode !== 'img' && <span>{textOf(node)}</span>}
      </div>
    </div>
  )
}
