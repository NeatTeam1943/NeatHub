// Security rules tests. Run with the Firestore emulator (needs Java):
//   npm run test:rules
import { readFileSync } from 'node:fs'
import { before, after, beforeEach, test } from 'node:test'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'

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
    await setDoc(doc(db, 'users/member'), { role: 'member', scopes: [] })
    await setDoc(doc(db, 'users/pending'), { role: 'pending', scopes: [] })
    await setDoc(doc(db, 'nodes/sw'), hub('sw'))
    await setDoc(doc(db, 'nodes/build'), hub('build'))
    await setDoc(doc(db, 'nodes/pub'), link('pub', 'sw'))
    await setDoc(doc(db, 'nodeUrls/pub'), { url: 'https://a.example', visibility: 'public', scope: 'sw' })
    await setDoc(doc(db, 'nodes/sec'), link('sec', 'sw', { visibility: 'members', effVis: 'members' }))
    await setDoc(doc(db, 'nodeUrls/sec'), { url: 'https://secret.example', visibility: 'members', scope: 'sw' })
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

test('leads stay inside their scope', async () => {
  await assertSucceeds(setDoc(doc(as('lead'), 'nodes/new1'), link('new1', 'sw')))
  await assertFails(setDoc(doc(as('lead'), 'nodes/new2'), link('new2', 'build')))
  await assertFails(setDoc(doc(as('lead'), 'nodes/root2'), hub('root2')))
  await assertFails(updateDoc(doc(as('lead'), 'nodes/pub'), { scope: 'build' }))
  await assertFails(deleteDoc(doc(as('lead'), 'nodes/sw')))
  await assertSucceeds(deleteDoc(doc(as('lead'), 'nodes/pub')))
})

test('users can only register themselves as pending', async () => {
  await assertSucceeds(setDoc(doc(as('newbie'), 'users/newbie'), { role: 'pending', scopes: [] }))
  await assertFails(setDoc(doc(as('sneaky'), 'users/sneaky'), { role: 'mentor', scopes: [] }))
  await assertFails(updateDoc(doc(as('member'), 'users/member'), { role: 'mentor' }))
  await assertSucceeds(updateDoc(doc(as('mentor'), 'users/member'), { role: 'lead', scopes: ['sw'] }))
})

test('URL writes need a real http(s) link', async () => {
  await assertFails(setDoc(doc(as('mentor'), 'nodeUrls/x'), { url: 'javascript:alert(1)', visibility: 'public', scope: 'sw' }))
  await assertSucceeds(setDoc(doc(as('mentor'), 'nodeUrls/x'), { url: 'https://ok.example', visibility: 'public', scope: 'sw' }))
})
