/**
 * Fills the real IRS 2025 PDFs in public/forms/2025 and checks that every mapped key
 * matches exactly one field and that key values land on the right lines.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import * as lib from 'pdf-lib'
import { computeReturn } from '../engine/compute.ts'
import { emptyAsset, emptySale, emptyBusiness, emptyDependent, emptyHomeOffice, emptyHsa, emptyProvider, emptyRental, emptyReturn, emptyStudent, emptyTransaction, empty1099Div, empty1099R, emptySocialSecurity, emptyW2 } from '../engine/model.ts'
import type { CapitalTransaction, DepreciableAsset, PropertySale, TaxReturnInput } from '../engine/model.ts'
import { buildPacket2025 } from './irs2025.ts'
import { buildPdf, fillForm, findField } from './fill.ts'
import type { FillProblem } from './fill.ts'

const formsDir = new URL('../../public/forms/2025/', import.meta.url)
const load = (file: string): Promise<Uint8Array> => readFile(new URL(file, formsDir))

const w2 = (owner: 'taxpayer' | 'spouse', wages: number, withholding: number) => ({
  ...emptyW2(owner), employer: 'Acme', wages, federalWithholding: withholding,
  socialSecurityWages: wages, socialSecurityWithheld: wages * 0.062, medicareWages: wages, medicareWithheld: wages * 0.0145
})

/** A deliberately busy return that needs nearly every supported form. */
const busy = (): TaxReturnInput => ({
  ...emptyReturn(),
  filingStatus: 'mfj',
  taxpayer: { ...emptyReturn().taxpayer, firstName: 'Alex', lastName: 'Rivera', ssn: '123456789', age: 66, occupation: 'Engineer', presidentialFund: true },
  spouse: { ...emptyReturn().spouse, firstName: 'Sam', lastName: 'Rivera', ssn: '987654321', age: 45, occupation: 'Photographer' },
  contact: { street: '12 Oak St', apt: '3', city: 'Haymarket', state: 'VA', zip: '20169', phone: '555-0100', email: 'a@example.com', livedInUsHalfYear: true },
  digitalAssets: false,
  dependents: [{ ...emptyDependent(), name: 'Mia Rivera', relationship: 'Daughter', age: 9, ssn: '111223333' }, { ...emptyDependent(), name: 'Leo Rivera', relationship: 'Son', age: 20, student: true, ssn: '111224444' }],
  w2s: [w2('taxpayer', 230000, 40000), w2('spouse', 30000, 3000)],
  interest: [{ id: 'i1', payer: 'Harbor Bank', interest: 2500, taxExemptInterest: 0, federalWithholding: 0 }],
  dividends: [{ ...empty1099Div(), payer: 'Index Fund', ordinaryDividends: 6000, qualifiedDividends: 5000, capitalGainDistributions: 400 }],
  capitalTransactions: [{ ...emptyTransaction(), id: 'c1', description: 'XYZ', term: 'long', proceeds: 20000, costBasis: 12000 }],
  businesses: [{ ...emptyBusiness('spouse'), name: 'Rivera Studio', activity: 'Photography', businessCode: '541920', required1099s: false, grossReceipts: 40000, expenses: { ...emptyBusiness().expenses, supplies: 5000, carAndTruck: 1200, other: 300 }, vehicle: { ...emptyBusiness().vehicle, placedInService: '03/15/2022', businessMiles: 1700, commutingMiles: 0, otherMiles: 9000 } }],
  retirement: [{ ...empty1099R(), payer: 'IRA Co', grossDistribution: 5000, taxableAmount: 5000, code: '1', ira: true }],
  socialSecurity: [{ ...emptySocialSecurity(), netBenefits: 12000 }],
  schedule1A: { qualifiedTips: 0, qualifiedOvertime: 4000, carLoanInterest: 3000, vehicleVin: '1HGCM82633A004352' },
  deductionChoice: 'itemized',
  itemized: { ...emptyReturn().itemized, stateLocalIncomeOrSalesTax: 18000, realEstateTax: 9000, mortgageInterest: 14000, charityCash: 3000 },
  refundDeposit: { routingNumber: '021000021', accountNumber: '123456789', accountType: 'checking' }
})

