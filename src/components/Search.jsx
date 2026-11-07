import { useEffect, useMemo, useRef, useState } from 'react'
import { ancestors, canView } from '../lib/model.js'
import { drawPiece, seasonOf } from '../lib/seasons.js'
import { imgSrcProps } from '../lib/links.js'

// Hebrew-friendly normalisation: lower-case, strip niqqud/punctuation, fold final letters.
const FINALS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' }
const norm = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[֑-ׇ]/g, '')
    .replace(/[ךםןףץ]/g, (c) => FINALS[c])
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

const MAX_RESULTS = 12

// Searches every item the viewer is allowed to open (effective visibility already
// includes the strictest tote above it, so contents of locked totes never show up).
export default function Search({ nodes, profile, onPick }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [sel, setSel] = useState(0)
  const [expanded, setExpanded] = useState(false) // small screens: icon → field
  const inputRef = useRef()
  const wrapRef = useRef()

  const index = useMemo(() => {
    if (!nodes) return []
    const byId = new Map(nodes.map((n) => [n.id, n]))
    return nodes
      .filter((n) => canView(profile, n.effVis))
      .map((n) => {
        const trail = ancestors(nodes, n.id).slice(0, -1)
        const parent = n.parentId ? byId.get(n.parentId) : null
        return {
          node: n,
          trail,
          path: trail.map((a) => a.title).join(' › '),
          title: norm(n.title),
          label: norm(n.labelText),
          pathN: norm(trail.map((a) => a.title).join(' ')),
          parentSeason: parent ? seasonOf(parent.season) : null,
        }
      })
  }, [nodes, profile])

  const results = useMemo(() => {
    const words = norm(q).split(' ').filter(Boolean)
    if (!words.length) return []
    const scored = []
    for (const e of index) {
      const hay = `${e.title} ${e.label} ${e.pathN}`
      if (!words.every((w) => hay.includes(w))) continue
      const first = words[0]
      let score = 0
      if (e.title.startsWith(first) || e.label.startsWith(first)) score += 4
      if (words.every((w) => e.title.includes(w) || e.label.includes(w))) score += 3
      if (e.node.type === 'hub') score += 1
      score -= e.trail.length * 0.1
      scored.push([score, e])
    }
    return scored.sort((a, b) => b[0] - a[0]).slice(0, MAX_RESULTS).map(([, e]) => e)
  }, [q, index])

  useEffect(() => setSel(0), [q])

  // "/" focuses the search; clicking outside closes the results.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) {
        e.preventDefault()
        setExpanded(true)
        requestAnimationFrame(() => inputRef.current?.focus())
      }
    }
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) { setOpen(false); if (!q) setExpanded(false) }
    }
    addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown, true)
    return () => { removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown, true) }
  }, [q])

  const pick = (e) => {
    if (!e) return
    onPick(e.node)
    setOpen(false)
    setQ('')
    setExpanded(false)
    inputRef.current?.blur()
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); pick(results[sel]) }
    else if (e.key === 'Escape') { e.stopPropagation(); setQ(''); setOpen(false); setExpanded(false); inputRef.current?.blur() }
  }

  const showPanel = open && q.trim().length > 0

  return (
    <div ref={wrapRef} className={`search ${expanded ? 'expanded' : ''}`}>
      <button
        type="button"
        className="ctl search-toggle"
        aria-label="חיפוש"
        onClick={() => { setExpanded(true); requestAnimationFrame(() => inputRef.current?.focus()) }}
      >
        <i className="ti ti-search" aria-hidden="true" />
      </button>
      <div className="search-field">
        <i className="ti ti-search" aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          value={q}
          placeholder="חיפוש בהאב…"
          aria-label="חיפוש בהאב"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="search-results"
          aria-activedescendant={showPanel && results[sel] ? `sr-${results[sel].node.id}` : undefined}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        <kbd className="search-kbd" aria-hidden="true">/</kbd>
      </div>
      {showPanel && (
        <ul id="search-results" className="search-results" role="listbox">
          {results.length === 0 && <li className="search-empty">לא נמצא כלום. נסו מילה אחרת.</li>}
          {results.map((e, i) => (
            <li
              key={e.node.id}
              id={`sr-${e.node.id}`}
              role="option"
              aria-selected={i === sel}
              className={i === sel ? 'sel' : ''}
              onPointerEnter={() => setSel(i)}
              onPointerDown={(ev) => ev.preventDefault()}
              onClick={() => pick(e)}
            >
              <ResultIcon entry={e} />
              <div className="sr-text">
                <b>{e.node.title}</b>
                <span>{e.path || 'דף הבית'}</span>
              </div>
              <span className={`sr-kind ${e.node.type}`}>
                <i className={`ti ${e.node.type === 'hub' ? 'ti-box' : 'ti-external-link'}`} aria-hidden="true" />
                {e.node.type === 'hub' ? 'ארגז' : 'קישור'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ResultIcon({ entry }) {
  const n = entry.node
  const img = n.imageData || n.imageUrl
  if (img) return <span className="sr-icon"><img key={img} {...imgSrcProps(n)} alt="" /></span>
  const key = n.type === 'hub' ? 'tote15' : entry.parentSeason ? n.piece || entry.parentSeason.pieces[0] : null
  if (!key) return <span className="sr-icon cube-icon" />
  return <span className="sr-icon" dangerouslySetInnerHTML={{ __html: drawPiece(key).svg }} />
}
