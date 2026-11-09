import { useEffect, useRef, useState } from 'react'
import { Tote, Piece, Cube } from './Items.jsx'
import { seasonOf } from '../lib/seasons.js'
import { canView, canEditNode, canAddToHome } from '../lib/model.js'

// Pieces that rise out of an opened tote: all of its children, drawn as the
// tote's season pieces (links) or little totes (sub-hubs).
function peekFor(hubNode, kids) {
  const season = seasonOf(hubNode.season)
  let li = 0
  return kids.map((k) => {
    if (k.type === 'hub') return { node: k, key: 'hubTote' }
    const key = k.piece && season.pieces.includes(k.piece) ? k.piece : season.pieces[li % season.pieces.length]
    li++
    return { node: k, key }
  })
}

// One level of the hub tree: the home page (hub = null) or the inside of a tote.
//
// "Active" item = mouse hovering it, keyboard focus on it, or (touch) the first tap.
// Active + allowed  → lid opens and a few of its contents peek out.
// Active + no access → the item stays shut and shakes "no".
// Tapping/clicking anywhere else, or the mouse leaving, closes it again.
export default function Stage({ hub, items, nodes, profile, editMode, onActivate, onEdit, onAdd, kidsOf }) {
  const [active, setActive] = useState(null)
  const pointer = useRef('mouse')
  const season = hub ? seasonOf(hub.season) : null
  const canAddHere = editMode && (hub ? canEditNode(profile, hub) : canAddToHome(profile))

  useEffect(() => {
    if (!active) return
    const onDown = (e) => {
      if (!e.target.closest?.(`[data-item="${CSS.escape(active)}"]`)) setActive(null)
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [active])

  const handle = (e, item, allowed) => {
    // Touch: the first tap only "opens" (peek / refuse); the second tap acts.
    const needsPreview = item.type === 'hub' || !allowed
    if (pointer.current !== 'mouse' && needsPreview && active !== item.id) {
      setActive(item.id)
      return
    }
    onActivate(e.currentTarget, item)
  }
  const mouseOnly = (fn) => (e) => { if (e.pointerType === 'mouse') fn() }

  let linkIdx = 0
  return (
    <div className={hub ? 'grid inside' : 'grid home'} onPointerDown={(e) => { pointer.current = e.pointerType }}>
      {items.map((item, i) => {
        const locked = item.effVis !== 'public'
        const allowed = canView(profile, item.effVis)
        const editable = editMode && canEditNode(profile, item)
        const peek = item.type === 'hub' && allowed ? peekFor(item, kidsOf(item.id)) : null
        let body
        if (item.type === 'hub') {
          // A tote is the same full size at every level, including sub-hubs.
          body = <Tote node={item} season={seasonOf(item.season)} peek={peek} />
        } else if (hub) {
          const key = item.piece && season.pieces.includes(item.piece) ? item.piece : season.pieces[linkIdx % season.pieces.length]
          linkIdx++
          body = (
            <div className="bob" style={{ animationDelay: `-${i * 0.6}s` }}>
              <Piece node={item} pieceKey={key} />
            </div>
          )
        } else {
          body = <Cube node={item} />
        }
        return (
          <div
            key={item.id}
            data-item={item.id}
            className={`item ${item.type} ${hub ? 'in' : 'lvl0'} ${active === item.id ? 'on' : ''} ${allowed ? '' : 'denied'}`}
            style={{ animationDelay: `${i * 0.07}s` }}
            onPointerEnter={mouseOnly(() => setActive(item.id))}
            onPointerLeave={mouseOnly(() => setActive((a) => (a === item.id ? null : a)))}
          >
            <button
              type="button"
              className="hit"
              title={item.title}
              aria-label={`${item.title}${item.type === 'hub' ? ' (ארגז)' : ''}${locked ? ' – נעול' : ''}`}
              onClick={(e) => handle(e, item, allowed)}
              onFocus={(e) => { if (e.target.matches(':focus-visible')) setActive(item.id) }}
              onBlur={() => setActive((a) => (a === item.id ? null : a))}
            >
              {body}
              <div className={hub && item.type !== 'hub' ? 'psh' : 'sh'} />
            </button>
            {locked && <span className="lock" title="דורש הרשאה"><i className="ti ti-lock" aria-hidden="true" /></span>}
            {editable && (
              <button type="button" className="edit-btn" aria-label={`עריכת ${item.title}`} onClick={() => onEdit(item)}>
                <i className="ti ti-pencil" aria-hidden="true" />
              </button>
            )}
          </div>
        )
      })}
      {canAddHere && (
        <div className={`item add ${hub ? 'in' : 'lvl0'}`}>
          <button type="button" className="hit add-tile" onClick={onAdd}>
            <i className="ti ti-plus" aria-hidden="true" />
            <span>הוספה</span>
          </button>
        </div>
      )}
      {!items.length && !canAddHere && <p className="empty">הארגז הזה עדיין ריק.</p>}
    </div>
  )
}
