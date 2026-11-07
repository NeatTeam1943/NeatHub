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

// Site icon for a link: { imageUrl, imageFallback }. Google apps get their own
// product icon; everything else uses Google's favicon service (sends only the hostname).
// imageFallback is used if the primary image fails to load.
export function siteIconFor(url) {
  const app = GOOGLE_APPS.find(([re]) => re.test(url))?.[1]
  const fallback = domainIcon(url)
  if (app) return { imageUrl: `https://www.gstatic.com/images/branding/product/2x/${app}_2020q4_48dp.png`, imageFallback: fallback }
  return { imageUrl: fallback, imageFallback: null }
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
