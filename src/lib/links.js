// Recognise common link types from the URL (shown in the editor).
const RULES = [
  [/docs\.google\.com\/presentation/, 'Google Slides', 'ti-presentation'],
  [/docs\.google\.com\/document/, 'Google Docs', 'ti-file-text'],
  [/docs\.google\.com\/spreadsheets/, 'Google Sheets', 'ti-table'],
  [/docs\.google\.com\/forms|forms\.gle/, 'Google Forms', 'ti-forms'],
  [/drive\.google\.com/, 'Google Drive', 'ti-brand-google-drive'],
  [/canva\.(com|link)/, 'Canva', 'ti-palette'],
  [/youtube\.com|youtu\.be/, 'YouTube', 'ti-brand-youtube'],
  [/github\.(com|io)/, 'GitHub', 'ti-brand-github'],
  [/thebluealliance\.com/, 'The Blue Alliance', 'ti-trophy'],
  [/onshape\.com/, 'Onshape', 'ti-3d-cube-sphere'],
]

export function detectLink(url) {
  if (!url) return null
  for (const [re, name, icon] of RULES) if (re.test(url)) return { name, icon }
  try {
    return { name: new URL(url).hostname.replace(/^www\./, ''), icon: 'ti-world' }
  } catch {
    return null
  }
}

export function isValidUrl(url) {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

// Google apps share hosts (docs.google.com serves Docs, Sheets, Slides…), so a
// domain-based favicon would give them all the generic "G". Pick the app from the path.
const GOOGLE_APPS = [
  [/docs\.google\.com\/document/, 'docs'],
  [/docs\.google\.com\/spreadsheets/, 'sheets'],
  [/docs\.google\.com\/presentation/, 'slides'],
  [/docs\.google\.com\/forms|forms\.gle/, 'forms'],
  [/docs\.google\.com\/drawings/, 'drawings'],
  [/drive\.google\.com/, 'drive'],
  [/sites\.google\.com/, 'sites'],
  [/calendar\.google\.com/, 'calendar'],
  [/mail\.google\.com/, 'gmail'],
  [/meet\.google\.com/, 'meet'],
  [/classroom\.google\.com/, 'classroom'],
  [/keep\.google\.com/, 'keep'],
  [/(maps\.google\.|google\.[a-z.]+\/maps|maps\.app\.goo\.gl)/, 'maps'],
]

const domainIcon = (url) => {
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=128`
  } catch {
    return null
  }
}

// Google's favicon service that resolves the icon of a full page URL (not just
// its domain) — matters for sites that share a host, e.g. owner.github.io/Repo.
const pageIconService = (url) =>
  `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=128&url=${encodeURIComponent(url)}`

// Pick the best icon declared in a page's HTML (like a browser tab does).
export function bestIconFromHtml(html, pageUrl) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const base = doc.querySelector('base[href]')?.getAttribute('href')
  const baseUrl = base ? new URL(base, pageUrl).href : pageUrl
  const links = [...doc.querySelectorAll('link[rel][href]')]
    .map((l) => {
      const rel = l.getAttribute('rel').toLowerCase()
      if (!/\bicon\b|apple-touch-icon/.test(rel)) return null
      const href = l.getAttribute('href')
      const type = (l.getAttribute('type') || '').toLowerCase()
      const size = Math.max(0, ...(l.getAttribute('sizes') || '').split(/\s+/).map((x) => parseInt(x, 10) || 0))
      let score = size || 32
      if (rel.includes('apple-touch-icon')) score = Math.max(score, 180)
      if (type.includes('svg') || /\.svg(\?|$)/i.test(href) || (l.getAttribute('sizes') || '') === 'any') score = 1000
      if (rel.includes('mask-icon')) score = 0 // monochrome Safari pinned-tab icon
      try {
        return { href: new URL(href, baseUrl).href, score }
      } catch {
        return null
      }
    })
    .filter((x) => x && x.score > 0)
    .sort((a, b) => b.score - a.score)
  return links[0]?.href || null
}

// Site icon for a link: { imageUrl, imageFallback }. imageFallback is used if the
// primary image fails to load.
//  1. Google apps (Docs/Sheets/…) → that app's own icon.
//  2. Read the page itself and use the icon it declares (works for same-origin pages,
//     e.g. other team sites on github.io, and for sites that allow CORS).
//  3. Otherwise Google's per-page favicon service, then the per-domain one.
export async function findSiteIcon(url) {
  const app = GOOGLE_APPS.find(([re]) => re.test(url))?.[1]
  if (app) return { imageUrl: `https://www.gstatic.com/images/branding/product/2x/${app}_2020q4_48dp.png`, imageFallback: domainIcon(url) }
  try {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), 4000)
    const res = await fetch(url, { signal: ctl.signal, credentials: 'omit', redirect: 'follow' })
    clearTimeout(t)
    if (res.ok && (res.headers.get('content-type') || '').includes('html')) {
      const icon = bestIconFromHtml(await res.text(), res.url || url)
      if (icon) return { imageUrl: icon, imageFallback: pageIconService(url) }
      // No icon declared: browsers fall back to /favicon.ico at the site root.
      return { imageUrl: new URL('/favicon.ico', res.url || url).href, imageFallback: pageIconService(url) }
    }
  } catch {
    // Cross-origin without CORS, offline, timeout… fall through.
  }
  return { imageUrl: pageIconService(url), imageFallback: domainIcon(url) }
}

// <img> props that fall back to imageFallback (then hide) if the image fails to load.
export function imgSrcProps(node) {
  return {
    src: node.imageData || node.imageUrl,
    onError: (e) => {
      const el = e.currentTarget
      if (node.imageFallback && el.src !== node.imageFallback) el.src = node.imageFallback
      else el.style.visibility = 'hidden'
    },
  }
}

// Resize an uploaded image to a small data URL so it can live inside the
// Firestore doc (no Cloud Storage bucket needed).
export function resizeImage(file, max = 192) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width || max, img.height || max))
      const w = Math.max(1, Math.round((img.width || max) * s))
      const h = Math.max(1, Math.round((img.height || max) * s))
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      c.getContext('2d').drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      let out = c.toDataURL('image/webp', 0.85)
      if (!out.startsWith('data:image/webp')) out = c.toDataURL('image/png')
      resolve(out)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')) }
    img.src = url
  })
}