/** Moderate-income family with care and education credits. */
const family = (): TaxReturnInput => ({
  ...emptyReturn(),
  filingStatus: 'mfj',
  taxpayer: { ...emptyReturn().taxpayer, firstName: 'Kim', lastName: 'Park', ssn: '222334444', age: 38 },
  spouse: { ...emptyReturn().spouse, firstName: 'Jo', lastName: 'Park', ssn: '555667777', age: 37 },
  contact: { ...emptyReturn().contact, street: '9 Pine Rd', city: 'Reston', state: 'VA', zip: '20190' },
  digitalAssets: false,
  dependents: [{ ...emptyDependent(), name: 'Ava Park', relationship: 'Daughter', age: 4, ssn: '111225555' }, { ...emptyDependent(), name: 'Ben Park', relationship: 'Son', age: 19, student: true, ssn: '111226666' }],
  w2s: [w2('taxpayer', 70000, 6000), w2('spouse', 45000, 3500)],
  dependentCare: { expenses: 7000, employerBenefits: 2000, providers: [{ ...emptyProvider(), name: 'Little Oaks Daycare', address: '1 School Ln, Reston, VA 20190', tin: '541234567', amountPaid: 7000 }] },
  students: [
    { ...emptyStudent(), name: 'Ben Park', ssn: '111226666', institution: 'George Mason University', institutionAddress: '4400 University Dr, Fairfax, VA 22030', institutionEin: '546001734', qualifiedExpenses: 6000 },
    { ...emptyStudent(), name: 'Jo Park', ssn: '555667777', institution: 'NOVA Community College', institutionAddress: '8333 Little River Tpke, Annandale, VA 22003', qualifiedExpenses: 1500, aotcEligible: false }
  ]
})

test('care and education credits print Form 2441 and Form 8863 with a page per extra student', async () => {
  const ret = family()
  const res = computeReturn(ret)
  const packet = buildPacket2025(ret, res)
  const ids = packet.forms.map((f) => f.id)
  for (const expected of ['1040', 's3', '2441', 's8812', '8863', '8863-p3-2']) assert.ok(ids.includes(expected), `missing ${expected}: ${ids.join(', ')}`)
  assert.deepEqual(packet.notIncluded, [])
  const { bytes, problems } = await buildPdf(lib, packet.forms, load)
  assert.deepEqual(problems, [])
  if (process.env.PDF_OUT2) await writeFile(process.env.PDF_OUT2, bytes)
  const f2441 = packet.forms.find((f) => f.id === '2441')!
  assert.equal(f2441.values['f1_33[0]'], res.form2441.credit.toLocaleString('en-US'))
  assert.equal(f2441.pages, undefined)
})

test('every mapped key matches exactly one field in the official PDFs', async () => {
  const ret = busy()
  const packet = buildPacket2025(ret, computeReturn(ret))
  const ids = packet.forms.map((f) => f.id)
    assert.ok(ids.some((x) => x.startsWith('sc-')), 'Schedule C should be printed')
  for (const expected of ['1040', 's1', 's1a', 's2', 'sa', 'sb', 'sd', 'sse-spouse', 's8812', '8995', '8959', '8960']) {
    assert.ok(ids.includes(expected), `packet should include ${expected}; got ${ids.join(', ')}`)
  }
  const problems: FillProblem[] = []
  for (const form of packet.forms) await fillForm(lib, await load(form.file), form, problems)
  assert.deepEqual(problems, [])
})

