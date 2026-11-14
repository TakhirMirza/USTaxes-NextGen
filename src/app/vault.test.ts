import { test } from 'node:test'
import assert from 'node:assert/strict'
import { KEYS, createReturn, loadIndex, loadReturn, memoryKV, touchReturn } from './store.ts'
import { VAULT_KEY, createVault, eraseEverything, hasVault, storedBytes, unlockVault } from './vault.ts'
import { emptyReturn } from '../engine/model.ts'

const FAST = 1000 // iterations for tests; the app uses 600,000

test('password protection encrypts every stored return and unlocks with the right password', async () => {
  const raw = memoryKV()
  const created = createReturn(raw, loadIndex(raw), { ...emptyReturn(), taxpayer: { ...emptyReturn().taxpayer, firstName: 'Alex', ssn: '123456789' } })
  raw.setItem(KEYS.privacy, '1')
  const vault = await createVault(raw, 'correct horse', FAST)
  assert.ok(hasVault(raw))
  for (let i = 0; i < raw.length; i++) {
    const k = raw.key(i)!
    assert.ok(!raw.getItem(k)!.includes('"ssn":"123456789"'), `${k} still holds the SSN in plain text`)
  }
  assert.equal(raw.getItem(KEYS.privacy), '1', 'the privacy notice flag stays readable')
  // The app keeps working through the vault.
  const data = loadReturn(vault, created.id)
  assert.equal(data.taxpayer.ssn, '123456789')
  touchReturn(vault, loadIndex(vault), created.id, { ...data, taxpayer: { ...data.taxpayer, lastName: 'Rivera' } })
  await vault.flushed()
  assert.equal(vault.pending, 0)
  assert.ok(![...Array(raw.length).keys()].some((i) => raw.getItem(raw.key(i)!)!.includes('"lastName":"Rivera"')))
  await assert.rejects(unlockVault(raw, 'wrong password'), /Wrong password/)
  const again = await unlockVault(raw, 'correct horse')
  assert.equal(loadReturn(again, created.id).taxpayer.lastName, 'Rivera')
  assert.equal(loadIndex(again).returns.length, 1)
})

test('changing the password and turning protection off', async () => {
  const raw = memoryKV()
  const created = createReturn(raw, loadIndex(raw))
  const vault = await createVault(raw, 'first password', FAST)
  await vault.changePassword('second password', FAST)
  await assert.rejects(unlockVault(raw, 'first password'), /Wrong password/)
  const v2 = await unlockVault(raw, 'second password')
  assert.equal(loadIndex(v2).returns[0].id, created.id)
  await v2.disable()
  assert.equal(hasVault(raw), false)
  assert.equal(loadIndex(raw).returns[0].id, created.id)
  await assert.rejects(createVault(raw, 'short', FAST), /at least 8/)
})

test('erase everything removes only this app’s keys', async () => {
  const raw = memoryKV()
  createReturn(raw, loadIndex(raw))
  raw.setItem(VAULT_KEY, '{}')
  raw.setItem('other-site', 'keep')
  assert.ok(storedBytes(raw) > 0)
  assert.ok((await eraseEverything(raw)) >= 3)
  assert.equal(raw.length, 1)
  assert.equal(raw.getItem('other-site'), 'keep')
})
