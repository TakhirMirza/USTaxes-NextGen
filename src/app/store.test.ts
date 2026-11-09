import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyReturn } from '../engine/model.ts'
import { KEYS, createReturn, duplicateReturn, loadIndex, loadReturn, memoryKV, removeReturn, returnName, touchReturn, updateMeta, loadPreparer, savePreparer, preparerReady } from './store.ts'
import { decryptBackup, encryptBackup, makeBackup, parseBackupText, restoreBackup } from './backup.ts'

const named = (first: string, last: string) => ({ ...emptyReturn(), taxpayer: { ...emptyReturn().taxpayer, firstName: first, lastName: last } })

test('a return saved by an older version moves into the list', () => {
  const kv = memoryKV()
  kv.setItem(KEYS.legacy, JSON.stringify({ filingStatus: 'hoh', taxpayer: { firstName: 'Old', lastName: 'Saved' } }))
  const index = loadIndex(kv)
  assert.equal(index.returns.length, 1)
  assert.equal(index.activeId, index.returns[0].id)
  assert.equal(loadReturn(kv, index.returns[0].id).filingStatus, 'hoh')
  assert.equal(kv.getItem(KEYS.legacy), null)
  assert.equal(loadIndex(kv).returns.length, 1)
})

test('create, duplicate, update status and remove returns', () => {
  const kv = memoryKV()
  let index = loadIndex(kv)
  const a = createReturn(kv, index, named('Ann', 'Lee')); index = a.index
  const b = duplicateReturn(kv, index, a.id); index = b.index
  assert.equal(index.returns.length, 2)
  assert.equal(index.activeId, b.id)
  assert.match(index.returns[0].label, /Lee, Ann \(copy\)/)
  index = updateMeta(kv, index, a.id, { status: 'filed', notes: 'Mailed 3/1' })
  assert.equal(loadIndex(kv).returns.find((m) => m.id === a.id)?.status, 'filed')
  index = touchReturn(kv, index, a.id, named('Ann', 'Lee-Park')).index
  assert.equal(loadReturn(kv, a.id).taxpayer.lastName, 'Lee-Park')
  index = removeReturn(kv, index, b.id)
  assert.equal(index.returns.length, 1)
  assert.equal(index.activeId, a.id)
  assert.equal(kv.getItem(KEYS.returnPrefix + b.id), null)
})

test('return names for single and joint returns', () => {
  assert.equal(returnName(named('Ann', 'Lee')), 'Lee, Ann')
  assert.equal(returnName({ ...named('Ann', 'Lee'), filingStatus: 'mfj', spouse: { ...emptyReturn().spouse, firstName: 'Bo', lastName: 'Lee' } }), 'Lee, Ann & Bo')
  assert.equal(returnName(emptyReturn()), 'Untitled return')
})

test('preparer profile round trip and PTIN check', () => {
  const kv = memoryKV()
  savePreparer(kv, { ...loadPreparer(kv), name: 'Pat Preparer', ptin: 'P01234567' })
  const p = loadPreparer(kv)
  assert.equal(p.name, 'Pat Preparer')
  assert.equal(preparerReady(p), true)
  assert.equal(preparerReady({ ...p, ptin: '1234' }), false)
})

test('encrypted backup round trip; wrong password is rejected', async () => {
  const kv = memoryKV()
  let index = loadIndex(kv)
  index = createReturn(kv, index, named('Ann', 'Lee')).index
  index = createReturn(kv, index, named('Bo', 'Park')).index
  const backup = makeBackup(kv, index, { ...loadPreparer(kv), name: 'Pat' })
  const enc = await encryptBackup(backup, 'correct horse battery', 1000)
  const text = JSON.stringify(enc)
  assert.ok(!text.includes('Ann'))
  const parsed = parseBackupText(text)
  assert.equal(parsed.kind, 'encrypted')
  if (parsed.kind !== 'encrypted') return
  await assert.rejects(decryptBackup(parsed.file, 'wrong password'), /Wrong password/)
  const restored = await decryptBackup(parsed.file, 'correct horse battery')
  assert.equal(restored.returns.length, 2)
  assert.equal(restored.preparer?.name, 'Pat')
  const kv2 = memoryKV()
  const result = restoreBackup(kv2, loadIndex(kv2), restored)
  assert.equal(result.added, 2)
  assert.deepEqual(result.index.returns.map((m) => loadReturn(kv2, m.id).taxpayer.lastName).sort(), ['Lee', 'Park'])
  assert.equal(loadIndex(kv2).returns.length, 2)
})

test('single-return files from the Review step are recognized', async () => {
  const parsed = parseBackupText(JSON.stringify(named('Ann', 'Lee')))
  assert.equal(parsed.kind, 'single')
  assert.throws(() => parseBackupText('not json'), /not a USTaxes file/)
  await assert.rejects(encryptBackup({ format: 'ustaxes-nextgen-backup', version: 1, createdAt: '', preparer: null, returns: [] }, 'short'), /at least 8/)
})
