// Where NEATHUB lives inside NeatSystem's hash router: '#/neathub' (host.base).
// Every route of NEATHUB is BASE + its old path: '#/neathub/software/vision', '#/neathub/admin'.
let base = '#/neathub'
export const setBase = (b) => { base = '#' + (b || '/neathub') }
export const BASE = () => base
export const href = (path = '') => (path ? `${base}/${path}` : base)
/** The part of the hash after BASE, without slashes at the ends. */
export function currentPath() {
  const h = decodeURI(location.hash)
  if (!h.startsWith(base)) return ''
  return h.slice(base.length).replace(/^\/+|\/+$/g, '')
}
