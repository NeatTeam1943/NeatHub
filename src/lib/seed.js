// Sample content for demo mode only.
const team = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#1216ff"/><circle cx="32" cy="32" r="22" fill="none" stroke="#ff8c12" stroke-width="5" stroke-dasharray="6 4"/><text x="32" y="38" font-family="Arial" font-size="15" font-weight="bold" fill="#fff" text-anchor="middle">1943</text></svg>')
const eye = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0a0f3d"/><path d="M8 32 Q32 10 56 32 Q32 54 8 32Z" fill="#fff"/><circle cx="32" cy="32" r="9" fill="#ff8c12"/><circle cx="32" cy="32" r="4" fill="#0a0f3d"/></svg>')

export function seedDemo() {
  const nodes = []
  const urls = {}
  let order = 0
  const add = (n, url) => {
    const node = {
      parentId: null, labelMode: 'txt', labelText: n.title, imageData: null, imageUrl: null,
      season: 2026, piece: null, visibility: 'public', order: order++, ...n,
    }
    nodes.push(node)
    if (url) urls[node.id] = { url, visibility: node.effVis || node.visibility, scope: node.scope }
    return node
  }
  // Home
  add({ id: 'sw', type: 'hub', title: 'תוכנה', labelMode: 'both', imageData: team, season: 2026, scope: 'sw', effVis: 'public' })
  add({ id: 'build', type: 'hub', title: 'בנייה', season: 2017, scope: 'build', effVis: 'public' })
  add({ id: 'home-tracker', type: 'link', title: 'רישיון בנאי', scope: 'root', effVis: 'public' }, 'https://example.com/builder-license')
  add({ id: 'home-drive', type: 'link', title: 'Drive קבוצתי', labelText: 'Drive', scope: 'root', effVis: 'public' }, 'https://drive.google.com/')
  // Software
  add({ id: 'vision', parentId: 'sw', type: 'hub', title: 'Vision', labelMode: 'both', imageData: eye, season: 2024, scope: 'sw', effVis: 'public' })
  add({ id: 'sw-drive', parentId: 'sw', type: 'link', title: 'Drive תוכנה', labelText: 'Drive', scope: 'sw', effVis: 'public' }, 'https://drive.google.com/')
  add({ id: 'scout', parentId: 'sw', type: 'hub', title: 'סקאוטינג', season: 2019, scope: 'sw', effVis: 'public' })
  add({ id: 'sw-logo', parentId: 'sw', type: 'link', title: 'לוגו קבוצה', labelMode: 'img', imageData: team, scope: 'sw', effVis: 'public' }, 'https://example.com/logo')
  add({ id: 'sw-wpilib', parentId: 'sw', type: 'link', title: 'מדריך WPILib', labelText: 'WPILib', scope: 'sw', effVis: 'public' }, 'https://docs.wpilib.org/')
  add({ id: 'sw-keys', parentId: 'sw', type: 'link', title: 'סיסמאות ומפתחות', labelText: 'מפתחות', visibility: 'mentors', scope: 'sw', effVis: 'mentors' }, 'https://example.com/secret')
  // Vision
  ;['Limelight', 'PhotonVision', 'AprilTags', 'מדריך כיול'].forEach((t, i) =>
    add({ id: `v${i}`, parentId: 'vision', type: 'link', title: t, scope: 'sw', effVis: 'public' }, 'https://example.com/v' + i))
  // Scouting
  ;[['טופס סקאוטינג', 'טופס'], ['The Blue Alliance', 'TBA'], ['גיליון נתונים', 'נתונים']].forEach(([t, l], i) =>
    add({ id: `s${i}`, parentId: 'scout', type: 'link', title: t, labelText: l, scope: 'sw', effVis: 'public' }, 'https://example.com/s' + i))
  // Build
  ;[['רישיון בנאי', 'רישיון'], ['שרטוטים', 'שרטוטים']].forEach(([t, l], i) =>
    add({ id: `b${i}`, parentId: 'build', type: 'link', title: t, labelText: l, scope: 'build', effVis: 'public' }, 'https://example.com/b' + i))
  add({ id: 'cnc', parentId: 'build', type: 'hub', title: 'CNC', season: 2023, scope: 'build', effVis: 'public' })
  add({ id: 'b-shop', parentId: 'build', type: 'link', title: 'רשימת קניות', labelText: 'קניות', visibility: 'members', scope: 'build', effVis: 'members' }, 'https://example.com/shop')
  add({ id: 'b-safety', parentId: 'build', type: 'link', title: 'הדרכת בטיחות', labelText: 'בטיחות', scope: 'build', effVis: 'public' }, 'https://example.com/safety')
  ;[['הוראות הפעלה', 'הוראות'], ['קבצי G-code', 'G-code'], ['תור עבודות', 'תור']].forEach(([t, l], i) =>
    add({ id: `c${i}`, parentId: 'cnc', type: 'link', title: t, labelText: l, scope: 'build', effVis: 'public' }, 'https://example.com/c' + i))
  return { nodes, urls }
}
