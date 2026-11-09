import { useEffect, useMemo, useState } from 'react'
import { ROLE_LABEL, HOME } from '../lib/model.js'
import { norm } from '../lib/text.js'

const ROLE_FILTERS = [
  ['all', 'כולם'],
  ['pending', 'ממתינים'],
  ['member', 'חברי קבוצה'],
  ['lead', 'ראשי צוותים'],
  ['mentor', 'מנטורים'],
]
const SORTS = [
  ['smart', 'ממתינים קודם'],
  ['name', 'לפי שם'],
  ['new', 'הצטרפו לאחרונה'],
  ['role', 'לפי תפקיד'],
]
const ROLE_ORDER = { pending: 0, mentor: 1, lead: 2, member: 3 }
const time = (t) => (typeof t === 'number' ? t : t?.toMillis?.() ?? 0)
const byName = (a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || '', 'he')

// Mentors approve users, set roles, and pick which top-level totes a team lead can edit.
export default function Admin({ store, nodes, me, toast }) {
  const [users, setUsers] = useState(null)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [role, setRole] = useState('all')
  const [tote, setTote] = useState('')
  const [sort, setSort] = useState('smart')
  const hubs = useMemo(() => nodes.filter((n) => !n.parentId && n.type === 'hub'), [nodes])
  const grants = useMemo(() => [{ id: HOME, title: 'דף הבית', home: true }, ...hubs], [hubs])

  useEffect(() => store.onUsers(setUsers, () => setErr('אין גישה לרשימת המשתמשים.')), [store])

  async function update(u, patch) {
    try {
      await store.updateUser(u.uid, patch)
      toast('עודכן')
    } catch {
      toast('העדכון נכשל')
    }
  }

  const counts = useMemo(() => {
    const c = { all: users?.length || 0 }
    for (const u of users || []) c[u.role] = (c[u.role] || 0) + 1
    return c
  }, [users])

  const shown = useMemo(() => {
    if (!users) return []
    const words = norm(q).split(' ').filter(Boolean)
    const list = users.filter((u) => {
      if (role !== 'all' && u.role !== role) return false
      if (role === 'lead' && tote && !(u.scopes || []).includes(tote)) return false
      if (!words.length) return true
      const hay = norm(`${u.name || ''} ${u.email || ''} ${ROLE_LABEL[u.role] || ''}`)
      return words.every((w) => hay.includes(w))
    })
    const cmp = {
      smart: (a, b) => (a.role === 'pending' ? 0 : 1) - (b.role === 'pending' ? 0 : 1) || byName(a, b),
      name: byName,
      new: (a, b) => time(b.createdAt) - time(a.createdAt) || byName(a, b),
      role: (a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9) || byName(a, b),
    }[sort]
    return list.sort(cmp)
  }, [users, q, role, tote, sort])

  if (err) return <p className="empty">{err}</p>
  if (!users) return <p className="empty">טוען…</p>

  const filtered = q || role !== 'all'
  const clear = () => { setQ(''); setRole('all'); setTote('') }

  return (
    <div className="admin">
      <h2>משתמשים והרשאות</h2>
      <p className="muted">
        מנטורים עורכים הכול. ראש צוות עורך רק את מה שסומן לו כאן: ארגז = הארגז וכל מה שבתוכו (כולל העונה);
        דף הבית = הוספת פריטים לדף הבית ועריכת הקישורים שעליו. ארגז חדש שראש צוות יוצר נוסף לו אוטומטית, ואפשר להוריד אותו.
      </p>

      <div className="ufilters">
        <label className="usearch">
          <i className="ti ti-search" aria-hidden="true" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="חיפוש לפי שם או מייל"
            aria-label="חיפוש משתמשים"
          />
        </label>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="מיון">
          {SORTS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
        </select>
      </div>

      <div className="rolechips" role="group" aria-label="סינון לפי תפקיד">
        {ROLE_FILTERS.map(([k, t]) => (
          <button
            key={k}
            type="button"
            className={`rchip ${role === k ? 'on' : ''} ${k === 'pending' && counts.pending ? 'alert' : ''}`}
            aria-pressed={role === k}
            onClick={() => { setRole(k); if (k !== 'lead') setTote('') }}
          >
            {t} <span className="n">{counts[k] || 0}</span>
          </button>
        ))}
        {role === 'lead' && (
          <select value={tote} onChange={(e) => setTote(e.target.value)} aria-label="ראשי צוותים עם הרשאה ל…">
            <option value="">כל ההרשאות</option>
            {grants.map((h) => <option key={h.id} value={h.id}>{h.title}</option>)}
          </select>
        )}
      </div>

      <p className="muted ucount">
        {filtered ? `${shown.length} מתוך ${users.length} משתמשים` : `${users.length} משתמשים`}
        {filtered && <button type="button" className="linkish" onClick={clear}>ניקוי סינון</button>}
      </p>

      {!shown.length && <p className="empty">אין משתמשים שמתאימים לסינון.</p>}

      <ul className="users">
        {shown.map((u) => {
          return (
            <li key={u.uid} className={u.role === 'pending' ? 'pending' : ''}>
              <div className="who">
                {u.photo ? <img src={u.photo} alt="" referrerPolicy="no-referrer" /> : <span className="avatar">{(u.name || u.email || '?')[0]}</span>}
                <div>
                  <b>{u.name || '—'}{u.uid === me?.uid ? ' (את/ה)' : ''}</b>
                  <span dir="ltr">{u.email}</span>
                </div>
              </div>
              <select
                value={u.role}
                disabled={u.uid === me?.uid}
                onChange={(e) => update(u, { role: e.target.value, ...(e.target.value !== 'lead' ? { scopes: [] } : {}) })}
                aria-label={`תפקיד של ${u.name || u.email}`}
              >
                {Object.entries(ROLE_LABEL).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
              </select>
              {u.role === 'lead' && (
                <div className="scopes">
                  {grants.map((h) => {
                    const on = (u.scopes || []).includes(h.id)
                    return (
                      <label key={h.id} className={`scope ${on ? 'on' : ''} ${h.home ? 'home' : ''}`}>
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => update(u, { scopes: on ? u.scopes.filter((s) => s !== h.id) : [...(u.scopes || []), h.id] })}
                        />
                        {h.home && <i className="ti ti-home" aria-hidden="true" />}
                        {h.title}
                      </label>
                    )
                  })}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
