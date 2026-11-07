import { useEffect, useState } from 'react'
import { ROLE_LABEL } from '../lib/model.js'

// Mentors approve users, set roles, and pick which top-level totes a team lead can edit.
export default function Admin({ store, nodes, me, toast }) {
  const [users, setUsers] = useState(null)
  const [err, setErr] = useState('')
  const hubs = nodes.filter((n) => !n.parentId && n.type === 'hub')

  useEffect(() => store.onUsers(setUsers, () => setErr('אין גישה לרשימת המשתמשים.')), [store])

  async function update(u, patch) {
    try {
      await store.updateUser(u.uid, patch)
      toast('עודכן')
    } catch {
      toast('העדכון נכשל')
    }
  }

  if (err) return <p className="empty">{err}</p>
  if (!users) return <p className="empty">טוען…</p>

  const sorted = [...users].sort((a, b) => (a.role === 'pending' ? -1 : 0) - (b.role === 'pending' ? -1 : 0) || (a.name || '').localeCompare(b.name || ''))

  return (
    <div className="admin">
      <h2>משתמשים והרשאות</h2>
      <p className="muted">מנטורים עורכים הכול. ראש צוות עורך רק את הארגזים שסומנו לו (כולל כל מה שבתוכם, ואת העונה שלהם).</p>
      <ul className="users">
        {sorted.map((u) => (
          <li key={u.uid} className={u.role === 'pending' ? 'pending' : ''}>
            <div className="who">
              {u.photo ? <img src={u.photo} alt="" referrerPolicy="no-referrer" /> : <span className="avatar">{(u.name || u.email || '?')[0]}</span>}
              <div>
                <b>{u.name || '—'}</b>
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
                {hubs.map((h) => {
                  const on = (u.scopes || []).includes(h.id)
                  return (
                    <label key={h.id} className={`scope ${on ? 'on' : ''}`}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => update(u, { scopes: on ? u.scopes.filter((s) => s !== h.id) : [...(u.scopes || []), h.id] })}
                      />
                      {h.title}
                    </label>
                  )
                })}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
