// Data layer. Uses Firebase when configured, otherwise a local demo store
// (localStorage) so the site can be run and tried without a backend.
import { seedDemo } from './seed.js'

const cfg = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
}

export const isDemo = !cfg.projectId

const strip = ({ id, ...rest }) => rest
const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n))

// ---------------------------------------------------------------- Firebase
async function firebaseStore() {
  const { initializeApp } = await import('firebase/app')
  const fa = await import('firebase/auth')
  const fs = await import('firebase/firestore')
  const app = initializeApp(cfg)
  const auth = fa.getAuth(app)
  const db = fs.getFirestore(app)

  return {
    mode: 'firebase',
    onNodes(cb, onError) {
      return fs.onSnapshot(
        fs.collection(db, 'nodes'),
        (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        onError,
      )
    },
    onAuth(cb) {
      let unsubProfile = () => {}
      const unsub = fa.onAuthStateChanged(auth, async (user) => {
        unsubProfile()
        if (!user) return cb({ user: null, profile: null })
        const ref = fs.doc(db, 'users', user.uid)
        const snap = await fs.getDoc(ref)
        if (!snap.exists()) {
          await fs.setDoc(ref, {
            name: user.displayName || '',
            email: user.email || '',
            photo: user.photoURL || '',
            role: 'pending',
            scopes: [],
            createdAt: fs.serverTimestamp(),
          })
        }
        unsubProfile = fs.onSnapshot(ref, (s) => cb({ user, profile: s.exists() ? { uid: user.uid, ...s.data() } : null }))
      })
      return () => { unsub(); unsubProfile() }
    },
    signIn: () => fa.signInWithPopup(auth, new fa.GoogleAuthProvider()),
    signOut: () => fa.signOut(auth),
    async getUrl(id) {
      const s = await fs.getDoc(fs.doc(db, 'nodeUrls', id))
      return s.exists() ? s.data().url : null
    },
    // nodes: full node objects to write. urls: { [id]: url } for links whose URL changed.
    // Written in small batches: security rules may read only ~20 documents per batch.
    // grantScope: id of a new top-level tote a team lead just created — added to their
    // own scopes in the same batch (the rules only allow it for a brand-new tote).
    async saveNodes(nodes, urls = {}, grantScope = null) {
      for (const [i, part] of chunks(nodes, 6).entries()) {
        const b = fs.writeBatch(db)
        if (i === 0 && grantScope && auth.currentUser) {
          b.update(fs.doc(db, 'users', auth.currentUser.uid), { scopes: fs.arrayUnion(grantScope) })
        }
        for (const n of part) {
          b.set(fs.doc(db, 'nodes', n.id), { ...strip(n), updatedAt: fs.serverTimestamp() })
          if (n.type === 'link') {
            const data = { visibility: n.effVis, scope: n.scope }
            if (urls[n.id] !== undefined) data.url = urls[n.id]
            b.set(fs.doc(db, 'nodeUrls', n.id), data, { merge: true })
          }
        }
        await b.commit()
      }
    },
    // Deepest items first, so a tote is removed only after everything inside it.
    async deleteNodes(nodes) {
      for (const part of chunks([...nodes].reverse(), 6)) {
        const b = fs.writeBatch(db)
        for (const n of part) {
          b.delete(fs.doc(db, 'nodes', n.id))
          if (n.type === 'link') b.delete(fs.doc(db, 'nodeUrls', n.id))
        }
        await b.commit()
      }
    },
    onUsers(cb, onError) {
      return fs.onSnapshot(
        fs.collection(db, 'users'),
        (snap) => cb(snap.docs.map((d) => ({ uid: d.id, ...d.data() }))),
        onError,
      )
    },
    updateUser: (uid, data) => fs.updateDoc(fs.doc(db, 'users', uid), data),
  }
}

// ---------------------------------------------------------------- Demo
function demoStore() {
  const KEY = 'neathub-demo-v3'
  let state
  try { state = JSON.parse(localStorage.getItem(KEY)) } catch { state = null }
  if (!state?.nodes) state = { ...seedDemo(), role: 'guest' }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* private mode */ } }
  const nodeSubs = new Set()
  const authSubs = new Set()
  const userSubs = new Set()
  const emitNodes = () => nodeSubs.forEach((cb) => cb(state.nodes.map((n) => ({ ...n }))))
  const profile = () =>
    state.role === 'guest'
      ? null
      : { uid: 'demo', name: 'משתמש דמו', email: 'demo@neathub', role: state.role, scopes: state.role === 'lead' ? state.leadScopes || [] : [] }
  const emitAuth = () => authSubs.forEach((cb) => cb({ user: state.role === 'guest' ? null : { uid: 'demo' }, profile: profile() }))
  const rank = { public: 0, members: 1, leads: 2, mentors: 3 }
  const rrank = { pending: 0, member: 1, lead: 2, mentor: 3 }

  return {
    mode: 'demo',
    onNodes(cb) { nodeSubs.add(cb); cb(state.nodes.map((n) => ({ ...n }))); return () => nodeSubs.delete(cb) },
    onAuth(cb) { authSubs.add(cb); cb({ user: state.role === 'guest' ? null : { uid: 'demo' }, profile: profile() }); return () => authSubs.delete(cb) },
    signIn() { state.role = 'mentor'; save(); emitAuth() },
    signOut() { state.role = 'guest'; save(); emitAuth() },
    setDemoRole(role) {
      state.role = role
      if (role === 'lead') state.leadScopes = ['root', ...state.nodes.filter((n) => !n.parentId && n.type === 'hub').slice(0, 1).map((n) => n.id)]
      save(); emitAuth()
    },
    async getUrl(id) {
      const u = state.urls[id]
      if (!u) return null
      const r = rrank[profile()?.role] ?? 0
      if (rank[u.visibility] > r) throw Object.assign(new Error('denied'), { code: 'permission-denied' })
      return u.url
    },
    async saveNodes(nodes, urls = {}, grantScope = null) {
      if (grantScope) { state.leadScopes = [...(state.leadScopes || []), grantScope]; emitAuth() }
      for (const n of nodes) {
        const i = state.nodes.findIndex((x) => x.id === n.id)
        if (i >= 0) state.nodes[i] = { ...n }
        else state.nodes.push({ ...n })
        if (n.type === 'link') {
          const prev = state.urls[n.id] || {}
          state.urls[n.id] = { ...prev, visibility: n.effVis, scope: n.scope, ...(urls[n.id] !== undefined ? { url: urls[n.id] } : {}) }
        }
      }
      save(); emitNodes()
    },
    async deleteNodes(nodes) {
      const ids = new Set(nodes.map((n) => n.id))
      state.nodes = state.nodes.filter((n) => !ids.has(n.id))
      ids.forEach((id) => delete state.urls[id])
      save(); emitNodes()
    },
    onUsers(cb) {
      if (!state.users) {
        const t = Date.now()
        state.users = [
          ['demo', 'משתמש דמו', 'demo@neathub', 'mentor', []],
          ['u2', 'נועה כהן', 'noa@example.com', 'pending', []],
          ['u3', 'איתי לוי', 'itai@example.com', 'lead', ['sw']],
          ['u4', 'מאיה פרץ', 'maya@example.com', 'lead', ['build']],
          ['u5', 'דניאל ברק', 'daniel@example.com', 'member', []],
          ['u6', 'שירה אבני', 'shira@example.com', 'member', []],
          ['u7', 'רון מזרחי', 'ron@example.com', 'mentor', []],
          ['u8', 'יעל גולן', 'yael@example.com', 'pending', []],
        ].map(([uid, name, email, role, scopes], i) => ({ uid, name, email, role, scopes, createdAt: t - i * 86400000 }))
      }
      userSubs.add(cb)
      cb(state.users.map((u) => ({ ...u })))
      return () => userSubs.delete(cb)
    },
    async updateUser(uid, data) {
      state.users = state.users.map((u) => (u.uid === uid ? { ...u, ...data } : u))
      save()
      userSubs.forEach((cb) => cb(state.users.map((u) => ({ ...u }))))
    },
    reset() { localStorage.removeItem(KEY); location.reload() },
  }
}

let storePromise
export function getStore() {
  if (!storePromise) storePromise = isDemo ? Promise.resolve(demoStore()) : firebaseStore()
  return storePromise
}
