import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getStore, isDemo } from './lib/store.js'
import { childrenOf, ancestors, canView, canEditScope, canEditAnything, recomputeSubtree, ROLE_LABEL, hubPath, resolvePath } from './lib/model.js'
import { SEASONS, seasonOf, seasonLabel } from './lib/seasons.js'
import Stage from './components/Stage.jsx'
import Drawer from './components/Drawer.jsx'
import Admin from './components/Admin.jsx'
import Search from './components/Search.jsx'
import About from './components/About.jsx'

// Routes: #/  ·  #/admin  ·  #/software/vision (hub path by slug)  ·  #/h/<id> (old links)
const parseHash = () => {
  const h = location.hash.replace(/^#\/?/, '').replace(/\/+$/, '')
  if (h === 'admin') return { kind: 'admin', key: 'admin' }
  const legacy = h.match(/^h\/([^/]+)$/)
  if (legacy) return { kind: 'legacy', id: decodeURIComponent(legacy[1]), key: h }
  const segs = h ? h.split('/').map((s) => { try { return decodeURIComponent(s) } catch { return s } }) : []
  return { kind: segs.length ? 'hub' : 'home', segs, key: h }
}
const hrefFor = (nodes, id) => (id ? `#/${hubPath(nodes, id)}` : '#/')
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const ANIM_MS = 360

export default function App() {
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
  const [toastMsg, setToastMsg] = useState('')
  const pendingEnter = useRef(null)
  const urlCache = useRef(new Map())
  const toastTimer = useRef()

  const toast = useCallback((m, ms = 1800) => {
    setToastMsg(m)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastMsg(''), ms)
  }, [])

  const signIn = () =>
    Promise.resolve(store?.signIn()).catch((e) => {
      const code = e?.code || ''
      console.error('Sign-in failed:', e)
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return
      const msg = {
        'auth/unauthorized-domain': `הדומיין ${location.hostname} לא מאושר ב-Firebase (Authentication → Settings → Authorized domains)`,
        'auth/operation-not-allowed': 'כניסה עם Google לא מופעלת ב-Firebase (Authentication → Sign-in method)',
        'auth/popup-blocked': 'הדפדפן חסם את חלון הכניסה. אפשרו חלונות קופצים לאתר ונסו שוב.',
        'auth/network-request-failed': 'בעיית רשת. נסו שוב.',
        'auth/invalid-api-key': 'מפתח ה-API של Firebase שגוי (בדקו את ה-secrets)',
      }[code]
      toast(msg || `הכניסה נכשלה: ${code || e?.message || 'שגיאה לא ידועה'}`, 9000)
    })

  // ---- data
  useEffect(() => {
    let unsubs = []
    let cancelled = false
    getStore().then((s) => {
      if (cancelled) return
      setStore(s)
      unsubs.push(s.onNodes(setNodes, () => setLoadErr('לא הצלחתי לטעון את ההאב.')))
      unsubs.push(s.onAuth((a) => setAuth({ ...a, ready: true })))
    })
    return () => { cancelled = true; unsubs.forEach((u) => u()) }
  }, [])
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
      const w = window.innerWidth
      const h = window.innerHeight
      const ts = Math.max(0.9, Math.min(2.05, (w - 40) / 330, (h - 170) / 270))
      document.documentElement.style.setProperty('--ts', ts.toFixed(3))
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
      location.replace(n ? hrefFor(nodes, n.id) : '#/')
    } else if (route.kind === 'hub') {
      if (!hub) location.replace('#/')
      else {
        // Normalise (e.g. a link that used an id instead of the slug).
        const canonical = hubPath(nodes, hub.id)
        if (canonical !== route.key) history.replaceState(null, '', '#/' + canonical)
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
                    {i === trail.length - 1 ? <b>{n.title}</b> : <a href={hrefFor(nodes, n.id)} onClick={(e) => { e.preventDefault(); goUp(n.id) }}>{n.title}</a>}
                  </span>
                ))}
              </>
            )
          )}
        </nav>
        <div className="spacer" />
        {nodes && route.kind !== 'admin' && <Search nodes={nodes} profile={profile} onPick={pickSearch} />}
        {isDemo && store?.setDemoRole && (
          <select className="ctl demo" value={profile?.role || 'guest'} onChange={(e) => store.setDemoRole(e.target.value)} aria-label="מצב דמו – תפקיד">
            <option value="guest">דמו: אורח</option>
            <option value="member">דמו: חבר/ה</option>
            <option value="lead">דמו: ראש צוות (תוכנה)</option>
            <option value="mentor">דמו: מנטור/ית</option>
          </select>
        )}
        {canEditAnything(profile) && route.kind !== 'admin' && (
          <button type="button" className={`ctl ${editMode ? 'on' : ''}`} onClick={() => setEditMode((v) => !v)} aria-pressed={editMode} aria-label={editMode ? 'סיום עריכה' : 'עריכה'}>
            <i className="ti ti-pencil" aria-hidden="true" /> <span className="ctl-label">{editMode ? 'סיום עריכה' : 'עריכה'}</span>
          </button>
        )}
        <button type="button" className="ctl about-btn" onClick={() => setAbout(true)} aria-label="אודות">
          <i className="ti ti-info-circle" aria-hidden="true" /> <span>אודות</span>
        </button>
        {profile?.role === 'mentor' && route.kind !== 'admin' && (
          <a className="ctl" href="#/admin" aria-label="משתמשים"><i className="ti ti-users" aria-hidden="true" /> <span className="ctl-label">משתמשים</span></a>
        )}
        {auth.user ? (
          <button type="button" className="ctl" aria-label="יציאה" onClick={() => store.signOut()} title={profile ? ROLE_LABEL[profile.role] : ''}>
            <i className="ti ti-logout" aria-hidden="true" /> <span className="ctl-label">יציאה</span>
          </button>
        ) : (
          !isDemo && (
            <button type="button" className="ctl accent" onClick={() => signIn()}>
              <i className="ti ti-brand-google" aria-hidden="true" /> כניסה
            </button>
          )
        )}
      </header>

      {profile?.role === 'pending' && (
        <div className="banner">החשבון שלך ממתין לאישור של מנטור. בינתיים רואים רק את מה שציבורי.</div>
      )}

      <main className="stage" ref={stageRef}>
        {hub && !hubLocked && (
          <div className="hub-bar">
            <button
              type="button"
              className="back-btn"
              onClick={() => goUp(hub.parentId || null)}
              title={`חזרה ל${trail.length > 1 ? trail[trail.length - 2].title : 'דף הבית'}`}
            >
              <i className="ti ti-arrow-right" aria-hidden="true" /> חזרה
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
              <i className="ti ti-link" aria-hidden="true" /> העתקת קישור
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
              <i className="ti ti-lock big-lock" aria-hidden="true" />
              <h2>{hub.title}</h2>
              {auth.user ? (
                <p>אין לך הרשאה לפתוח את הארגז הזה. אפשר לבקש ממנטור.</p>
              ) : (
                <>
                  <p>צריך להתחבר כדי לפתוח את הארגז הזה.</p>
                  <button type="button" className="btn primary" onClick={() => signIn()}>
                    <i className="ti ti-brand-google" aria-hidden="true" /> {isDemo ? 'כניסה (דמו: מנטור)' : 'כניסה עם Google'}
                  </button>
                </>
              )}
              <a className="btn ghost" href="#/">לדף הבית</a>
            </div>
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
            <i className="ti ti-lock big-lock" aria-hidden="true" />
            <h2>{gate.title}</h2>
            {auth.user ? (
              <p>אין לך הרשאה לפתוח את זה. אפשר לבקש ממנטור.</p>
            ) : (
              <>
                <p>צריך להתחבר כדי לפתוח את זה.</p>
                <button type="button" className="btn primary" onClick={() => { setGate(null); signIn() }}>
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
