/**
 * Rows that do not fit on a state form go on repeat copies of the official page or on a supporting statement,
 * and every packet still fills without problems.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from '../engine/compute.ts'
import { emptyDependent, emptyReturn, emptyW2 } from '../engine/model.ts'
import type { TaxReturnInput } from '../engine/model.ts'
import { computeAlabama } from '../engine/al2025.ts'
import { computeGeorgia } from '../engine/ga2025.ts'
import { computeMinnesota } from '../engine/mn2025.ts'
import { computeOhio } from '../engine/oh2025.ts'
import { computeMississippi } from '../engine/ms2025.ts'
import { computeUtah } from '../engine/ut2025.ts'
import { computeConnecticut } from '../engine/ct2025.ts'
import { computeOregon } from '../engine/or2025.ts'
import { computeColorado } from '../engine/co2025.ts'
import { buildAlPacket } from './al2025.ts'
import { buildGaPacket } from './ga2025.ts'
import { buildMnPacket } from './mn2025.ts'
import { buildOhPacket } from './oh2025.ts'
import { buildMsPacket } from './ms2025.ts'
import { buildUtPacket } from './ut2025.ts'
import { buildCtPacket } from './ct2025.ts'
import { buildOrPacket } from './or2025.ts'
import { buildCoPacket } from './co2025.ts'
import { computeMissouri } from '../engine/mo2025.ts'
import { buildMoPacket } from './mo2025.ts'
import { buildPdf, fillForm } from './fill.ts'
import type { FillProblem } from './fill.ts'
import type { FormFill } from './irs2025.ts'

type St = 'al' | 'ga' | 'mn' | 'oh' | 'ms' | 'ut' | 'ct' | 'or' | 'co' | 'mo'

/** A single filer with `n` W-2s, each with state withholding. */
const many = (st: St, n: number, patch: Partial<TaxReturnInput> = {}): TaxReturnInput => {
  const r = emptyReturn()
  const w2s = Array.from({ length: n }, (_, i) => ({ ...emptyW2('taxpayer'), employer: `Employer ${i + 1}`, wages: 5000, socialSecurityWages: 5000, medicareWages: 5000, federalWithholding: 300 }))
  const ret: TaxReturnInput = {
    ...r, filingStatus: 'single', residentState: st.toUpperCase() as TaxReturnInput['residentState'],
    taxpayer: { ...r.taxpayer, firstName: 'Pat', lastName: 'Doe', ssn: '123456789', age: 40 },
    contact: { ...r.contact, street: '1 Main St', city: 'Town', state: st.toUpperCase(), zip: '00000', phone: '555-555-0100' },
    w2s, ...patch
  }
  const wh = Object.fromEntries(w2s.map((w, i) => [w.id, { ein: `99-12345${String(i).padStart(2, '0')}`, stateId: `1234${String(i).padStart(4, '0')}`, stateIncome: null, stateTax: 150 }]))
  const block = (ret as unknown as Record<string, { w2: unknown }>)[st]
  return { ...ret, [st]: { ...block, w2: wh } } as TaxReturnInput
}

const formsDir = new URL('../../public/forms/2025/', import.meta.url)
const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
const fillsClean = async (forms: FormFill[], name: string): Promise<void> => {
  const problems: FillProblem[] = []
  for (const f of forms) await fillForm(lib, await load(f.file), { ...f }, problems)
  assert.deepEqual(problems, [])
  const { bytes } = await buildPdf(lib, forms, load, `2025 ${name}`)
  if (process.env.WRITE_PDF) await (await import('node:fs/promises')).writeFile(`${process.env.WRITE_PDF}-OV-${name}.pdf`, bytes)
}
const ids = (forms: FormFill[]): string[] => forms.map((f) => f.id)

test('AL: W-2s after the fifteenth on a statement', async () => {
  const ret = many('al', 17)
  const res = computeReturn(ret)
  const al = computeAlabama(ret, res)
  const p = buildAlPacket(ret, res, al)
  const st = p.forms.find((f) => f.id.startsWith('st-al-w2'))!
  assert.ok(st)
  assert.ok(st.draw!.some((d) => d.text === 'Employer 16'))
  assert.ok(!p.notIncluded.some((x) => x.includes('fifteenth')))
  await fillsClean(p.forms, 'AL')
})

