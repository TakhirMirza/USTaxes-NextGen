/**
 * Form 760C tests, worked by hand: 9% a year is 0.00025 a day; unpaid installments run to May 1, 2026
 * (365, 320, 228 and 106 days from the four due dates).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compute760c } from './va760c.ts'

const none = [0, 0, 0, 0] as [number, number, number, number]

test('nothing paid: each $900 installment runs to May 1, 2026', () => {
  const c = compute760c({ tax: 4000, priorYearTax: null, withholding: 0, priorOverpayment: 0, estimated: none })
  assert.equal(c.line2, 3600)
  assert.equal(c.line4, 3600)
  assert.deepEqual(c.columns.map((x) => x.pieces[0].days), [365, 320, 228, 106])
  assert.equal(c.addition, 229.28) // 900 × 0.00025 × 1,019
})

test('withholding counts in four equal parts', () => {
  const c = compute760c({ tax: 4000, priorYearTax: null, withholding: 2000, priorOverpayment: 0, estimated: none })
  assert.deepEqual(c.columns.map((x) => x.underpayment), [400, 400, 400, 400])
  assert.equal(c.addition, 101.9) // 400 × 0.00025 × 1,019
})

test('one late payment in January pays the earlier installments first', () => {
  const c = compute760c({ tax: 4000, priorYearTax: null, withholding: 0, priorOverpayment: 0, estimated: [0, 0, 0, 3600] })
  assert.deepEqual(c.columns.map((x) => x.pieces.map((p) => p.days)), [[259], [214], [122], []])
  assert.equal(c.columns[3].underpayment, 0)
  assert.equal(c.addition, 133.88) // 900 × 0.00025 × (259 + 214 + 122)
})

test('Exception 1: payments kept pace with the 2024 tax', () => {
  const c = compute760c({ tax: 4000, priorYearTax: 2000, withholding: 2000, priorOverpayment: 0, estimated: none })
  assert.equal(c.line4, 2000)
  assert.ok(c.columns.every((x) => x.exceptionMet))
  assert.equal(c.notRequired, true)
  assert.equal(c.addition, 0)
})

test('tax of $150 or less: no Form 760C', () => {
  const c = compute760c({ tax: 150, priorYearTax: null, withholding: 0, priorOverpayment: 0, estimated: none })
  assert.equal(c.notRequired, true)
  assert.equal(c.addition, 0)
})

test('2024 overpayment counts on May 1', () => {
  const c = compute760c({ tax: 4000, priorYearTax: null, withholding: 0, priorOverpayment: 3600, estimated: none })
  assert.equal(c.addition, 0)
  assert.equal(c.columns[0].line13, 900)
})
