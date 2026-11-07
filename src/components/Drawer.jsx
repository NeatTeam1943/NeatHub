import { useEffect, useMemo, useState } from 'react'
import { SEASONS, PIECES, seasonOf, seasonLabel, DEFAULT_SEASON } from '../lib/seasons.js'
import { VIS_LABEL, VIS_RANK, childrenOf, descendants, canEditScope, recomputeSubtree, newId, ancestors, slugify, hubPath, SLUG_RE, RESERVED_SLUGS } from '../lib/model.js'
import { detectLink, faviconFor, isValidUrl, resizeImage } from '../lib/links.js'
import { Tote, Piece, Cube } from './Items.jsx'

// Add / edit one node. `node` is null for a new item created inside `parentId`.
export default function Drawer({ node, parentId, nodes, profile, store, onClose, toast }) {
  const isNew = !node
  const [d, setD] = useState(() =>
    node
      ? { ...node }
      : {
          id: newId(), parentId, type: 'link', title: '', labelMode: 'txt', labelText: '',
          imageData: null, imageUrl: null, season: DEFAULT_SEASON, piece: null, visibility: 'public',
        },
  )
  const [url, setUrl] = useState('')
  const [origUrl, setOrigUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (patch) => setD((x) => ({ ...x, ...patch }))

  useEffect(() => {
    if (node?.type === 'link') {
      store.getUrl(node.id).then((u) => { setUrl(u || ''); setOrigUrl(u || '') }).catch(() => {})
    }
  }, [node, store])

  const parent = nodes.find((n) => n.id === d.parentId) || null
  const parentEff = parent ? parent.effVis : 'public'
  const effective = VIS_RANK[d.visibility] >= VIS_RANK[parentEff] ? d.visibility : parentEff
  const season = seasonOf(parent ? parent.season : DEFAULT_SEASON)
  const link = d.type === 'link' ? detectLink(url) : null

  // Hubs this user may move the item into (never into itself or its own subtree).
  const targets = useMemo(() => {
    const banned = new Set([d.id, ...descendants(nodes, d.id).map((n) => n.id)])
    return nodes
      .filter((n) => n.type === 'hub' && !banned.has(n.id) && canEditScope(profile, n.scope))
      .map((n) => ({ id: n.id, path: ancestors(nodes, n.id).map((a) => a.title).join(' › ') }))
      .sort((a, b) => a.path.localeCompare(b.path))
  }, [nodes, d.id, profile])

  const siblings = childrenOf(nodes, d.parentId ?? null).filter((n) => n.id !== d.id)
  const subtree = isNew ? [] : descendants(nodes, d.id)

  async function onImage(e) {
    const f = e.target.files?.[0]
    if (!f) return
    try {
      const data = await resizeImage(f)
      set({ imageData: data, imageUrl: null, labelMode: d.labelMode === 'txt' ? 'both' : d.labelMode })
    } catch {
      setErr('לא הצלחתי לקרוא את התמונה.')
    }
    e.target.value = ''
  }

  async function save() {
    setErr('')
    if (!d.title.trim()) return setErr('צריך שם.')
    if (d.type === 'link' && !isValidUrl(url)) return setErr('הקישור צריך להתחיל ב-https://')
    if (d.labelMode !== 'txt' && !d.imageData && !d.imageUrl) return setErr('בחרו תמונה, או עברו למצב טקסט.')
    let slug = null
    if (d.type === 'hub') {
      slug = (d.slug || '').trim() || slugify(d.title) || null
      if (slug && !SLUG_RE.test(slug)) return setErr('כתובת: רק אותיות באנגלית, ספרות ומקפים.')
      if (slug && !d.parentId && RESERVED_SLUGS.includes(slug)) return setErr(`הכתובת "${slug}" שמורה. בחרו אחרת.`)
      const clash = childrenOf(nodes, d.parentId ?? null).some((n) => n.id !== d.id && n.type === 'hub' && (n.slug || n.id) === slug)
      if (slug && clash) return setErr('כבר יש ארגז עם הכתובת הזאת באותו מקום.')
    }
    const order = isNew ? Math.max(-1, ...siblings.map((s) => s.order ?? 0)) + 1 : d.order
    const clean = {
      ...d, title: d.title.trim(), labelText: (d.labelText || '').trim(), order,
      season: d.type === 'hub' ? d.season : null,
      slug,
      piece: d.type === 'link' ? d.piece : null,
    }
    if (!isNew && clean.parentId !== node.parentId) {
      clean.order = Math.max(-1, ...childrenOf(nodes, clean.parentId ?? null).map((s) => s.order ?? 0)) + 1
    }
    const changed = recomputeSubtree(nodes, clean)
    const urls = d.type === 'link' && (isNew || url !== origUrl) ? { [d.id]: url.trim() } : {}
    setBusy(true)
    try {
      await store.saveNodes(changed, urls)
      toast(isNew ? 'נוסף' : 'נשמר')
      onClose()
    } catch (e) {
      setErr(e.code === 'permission-denied' ? 'אין לך הרשאה לשמור כאן.' : 'השמירה נכשלה. נסו שוב.')
    } finally {
      setBusy(false)
    }
  }

  async function move(dir) {
    const all = childrenOf(nodes, d.parentId ?? null)
    const i = all.findIndex((n) => n.id === d.id)
    const j = i + dir
    if (j < 0 || j >= all.length) return
    const a = { ...all[i], order: all[j].order ?? j }
    const b = { ...all[j], order: all[i].order ?? i }
    if (a.order === b.order) { a.order = j; b.order = i }
    try {
      await store.saveNodes([a, b])
      set({ order: a.order })
    } catch {
      setErr('לא הצלחתי להזיז.')
    }
  }

  async function remove() {
    const extra = subtree.length ? `\nכולל ${subtree.length} פריטים שבתוכו.` : ''
    if (!confirm(`למחוק את "${node.title}"?${extra}`)) return
    setBusy(true)
    try {
      await store.deleteNodes([node, ...subtree])
      toast('נמחק')
      onClose()
    } catch {
      setErr('המחיקה נכשלה.')
      setBusy(false)
    }
  }

  const preview = { ...d, labelText: d.labelText || d.title || 'שם' }

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" role="dialog" aria-label={isNew ? 'הוספת פריט' : 'עריכת פריט'}>
        <header>
          <h2>{isNew ? 'הוספה' : 'עריכה'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="סגירה"><i className="ti ti-x" /></button>
        </header>

        <div className="preview">
          {d.type === 'hub' ? (
            <div className="pv-tote"><Tote node={preview} season={seasonOf(d.season)} /></div>
          ) : parent ? (
            <div className="pv-piece"><Piece node={preview} pieceKey={d.piece && season.pieces.includes(d.piece) ? d.piece : season.pieces[0]} /></div>
          ) : (
            <div className="pv-cube"><Cube node={preview} /></div>
          )}
        </div>

        {isNew && (
          <div className="field">
            <span className="lbl">סוג</span>
            <div className="seg">
              <button type="button" className={d.type === 'link' ? 'on' : ''} onClick={() => set({ type: 'link' })}>קישור</button>
              <button type="button" className={d.type === 'hub' ? 'on' : ''} onClick={() => set({ type: 'hub' })}>ארגז (האב)</button>
            </div>
          </div>
        )}

        <label className="field">
          <span className="lbl">שם</span>
          <input value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder="מדריך WPILib" maxLength={60} />
        </label>

        {d.type === 'link' && (
          <label className="field">
            <span className="lbl">קישור</span>
            <input dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://docs.wpilib.org" />
            {link && (
              <span className="chip"><i className={`ti ${link.icon}`} aria-hidden="true" /> {link.name}</span>
            )}
          </label>
        )}

        <div className="field">
          <span className="lbl">מה מופיע במרכז</span>
          <div className="seg">
            {[['txt', 'טקסט'], ['img', 'תמונה'], ['both', 'שניהם']].map(([m, t]) => (
              <button type="button" key={m} className={d.labelMode === m ? 'on' : ''} onClick={() => set({ labelMode: m })}>{t}</button>
            ))}
          </div>
        </div>

        {d.labelMode !== 'img' && (
          <label className="field">
            <span className="lbl">טקסט קצר</span>
            <input value={d.labelText} onChange={(e) => set({ labelText: e.target.value })} placeholder={d.title || 'WPILib'} maxLength={18} />
          </label>
        )}

        {d.labelMode !== 'txt' && (
          <div className="field">
            <span className="lbl">תמונה</span>
            <div className="row-btns">
              <label className="btn"><i className="ti ti-upload" aria-hidden="true" /> העלאה<input type="file" accept="image/*" hidden onChange={onImage} /></label>
              {d.type === 'link' && isValidUrl(url) && (
                <button type="button" className="btn" onClick={() => set({ imageUrl: faviconFor(url), imageData: null })}>
                  <i className="ti ti-world" aria-hidden="true" /> אייקון האתר
                </button>
              )}
              {(d.imageData || d.imageUrl) && (
                <button type="button" className="btn ghost" onClick={() => set({ imageData: null, imageUrl: null })}>הסרה</button>
              )}
            </div>
          </div>
        )}

        {d.type === 'hub' && (
          <label className="field">
            <span className="lbl">כתובת לשיתוף</span>
            <div className="slug-row" dir="ltr">
              <span className="slug-prefix">{d.parentId ? `#/${hubPath(nodes, d.parentId)}/` : '#/'}</span>
              <input
                dir="ltr"
                value={d.slug ?? ''}
                onChange={(e) => set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                placeholder={slugify(d.title) || 'software'}
                maxLength={40}
              />
            </div>
            <span className="hint">באנגלית. ריק = לפי השם{!isNew && node.slug ? ' · שינוי ישבור קישורים ששותפו' : ''}.</span>
          </label>
        )}

        {d.type === 'hub' && (
          <label className="field">
            <span className="lbl">עונה (חלקי המשחק בפנים)</span>
            <select value={d.season} onChange={(e) => set({ season: +e.target.value })}>
              {SEASONS.map((s) => <option key={s.year} value={s.year}>{seasonLabel(s)}</option>)}
            </select>
          </label>
        )}

        {d.type === 'link' && parent && season.pieces.length > 1 && (
          <label className="field">
            <span className="lbl">חלק משחק</span>
            <select value={d.piece || ''} onChange={(e) => set({ piece: e.target.value || null })}>
              <option value="">אוטומטי (לסירוגין)</option>
              {season.pieces.map((k) => <option key={k} value={k}>{PIECES[k].he}</option>)}
            </select>
          </label>
        )}

        <label className="field">
          <span className="lbl">מי יכול לפתוח</span>
          <select value={d.visibility} onChange={(e) => set({ visibility: e.target.value })}>
            {Object.entries(VIS_LABEL).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select>
          {effective !== d.visibility && <span className="hint">בפועל: {VIS_LABEL[effective]} (לפי הארגז שמעליו)</span>}
          {d.type === 'hub' && <span className="hint">חל גם על כל מה שבתוך הארגז.</span>}
        </label>

        {(profile?.role === 'mentor' || d.parentId) && <label className="field">
          <span className="lbl">נמצא בתוך</span>
          <select value={d.parentId ?? ''} onChange={(e) => set({ parentId: e.target.value || null })}>
            {profile?.role === 'mentor' && <option value="">דף הבית</option>}
            {targets.map((t) => <option key={t.id} value={t.id}>{t.path}</option>)}
          </select>
        </label>}

        {!isNew && (
          <div className="field">
            <span className="lbl">סדר</span>
            <div className="row-btns">
              <button type="button" className="btn" onClick={() => move(-1)}><i className="ti ti-arrow-right" aria-hidden="true" /> מוקדם יותר</button>
              <button type="button" className="btn" onClick={() => move(1)}>מאוחר יותר <i className="ti ti-arrow-left" aria-hidden="true" /></button>
            </div>
          </div>
        )}

        {err && <p className="err" role="alert">{err}</p>}

        <footer>
          <button type="button" className="btn primary" disabled={busy} onClick={save}>{isNew ? 'הוספה' : 'שמירה'}</button>
          {!isNew && (profile?.role === 'mentor' || node.parentId) && <button type="button" className="btn danger" disabled={busy} onClick={remove}><i className="ti ti-trash" aria-hidden="true" /> מחיקה</button>}
        </footer>
      </aside>
    </div>
  )
}