test('values land on the right Form 1040 lines', async () => {
  const ret = busy()
  const res = computeReturn(ret)
  const form = buildPacket2025(ret, res).forms[0]
  const doc = await lib.PDFDocument.load(await load(form.file))
  const fields = doc.getForm().getFields()
  const text = (key: string): string => (findField(fields, key)[0] as lib.PDFTextField).getText() ?? ''
  const problems: FillProblem[] = []
  const filled = await fillForm(lib, await load(form.file), { ...form, values: form.values }, problems)
  assert.deepEqual(problems, [])
  assert.ok(filled.getPageCount() === 2)
  // Spot-check the mapping table itself against computed lines
  assert.equal(form.values['f1_75[0]'], res.f1040['11a'].toLocaleString('en-US'))
  assert.equal(form.values['f2_16[0]'], res.f1040['24'].toLocaleString('en-US'))
  assert.equal(form.values['Checkbox_ReadOrder[0].c1_8[1]'], true)
  assert.equal(text('f1_14[0]'), '')
})

test('builds one merged PDF and a payment voucher when tax is owed', async () => {
  const ret: TaxReturnInput = { ...busy(), w2s: [w2('taxpayer', 230000, 1000), w2('spouse', 30000, 0)], refundDeposit: { routingNumber: '', accountNumber: '', accountType: 'checking' } }
  const res = computeReturn(ret)
  assert.ok(res.f1040['37'] > 0)
  const packet = buildPacket2025(ret, res)
  assert.equal(packet.forms[packet.forms.length - 1].id, '1040v')
  const { bytes, problems } = await buildPdf(lib, packet.forms, load)
  assert.deepEqual(problems, [])
  const merged = await lib.PDFDocument.load(bytes)
  assert.ok(merged.getPageCount() >= 20)
  if (process.env.PDF_OUT) await writeFile(process.env.PDF_OUT, bytes)
})

test('simple W-2 return prints only Form 1040', async () => {
  const ret: TaxReturnInput = { ...emptyReturn(), taxpayer: { ...emptyReturn().taxpayer, firstName: 'Pat', lastName: 'Lee', ssn: '123456789', age: 30 }, digitalAssets: false, w2s: [w2('taxpayer', 60000, 6000)] }
  const packet = buildPacket2025(ret, computeReturn(ret))
  assert.deepEqual(packet.forms.map((f) => f.id), ['1040'])
  assert.deepEqual(packet.notIncluded, [])
})

test('Schedule C prints net profit on line 31 and the home office note is listed', () => {
  const ret = busy()
  ret.businesses[0].homeOffice = { ...emptyHomeOffice(), method: 'amount', amount: 1500 }
  const res = computeReturn(ret)
  const packet = buildPacket2025(ret, res)
  const sc = packet.forms.find((f) => f.id.startsWith('sc-'))!
  assert.equal(sc.values['f1_46[0]'], res.scheduleC[0].netProfit.toLocaleString('en-US'))
  assert.equal(sc.values['f1_1[0]'], 'Sam Rivera')
  assert.equal(sc.values['f1_45[0]'], '1,500')
  assert.ok(packet.notIncluded.some((s) => s.includes('Form 8829')))
})

test('every blank form in public/forms/2025 is the 2025 revision', async () => {
  const { readdir } = await import('node:fs/promises')
  const files = (await readdir(formsDir)).filter((f) => f.endsWith('.pdf'))
  assert.ok(files.length >= 18)
  for (const file of files) {
    const doc = await lib.PDFDocument.load(await load(file))
    const title = doc.getTitle() ?? ''
    const subject = doc.getSubject() ?? ''
    assert.ok(/2025/.test(`${title} ${subject}`), `${file} does not look like a 2025 form (title: "${title}")`)
  }
})

test('Saver’s Credit prints Form 8880 with the rate as a single digit', async () => {
  const { exampleReturn } = await import('../app/example.ts')
  const ret = exampleReturn()
  const res = computeReturn(ret)
  const packet = buildPacket2025(ret, res)
  const f = packet.forms.find((x) => x.id === '8880')
  assert.ok(f, 'Form 8880 should be in the packet')
  assert.equal(f!.values['f1_17[0]'], '5')
  assert.equal(f!.values['f1_20[0]'], res.schedule3.saversCredit.toLocaleString('en-US'))
  const problems: FillProblem[] = []
  await fillForm(lib, await load(f!.file), f!, problems)
  assert.deepEqual(problems, [])
  assert.deepEqual(packet.notIncluded, [])
})

