import Ti from './components/Ti.jsx'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getStore } from './lib/store.js'
import { BASE, currentPath, href, setBase } from './lib/nav.js'
import { childrenOf, ancestors, canView, canEditNode, canAddToHome, canEditAnything, recomputeSubtree, hubPath, resolvePath } from './lib/model.js'
import { SEASONS, seasonOf, seasonLabel } from './lib/seasons.js'
import Stage from './components/Stage.jsx'
import Drawer from './components/Drawer.jsx'
import Admin from './components/Admin.jsx'
import Search from './components/Search.jsx'
import About from './components/About.jsx'

// Routes, under NeatSystem's '#/neathub': /  ·  /admin  ·  /software/vision (hub path by slug)  ·  /h/<id> (old links)
const parseHash = () => {
  const h = currentPath()
  if (h === 'admin') return { kind: 'admin', key: 'admin' }
  const legacy = h.match(/^h\/([^/]+)$/)
  if (legacy) return { kind: 'legacy', id: decodeURIComponent(legacy[1]), key: h }
  const segs = h ? h.split('/').map((s) => { try { return decodeURIComponent(s) } catch { return s } }) : []
  return { kind: segs.length ? 'hub' : 'home', segs, key: h }
}
const hrefFor = (nodes, id) => (id ? href(hubPath(nodes, id)) : href())
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const ANIM_MS = 360

