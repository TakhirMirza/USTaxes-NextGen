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
import { AZ_OTHER_SUBTRACTION_LINES, computeArizona } from '../engine/az2025.ts'
import { buildAzPacket } from './az2025.ts'
import { computeCalifornia } from '../engine/ca2025.ts'
import { buildCaPacket } from './ca2025.ts'
import { computeKentucky } from '../engine/ky2025.ts'
import { buildKyPacket } from './ky2025.ts'
import { IL_SUBTRACTION_LINES_P2, IL_SUBTRACTION_LINES_P3, computeIllinois } from '../engine/il2025.ts'
import { IL_GIFT, buildIlPacket } from './il2025.ts'
import { buildPdf, fillForm } from './fill.ts'
import type { FillProblem } from './fill.ts'
import type { FormFill } from './irs2025.ts'

type St = 'al' | 'ga' | 'mn' | 'oh' | 'ms' | 'ut' | 'ct' | 'or' | 'co' | 'mo' | 'az' | 'ca' | 'ky' | 'il'

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

test('AZ: listed other subtractions go on their own page 6 lines', async () => {
  const base = many('az', 2)
  const ltc = AZ_OTHER_SUBTRACTION_LINES.find((l) => l.startsWith('Long-Term Care'))!
  const ret = { ...base, az: { ...base.az, otherSubtractions: 900 }, explain: { 'az.otherSubtractions': [{ line: ltc, description: 'LTC premiums', amount: 600 }, { line: '', description: 'Something else', amount: 200 }] } }
  const res = computeReturn(ret)
  const az = computeArizona(ret, res)
  const p = buildAzPacket(ret, res, az)
  const v = p.forms[0].values
  assert.equal(v[ltc], '600')
  assert.equal(v[AZ_OTHER_SUBTRACTION_LINES[AZ_OTHER_SUBTRACTION_LINES.length - 1]], '300')
  assert.ok(!p.notIncluded.some((x) => x.startsWith('Page 6')))
  await fillsClean(p.forms, 'AZX')
})

test('CA: other Schedule CA additions listed on a statement', async () => {
  const base = many('ca', 1)
  const ret = { ...base, ca: { ...base.ca, otherAdditions: 1500 }, explain: { 'ca.otherAdditions': [{ line: '', description: 'HSA contributions deducted federally', amount: 1500 }] } }
  const res = computeReturn(ret)
  const ca = computeCalifornia(ret, res)
  const p = buildCaPacket(ret, res, ca)
  const st = p.forms.find((f) => f.id.startsWith('st-ca-otherAdditions'))!
  assert.ok(st.draw!.some((d) => d.text === 'HSA contributions deducted federally'))
  assert.ok(!p.notIncluded.some((x) => x.includes('column C')))
  await fillsClean(p.forms, 'CAX')
})

test('KY: the other-additions text makes the statement when no items are listed', async () => {
  const base = many('ky', 1)
  const ret = { ...base, ky: { ...base.ky, otherAdditions: 700, otherAdditionsText: 'Nonqualified 529 withdrawal' } }
  const res = computeReturn(ret)
  const ky = computeKentucky(ret, res)
  const p = buildKyPacket(ret, res, ky)
  assert.ok(p.forms.some((f) => f.id.startsWith('st-ky-otherAdditions')))
  assert.ok(!p.notIncluded.some((x) => x.startsWith('A statement explaining the other additions')))
  await fillsClean(p.forms, 'KYX')
})

const wh = (kind: string, tax: number, i = 0) => ({ owner: 'taxpayer' as const, kind, payerId: `98765432${i}`, stateId: `77${i}`, fedIncome: 1000, income: 900, federal: 100, tax })