test('paid preparer, designee and IP PIN print on Form 1040 page 2', async () => {
  const ret: TaxReturnInput = {
    ...busy(), usePaidPreparer: true,
    taxpayer: { ...busy().taxpayer, ipPin: '123456' },
    designee: { enabled: true, name: 'Pat Preparer', phone: '555-0101', pin: '24680' }
  }
  const preparer = { name: 'Pat Preparer', ptin: 'p01234567', selfEmployed: false, firmName: 'Lee Tax Services LLC', firmEin: '123456789', firmAddress: '1 Main St, Fairfax, VA 22030', phone: '555-0101' }
  const f = buildPacket2025(ret, computeReturn(ret), preparer).forms[0]
  assert.equal(f.values['f2_47[0]'], 'P01234567')
  assert.equal(f.values['f2_51[0]'], '12-3456789')
  assert.equal(f.values['c2_17[0]'], true)
  assert.equal(f.values['f2_41[0]'], '123456')
  const problems: FillProblem[] = []
  await fillForm(lib, await load(f.file), f, problems)
  assert.deepEqual(problems, [])
  const noPrep = buildPacket2025({ ...ret, usePaidPreparer: false }, computeReturn(ret), preparer).forms[0]
  assert.equal(noPrep.values['f2_46[0]'], undefined)
})

test('rentals, HSA, home office and AMT print on Schedule E, Forms 8889 and 6251', async () => {
  const r = (addr: string, rents: number, repairs: number) => ({ ...emptyRental(), address: addr, rents, expenses: { ...emptyRental().expenses, repairs, taxes: 2000, depreciation: 4000 } })
  const ret: TaxReturnInput = {
    ...busy(),
    rentals: [r('1 Oak St, Reston, VA', 24000, 3000), r('2 Elm St, Reston, VA', 9000, 14000), r('3 Fir St, Reston, VA', 15000, 1000), r('4 Ash St, Reston, VA', 12000, 2000)],
    rentalForms1099: { required: true, filed: true },
    hsa: { taxpayer: { ...emptyHsa(), coverage: 'family', personalContributions: 3000, employerContributions: 2000, distributions: 1500, qualifiedExpenses: 1000 }, spouse: emptyHsa() },
    amt: { isoBargainElement: 400000, privateActivityBondInterest: 0, otherAdjustments: 0 },
    businesses: busy().businesses.map((b) => ({ ...b, homeOffice: { ...emptyHomeOffice(), method: 'simplified' as const, homeSqFt: 1800, officeSqFt: 150 } }))
  }
  const res = computeReturn(ret)
  assert.ok(res.f1040['17'] > 0, 'AMT expected')
  const packet = buildPacket2025(ret, res)
  const ids = packet.forms.map((f) => f.id)
  for (const id of ['se', 'se-2', '8889-taxpayer', '6251']) assert.ok(ids.includes(id), `missing ${id}: ${ids.join(', ')}`)
  const se = packet.forms.find((f) => f.id === 'se')!
  assert.equal(se.values['f1_84[0]'], res.scheduleE.net.toLocaleString('en-US'))
  assert.equal(se.values['f1_68[0]'], res.scheduleE.properties[0].expenses.toLocaleString('en-US'))
  const { bytes, problems } = await buildPdf(lib, packet.forms, load)
  assert.deepEqual(problems, [])
  if (process.env.PDF_OUT3) await writeFile(process.env.PDF_OUT3, bytes)
})

