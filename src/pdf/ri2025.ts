/**
 * Fills the official 2025 Rhode Island RI-1040 with Schedules W and E (public/forms/2025/ri-1040.pdf, 5 pages), RI
 * Schedule M (ri-schm.pdf) and RI Schedule CR (ri-schcr.pdf): the Division of Taxation’s fill-in PDFs with their XFA
 * and scripts removed. Amounts are written as dollars and cents in the separate cents boxes.
 */
import type { TaxReturnInput } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import type { RiResult } from '../engine/ri2025.ts'
import type { FieldValue, FormFill, FormPacket, PreparerInfo } from './irs2025.ts'

const T = 'topmostSubform[0].'
const digits = (v: string): string => v.replace(/\D/g, '')
const upper = (s: string): string => s.trim().toUpperCase()
const nameParts = (first: string): [string, string] => {
  const parts = first.trim().split(/\s+/)
  const mi = parts.length > 1 && /^[A-Za-z]\.?$/.test(parts[parts.length - 1]) ? parts.pop() ?? '' : ''
  return [parts.join(' '), mi.replace('.', '')]
}
/** A date written into a box that already prints the two slashes. */
const slashed = (s: string): string => {
  const m = s.trim().match(/^(\d{1,2})\D(\d{1,2})\D(\d{4})$/)
  return m ? `${m[1].padStart(2, "0")}   ${m[2].padStart(2, "0")}   ${m[3]}` : s.trim()
}
const mmddyyyy = (s: string): string => {
  const m = s.trim().match(/^(\d{1,2})\D(\d{1,2})\D(\d{4})$/)
  return m ? `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3]}` : s.trim()
}

/** Writes an amount into a dollars field and its “-00” cents field. */
function amount(v: Record<string, FieldValue>, page: string, base: string, n: number | undefined, always = false, centsName?: string): void {
  const x = Math.round((n ?? 0) * 100)
  if (x === 0 && !always) return
  const abs = Math.abs(x)
  v[`${T}${page}[0].${base}[0]`] = `${x < 0 ? '-' : ''}${Math.floor(abs / 100)}`
  v[`${T}${page}[0].${centsName ?? `${base}-00`}[0]`] = String(abs % 100).padStart(2, '0')
}

function header(v: Record<string, FieldValue>, ret: TaxReturnInput, page: string, lastOnly = false): void {
  const tp = ret.taxpayer
  const joint = ret.filingStatus === 'mfj'
  if (!lastOnly) v[`${T}${page}[0].PrimFirstName[0]`] = upper(joint ? `${nameParts(tp.firstName)[0]} & ${nameParts(ret.spouse.firstName)[0]}` : nameParts(tp.firstName)[0])
  v[`${T}${page}[0].PrimLastName[0]`] = upper(tp.lastName)
  v[`${T}${page}[0].PrimTaxpayerSSN[0]`] = digits(tp.ssn)
}

