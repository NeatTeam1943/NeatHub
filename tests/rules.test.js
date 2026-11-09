// Security rules tests. Run with the Firestore emulator (needs Java):
//   npm run test:rules
import { readFileSync } from 'node:fs'
import { before, after, beforeEach, test } from 'node:test'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, arrayUnion } from 'firebase/firestore'

let env
const hub = (id, extra = {}) => ({ parentId: null, type: 'hub', title: id, scope: id, order: 0, visibility: 'public', effVis: 'public', labelMode: 'txt', season: 2026, ...extra })
const link = (id, scope, extra = {}) => ({ parentId: scope, type: 'link', title: id, scope, order: 1, visibility: 'public', effVis: 'public', labelMode: 'txt', season: null, ...extra })

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'neathub-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
})
after(() => env.cleanup())
beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users/mentor'), { role: 'mentor', scopes: [] })
    await setDoc(doc(db, 'users/lead'), { role: 'lead', scopes: ['sw'] })
    await setDoc(doc(db, 'users/lead2'), { role: 'lead', scopes: ['root'] })
    await setDoc(doc(db, 'users/member'), { role: 'member', scopes: [] })
    await setDoc(doc(db, 'users/pending'), { role: 'pending', scopes: [] })
    await setDoc(doc(db, 'nodes/sw'), hub('sw'))
    await setDoc(doc(db, 'nodes/build'), hub('build'))
    await setDoc(doc(db, 'nodes/pub'), link('pub', 'sw'))
    await setDoc(doc(db, 'nodeUrls/pub'), { url: 'https://a.example', visibility: 'public', scope: 'sw' })
    await setDoc(doc(db, 'nodes/sec'), link('sec', 'sw', { visibility: 'members', effVis: 'members' }))
    await setDoc(doc(db, 'nodeUrls/sec'), { url: 'https://secret.example', visibility: 'members', scope: 'sw' })
    await setDoc(doc(db, 'nodes/homelink'), { ...link('homelink', 'root'), parentId: null })
  })
})

const as = (uid) => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore()

test('guests read nodes and public URLs, not locked URLs', async () => {
  await assertSucceeds(getDoc(doc(as(null), 'nodes/sec')))
  await assertSucceeds(getDoc(doc(as(null), 'nodeUrls/pub')))
  await assertFails(getDoc(doc(as(null), 'nodeUrls/sec')))
  await assertFails(getDoc(doc(as('pending'), 'nodeUrls/sec')))
  await assertSucceeds(getDoc(doc(as('member'), 'nodeUrls/sec')))
})

test('only editors can change a season', async () => {
  await assertFails(updateDoc(doc(as(null), 'nodes/sw'), { season: 2012 }))
  await assertFails(updateDoc(doc(as('member'), 'nodes/sw'), { season: 2012 }))
  await assertSucceeds(updateDoc(doc(as('lead'), 'nodes/sw'), { season: 2012 }))
  await assertFails(updateDoc(doc(as('lead'), 'nodes/build'), { season: 2012 }))
  await assertSucceeds(updateDoc(doc(as('mentor'), 'nodes/build'), { season: 2012 }))
})

const by = (uid, d) => ({ ...d, createdBy: uid })

test('leads stay inside their scope', async () => {
  await assertSucceeds(setDoc(doc(as('lead'), 'nodes/new1'), by('lead', link('new1', 'sw'))))
  await assertFails(setDoc(doc(as('lead'), 'nodes/new2'), by('lead', link('new2', 'build'))))
  await assertFails(updateDoc(doc(as('lead'), 'nodes/pub'), { scope: 'build' }))
  await assertFails(updateDoc(doc(as('lead'), 'nodes/pub'), { parentId: 'build', scope: 'build' }))
  await assertFails(deleteDoc(doc(as('lead'), 'nodes/sw')))
  await assertSucceeds(deleteDoc(doc(as('lead'), 'nodes/pub')))
})

