'use strict'
/** Tax-return lifecycle domain model. No PII storage or filing transport. */
const crypto = require('node:crypto')
const STATES = Object.freeze(['draft', 'in_review', 'needs_correction', 'approved', 'filed', 'accepted', 'rejected', 'amended'])
const TRANSITIONS = Object.freeze({
  draft: ['in_review'],
  in_review: ['draft', 'needs_correction', 'approved'],
  needs_correction: ['draft', 'in_review'],
  approved: ['in_review', 'filed'],
  filed: ['accepted', 'rejected'],
  accepted: ['amended'],
  rejected: ['needs_correction'],
  amended: ['in_review']
})
const YEAR_MIN = 2025
const isYear = y => Number.isInteger(y) && y >= YEAR_MIN && y <= 2100
function createReturn({ year, ownerId, now = new Date().toISOString(), id = crypto.randomUUID() }) {
  if (!isYear(year)) throw new Error('Unsupported tax year')
  if (typeof ownerId !== 'string' || !/^[a-zA-Z0-9_-]{3,128}$/.test(ownerId)) throw new Error('Invalid owner reference')
  return Object.freeze({ id, ownerId, year, revision: 1, state: 'draft', createdAt: now, updatedAt: now, history: Object.freeze([{ from: null, to: 'draft', at: now, actorId: ownerId }]) })
}
function transitionReturn(record, { to, actorId, expectedRevision, now = new Date().toISOString(), evidence }) {
  if (!record || !STATES.includes(record.state)) throw new Error('Invalid return')
  if (record.revision !== expectedRevision) throw new Error('Revision conflict')
  if (actorId !== record.ownerId) throw new Error('Access denied')
  if (!(TRANSITIONS[record.state] || []).includes(to)) throw new Error(`Transition ${record.state} -> ${to} is not allowed`)
  if (['approved', 'filed', 'accepted', 'rejected'].includes(to) && (!evidence || typeof evidence !== 'object' || !evidence.reference)) {
    throw new Error('Verified evidence reference required')
  }
  if (to === 'filed' && evidence.channel !== 'authorized_efile_provider') throw new Error('Authorized e-file provider evidence required')
  return Object.freeze({ ...record, revision: record.revision + 1, state: to, updatedAt: now,
    history: Object.freeze([...record.history, { from: record.state, to, at: now, actorId, ...(evidence ? { evidenceReference: String(evidence.reference).slice(0, 128) } : {}) }]) })
}
function filingPermitted(record, gates) {
  const required = ['identityVerified', 'taxRulesValidated', 'allFormsReconciled', 'taxpayerConsent', 'providerConfigured']
  return !!record && record.state === 'approved' && required.every(key => gates && gates[key] === true)
}
module.exports = { STATES, TRANSITIONS, createReturn, transitionReturn, filingPermitted }