export function formRi1040(ret: TaxReturnInput, ri: RiResult, preparer?: PreparerInfo | null): FormFill {
  const L = ri.lines
  const c = ret.contact
  const fs = ret.filingStatus
  const joint = fs === 'mfj'
  const d = ret.ri
  const tp = ret.taxpayer
  const sp = ret.spouse
  const v: Record<string, FieldValue> = {}
  const P1 = `${T}Page1[0].`

  // ── Page 1 ──
  const [tf, tmi] = nameParts(tp.firstName)
  v[`${P1}PrimFirstName[0]`] = upper(tf)
  if (tmi) v[`${P1}PrimMidInitial[0]`] = upper(tmi)
  v[`${P1}PrimLastName[0]`] = upper(tp.lastName)
  v[`${P1}PrimTaxpayerSSN[0]`] = digits(tp.ssn)
  if (joint || fs === 'mfs') {
    const [sf, smi] = nameParts(sp.firstName)
    v[`${P1}SecFirstName[0]`] = upper(sf)
    if (smi) v[`${P1}SecMidInitial[0]`] = upper(smi)
    v[`${P1}SecLastName[0]`] = upper(sp.lastName)
    v[`${P1}SecTaxpayerSSN[0]`] = digits(sp.ssn)
  }
  v[`${P1}AddressLine1[0]`] = upper([c.street, c.apt].filter((x) => x.trim()).join(' '))
  v[`${P1}City[0]`] = upper(c.city)
  v[`${P1}State[0]`] = upper(c.state).slice(0, 2)
  v[`${P1}ZipCode[0]`] = digits(c.zip).slice(0, 5)
  v[`${P1}CityTownLegalResidence[0]`] = upper(c.city)
  v[`${P1}StateFilingStatus_${{ single: 'S', mfj: 'J', mfs: 'M', hoh: 'H', qss: 'W' }[fs]}[0]`] = true
  if (d.electoral) {
    v[`${P1}ElectoralContribution[0]`] = true
    if (d.electoralParty.trim()) { v[`${P1}SpecificPartyChkBx[0]`] = true; v[`${P1}SpecificParty[0]`] = upper(d.electoralParty) }
  }
  amount(v, 'Page1', 'AGI', L['1'], true)
  amount(v, 'Page1', 'NetMods', L['2'], true)
  amount(v, 'Page1', 'ModifiedFedAGI', L['3'], true)
  amount(v, 'Page1', 'RIStandardDeduction', L['4'], true)
  amount(v, 'Page1', 'FedAGIAfterDed', L['5'], true)
  v[`${P1}NumFedExemptions[0]`] = String(L['6n'])
  amount(v, 'Page1', 'RIExemptionAmount', L['6'], true)
  amount(v, 'Page1', 'RITaxableIncome', L['7'], true)
  amount(v, 'Page1', 'RIIncomeTax', L['8'], true)
  amount(v, 'Page1', 'RIFederalCredit', L['9a'])
  amount(v, 'Page1', 'RICreditPaidToOtherStates', L['9b'])
  amount(v, 'Page1', 'OtherRICredits', L['9c'])
  amount(v, 'Page1', 'TotalRICredits', L['9d'], true)
  amount(v, 'Page1', 'RIIncomeTaxAfterCredit', L['10a'], true)
  amount(v, 'Page1', 'RIContributions', L['11'])
  amount(v, 'Page1', 'UseSalesTaxDue', L['12a'], true)
  v[`${P1}UseTax[0]`] = true
  if (d.fullYearCoverage) v[`${P1}IndMandate[0]`] = true
  else amount(v, 'Page1', 'MandatePenalty', L['12b'], true)
  amount(v, 'Page1', 'TotalRITax', L['13a'], true)

  // ── Page 2 ──
  header(v, ret, 'Page2')
  const P2 = `${T}Page2[0].`
  amount(v, 'Page2', 'TotalRITax', L['13b'], true, 'RIIncomeTax-00')
  amount(v, 'Page2', 'RIWithholding', L['14a'])
  amount(v, 'Page2', 'EstimatedTaxPayments', L['14b'])
  amount(v, 'Page2', 'PropertyTaxReliefCredit', L['14c'])
  amount(v, 'Page2', 'RIEarnedIncomeCredit', L['14d'])
  amount(v, 'Page2', 'TotalPaymentsAndCredits', L['14g'], true)
  amount(v, 'Page2', 'NetPayments', L['14i'], true)
  amount(v, 'Page2', 'AmountDue', L['15a'])
  amount(v, 'Page2', 'TotalAmountDue', L['15c'])
  amount(v, 'Page2', 'AmountOverpaid', L['16'])
  amount(v, 'Page2', 'AmountToBeRefunded', L['17'])
  amount(v, 'Page2', 'AmountToBeApplied', L['18'])
  if (d.driversLicense.taxpayer.trim()) v[`${P2}PrimTaxpayerLicenseNumber[0]`] = upper(d.driversLicense.taxpayer)
  if (c.phone.trim()) v[`${P2}PhoneNumberP[0]`] = digits(c.phone).slice(-10)
  if (joint && d.driversLicense.spouse.trim()) v[`${P2}SecTaxpayeLicenseNumber[0]`] = upper(d.driversLicense.spouse)
  if (ret.usePaidPreparer && preparer) {
    v[`${P2}PreparerName[0]`] = upper(preparer.name)
    v[`${P2}PreparerPhoneNumber[0]`] = digits(preparer.phone).slice(-10)
    v[`${P2}PTIN[0]`] = preparer.ptin.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 9)
    v[`${P2}PreparerAddress[0]`] = upper(preparer.firmAddress)
  }

  // ── Page 3 ──
  header(v, ret, 'Page3')
  const P3 = `${T}Page3[0].`
  if (L['20'] > 0) {
    amount(v, 'Page3', 'RIIncomeTax', L['8'], true)
    amount(v, 'Page3', 'CreditChildDep', L['20'], true)
    amount(v, 'Page3', 'TentativeAllowFedCredits', L['21'], true)
    amount(v, 'Page3', 'MaxCredit', L['22'], true)
  }
  if (L['29'] > 0) {
    amount(v, 'Page3', 'RIIncomeTaxLessFCR', L['23'], true)
    amount(v, 'Page3', 'IncOtherState', L['24'], true)
    amount(v, 'Page3', 'ModifiedFedAGI', L['25'], true)
    v[`${P3}OtherStatePctg[0]`] = L['26'].toFixed(4)
    amount(v, 'Page3', 'TentativeCredit', L['27'], true)
    v[`${P3}OtherStateAbbrev[0]`] = upper(d.otherState.state).slice(0, 2)
    amount(v, 'Page3', 'TxPdOtherState', L['28'], true)
    amount(v, 'Page3', 'MaxCreditSchII', L['29'], true)
  }
  const checkoffs: [string, string][] = [['30', 'DrugPrgCont'], ['31', 'OlympicCont'], ['32', 'OrganTranCont'], ['33', 'CouncilArtCont'], ['34', 'RIWildlifeCont'], ['35', 'DiseaseVictimsCont'], ['36', 'RIMilFamCont'], ['37', 'BehavioralHealth']]
  for (const [k, f] of checkoffs) amount(v, 'Page3', f, L[k])
  amount(v, 'Page3', 'RICheckoffAmt', L['38'])
  if (L['41'] > 0) {
    amount(v, 'Page3', 'FedEarnedIncCrdts', L['39'], true)
    amount(v, 'Page3', 'RIEIC', L['41'], true)
  }

  // ── Page 4: Schedule W ──
  header(v, ret, 'Page4')
  const P4 = `${T}Page4[0].`
  const owners = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const rows = [
    ...ret.w2s.filter((w) => owners.includes(w.owner) && (d.w2[w.id]?.stateTax ?? 0) > 0).map((w) => ({ spouse: w.owner === 'spouse', code: '', name: w.employer, id: d.w2[w.id]?.stateId || d.w2[w.id]?.ein || '', tax: d.w2[w.id]?.stateTax ?? 0 })),
    ...d.other1099.filter((x) => owners.includes(x.owner) && x.tax > 0).map((x) => ({ spouse: x.owner === 'spouse', code: x.code || 'R', name: x.payer, id: x.ein, tax: x.tax }))
  ]
  rows.slice(0, 15).forEach((row, i) => {
    const n = i + 1
    if (row.spouse) v[`${P4}Spouse${n}[0]`] = 'S'
    if (row.code) v[`${P4}Code${n}[0]`] = upper(row.code).slice(0, 1)
    v[`${P4}EmpPayerName-${n}[0]`] = upper(row.name).slice(0, 30)
    v[`${P4}EmpFedID-${n}[0]`] = digits(row.id).slice(0, 9)
    const cents = Math.round(row.tax * 100)
    v[`${P4}RIIncWthld-${n}[0]`] = String(Math.floor(cents / 100))
    v[`${P4}RIIncWthld-${n}[1]`] = String(cents % 100).padStart(2, '0')
  })
  if (rows.length) {
    const cents = Math.round(L['14a'] * 100)
    v[`${P4}TotalRIIncWthld-1[0]`] = String(Math.floor(cents / 100))
    v[`${P4}TotalRIIncWthld-1[1]`] = String(cents % 100).padStart(2, '0')
    v[`${P4}NumW21099[0]`] = String(rows.length)
  }

  // ── Page 5: Schedule E ──
  const P5 = `${T}Page5[0].`
  header(v, ret, 'Page5')
  const pages = [0, 1, 2]
  if (rows.length) pages.push(3)
  if (ri.exemptions > 0) {
    if (!ret.canBeClaimedAsDependent) v[`${P5}CheckBox_Yourself[0]`] = true
    if (joint && !ret.canBeClaimedAsDependent) v[`${P5}CheckBox_Spouse[0]`] = true
    const deps = ret.canBeClaimedAsDependent ? [] : ret.dependents
    deps.slice(0, 13).forEach((dep, i) => {
      const n = i + 1
      v[`${P5}Name-${n}[0]`] = upper(dep.name)
      v[`${P5}SSN-${n}[0]`] = digits(dep.ssn)
      const b = (d.dependentBirthDates[dep.id] ?? '').trim()
      if (b) v[`${P5}DOB-${n}[0]`] = mmddyyyy(b)
      v[`${P5}Relationship-${n}[0]`] = upper(dep.relationship)
    })
    const lived = deps.filter((x) => x.childRelationship && x.monthsLivedWithYou >= 6).length
    const other = deps.length - lived
    v[`${P5}SummaryLine3[0]`] = String(ri.exemptions - deps.length)
    if (lived) v[`${P5}SummaryLine4a[0]`] = String(lived)
    if (other) v[`${P5}SummaryLine4c[0]`] = String(other)
    v[`${P5}SummaryLine5[0]`] = String(ri.exemptions)
    pages.push(4)
  }
  return { id: 'ri1040', file: 'ri-1040.pdf', title: 'Rhode Island RI-1040', values: v, pages }
}

