import { useRef, useState } from 'react'
import { Tote, Piece, Cube } from './Items.jsx'
import { seasonOf } from '../lib/seasons.js'
import { canView, canEditScope } from '../lib/model.js'

// One level of the hub tree: the home page (hub = null) or the inside of a tote.
export default function Stage({ hub, items, profile, editMode, onActivate, onEdit, onAdd }) {
  const [opened, setOpened] = useState(null) // touch: first tap opens the lid
  const pointer = useRef('mouse')
  const season = hub ? seasonOf(hub.season) : null
  const canAddHere = editMode && (hub ? canEditScope(profile, hub.scope) : profile?.role === 'mentor')

  let linkIdx = 0
  const handle = (e, item) => {
    if (pointer.current === 'touch' && item.type === 'hub' && opened !== item.id) {
      setOpened(item.id)
      return
    }
    onActivate(e.currentTarget, item)
  }

  return (
    <div className={hub ? 'grid inside' : 'grid home'} onPointerDown={(e) => { pointer.current = e.pointerType }}>
      {items.map((item, i) => {
        const locked = item.effVis !== 'public'
        const allowed = canView(profile, item.effVis)
        const editable = editMode && canEditScope(profile, item.scope)
        let body
        if (item.type === 'hub') {
          body = hub ? (
            <div className="bob" style={{ animationDelay: `-${i * 0.6}s` }}>
              <div className="mini"><Tote node={item} season={seasonOf(item.season)} /></div>
            </div>
          ) : (
            <Tote node={item} season={seasonOf(item.season)} />
          )
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
            className={`item ${item.type} ${hub ? 'in' : 'lvl0'} ${opened === item.id ? 'open' : ''} ${locked && !allowed ? 'denied' : ''}`}
            style={{ animationDelay: `${i * 0.07}s` }}
          >
            <button
              type="button"
              className="hit"
              title={item.title}
              aria-label={`${item.title}${item.type === 'hub' ? ' (ארגז)' : ''}${locked ? ' – נעול' : ''}`}
              onClick={(e) => handle(e, item)}
            >
              {body}
              <div className={hub ? 'psh' : 'sh'} />
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
