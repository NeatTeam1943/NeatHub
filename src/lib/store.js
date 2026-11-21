// Data layer. NEATHUB runs as a NeatSystem tab:
//  - Supabase mode: NeatSystem's project and login, through neathub_api
//    (supabase/migrations/0001_neathub.sql). Roles come from NeatSystem.
//  - mock mode (NeatSystem's dev:mock / preview): sample data in memory, roles
//    from NeatSystem's mock persona.
// Same interface either way, so the components don't care.
import { seedDemo } from './seed.js'
import { canView, VIS_RANK } from './model.js'

const deny = () => Object.assign(new Error('denied'), { code: 'permission-denied' })

// ---------------------------------------------------------------- Supabase
function supabaseStore(sb, getHost) {
  const api = () => sb.schema('neathub_api')
  const nodeSubs = new Set()
  const authSubs = new Set()
  const userSubs = new Set()
  const call = async (fn, args) => {
    const { data, error } = await api().rpc(fn, args)
    if (error) throw Object.assign(new Error(error.message), { code: error.code === '42501' || /permission-denied/.test(error.message) ? 'permission-denied' : error.code })
    return data
  }
  const pushNodes = async () => { const n = await call('nodes'); nodeSubs.forEach((cb) => cb(n)) }
  const pushAuth = async () => {
    const me = await call('me')
    const h = getHost()
    const profile = me.role === 'guest' ? null : { uid: me.uid, name: h.me.full_name, email: '', role: me.role, scopes: me.scopes ?? [] }
    authSubs.forEach((cb) => cb({ user: { uid: me.uid }, profile }))
  }
  const pushUsers = async () => { const u = await call('users'); userSubs.forEach((cb) => cb(u)) }
  return {
    mode: 'supabase',
    onNodes(cb, onError) { nodeSubs.add(cb); call('nodes').then(cb, onError); return () => nodeSubs.delete(cb) },
    onAuth(cb) { authSubs.add(cb); void pushAuth(); return () => authSubs.delete(cb) },
    refresh() { void pushNodes(); void pushAuth() },
    getUrl: (id) => call('url', { p_id: id }),
    async saveNodes(nodes, urls = {}, grantScope = null) {
      await call('save_nodes', { p_nodes: nodes, p_urls: urls, p_grant_scope: grantScope })
      await pushNodes()
      if (grantScope) await pushAuth()
    },
    async deleteNodes(nodes) { await call('delete_nodes', { p_ids: nodes.map((n) => n.id) }); await pushNodes() },
    onUsers(cb, onError) { userSubs.add(cb); call('users').then(cb, onError); return () => userSubs.delete(cb) },
    async updateUser(uid, data) { await call('set_scopes', { p_user: uid, p_scopes: data.scopes ?? [] }); await pushUsers() },
  }
}