function formRiSchM(ret: TaxReturnInput, ri: RiResult): FormFill {
  const M = ri.m
  const d = ret.ri
  const v: Record<string, FieldValue> = {}
  header(v, ret, 'Page1')
  header(v, ret, 'Page2')
  const P1 = `${T}Page1[0].`
  amount(v, 'Page1', 'ObligationsUSGov', M['1a'])
  amount(v, 'Page1', 'RailroadRetirement', M['1d'])
  amount(v, 'Page1', 'TuitionSavingProgram', M['1g'])
  amount(v, 'Page1', 'TaxableSS', M['1s'])
  amount(v, 'Page1', 'TaxableRetirementIncome', M['1t'])
  amount(v, 'Page1', 'MilitaryPensions', M['1v'])
  const joint = ret.filingStatus === 'mfj'
  if (M['1s'] > 0) {
    if (d.birthDates.taxpayer.trim()) v[`${P1}PrimaryDOB[0]`] = slashed(d.birthDates.taxpayer)
    if (joint && d.birthDates.spouse.trim()) v[`${P1}SpouseDOB[0]`] = slashed(d.birthDates.spouse)
  }
  if (M['1t'] > 0) {
    if (d.birthDates.taxpayer.trim()) v[`${P1}PrimaryDOB[1]`] = slashed(d.birthDates.taxpayer)
    if (joint && d.birthDates.spouse.trim()) v[`${P1}SpouseDOB[1]`] = slashed(d.birthDates.spouse)
  }
  amount(v, 'Page1', 'NetDecreasing', M['1y'], true)
  amount(v, 'Page2', 'ObligationsotherState', M['2a'])
  amount(v, 'Page2', 'NetIncreasing', M['2m'], true)
  amount(v, 'Page2', 'DecreasingMod', M['1y'], true)
  amount(v, 'Page2', 'IncreasingMod', M['2m'], true)
  amount(v, 'Page2', 'NetModFedAGI', M['3'], true)
  return { id: 'rischm', file: 'ri-schm.pdf', title: 'RI Schedule M', values: v }
}

