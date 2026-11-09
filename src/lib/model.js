// Shared data-model helpers.
//
// Node shape (Firestore `nodes/{id}`, public read):
//   parentId     string | null      null = shown on the home page
//   type         'hub' | 'link'
//   title        string             name (tooltip, breadcrumbs, editor)
//   labelMode    'txt' | 'img' | 'both'
//   labelText    string             text printed on the tote / piece
//   imageData    string | null      small data: URL (resized client-side)
//   imageUrl     string | null      external image (e.g. site / Google-app icon)
//   imageFallback string | null     used if imageUrl fails to load
//   season       number             hubs only — which season's pieces are inside
//   piece        string | null      links only — override the auto piece
//   visibility   'public'|'members'|'leads'|'mentors'   set on this node
//   effVis       same values        effective = strictest of node + ancestors
//   scope        string             top-level hub id (edit permission unit), 'root' for home links
//   order        number
//   createdBy    uid of whoever added it (informational)
//
// The URL itself lives in `nodeUrls/{id}` = { url, visibility: effVis, scope }
// so locked links never reach a guest's browser.

export const ROLE_RANK = { pending: 0, member: 1, lead: 2, mentor: 3 }
export const VIS_RANK = { public: 0, members: 1, leads: 2, mentors: 3 }
export const VIS_LABEL = {
  public: 'ציבורי',
  members: 'חברי קבוצה',
  leads: 'ראשי צוותים ומנטורים',
  mentors: 'מנטורים בלבד',
}
export const ROLE_LABEL = { pending: 'ממתין לאישור', member: 'חבר/ת קבוצה', lead: 'ראש צוות', mentor: 'מנטור/ית' }

export const stricter = (a, b) => (VIS_RANK[a] >= VIS_RANK[b] ? a : b)

export const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title)

export function childrenOf(nodes, parentId) {
  return nodes.filter((n) => (n.parentId ?? null) === parentId).sort(byOrder)
}

export function ancestors(nodes, id) {
  const map = new Map(nodes.map((n) => [n.id, n]))
  const out = []
  let cur = map.get(id)
  while (cur) {
    out.unshift(cur)
    cur = cur.parentId ? map.get(cur.parentId) : null
  }
  return out
}

export function descendants(nodes, id) {
  const out = []
  const walk = (pid) => childrenOf(nodes, pid).forEach((c) => { out.push(c); walk(c.id) })
  walk(id)
  return out
}

export function canView(profile, vis) {
  return (VIS_RANK[vis] ?? 0) <= (ROLE_RANK[profile?.role] ?? 0)
}

// Permissions are granted by mentors on the users page (profile.scopes):
//  - a top-level tote's id  → edit that tote and everything inside it (incl. its season)
//  - HOME ('root')          → add items to the home page, edit/delete the links on it,
//                             and delete totes from it (if that tote is granted too)
// Mentors can do everything. A lead who creates a new tote on the home page gets that
// tote added to their scopes automatically (a mentor can take it away).
// Mirrors firestore.rules.
export const HOME = 'root'
const has = (profile, scope) => (profile?.scopes || []).includes(scope)

export function canEditNode(profile, node) {
  if (!profile || !node) return false
  if (profile.role === 'mentor') return true
  return profile.role === 'lead' && has(profile, node.scope)
}

export const canAddToHome = (profile) => profile?.role === 'mentor' || (profile?.role === 'lead' && has(profile, HOME))

// Shows the edit toggle at all.
export const canEditAnything = (profile) => profile?.role === 'mentor' || (profile?.role === 'lead' && (profile.scopes || []).length > 0)

// Removing something from the home page needs the home-page permission too.
export function canDeleteNode(profile, node) {
  if (!canEditNode(profile, node)) return false
  return profile.role === 'mentor' || !!node.parentId || has(profile, HOME)
}

// Recompute scope + effVis for a node and its whole subtree after a change.
// Returns the list of nodes whose derived fields changed (including `node`).
export function recomputeSubtree(nodes, node) {
  const all = nodes.filter((n) => n.id !== node.id).concat(node)
  const map = new Map(all.map((n) => [n.id, n]))
  const changed = []
  const apply = (n, parent) => {
    const scope = parent ? parent.scope : n.type === 'hub' ? n.id : 'root'
    const effVis = parent ? stricter(n.visibility, parent.effVis) : n.visibility
    const next = { ...n, scope, effVis }
    if (n === node || next.scope !== n.scope || next.effVis !== n.effVis) changed.push(next)
    map.set(n.id, next)
    childrenOf(all, n.id).forEach((c) => apply(map.get(c.id), next))
  }
  apply(node, node.parentId ? map.get(node.parentId) : null)
  return changed
}

// ---- Shareable hub paths: #/software/vision
// Each hub has an optional `slug` (a-z, 0-9, '-'), unique among its siblings.
// A path segment matches a child hub by slug, or by id as a fallback.
export const RESERVED_SLUGS = ['admin', 'h']
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,39}$/

export function slugify(title) {
  return (title || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export const segOf = (n) => n.slug || n.id

export function hubPath(nodes, id) {
  return ancestors(nodes, id).map((n) => encodeURIComponent(segOf(n))).join('/')
}

export function resolvePath(nodes, segs) {
  let parent = null
  let cur = null
  for (const seg of segs) {
    const kids = childrenOf(nodes, parent).filter((n) => n.type === 'hub')
    cur = kids.find((n) => n.slug === seg) || kids.find((n) => n.id === seg)
    if (!cur) return null
    parent = cur.id
  }
  return cur
}

export function newId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}
