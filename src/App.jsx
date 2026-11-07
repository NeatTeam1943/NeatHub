import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getStore, isDemo } from './lib/store.js'
import { childrenOf, ancestors, canView, canEditScope, canEditAnything, recomputeSubtree, ROLE_LABEL } from './lib/model.js'
import { SEASONS, seasonOf, seasonLabel } from './lib/seasons.js'
import Stage from './components/Stage.jsx'
import Drawer from './components/Drawer.jsx'
import Admin from './components/Admin.jsx'

const parseHash = () => {
  const h = location.hash.replace(/^#\/?/, '')
  if (h === 'admin') return { kind: 'admin' }
  const m = h.match(/^h\/(.+)$/)
  return m ? { kind: 'hub', id: decodeURIComponent(m[1]) } : { kind: 'home' }
}
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const ANIM_MS = 360

export default function App() {
  const [store, setStore] = useState(null)
  const [nodes, setNodes] = useState(null)
  const [loadErr, setLoadErr] = useState('')
  const [auth, setAuth] = useState({ user: null, profile: null })
  const [route, setRoute] = useState(parseHash)
  const [anim, setAnim] = useState({ cls: 'enter-fade', origin: '50% 50%' })
  const [editMode, setEditMode] = useState(false)
  const [drawer, setDrawer] = useState(null) // { node } | { parentId }
  const [gate, setGate] = useState(null) // locked item the viewer can't open
  const [toastMsg, setToastMsg] = useState('')
  const pendingEnter = useRef(null)
  const urlCache = useRef(new Map())
  const toastTimer = useRef()

  const toast = useCallback((m) => {
    setToastMsg(m)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastMsg(''), 1800)
  }, [])

  // ---- data
  useEffect(() => {
    let unsubs = []
    let cancelled = false
    getStore().then((s) => {
      if (cancelled) return
      setStore(s)
      unsubs.push(s.onNodes(setNodes, () => setLoadErr('לא הצלחתי לטעון את ההאב.')))
      unsubs.push(s.onAuth(setAuth))
    })
    return () => { cancelled = true; unsubs.forEach((u) => u()) }
  }, [])
  const profile = auth.profile
  useEffect(() => { if (!canEditAnything(profile)) setEditMode(false) }, [profile])
  useEffect(() => { urlCache.current.clear() }, [profile?.role])
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { setDrawer(null); setGate(null) } }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])

  // ---- routing
  useEffect(() => {
    const onHash = () => {
      setRoute(parseHash())
      setAnim({ cls: pendingEnter.current || 'enter-fade', origin: '50% 50%' })
      pendingEnter.current = null
    }
    addEventListener('hashchange', onHash)
    return () => removeEventListener('hashchange', onHash)
  }, [])

  const hub = route.kind === 'hub' && nodes ? nodes.find((n) => n.id === route.id) || null : null
  useEffect(() => {
    if (nodes && route.kind === 'hub' && (!hub || hub.type !== 'hub')) location.hash = '#/'
  }, [nodes, route, hub])

  const items = useMemo(() => (nodes && route.kind !== 'admin' ? childrenOf(nodes, hub ? hub.id : null) : []), [nodes, hub, route.kind])
  const trail = hub ? ancestors(nodes, hub.id) : []

  // Prefetch URLs of links on this level so clicks open synchronously (no popup blocker).
  useEffect(() => {
    if (!store) return
    items.filter((n) => n.type === 'link' && canView(profile, n.effVis) && !urlCache.current.has(n.id)).forEach((n) =>
      store.getUrl(n.id).then((u) => u && urlCache.current.set(n.id, u)).catch(() => {}))
  }, [items, store, profile])

  const go = (hash, leaveCls, enterCls, origin = '50% 50%') => {
    if (reduced()) { location.hash = hash; return }
    setAnim({ cls: leaveCls, origin })
    pendingEnter.current = enterCls
    setTimeout(() => { location.hash = hash }, ANIM_MS)
  }

  const stageRef = useRef()
  const enterHub = (el, node) => {
    const r = el.getBoundingClientRect()
    const s = stageRef.current.getBoundingClientRect()
    go(`#/h/${encodeURIComponent(node.id)}`, 'leave-in', 'enter-in', `${r.left - s.left + r.width / 2}px ${r.top - s.top + r.height / 2}px`)
  }
  const goUp = (id) => go(id ? `#/h/${encodeURIComponent(id)}` : '#/', 'leave-out', 'enter-out')

  const openLink = async (node) => {
    const cached = urlCache.current.get(node.id)
    if (cached) { window.open(cached, '_blank', 'noopener'); return }
    const w = window.open('about:blank', '_blank')
    try {
      const url = await store.getUrl(node.id)
      if (!url) throw new Error('missing')
      urlCache.current.set(node.id, url)
      if (w) { w.opener = null; w.location.href = url } else location.href = url
    } catch (e) {
      w?.close()
      if (e.code === 'permission-denied') setGate(node)
      else toast('לא הצלחתי לפתוח את הקישור')
    }
  }

  const activate = (el, node) => {
    if (!canView(profile, node.effVis)) { setGate(node); return }
    if (node.type === 'hub') enterHub(el, node)
    else openLink(node)
  }

  const setSeason = async (year) => {
    if (!hub || !canEditScope(profile, hub.scope)) return
    try {
      await store.saveNodes(recomputeSubtree(nodes, { ...hub, season: year }))
    } catch {
      toast('אין הרשאה לשנות עונה')
    }
  }

  const canEditHere = editMode && (hub ? canEditScope(profile, hub.scope) : profile?.role === 'mentor')
  const season = hub ? seasonOf(hub.season) : null

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/" onClick={(e) => { if (route.kind !== 'home') { e.preventDefault(); goUp(null) } }}>
          <span className="logo">1943</span>
          <span className="name">NEATHUB</span>
        </a>
        <nav className="crumbs" aria-label="מיקום">
          {route.kind === 'admin' ? (
            <><a href="#/">הבית</a> › <b>משתמשים</b></>
          ) : (
            trail.length > 0 && (
              <>
                <a href="#/" onClick={(e) => { e.preventDefault(); goUp(null) }}>הבית</a>
                {trail.map((n, i) => (
                  <span key={n.id}>
                    {' › '}
                    {i === trail.length - 1 ? <b>{n.title}</b> : <a href={`#/h/${n.id}`} onClick={(e) => { e.preventDefault(); goUp(n.id) }}>{n.title}</a>}
                  </span>
                ))}
              </>
            )
          )}
        </nav>
        <div className="spacer" />
        {isDemo && store?.setDemoRole && (
          <select className="ctl demo" value={profile?.role || 'guest'} onChange={(e) => store.setDemoRole(e.target.value)} aria-label="מצב דמו – תפקיד">
            <option value="guest">דמו: אורח</option>
            <option value="member">דמו: חבר/ה</option>
            <option value="lead">דמו: ראש צוות (תוכנה)</option>
            <option value="mentor">דמו: מנטור/ית</option>
          </select>
        )}
        {canEditAnything(profile) && route.kind !== 'admin' && (
          <button type="button" className={`ctl ${editMode ? 'on' : ''}`} onClick={() => setEditMode((v) => !v)} aria-pressed={editMode}>
            <i className="ti ti-pencil" aria-hidden="true" /> {editMode ? 'סיום עריכה' : 'עריכה'}
          </button>
        )}
        {profile?.role === 'mentor' && route.kind !== 'admin' && (
          <a className="ctl" href="#/admin"><i className="ti ti-users" aria-hidden="true" /> משתמשים</a>
        )}
        {auth.user ? (
          <button type="button" className="ctl" onClick={() => store.signOut()} title={profile ? ROLE_LABEL[profile.role] : ''}>
            <i className="ti ti-logout" aria-hidden="true" /> יציאה
          </button>
        ) : (
          !isDemo && (
            <button type="button" className="ctl accent" onClick={() => store?.signIn().catch(() => {})}>
              <i className="ti ti-brand-google" aria-hidden="true" /> כניסה
            </button>
          )
        )}
      </header>

      {profile?.role === 'pending' && (
        <div className="banner">החשבון שלך ממתין לאישור של מנטור. בינתיים רואים רק את מה שציבורי.</div>
      )}

      <main className="stage" ref={stageRef}>
        {hub && (
          <div className="hub-bar">
            {canEditHere ? (
              <label className="season-pick">
                <span>עונה</span>
                <select value={hub.season} onChange={(e) => setSeason(+e.target.value)}>
                  {SEASONS.map((s) => <option key={s.year} value={s.year}>{seasonLabel(s)}</option>)}
                </select>
              </label>
            ) : (
              <span className="season-tag">{seasonLabel(season)}</span>
            )}
          </div>
        )}
        <div key={route.kind + (route.id || '')} className={`view ${anim.cls}`} style={{ transformOrigin: anim.origin }}>
          {loadErr ? (
            <p className="empty">{loadErr}</p>
          ) : !nodes ? (
            <p className="empty">טוען…</p>
          ) : route.kind === 'admin' ? (
            profile?.role === 'mentor' ? <Admin store={store} nodes={nodes} me={profile} toast={toast} /> : <p className="empty">רק מנטורים יכולים לנהל משתמשים.</p>
          ) : (
            <Stage
              hub={hub}
              items={items}
              profile={profile}
              editMode={editMode}
              onActivate={activate}
              onEdit={(node) => setDrawer({ node })}
              onAdd={() => setDrawer({ parentId: hub ? hub.id : null })}
            />
          )}
        </div>
        {route.kind === 'home' && nodes && !editMode && <p className="hint">ארגז = האב · רחפו לפתיחה, לחצו להיכנס</p>}
      </main>

      {drawer && store && (
        <Drawer
          node={drawer.node || null}
          parentId={drawer.parentId ?? null}
          nodes={nodes}
          profile={profile}
          store={store}
          toast={toast}
          onClose={() => setDrawer(null)}
        />
      )}

      {gate && (
        <div className="scrim center" onMouseDown={(e) => e.target === e.currentTarget && setGate(null)}>
          <div className="modal" role="dialog" aria-label="פריט נעול">
            <i className="ti ti-lock big-lock" aria-hidden="true" />
            <h2>{gate.title}</h2>
            {auth.user ? (
              <p>אין לך הרשאה לפתוח את זה. אפשר לבקש ממנטור.</p>
            ) : (
              <>
                <p>צריך להתחבר כדי לפתוח את זה.</p>
                <button type="button" className="btn primary" onClick={() => { setGate(null); store.signIn().catch(() => {}) }}>
                  <i className="ti ti-brand-google" aria-hidden="true" /> {isDemo ? 'כניסה (דמו: מנטור)' : 'כניסה עם Google'}
                </button>
              </>
            )}
            <button type="button" className="btn ghost" onClick={() => setGate(null)}>סגירה</button>
          </div>
        </div>
      )}

      <div className={`toast ${toastMsg ? 'on' : ''}`} role="status">{toastMsg}</div>
    </div>
  )
}