test('GA: income statements after F on a statement', async () => {
  const ret = many('ga', 8)
  const res = computeReturn(ret)
  const p = buildGaPacket(ret, res, computeGeorgia(ret, res))
  assert.ok(ids(p.forms).some((x) => x.startsWith('st-ga-wh')))
  assert.ok(!p.notIncluded.some((x) => x.includes('six income statements')))
  await fillsClean(p.forms, 'GA')
})

test('MN: a second Schedule M1W for W-2s six to ten', async () => {
  const ret = many('mn', 7)
  const res = computeReturn(ret)
  const mn = computeMinnesota(ret, res)
  const p = buildMnPacket(ret, res, mn)
  const second = p.forms.find((f) => f.id === 'mnm1w-2')!
  assert.equal(second.values['d2'], '150')
  assert.equal(second.values['1'], undefined)
  assert.equal(p.forms.find((f) => f.id === 'mnm1w')!.values['1'], '1050')
  assert.ok(!p.notIncluded.some((x) => x.includes('beyond the fifth')))
  await fillsClean(p.forms, 'MN')
})

test('OH: an additional Schedule of Ohio Withholding page after seven W-2s', async () => {
  const ret = many('oh', 9)
  const res = computeReturn(ret)
  const p = buildOhPacket(ret, res, computeOhio(ret, res))
  const extra = p.forms.find((f) => f.id === 'ohwh-2')!
  assert.ok(extra.values['SchedW_B_L2_OHIT'])
  assert.equal(extra.values['SchedW_A'], undefined)
  await fillsClean(p.forms, 'OH')
})

test('MS: another Form 80-107 for statements after the fourth', async () => {
  const ret = many('ms', 6)
  const res = computeReturn(ret)
  const ms = computeMississippi(ret, res)
  const p = buildMsPacket(ret, res, ms)
  assert.ok(ids(p.forms).includes('ms80107-2'))
  assert.ok(!ms.issues.some((x) => x.includes('another 80-107')))
  await fillsClean(p.forms, 'MS')
})

test('UT: another TC-40W page after four W-2s', async () => {
  const ret = many('ut', 5)
  const res = computeReturn(ret)
  const ut = computeUtah(ret, res)
  const p = buildUtPacket(ret, res, ut)
  const extra = p.forms.find((f) => f.id === 'uttc40w-2')!
  assert.deepEqual(extra.pages, [7])
  assert.equal(extra.values['40W First line 7'] ?? Object.entries(extra.values).find(([k]) => k.endsWith('line 7'))?.[1], '150')
  await fillsClean(p.forms, 'UT')
})

test('CT: withholding statements after the fifth on a statement', async () => {
  const ret = many('ct', 6, { spouse: { ...emptyReturn().spouse, firstName: 'Sam J', lastName: 'Doe', ssn: '987654321', age: 40 }, filingStatus: 'mfj' })
  const res = computeReturn(ret)
  const ct = computeConnecticut(ret, res)
  const p = buildCtPacket(ret, res, ct)
  const wh = p.forms.find((f) => f.id === 'ct1040wh')!
  assert.ok(wh.draw!.some((d) => d.text === '150'))
  assert.equal(ct.lines['18f'], 150)
  assert.equal(ct.lines['18'], 900)
  assert.ok(!ct.attach.some((x) => x.includes('CT-1040WH')))
  await fillsClean(p.forms, 'CT')
})

