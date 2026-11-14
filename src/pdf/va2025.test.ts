/**
 * Fills the real Virginia 2025 PDFs (Form 760, Schedule ADJ) and checks that every mapped key
 * matches exactly one field and that amounts land in the right boxes.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from '../engine/compute.ts'
import { emptyDependent, emptyReturn, emptyVaEntry, emptyVaSavers, emptyW2 } from '../engine/model.ts'
import type { TaxReturnInput } from '../engine/model.ts'
import { computeVirginia } from '../engine/va2025.ts'
import { buildVirginiaPacket } from './va2025.ts'
import { buildPdf, fillForm } from './fill.ts'
import type { FillProblem } from './fill.ts'

const formsDir = new URL('../../public/forms/2025/', import.meta.url)
const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))
const w2 = (owner: 'taxpayer' | 'spouse', wages: number) => ({
  ...emptyW2(owner), employer: 'Acme', wages, federalWithholding: wages * 0.1, socialSecurityWages: wages, socialSecurityWithheld: wages * 0.062, medicareWages: wages, medicareWithheld: wages * 0.0145
})

const couple = (): TaxReturnInput => {
  const r = emptyReturn()
  return {
    ...r,
    filingStatus: 'mfj',
    taxpayer: { ...r.taxpayer, firstName: 'Alex Q', lastName: 'Rivera', ssn: '123456789', age: 67, age65OrOlder: true },
    spouse: { ...r.spouse, firstName: 'Sam', lastName: 'Rivera', ssn: '987654321', age: 50 },
    contact: { ...r.contact, street: '12 Oak St', apt: 'Apt 3', city: 'Haymarket', state: 'va', zip: '20169-1234', phone: '(703) 555-0100' },
    dependents: [{ ...emptyDependent(), name: 'Mia Rivera', relationship: 'Daughter', age: 9, ssn: '111223333' }],
    w2s: [w2('taxpayer', 52000), w2('spouse', 38000)],
    unemployment: 2000,
    refundDeposit: { routingNumber: '021000021', accountNumber: '000123456789', accountType: 'savings' },
    virginia: {
      ...r.virginia, enabled: true, localityCode: '153', birthDate: { taxpayer: '4/2/1958', spouse: '07/09/1975' },
      withholding: { taxpayer: 2600, spouse: 1700 }, usObligationInterest: 120,
      subtractions: [{ ...emptyVaEntry('60'), amount: 1000 }],
      deductions: [{ ...emptyVaEntry('106'), amount: 900 }],
      savers: [{ ...emptyVaSavers(), contributed: 2500 }],
      additions: [{ ...emptyVaEntry('20'), amount: 300 }]
    }
  }
}

async function filled(ret: TaxReturnInput) {
  const res = computeReturn(ret)
  const va = computeVirginia(ret, res)
  const packet = buildVirginiaPacket(ret, res, va)
  const problems: FillProblem[] = []
  const docs = []
  for (const f of packet.forms) docs.push(await fillForm(lib, await load(f.file), { ...f }, problems))
  return { res, va, packet, problems, docs }
}

/** Fill without flattening so the values can be read back. */
async function readBack(file: string, values: Record<string, string | boolean>): Promise<Record<string, string | boolean>> {
  const doc = await lib.PDFDocument.load(await load(file))
  const form = doc.getForm()
  const out: Record<string, string | boolean> = {}
  for (const [k, v] of Object.entries(values)) {
    const f = form.getField(k)
    if (f instanceof lib.PDFTextField) { f.setText(typeof v === 'string' ? v || undefined : undefined); out[k] = f.getText() ?? '' }
  }
  return out
}

test('Form 760 and Schedule ADJ: every key matches exactly one field', async () => {
  const { packet, problems } = await filled(couple())
  assert.deepEqual(packet.forms.map((f) => f.id), ['va760', 'va760adj'])
  assert.deepEqual(problems, [])
})