function formRiSchCR(ret: TaxReturnInput, ri: RiResult): FormFill {
  const v: Record<string, FieldValue> = {}
  header(v, ret, 'Page1')
  amount(v, 'Page1', 'TotalCredits', ri.lines['9c'], true)
  return { id: 'rischcr', file: 'ri-schcr.pdf', title: 'RI Schedule CR', values: v }
}

function formRi1040H(ret: TaxReturnInput, ri: RiResult): FormFill {
  const H = ri.h ?? {}
  const d = ret.ri
  const rl = d.relief
  const c = ret.contact
  const tp = ret.taxpayer
  const sp = ret.spouse
  const joint = ret.filingStatus === 'mfj'
  const v: Record<string, FieldValue> = {}
  const P1 = `${T}Page1[0].`
  const [tf, tmi] = nameParts(tp.firstName)
  v[`${P1}PrimFirstName[0]`] = upper(tf)
  if (tmi) v[`${P1}PrimMidInitial[0]`] = upper(tmi)
  v[`${P1}PrimLastName[0]`] = upper(tp.lastName)
  v[`${P1}PrimTaxpayerSSN[0]`] = digits(tp.ssn)
  if (joint) {
    const [sf, smi] = nameParts(sp.firstName)
    v[`${P1}SecFirstName[0]`] = upper(sf)
    if (smi) v[`${P1}SecMidInitial[0]`] = upper(smi)
    v[`${P1}SecLastName[0]`] = upper(sp.lastName)
    v[`${P1}SecTaxpayerSSN[0]`] = digits(sp.ssn)
  }
  v[`${P1}AddressLine1[0]`] = upper(c.street)
  if (c.apt.trim()) v[`${P1}AddressLine2[0]`] = upper(c.apt)
  if (c.phone.trim()) v[`${P1}DayTimePhoneNumber[0]`] = digits(c.phone).slice(-10)
  v[`${P1}City[0]`] = upper(c.city)
  v[`${P1}State[0]`] = upper(c.state).slice(0, 2)
  v[`${P1}ZipCode[0]`] = digits(c.zip).slice(0, 5)
  v[`${P1}CityTownLegalResidence[0]`] = upper(c.city)
  // Part 1: eligibility answers (the credit is only computed when they are all yes).
  const ok = (H['13'] ?? 0) > 0
  for (const k of ['Domociled', 'PropertyTax', 'CurrentTaxes', 'Age65']) v[`${P1}${k}-${ok ? 'Y' : 'N'}[0]`] = true
  v[`${P1}${ok ? 'income30000-Y' : 'Income30000-N'}[0]`] = true
  // Part 2.
  amount(v, 'Page1', 'PublicAssistance', H['29'], true)
  amount(v, 'Page1', 'TotalHouseholdIncome', H['32'], true)
  if (d.birthDates.taxpayer.trim()) v[`${P1}PrimaryDOB[0]`] = slashed(d.birthDates.taxpayer)
  if (joint && d.birthDates.spouse.trim()) v[`${P1}SpouseDOB[0]`] = slashed(d.birthDates.spouse)
  v[`${P1}Disabled-${rl.disabled ? 'Y' : 'N'}[0]`] = true
  v[`${P1}PersonsInHousehold[0]`] = String(Math.max(1, Math.round(rl.householdSize)))
  v[`${P1}Dependents[0]`] = String(Math.max(0, Math.round(rl.dependentsUnder18)))
  const pct = (n: number | undefined): string => `${Math.round((n ?? 0) * 100)}`
  if (rl.owner) {
    amount(v, 'Page1', 'PropertyTaxes', H['2'], true)
    v[`${P1}IncomePct[0]`] = pct(H['3'])
    amount(v, 'Page1', 'HomeownerCalc', H['4'], true)
    amount(v, 'Page1', 'TentativeCredit', H['5'], true)
    amount(v, 'Page1', 'HomeownerCredit', H['6'], true)
  } else {
    if (rl.landlord.trim()) v[`${P1}LandlordName[0]`] = upper(rl.landlord)
    amount(v, 'Page1', 'Rent', H['7'], true)
    amount(v, 'Page1', 'RenterCalc', H['8'], true)
    v[`${P1}IncomePct[1]`] = pct(H['9'])
    amount(v, 'Page1', 'RenterCalcB', H['10'], true)
    amount(v, 'Page1', 'RentTentativeCredit', H['11'], true)
    amount(v, 'Page1', 'RenterCredit', H['12'], true)
  }
  amount(v, 'Page1', 'PropTaxReliefCredit', H['13'], true)
  // Page 2: household income worksheet.
  header(v, ret, 'Page2')
  const rows: [string, string][] = [['14', 'Wages'], ['15', 'Interest'], ['18', 'BusinessIncome'], ['19', 'SaleProperty'], ['20', 'IRAPensions'], ['21', 'RentalRE'], ['23', 'Unemployment'], ['24', 'SocialSecurity'], ['25', 'OtherIncome']]
  for (const [k, f] of rows) amount(v, 'Page2', f, H[k])
  amount(v, 'Page2', 'TotalIncome', H['26'], true)
  amount(v, 'Page2', 'Deductions', H['27'])
  amount(v, 'Page2', 'AdjustedIncome', H['28'], true)
  amount(v, 'Page2', 'PublicAssistance', H['29'])
  amount(v, 'Page2', 'OtherNontaxableIncome', H['30'])
  amount(v, 'Page2', 'Addback', H['31'])
  amount(v, 'Page2', 'TotalHouseholdIncome', H['32'], true)
  if (c.phone.trim()) v[`${T}Page2[0].TPPhone[0]`] = digits(c.phone).slice(-10)
  return { id: 'ri1040h', file: 'ri-1040h.pdf', title: 'Rhode Island RI-1040H', values: v }
}