export default function App({ host }) {
  setBase(host.base)
  const [store, setStore] = useState(null)
  const [nodes, setNodes] = useState(null)
  const [loadErr, setLoadErr] = useState('')
  const [auth, setAuth] = useState({ user: null, profile: null, ready: false })
  const [route, setRoute] = useState(parseHash)
  const [anim, setAnim] = useState({ cls: 'enter-fade', origin: '50% 50%' })
  const [editMode, setEditMode] = useState(false)
  const [drawer, setDrawer] = useState(null) // { node } | { parentId }
  const [gate, setGate] = useState(null) // locked item the viewer can't open
  const [about, setAbout] = useState(false)
  const pendingEnter = useRef(null)
  const urlCache = useRef(new Map())
  const appRef = useRef(null)
  // NeatSystem's toasts, so messages look and sit like everywhere else
  const toast = useCallback((m) => host.toast(m), [host])

  // ---- data
  useEffect(() => {
    let unsubs = []
    let cancelled = false
    getStore(host).then((s) => {
      if (cancelled) return
      setStore(s)
      unsubs.push(s.onNodes(setNodes, () => setLoadErr('לא הצלחתי לטעון את ההאב.')))
      unsubs.push(s.onAuth((a) => setAuth({ ...a, ready: true })))
    })
    return () => { cancelled = true; unsubs.forEach((u) => u()) }
  }, [])
  // the person changed in NeatSystem (mock persona switch, a permission change): ask again
  useEffect(() => { store?.refresh?.() }, [store, host.me.id, host.me.position, host.me.is_admin])
  const profile = auth.profile
  useEffect(() => { if (!canEditAnything(profile)) setEditMode(false) }, [profile])
  useEffect(() => { urlCache.current.clear() }, [profile?.role])
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { setDrawer(null); setGate(null); setAbout(false) } }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])

  // ---- item scale: one number (--ts) that every tote/piece/cube size is a multiple of.
  // Phones: two items side by side; desktop: capped; short windows: a tote still fits.
  useEffect(() => {
    const fit = () => {
      // the tab's own width (NeatSystem's sidebar takes part of the window)
      const w = appRef.current?.clientWidth || window.innerWidth
      const h = window.innerHeight - 70
      const ts = Math.max(0.9, Math.min(1.7, (w - 40) / 330, (h - 170) / 270))
      appRef.current?.style.setProperty('--ts', ts.toFixed(3))
    }
    fit()
    addEventListener('resize', fit)
    return () => removeEventListener('resize', fit)
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

  const hub = useMemo(() => (route.kind === 'hub' && nodes ? resolvePath(nodes, route.segs) : null), [nodes, route])
  useEffect(() => {
    if (!nodes) return
    if (route.kind === 'legacy') {
      const n = nodes.find((x) => x.id === route.id && x.type === 'hub')
      location.replace(n ? hrefFor(nodes, n.id) : href())
    } else if (route.kind === 'hub') {
      if (!hub) location.replace(href())
      else {
        // Normalise (e.g. a link that used an id instead of the slug).
        const canonical = hubPath(nodes, hub.id)
        if (canonical !== route.key) history.replaceState(history.state, '', href(canonical))
      }
    }
  }, [nodes, route, hub])

  // A shared link to a locked hub: show a lock screen instead of its contents.
  const hubLocked = !!hub && !canView(profile, hub.effVis)
  const items = useMemo(
    () => (nodes && route.kind !== 'admin' && !hubLocked ? childrenOf(nodes, hub ? hub.id : null) : []),
    [nodes, hub, route.kind, hubLocked],
  )
  const trail = hub ? ancestors(nodes, hub.id) : []

  const shareHub = async () => {
    const url = location.href
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ title: `${hub.title} · NEATHUB`, url })
        return
      }
      await navigator.clipboard.writeText(url)
      toast('הקישור הועתק')
    } catch (e) {
      if (e?.name !== 'AbortError') window.prompt('העתיקו את הקישור:', url)
    }
  }

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
    go(hrefFor(nodes, node.id), 'leave-in', 'enter-in', `${r.left - s.left + r.width / 2}px ${r.top - s.top + r.height / 2}px`)
  }
  const goUp = (id) => go(hrefFor(nodes, id), 'leave-out', 'enter-out')

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

  const pickSearch = (node) => {
    if (node.type === 'hub') go(hrefFor(nodes, node.id), 'leave-out', 'enter-in')
    else openLink(node)
  }

  const activate = (el, node) => {
    if (!canView(profile, node.effVis)) { setGate(node); return }
    if (node.type === 'hub') enterHub(el, node)
    else openLink(node)
  }

  const setSeason = async (year) => {
    if (!hub || !canEditNode(profile, hub)) return
    try {
      await store.saveNodes(recomputeSubtree(nodes, { ...hub, season: year }))
    } catch {
      toast('אין הרשאה לשנות עונה')
    }
  }

  const canEditHere = editMode && (hub ? canEditNode(profile, hub) : canAddToHome(profile))
  const season = hub ? seasonOf(hub.season) : null

  return (
    <div className="app" ref={appRef}>
      <header className="topbar">
        <nav className="crumbs" aria-label="מיקום">
          {route.kind === 'admin' ? (
            <><a href={href()}>NEATHUB</a> › <b>מי עורך מה</b></>
          ) : (
            <>
              {trail.length > 0 ? <a href={href()} onClick={(e) => { e.preventDefault(); goUp(null) }}>NEATHUB</a> : <b className="home-title">NEATHUB</b>}
              {trail.map((n, i) => (
                <span key={n.id}>
                  {' › '}
                  {i === trail.length - 1 ? <b>{n.title}</b> : <a href={hrefFor(nodes, n.id)} onClick={(e) => { e.preventDefault(); goUp(n.id) }}>{n.title}</a>}
                </span>
              ))}
            </>
          )}
        </nav>
        <div className="spacer" />
        {nodes && route.kind !== 'admin' && <Search nodes={nodes} profile={profile} onPick={pickSearch} />}
        {canEditAnything(profile) && route.kind !== 'admin' && (
          <button type="button" className={`btn sm ${editMode ? 'primary' : 'tint'}`} onClick={() => setEditMode((v) => !v)} aria-pressed={editMode}>
            <Ti n="pencil" size={16} /> <span className="ctl-label">{editMode ? 'סיום עריכה' : 'עריכה'}</span>
          </button>
        )}
        <button type="button" className="btn sm ghost about-btn" onClick={() => setAbout(true)} aria-label="אודות">
          <Ti n="info-circle" size={16} /> <span>אודות</span>
        </button>
        {profile?.role === 'mentor' && route.kind !== 'admin' && (
          <a className="btn sm ghost" href={href('admin')} aria-label="מי עורך מה"><Ti n="users" size={16} /> <span className="ctl-label">מי עורך מה</span></a>
        )}
      </header>

      <main className="stage" ref={stageRef}>
        {hub && !hubLocked && (
          <div className="hub-bar">
            <button
              type="button"
              className="back-btn"
              onClick={() => goUp(hub.parentId || null)}
              title={`חזרה ל${trail.length > 1 ? trail[trail.length - 2].title : 'דף הבית'}`}
            >
              <Ti n="arrow-right" /> חזרה
            </button>
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
            <button type="button" className="share-btn" onClick={shareHub}>
              <Ti n="link" /> העתקת קישור
            </button>
          </div>
        )}
        <div key={route.key} className={`view ${anim.cls}`} style={{ transformOrigin: anim.origin }}>
          {loadErr ? (
            <p className="empty">{loadErr}</p>
          ) : !nodes || (hubLocked && !auth.ready) ? (
            <p className="empty">טוען…</p>
          ) : hubLocked ? (
            <div className="locked-hub">
              <Ti n="lock" className="big-lock" />
              <h2>{hub.title}</h2>
              <p>אין לך הרשאה לפתוח את הארגז הזה. אפשר לבקש ממנטור.</p>
              <a className="btn ghost" href={href()}>לדף הבית של NEATHUB</a>
            </div>
          ) : route.kind === 'admin' ? (
            profile?.role === 'mentor' ? <Admin store={store} nodes={nodes} me={profile} toast={toast} /> : <p className="empty">רק מנטורים מחלקים הרשאות עריכה.</p>
          ) : (
            <Stage
              hub={hub}
              items={items}
              nodes={nodes}
              profile={profile}
              editMode={editMode}
              onActivate={activate}
              onEdit={(node) => setDrawer({ node })}
              onAdd={() => setDrawer({ parentId: hub ? hub.id : null })}
              kidsOf={(id) => childrenOf(nodes, id)}
            />
          )}
        </div>
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

      {about && <About onClose={() => setAbout(false)} />}

      {gate && (
        <div className="scrim center" onMouseDown={(e) => e.target === e.currentTarget && setGate(null)}>
          <div className="modal" role="dialog" aria-label="פריט נעול">
            <Ti n="lock" className="big-lock" />
            <h2>{gate.title}</h2>
            <p>אין לך הרשאה לפתוח את זה. אפשר לבקש ממנטור.</p>
            <button type="button" className="btn ghost" onClick={() => setGate(null)}>סגירה</button>
          </div>
        </div>
      )}

    </div>
  )
}