test('Form 8995-A prints the wage limit, the phase-in, and a second sheet for a fourth business', async () => {
  const biz = (name: string, receipts: number, w2Wages: number, sstb = false) => ({
    ...emptyBusiness('spouse'), name, activity: 'Services', businessCode: '541990', required1099s: false, grossReceipts: receipts,
    qbi: { w2Wages, ubia: 20000, sstb }
  })
  const ret: TaxReturnInput = {
    ...busy(),
    w2s: [w2('taxpayer', 300000, 60000)],
    dividends: [{ ...empty1099Div(), payer: 'REIT Fund', ordinaryDividends: 3000, qualifiedDividends: 0, section199ADividends: 2500 }],
    businesses: [biz('Studio', 60000, 10000), biz('Consulting', 40000, 0, true), biz('Shop', 30000, 4000), biz('Rentals Co', 10000, 0)]
  }
  const res = computeReturn(ret)
  assert.equal(res.qbi.form, '8995a')
  assert.ok(res.qbi.phaseIn, `taxable income ${res.qbi.taxableIncomeBeforeQbi} should be inside the phase-in range`)
  const packet = buildPacket2025(ret, res)
  const ids = packet.forms.map((f) => f.id)
  assert.ok(ids.includes('8995a') && ids.includes('8995a-2') && !ids.includes('8995'), ids.join(', '))
  const a = packet.forms.find((f) => f.id === '8995a')!
  assert.equal(a.values['f2_46[0]'], res.qbi.deduction.toLocaleString('en-US'))
  assert.equal(a.values['Table_PartI[0].RowB[0].c1_4[0]'], true)
  assert.ok(packet.notIncluded.some((x) => x.startsWith('Schedule A (Form 8995-A)')))
  assert.equal(res.f1040['13a'], res.qbi.deduction)
  const { bytes, problems } = await buildPdf(lib, packet.forms, load)
  assert.deepEqual(problems, [])
  if (process.env.PDF_OUT4) await writeFile(process.env.PDF_OUT4, bytes)
})

test('Form 8949 prints one page per box, 11 sales per page, and Schedule D picks up the totals', async () => {
  const sale = (i: number, p: Partial<CapitalTransaction> = {}): CapitalTransaction => ({
    ...emptyTransaction(), description: `${10 + i} sh. Fund ${i}`, term: 'short', dateAcquired: '02/03/2025', dateSold: '09/15/2025',
    proceeds: 1000 + i, costBasis: 900, adjustmentCode: 'W', adjustment: 25, ...p
  })
  const ret: TaxReturnInput = {
    ...busy(),
    capitalTransactions: [
      ...Array.from({ length: 13 }, (_, i) => sale(i)),
      sale(20, { term: 'long', dateAcquired: 'VARIOUS', reporting: 'noncovered', adjustmentCode: '', adjustment: 0, proceeds: 8000, costBasis: 3000 }),
      sale(21, { term: 'long', dateAcquired: '01/02/2020', adjustmentCode: '', adjustment: 0 })
    ]
  }
  const res = computeReturn(ret)
  const packet = buildPacket2025(ret, res)
  const p8949 = packet.forms.filter((f) => f.file === 'f8949.pdf')
  assert.deepEqual(p8949.map((f) => f.title), ['Form 8949 (Box A, page 1)', 'Form 8949 (Box A, page 2)', 'Form 8949 (Box E)'])
  assert.deepEqual(p8949.map((f) => f.pages), [[0], [0], [1]])
  assert.equal(p8949[2].values['Page2[0].c2_1[1]'], true)
  assert.equal(p8949[0].values['f1_10[0]'], '125')
  const sd = packet.forms.find((f) => f.id === 'sd')!
  assert.equal(sd.values['f1_9[0]'], '325')
  assert.equal(sd.values['f1_34[0]'], '5,000')
  assert.equal(sd.values['f1_23[0]'], '1,021')
  const { bytes, problems } = await buildPdf(lib, packet.forms, load)
  assert.deepEqual(problems, [])
  if (process.env.PDF_OUT5) await writeFile(process.env.PDF_OUT5, bytes)
})