export function buildRiPacket(ret: TaxReturnInput, res: TaxReturnResult, ri: RiResult, preparer?: PreparerInfo | null): FormPacket {
  void res
  const forms = [formRi1040(ret, ri, preparer)]
  const notIncluded: string[] = []
  for (const a of ri.attach) {
    if (a.startsWith('RI Schedule M')) forms.push(formRiSchM(ret, ri))
    else if (a.startsWith('RI Schedule CR')) { forms.push(formRiSchCR(ret, ri)); notIncluded.push('RI Schedule CR lines 1–8: enter each credit yourself (only the total is filled) and attach the credit forms and certificates') }
    else if (a.startsWith('RI Schedule W') || a.startsWith('RI Schedule E')) notIncluded.push(a.startsWith('RI Schedule W') ? 'Every W-2 and 1099 with Rhode Island withholding (Schedule W is filled in)' : 'Schedule E is filled in: check each dependent’s date of birth')
    else if (a.startsWith('RI-1040H')) { forms.push(formRi1040H(ret, ri)); notIncluded.push(`With RI-1040H, attach ${d(ret)}`) }
    else notIncluded.push(a)
  }
  return { forms, notIncluded }
}
const d = (ret: TaxReturnInput): string => (ret.ri.relief.owner ? 'your 2025 property tax bill' : 'your lease or three rent receipts')