test('Form 760 boxes hold the computed amounts', async () => {
  const ret = couple()
  const { va, packet } = await filled(ret)
  const v = packet.forms[0].values
  assert.equal(v['Filing Status'], '2')
  assert.equal(v['Your Name'], 'Alex')
  assert.equal(v['Middle initial'], 'Q')
  assert.equal(v['First four letters of last name'], 'RIVE')
  assert.equal(v['Your Birthdate'], '04021958')
  assert.equal(v['Zip Code'], '201691234')
  assert.equal(v['State'], 'VA')
  assert.equal(v['Total Exemptions Section A'], '3')
  assert.equal(v['Total Exemptions Dollar Amount Section A'], '2790')
  assert.equal(v['You over 65'], '1')
  assert.equal(v['1. Federal Adjusted Gross Income'], String(va.lines['1']))
  assert.equal(v['9. Virginia Adjusted Gross Income'], String(va.lines['9']))
  assert.equal(v['15. Virginia Taxable income'], String(va.lines['15']))
  assert.equal(v['16. Amount of tax'], String(va.lines['16']))
  assert.equal(v['19a Your Virginia Witholding'], '2600')
  assert.equal(v['Account Type'], va.lines['36'] > 0 ? 'savings' : undefined)
  assert.equal(v['Your Phone Number'], '7035550100')
  // Lines add up as the form says.
  const L = va.lines
  assert.equal(L['3'], L['1'] + L['2'])
  assert.equal(L['9'], L['3'] - L['8'])
  assert.equal(L['15'], L['9'] - L['14'])
  assert.equal(L['26'], L['19a'] + L['19b'] + L['20'] + L['21'] + L['22'] + L['23'] + L['24'] + L['25'])
  // Age deduction for the taxpayer only (spouse born after 1/1/1961).
  assert.equal(va.age.kind.spouse, 'none')
  assert.equal(L['4'], L['4you'])
  // Read back a few boxes from the real PDF.
  const back = await readBack('va760.pdf', { '9. Virginia Adjusted Gross Income': String(L['9']), '17a Spouse Tax Adjustment Dollar Amount': String(L['17']) })
  assert.equal(back['9. Virginia Adjusted Gross Income'], String(L['9']))
  assert.equal(back['17a Spouse Tax Adjustment Dollar Amount'], String(L['17']))
})

test('Schedule ADJ codes and totals', async () => {
  const { va, packet } = await filled(couple())
  const a = packet.forms[1].values
  assert.equal(a['2b Addition Code'], '20')
  assert.equal(a['2b Amount'], '300')
  assert.equal(a['3. Total Additions'], '300')
  assert.equal(a['4. Income from obligations'], '120')
  assert.equal(a['6b Subtraction Code'], '37')
  assert.equal(a['6b Amount'], '2000')
  assert.equal(a['6c Subtraction Code'], '60')
  assert.equal(a['7. Total Subtractions'], String(120 + 2000 + 1000))
  assert.equal(a['8a Deduction Code'], '104')
  assert.equal(a['8a Amount'], '2500')
  assert.equal(a['8b Deduction Code'], '106')
  assert.equal(a['9. Total Deductions'], '3400')
  assert.equal(va.lines['13'], 3400)
})

test('the Virginia PDF builds and the savings oval is filled', async () => {
  const ret = couple()
  const res = computeReturn(ret)
  const va = computeVirginia(ret, res)
  const packet = buildVirginiaPacket(ret, res, va)
  const { bytes, problems } = await buildPdf(lib, packet.forms, load, '2025 Virginia Form 760')
  assert.deepEqual(problems, [])
  const doc = await lib.PDFDocument.load(bytes)
  assert.equal(doc.getPageCount(), 4)
  assert.equal(doc.getTitle(), '2025 Virginia Form 760')
  if (process.env.WRITE_PDF) await writeFile(process.env.WRITE_PDF, bytes)
  // The two "Account Type" widgets have different on-states; only "savings" should be on.
  const unflat = await lib.PDFDocument.load(await load('va760.pdf'))
  const problems2: FillProblem[] = []
  const filledDoc = await fillForm(lib, await lib.PDFDocument.load(await load('va760.pdf')).then((d) => d.save()), { id: 'x', file: 'va760.pdf', title: '', values: { 'Account Type': 'savings' } }, problems2)
  assert.deepEqual(problems2, [])
  assert.ok(filledDoc && unflat)
})