test('Form 5329 prints Part I with the exception and Part VII; Schedule 2 line 8 carries both', async () => {
  const ret: TaxReturnInput = {
    ...busy(),
    retirement: [{ ...empty1099R(), payer: 'IRA Co', grossDistribution: 12000, taxableAmount: 12000, code: '1', ira: true, earlyExceptionCode: '08', earlyExceptionAmount: 4000 }],
    hsa: { taxpayer: { ...emptyHsa(), coverage: 'self', personalContributions: 6000, yearEndValue: 15000 }, spouse: emptyHsa() }
  }
  const res = computeReturn(ret)
  const packet = buildPacket2025(ret, res)
  const f = packet.forms.find((x) => x.id === '5329-taxpayer')!
  assert.ok(f, packet.forms.map((x) => x.id).join(', '))
  assert.deepEqual(f.pages, [0, 1])
  assert.equal(f.values['f1_10[0]'], '08')
  assert.equal(f.values['f1_13[0]'], '800')
  assert.equal(f.values['f2_24[0]'], (res.form5329[0].line49).toLocaleString('en-US'))
  const s2 = packet.forms.find((x) => x.id === 's2')!
  assert.equal(s2.values['f1_19[0]'], (800 + res.form5329[0].line49).toLocaleString('en-US'))
  assert.equal(s2.values['Line8_ReadOrder[0].c1_6[0]'], false)
  const { bytes, problems } = await buildPdf(lib, packet.forms, load)
  assert.deepEqual(problems, [])
  if (process.env.PDF_OUT6) await writeFile(process.env.PDF_OUT6, bytes)
})

test('Form 8829 and Form 4562 print with equipment, a home first used in 2025, and a rental', async () => {
  const asset = (p: Partial<DepreciableAsset>): DepreciableAsset => ({ ...emptyAsset('5'), placedInService: '04/10/2025', cost: 3000, ...p })
  const ret: TaxReturnInput = {
    ...busy(),
    businesses: [{
      ...busy().businesses[0],
      homeOffice: { ...emptyHomeOffice(), method: 'regular', homeSqFt: 2400, officeSqFt: 240, mortgageInterest: 12000, realEstateTaxes: 5000, insurance: 1200, utilities: 3600, homeBasis: 500000, landValue: 120000, firstUsed: '02/01/2025' },
      assets: [
        asset({ description: 'Laptop', cost: 2400, section179: 2400 }),
        asset({ description: 'Camera body', cost: 6000, bonus: 'none' }),
        asset({ description: 'Desk', propertyClass: '7', cost: 1500, acquiredBeforeJan20: true }),
        asset({ description: 'Lens (2023)', placedInService: '06/01/2023', cost: 4000, bonus: 'none' })
      ]
    }],
    rentals: [{ ...emptyRental(), address: '9 Elm St, Reston, VA', rents: 26000, expenses: { ...emptyRental().expenses, taxes: 3000 }, assets: [
      { ...emptyAsset('27.5'), description: 'Building', placedInService: '09/15/2025', cost: 280000 },
      { ...emptyAsset('5'), description: 'Washer', placedInService: '09/20/2025', cost: 900 }
    ] }]
  }
  const res = computeReturn(ret)
  const packet = buildPacket2025(ret, res)
  const ids = packet.forms.map((f) => f.id)
  const biz = ret.businesses[0].id
  for (const id of [`4562-${biz}`, `4562-${ret.rentals[0].id}`, `8829-${biz}`]) assert.ok(ids.includes(id), `${id} missing: ${ids.join(', ')}`)
  const f4562 = packet.forms.find((f) => f.id === `4562-${biz}`)!
  assert.equal(f4562.values['f1_20[0]'], '2,400')
  assert.equal(f4562.values['f1_33[0]'], '6,000')
  assert.equal(f4562.values['f1_37[0]'], '1,200')
  assert.equal(f4562.values['f1_86[0]'], '02/2025')
  const f8829 = packet.forms.find((f) => f.id === `8829-${biz}`)!
  assert.equal(f8829.values['f1_55[0]'], '2.247')
  const sc = packet.forms.find((f) => f.id.startsWith('sc-'))!
  assert.equal(sc.values['f1_22[0]'], res.scheduleC[0].depreciation.toLocaleString('en-US'))
  assert.equal(res.scheduleC[0].depreciation + res.form4562.find((f) => f.id === biz)!.home!.deduction, res.form4562.find((f) => f.id === biz)!.line22)
  const { bytes, problems } = await buildPdf(lib, packet.forms, load)
  assert.deepEqual(problems, [])
  if (process.env.PDF_OUT7) await writeFile(process.env.PDF_OUT7, bytes)
})