test('MN: listed 1099s fill Schedule M1W line 2, five per page', async () => {
  const base = many('mn', 1)
  const list = Array.from({ length: 6 }, (_, i) => wh('1099', 20, i))
  const ret = { ...base, mn: { ...base.mn, withholding1099: 120 }, withholdingLists: { 'mn.withholding1099': list } }
  const res = computeReturn(ret)
  const p = buildMnPacket(ret, res, computeMinnesota(ret, res))
  const first = p.forms.find((f) => f.id === 'mnm1w')!
  assert.equal(first.values['d5_2'], '20')
  assert.equal(first.values['b1_2'], '770')
  assert.equal(p.forms.find((f) => f.id === 'mnm1w-2')!.values['d1_2'], '20')
  assert.ok(!p.notIncluded.some((x) => x.includes('line 2')))
  await fillsClean(p.forms, 'MNL2')
})

test('GA: listed 1099s and G2 forms take the income statement lines after the W-2s', async () => {
  const base = many('ga', 1)
  const ret = { ...base, ga: { ...base.ga, withholding1099: 30, otherWithholding: 40 }, withholdingLists: { 'ga.withholding1099': [wh('1099', 30, 1)], 'ga.otherWithholding': [wh('G2-LP', 40, 2)] } }
  const res = computeReturn(ret)
  const p = buildGaPacket(ret, res, computeGeorgia(ret, res))
  const v = p.forms.find((f) => f.id === 'ga500')!.values
  assert.equal(v['CB_WH_TYPE_B.0.0'], '1099s')
  assert.equal(v['CB_WH_TYPE_C.0.0'], 'G2-LP')
  assert.ok(!p.notIncluded.some((x) => x.includes('G2 forms')))
  await fillsClean(p.forms, 'GAL')
})

test('OH: listed W-2G, 1099-NEC and 1099-G fill Parts D–F', async () => {
  const base = many('oh', 1)
  const list = [wh('W-2G', 10, 1), wh('W-2G', 11, 2), wh('W-2G', 12, 3), wh('1099-NEC', 13, 4), wh('1099-G', 14, 5)]
  const ret = { ...base, oh: { ...base.oh, otherWithholding: 60 }, withholdingLists: { 'oh.otherWithholding': list } }
  const res = computeReturn(ret)
  const p = buildOhPacket(ret, res, computeOhio(ret, res))
  const a = p.forms.find((f) => f.id === 'ohwh')!
  assert.deepEqual(a.pages, [10, 11])
  assert.equal(a.values['SchedW_D_L2_OHTW'], '11')
  assert.equal(a.values['SchedW_E_L1_OHTW'], '13')
  assert.equal(a.values['SchedW_F_L1_OHTW'], '14')
  assert.equal(p.forms.find((f) => f.id === 'ohwh-2')!.values['SchedW_D_L1_OHTW'], '12')
  assert.ok(!p.notIncluded.some((x) => x.includes('Parts D–F')))
  await fillsClean(p.forms, 'OHL')
})

test('IL: college savings accounts on line 13a and other subtractions on their lines', async () => {
  const base = many('il', 1)
  const rr = IL_SUBTRACTION_LINES_P3.find((l) => l.startsWith('Railroad'))!
  const mil = IL_SUBTRACTION_LINES_P2.find((l) => l.startsWith('Military'))!
  const ret = {
    ...base, il: { ...base.il, collegeSavings: 3000, otherSubtractions: 700 },
    explain: {
      'il.collegeSavings': [{ line: '', description: 'BS-12345', amount: 2000 }, { line: IL_GIFT, description: 'BD-999', amount: 1000 }],
      'il.otherSubtractions': [{ line: rr, description: 'RRB', amount: 300 }, { line: mil, description: 'Guard pay', amount: 400 }]
    }
  }
  const res = computeReturn(ret)
  const il = computeIllinois(ret, res)
  const p = buildIlPacket(ret, res, il)
  const v = p.forms.find((f) => f.id === 'ilschm')!.values
  assert.equal(v['Column A  Account Number'], 'BS-12345')
  assert.equal(v['gift_2'], true)
  assert.equal(v['Total - Add Column B, Lines 1-10 and enter here'], '3000')
  assert.equal(v[rr], '300')
  assert.equal(v[mil], '400')
  assert.ok(!p.notIncluded.some((x) => x.includes('line 13a') || x.includes('not on a line')))
  await fillsClean(p.forms, 'ILM')
})