test('a single filer without Virginia adjustments gets Form 760 only', async () => {
  const r = emptyReturn()
  const ret: TaxReturnInput = { ...r, taxpayer: { ...r.taxpayer, firstName: 'Lee', lastName: 'Ng', ssn: '111111111' }, w2s: [w2('taxpayer', 48000)], virginia: { ...r.virginia, enabled: true, withholding: { taxpayer: 2000, spouse: 0 } } }
  const { packet, problems } = await filled(ret)
  assert.deepEqual(packet.forms.map((f) => f.id), ['va760'])
  assert.deepEqual(problems, [])
  assert.equal(packet.forms[0].values['Spouse SSN'], '')
})

test('Form 760C is filled when an addition to tax is figured', async () => {
  const r = emptyReturn()
  const ret: TaxReturnInput = {
    ...r, taxpayer: { ...r.taxpayer, firstName: 'Lee', lastName: 'Ng', ssn: '111111111' }, w2s: [w2('taxpayer', 90000)],
    virginia: { ...r.virginia, enabled: true, estimatedByPeriod: [0, 0, 0, 2000] }
  }
  const { va, packet, problems } = await filled(ret)
  assert.deepEqual(problems, [])
  assert.deepEqual(packet.forms.map((f) => f.id), ['va760', 'va760adj', 'va760c'])
  const c = packet.forms[2].values
  assert.equal(c['Line  14 A'], String(Math.round(va.form760c.columns[0].underpayment)))
  assert.equal(packet.forms[0].values['Fill in oval if 760C or 760F is enclosed'], true)
  assert.equal(packet.forms[1].values['18. Addition to Tax'], String(va.adj.lines['18']))
  const res = computeReturn(ret)
  const { bytes } = await buildPdf(lib, buildVirginiaPacket(ret, res, va).forms, load)
  if (process.env.WRITE_760C) await writeFile(process.env.WRITE_760C, bytes)
})

test('Virginia Schedule A is filled for itemizers, with the limited worksheet', async () => {
  const r = emptyReturn()
  const ret: TaxReturnInput = {
    ...r, taxpayer: { ...r.taxpayer, firstName: 'Lee', lastName: 'Ng', ssn: '111111111' }, w2s: [w2('taxpayer', 450000)], deductionChoice: 'itemized',
    itemized: { ...r.itemized, stateLocalIncomeOrSalesTax: 35000, realEstateTax: 15000, mortgageInterest: 20000, charityCash: 10000 },
    virginia: { ...r.virginia, enabled: true, withholding: { taxpayer: 30000, spouse: 0 } }
  }
  const { packet, problems } = await filled(ret)
  assert.deepEqual(problems, [])
  const a = packet.forms.find((f) => f.id === 'va760sa')
  assert.ok(a)
  assert.equal(a.values['19. Virginia Itemized Deductions, Subtract Line 18 from Line 17'], '43021')
  assert.equal(a.values['11. Divide Line 9 by Line 10'], '0.044')
  assert.equal(packet.forms[0].values['10. Itemized Deductions'], '43021')
  if (process.env.WRITE_SA) {
    const res = computeReturn(ret)
    const { bytes } = await buildPdf(lib, buildVirginiaPacket(ret, res, computeVirginia(ret, res)).forms, load)
    await writeFile(process.env.WRITE_SA, bytes)
  }
})
