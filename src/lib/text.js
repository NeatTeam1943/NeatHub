// Hebrew-friendly normalisation: lower-case, strip niqqud/punctuation, fold final letters.
const FINALS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' }
export const norm = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[֑-ׇ]/g, '')
    .replace(/[ךםןףץ]/g, (c) => FINALS[c])
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