test('Form 4797 and Form 4562 Part V print; Schedule D line 19 and Schedule 1 line 4 carry the results', async () => {
  const sale = (p: Partial<PropertySale>): PropertySale => ({ ...emptySale(), dateAcquired: '01/10/2015', dateSold: '06/01/2025', ...p })
  const ret: TaxReturnInput = {
    ...busy(),
    propertySales: [
      sale({ description: 'Rental house, 4 Ash St', kind: '1250', usedIn: 'rental', salesPrice: 400000, costBasis: 300000, depreciation: 80000 }),
      sale({ description: 'Studio lights', kind: '1245', dateAcquired: '03/01/2020', salesPrice: 6000, costBasis: 9000, depreciation: 7000 }),
      sale({ description: 'Lot', kind: 'land', salesPrice: 30000, costBasis: 35000 }),
      sale({ description: 'Tripod', kind: '1245', dateAcquired: '11/01/2024', salesPrice: 300, costBasis: 500 })
    ],
    businesses: [{
      ...busy().businesses[0],
      assets: [
        { ...emptyAsset('5'), listed: 'auto', description: 'Sedan', placedInService: '04/02/2025', cost: 42000, businessPct: 75,
          vehicle: { ...emptyAsset().vehicle, businessMiles: 9000, commutingMiles: 0, otherMiles: 3000 } },
        { ...emptyAsset('5'), listed: 'auto', description: 'Old van', placedInService: '05/01/2023', cost: 30000, businessPct: 40, bonus: 'none',
          vehicle: { ...emptyAsset().vehicle, businessMiles: 4000, commutingMiles: 1000, otherMiles: 5000 } }
      ]
    }]
  }
  const res = computeReturn(ret)
  const packet = buildPacket2025(ret, res)
  const f4797 = packet.forms.find((f) => f.id === '4797')!
  assert.ok(f4797, packet.forms.map((f) => f.id).join(', '))
  assert.equal(f4797.values['f2_99[0]'], res.form4797.line32.toLocaleString('en-US'))
  const sd = packet.forms.find((f) => f.id === 'sd')!
  assert.equal(sd.values['f2_3[0]'], '80,000')
  assert.equal(sd.values['Page2[0].c2_2[1]'], true)
  const s1 = packet.forms.find((f) => f.id === 's1')!
  assert.equal(s1.values['f1_08[0]'], res.form4797.line18b.toLocaleString('en-US'))
  const f4562 = packet.forms.find((f) => f.id === `4562-${ret.businesses[0].id}`)!
  assert.equal(f4562.values['f2_6[0]'], 'Sedan')
  assert.equal(f4562.values['f2_33[0]'], 'Old van')
  assert.equal(f4562.values['f2_13[0]'], '0')
  assert.equal(f4562.values['f2_5[0]'], '15,150')
  const { bytes, problems } = await buildPdf(lib, packet.forms, load)
  assert.deepEqual(problems, [])
  if (process.env.PDF_OUT8) await writeFile(process.env.PDF_OUT8, bytes)
})

test('a Form 4797 gain alone still brings in Schedule D', () => {
  const ret: TaxReturnInput = {
    ...busy(), capitalTransactions: [], dividends: [],
    propertySales: [{ ...emptySale(), description: 'Condo', kind: '1250', usedIn: 'rental', dateAcquired: '05/01/2016', dateSold: '07/15/2025', salesPrice: 350000, costBasis: 260000, depreciation: 70000 }]
  }
  const ids = buildPacket2025(ret, computeReturn(ret)).forms.map((f) => f.id)
  assert.ok(ids.includes('sd') && ids.includes('4797'), ids.join(', '))
})
