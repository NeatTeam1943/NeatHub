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
    async saveNodes(nodes, urls = {}) {
      const b = fs.writeBatch(db)
      for (const n of nodes) {
        b.set(fs.doc(db, 'nodes', n.id), { ...strip(n), updatedAt: fs.serverTimestamp() })
        if (n.type === 'link') {
          const data = { visibility: n.effVis, scope: n.scope }
          if (urls[n.id] !== undefined) data.url = urls[n.id]
          b.set(fs.doc(db, 'nodeUrls', n.id), data, { merge: true })
        }
      }
      await b.commit()
    },
    async deleteNodes(nodes) {
      const b = fs.writeBatch(db)
      for (const n of nodes) {
        b.delete(fs.doc(db, 'nodes', n.id))
        if (n.type === 'link') b.delete(fs.doc(db, 'nodeUrls', n.id))
      }
      await b.commit()
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
  const KEY = 'neathub-demo-v1'
  let state
  try { state = JSON.parse(localStorage.getItem(KEY)) } catch { state = null }
  if (!state?.nodes) state = { ...seedDemo(), role: 'guest' }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* private mode */ } }
  const nodeSubs = new Set()
  const authSubs = new Set()
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
      if (role === 'lead') state.leadScopes = state.nodes.filter((n) => !n.parentId && n.type === 'hub').slice(0, 1).map((n) => n.id)
      save(); emitAuth()
    },
    async getUrl(id) {
      const u = state.urls[id]
      if (!u) return null
      const r = rrank[profile()?.role] ?? 0
      if (rank[u.visibility] > r) throw Object.assign(new Error('denied'), { code: 'permission-denied' })
      return u.url
    },
    async saveNodes(nodes, urls = {}) {
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
      cb([
        { uid: 'demo', name: 'משתמש דמו', email: 'demo@neathub', role: state.role === 'guest' ? 'mentor' : state.role, scopes: [] },
        { uid: 'u2', name: 'נועה (דוגמה)', email: 'noa@example.com', role: 'pending', scopes: [] },
      ])
      return () => {}
    },
    async updateUser() {},
    reset() { localStorage.removeItem(KEY); location.reload() },
  }
}

let storePromise
export function getStore() {
  if (!storePromise) storePromise = isDemo ? Promise.resolve(demoStore()) : firebaseStore()
  return storePromise
}