test('OR: dependents after the third on Schedule OR-ADD-DEP', async () => {
  const kids = Array.from({ length: 5 }, (_, i) => ({ ...emptyDependent(), name: `Kid${i + 1} Doe`, relationship: 'Son', age: 3 + i, ssn: `11122333${i}`, hasSsn: true, monthsLivedWithYou: 12, childRelationship: true }))
  const base = many('or', 1, { dependents: kids })
  const ret = { ...base, or: { ...base.or, dependentBirthDates: Object.fromEntries(kids.map((k, i) => [k.id, `01/0${i + 1}/${2020 - i}`])) } }
  const res = computeReturn(ret)
  const p = buildOrPacket(ret, res, computeOregon(ret, res))
  const add = p.forms.find((f) => f.id.startsWith('or-add-dep'))!
  assert.ok(add)
  assert.ok(Object.values(add.values).some((v) => typeof v === 'string' && v.toUpperCase().includes('KID')))
  assert.ok(Object.values(add.values).includes("01/05/2016"))
  assert.ok(!p.notIncluded.some((x) => x.includes('OR-ADD-DEP')))
  await fillsClean(p.forms, 'OR')
})

test('CO: DR 0347 care providers after the second on a statement', async () => {
  const kid = { ...emptyDependent(), name: 'Kai Doe', relationship: 'Son', age: 4, ssn: '111223333', hasSsn: true, monthsLivedWithYou: 12, childRelationship: true }
  const providers = [1, 2, 3].map((i) => ({ id: `p${i}`, name: `Daycare ${i}`, address: `${i} Elm St, Denver CO 80202`, tin: `12345678${i}`, amountPaid: 1000 }))
  const ret = { ...many('co', 2), filingStatus: 'hoh' as const, dependents: [kid], dependentCare: { expenses: 3000, employerBenefits: 0, providers } }
  const res = computeReturn(ret)
  const co = computeColorado(ret, res)
  assert.ok(co.cr['2'] > 0)
  const p = buildCoPacket(ret, res, co)
  const st = p.forms.find((f) => f.id.startsWith('st-co-0347'))!
  assert.ok(st.draw!.some((d) => d.text === 'Daycare 3'))
  assert.ok(!p.notIncluded.some((x) => x.includes('more than two care providers')))
  await fillsClean(p.forms, 'CO')
})

test('UT: another TC-40S for states after the third', async () => {
  const base = many('ut', 1, { w2s: [{ ...emptyW2('taxpayer'), employer: 'Big Co', wages: 120000, socialSecurityWages: 120000, medicareWages: 120000 }] })
  const ret = { ...base, ut: { ...base.ut, otherStates: ['ID', 'CO', 'AZ', 'OR'].map((st) => ({ state: st, income: 5000, tax: 200 })) } }
  const res = computeReturn(ret)
  const ut = computeUtah(ret, res)
  assert.equal(ut.tc40s.length, 4)
  const p = buildUtPacket(ret, res, ut)
  assert.equal(p.forms.find((f) => f.id === 'uttc40s-2')!.values['40S One State'], 'OR')
  assert.ok(!ut.issues.some((x) => x.includes('three states')))
  await fillsClean(p.forms, 'UT40S')
})

test('MO: another MO-TC for credits after the tenth', async () => {
  const base = many('mo', 1)
  const moTc = Array.from({ length: 11 }, (_, i) => ({ owner: 'taxpayer' as const, benefit: `10000${i}`, code: 'ABC', name: `Credit ${i + 1}`, amount: 10, refundable: false }))
  const ret = { ...base, mo: { ...base.mo, moTc } }
  const res = computeReturn(ret)
  const mo = computeMissouri(ret, res)
  assert.equal(mo.moTc.rows.length, 11)
  const p = buildMoPacket(ret, res, mo)
  const second = p.forms.find((f) => f.id === 'motc-2')!
  assert.equal(second.values['Credit Name Each credit will apply in the order they appear below1'], 'Credit 11')
  assert.equal(second.values['13'], undefined)
  await fillsClean(p.forms, 'MO')
})

test('MS: another Form 80-401 for credits after the fourth', async () => {
  const base = many('ms', 1)
  const credits401 = ['01', '02', '03', '04', '05'].map((code) => ({ code, earned: 10, passThrough: 0, carryover: 0, expired: 0 }))
  const ret = { ...base, ms: { ...base.ms, credits401 } }
  const res = computeReturn(ret)
  const ms = computeMississippi(ret, res)
  const p = buildMsPacket(ret, res, ms)
  assert.equal(p.forms.find((f) => f.id === 'ms80401-2')!.values['Code1'], '05')
  await fillsClean(p.forms, 'MS401')
})