// ---------------------------------------------------------------- mock
// Roles as in neathub.role(): from NeatSystem permissions for the signed-in
// person; for others (admin list, profile) from the default role table.
const roleOf = (p, can) => {
  if (!p || p.status !== 'active') return 'guest'
  if (can) return can('neathub.manage') ? 'mentor' : can('neathub.lead') ? 'lead' : 'member'
  return p.position === 'mentor' || p.is_admin ? 'mentor' : p.position === 'team_lead' || p.position === 'captain' ? 'lead' : 'member'
}
let mockState = null
function ensureMock(people) {
  if (!mockState) {
    const { nodes, urls } = seedDemo()
    const sw = people.find((p) => p.position === 'team_lead' && p.team === 'software')
    const bl = people.find((p) => p.position === 'team_lead' && p.team === 'build')
    mockState = { nodes, urls, scopes: { ...(sw ? { [sw.id]: ['sw'] } : {}), ...(bl ? { [bl.id]: ['build', 'root'] } : {}) } }
  }
  return mockState
}
/** Mock of neathub_api.profile_v1 (for NeatSystem's profile page in mock mode). */
export function mockProfile(user, ctx) {
  const S = ensureMock(ctx.people)
  const p = ctx.people.find((x) => x.id === user)
  const role = roleOf(p, p?.id === ctx.me.id ? ctx.can : null)
  if (role === 'mentor') return { contract: 1, title: 'NEATHUB', link: '/neathub', blocks: [{ kind: 'text', text: 'עורך/ת את כל ה-NEATHUB' }] }
  const sc = S.scopes[user] ?? []
  if (role !== 'lead' || !sc.length) return { contract: 1, blocks: [] }
  return { contract: 1, title: 'NEATHUB', link: '/neathub', blocks: [{ kind: 'chips', title: 'עורך/ת', items: sc.map((x) => ({ label: x === 'root' ? 'דף הבית' : S.nodes.find((n) => n.id === x)?.title ?? x, tone: 'brand' })) }] }
}
function mockStore(getHost) {
  const S = ensureMock(getHost().people)
  const nodeSubs = new Set()
  const authSubs = new Set()
  const userSubs = new Set()
  const profile = () => {
    const me = getHost().me, role = roleOf(me, getHost().can)
    return role === 'guest' ? null : { uid: me.id, name: me.full_name, email: '', role, scopes: S.scopes[me.id] ?? [] }
  }
  const emitNodes = () => nodeSubs.forEach((cb) => cb(S.nodes.map((n) => ({ ...n }))))
  const emitAuth = () => authSubs.forEach((cb) => cb({ user: { uid: getHost().me.id }, profile: profile() }))
  const users = () => getHost().people.filter((p) => p.status === 'active').map((p) => ({ uid: p.id, name: p.full_name, email: p.email ?? '', photo: p.avatar_url, role: roleOf(p), scopes: S.scopes[p.id] ?? [], createdAt: p.created_at }))
  const wait = () => new Promise((r) => setTimeout(r, 80))
  return {
    mode: 'mock',
    onNodes(cb) { nodeSubs.add(cb); cb(S.nodes.map((n) => ({ ...n }))); return () => nodeSubs.delete(cb) },
    onAuth(cb) { authSubs.add(cb); cb({ user: { uid: getHost().me.id }, profile: profile() }); return () => authSubs.delete(cb) },
    refresh() { emitAuth(); emitNodes() },
    async getUrl(id) {
      await wait()
      const u = S.urls[id]
      if (!u) return null
      const n = S.nodes.find((x) => x.id === id)
      if (!canView(profile(), n?.effVis ?? u.visibility)) throw deny()
      return u.url
    },
    async saveNodes(nodes, urls = {}, grantScope = null) {
      await wait()
      const p = profile()
      if (!p || (p.role !== 'mentor' && p.role !== 'lead')) throw deny()
      if (grantScope) S.scopes[p.uid] = [...(S.scopes[p.uid] ?? []), grantScope]
      for (const n of nodes) {
        const i = S.nodes.findIndex((x) => x.id === n.id)
        if (i >= 0) S.nodes[i] = { ...n }
        else S.nodes.push({ ...n })
        if (n.type === 'link' && urls[n.id] !== undefined) S.urls[n.id] = { url: urls[n.id], visibility: n.effVis, scope: n.scope }
      }
      emitNodes(); if (grantScope) emitAuth()
    },
    async deleteNodes(nodes) {
      await wait()
      const ids = new Set(nodes.map((n) => n.id))
      S.nodes = S.nodes.filter((n) => !ids.has(n.id))
      ids.forEach((id) => delete S.urls[id])
      emitNodes()
    },
    onUsers(cb) { userSubs.add(cb); cb(users()); return () => userSubs.delete(cb) },
    async updateUser(uid, data) { await wait(); S.scopes[uid] = data.scopes ?? []; userSubs.forEach((cb) => cb(users())); emitAuth() },
  }
}

let store = null
let hostRef = null
/** One store per page; `host` is NeatSystem's tab host (kept current on every render). */
export function getStore(host) {
  hostRef = host
  if (!store) store = host.mode === 'mock' ? mockStore(() => hostRef) : supabaseStore(host.supabase, () => hostRef)
  return Promise.resolve(store)
}
export { VIS_RANK }
