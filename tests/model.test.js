import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canEditNode, canDeleteNode, canView, recomputeSubtree, resolvePath, hubPath } from '../src/lib/model.js'

const nodes = [
  { id: 'sw', parentId: null, type: 'hub', title: 'תוכנה', slug: 'software', visibility: 'public', effVis: 'public', scope: 'sw', order: 1 },
  { id: 'v', parentId: 'sw', type: 'hub', title: 'Vision', slug: 'vision', visibility: 'members', effVis: 'members', scope: 'sw', order: 1 },
  { id: 'l', parentId: 'v', type: 'link', title: 'L', visibility: 'public', effVis: 'members', scope: 'sw', order: 1 },
]

test('paths', () => {
  assert.equal(hubPath(nodes, 'v'), 'software/vision')
  assert.equal(resolvePath(nodes, ['software', 'vision']).id, 'v')
})

test('permissions mirror the SQL', () => {
  const lead = { role: 'lead', scopes: ['sw'] }
  assert.equal(canEditNode(lead, nodes[2]), true)
  assert.equal(canDeleteNode(lead, nodes[0]), false, 'home page needs root')
  assert.equal(canView({ role: 'member' }, 'members'), true)
  assert.equal(canView(null, 'members'), false)
})

test('visibility flows down the tree', () => {
  const changed = recomputeSubtree(nodes, { ...nodes[0], visibility: 'mentors' })
  assert.equal(changed.find((n) => n.id === 'l').effVis, 'mentors')
})