test('home-page permission is granted by mentors', async () => {
  const rootLink = (id) => by('lead2', { ...link(id, 'root'), parentId: null })
  // lead2 has 'root': add/edit/delete links on the home page
  await assertSucceeds(setDoc(doc(as('lead2'), 'nodes/r1'), rootLink('r1')))
  await assertSucceeds(setDoc(doc(as('lead2'), 'nodeUrls/r1'), { url: 'https://r.example', visibility: 'public', scope: 'root' }))
  await assertSucceeds(updateDoc(doc(as('lead2'), 'nodes/homelink'), { title: 'renamed' }))
  await assertSucceeds(deleteDoc(doc(as('lead2'), 'nodes/homelink')))
  // lead (only 'sw') can't touch the home page, and can't delete its granted top-level tote
  await assertFails(setDoc(doc(as('lead'), 'nodes/r2'), by('lead', { ...link('r2', 'root'), parentId: null })))
  await assertFails(setDoc(doc(as('lead'), 'nodes/t0'), by('lead', hub('t0'))))
  await assertFails(deleteDoc(doc(as('lead'), 'nodes/sw')))
  // can't pretend someone else created it, or claim another tote's scope
  await assertFails(setDoc(doc(as('lead2'), 'nodes/t2'), by('mentor', hub('t2'))))
  await assertFails(setDoc(doc(as('lead2'), 'nodes/t3'), by('lead2', hub('t3', { scope: 'sw' }))))
  // lead2 has no tote permissions: can't edit inside 'sw' or 'build'
  await assertFails(updateDoc(doc(as('lead2'), 'nodes/build'), { season: 2017 }))
  await assertFails(setDoc(doc(as('lead2'), 'nodes/x1'), by('lead2', link('x1', 'sw'))))
})

test('a new tote comes with permission to fill it (once)', async () => {
  const db = as('lead2')
  const b = writeBatch(db)
  b.set(doc(db, 'nodes/t1'), by('lead2', hub('t1')))
  b.update(doc(db, 'users/lead2'), { scopes: arrayUnion('t1') })
  await assertSucceeds(b.commit())
  await assertSucceeds(setDoc(doc(db, 'nodes/in1'), by('lead2', link('in1', 't1'))))
  await assertSucceeds(updateDoc(doc(db, 'nodes/t1'), { season: 2017 }))
  // can't sneak an item into someone else's tote by claiming her own scope
  await assertFails(setDoc(doc(db, 'nodes/in2'), by('lead2', { ...link('in2', 't1'), parentId: 'build' })))
  // can't grant herself an existing tote, or anything else
  await assertFails(updateDoc(doc(db, 'users/lead2'), { scopes: arrayUnion('build') }))
  await assertFails(updateDoc(doc(db, 'users/lead2'), { role: 'mentor' }))
  // after a mentor removes it, she can't take it back
  await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), 'users/lead2'), { scopes: ['root'] }))
  await assertFails(updateDoc(doc(db, 'users/lead2'), { scopes: arrayUnion('t1') }))
  await assertFails(updateDoc(doc(db, 'nodes/t1'), { season: 2012 }))
  // a lead without home permission can't use the trick
  const b2 = writeBatch(as('lead'))
  b2.set(doc(as('lead'), 'nodes/t9'), by('lead', hub('t9')))
  b2.update(doc(as('lead'), 'users/lead'), { scopes: arrayUnion('t9') })
  await assertFails(b2.commit())
})

test('users can only register themselves as pending', async () => {
  await assertSucceeds(setDoc(doc(as('newbie'), 'users/newbie'), { role: 'pending', scopes: [] }))
  await assertFails(setDoc(doc(as('sneaky'), 'users/sneaky'), { role: 'mentor', scopes: [] }))
  await assertFails(updateDoc(doc(as('member'), 'users/member'), { role: 'mentor' }))
  await assertSucceeds(updateDoc(doc(as('mentor'), 'users/member'), { role: 'lead', scopes: ['sw'] }))
})

test('URL writes need a real http(s) link', async () => {
  await assertFails(setDoc(doc(as('mentor'), 'nodeUrls/pub'), { url: 'javascript:alert(1)', visibility: 'public', scope: 'sw' }))
  await assertSucceeds(setDoc(doc(as('mentor'), 'nodeUrls/pub'), { url: 'https://ok.example', visibility: 'public', scope: 'sw' }))
  // URL visibility must match the link's effective visibility (no unlocking a locked URL)
  await assertFails(setDoc(doc(as('lead'), 'nodeUrls/sec'), { url: 'https://secret.example', visibility: 'public', scope: 'sw' }))
  await assertSucceeds(setDoc(doc(as('lead'), 'nodeUrls/sec'), { url: 'https://secret2.example', visibility: 'members', scope: 'sw' }))
  await assertFails(setDoc(doc(as('lead2'), 'nodeUrls/pub'), { url: 'https://evil.example', visibility: 'public', scope: 'sw' }))
})
