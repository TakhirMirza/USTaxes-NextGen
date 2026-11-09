import type { FilingStatus } from './rules2025.ts'

export type Owner = 'taxpayer' | 'spouse'

export interface Person {
  /** First name and middle initial, as on the Social Security card. */
  firstName: string
  lastName: string
  /** 9 digits, no dashes. Stored only in this browser. */
  ssn: string
  occupation: string
  presidentialFund: boolean
  /** Full-time student during any part of 5 months of 2025 (blocks the Saver's Credit). */
  fullTimeStudent: boolean
  /** 6-digit Identity Protection PIN from the IRS, if one was issued. */
  ipPin: string
  /** Age on December 31, 2025. 0 = not entered. */
  age: number
  age65OrOlder: boolean
  blind: boolean
}

export interface Dependent {
  id: string
  name: string
  relationship: string
  /** Age on December 31, 2025. */
  age: number
  /** Has an SSN valid for employment (required for the Child Tax Credit and EIC). */
  hasSsn: boolean
  /** Months the dependent lived with you in the U.S. during 2025. */
  monthsLivedWithYou: number
  /** Full-time student for at least five months of 2025. */
  student: boolean
  /** Permanently and totally disabled. */
  disabled: boolean
  /** Your child, stepchild, foster child, sibling, step-sibling, or a descendant of one. */
  childRelationship: boolean
  /** 9 digits, no dashes. */
  ssn: string
}

export interface Contact {
  street: string
  apt: string
  city: string
  state: string
  zip: string
  phone: string
  email: string
  /** Main home (and spouse's, if joint) in the U.S. for more than half of 2025. */
  livedInUsHalfYear: boolean
}

export interface RetirementSavings {
  /** Traditional and Roth IRA contributions for 2025 (Form 8880 line 1). */
  iraContributions: number
  /** 401(k), 403(b), 457, TSP and SIMPLE deferrals (W-2 box 12 codes D, E, G, H, S, AA, BB, EE). */
  electiveDeferrals: number
  /** Retirement distributions received from 2023 through the 2025 return due date (Form 8880 line 4). */
  distributions: number
}

export interface PriorYear {
  /** Total 2024 tax (2024 Form 1040 line 22 + line 23 − refundable credits). null = not entered. */
  tax: number | null
  /** 2024 adjusted gross income (2024 Form 1040 line 11). */
  agi: number
  /** Had no tax liability for 2024 and was a U.S. citizen or resident all year (no penalty). */
  noLiability: boolean
}

export interface RefundDeposit {
  routingNumber: string
  accountNumber: string
  accountType: 'checking' | 'savings'
}

export interface Form1099R {
  id: string
  owner: Owner
  payer: string
  /** Box 1 */ grossDistribution: number
  /** Box 2a */ taxableAmount: number
  /** Box 4 */ federalWithholding: number
  /** Box 7 distribution code */ code: string
  /** IRA/SEP/SIMPLE box checked */ ira: boolean
}

export interface SocialSecurityBenefits {
  id: string
  owner: Owner
  /** SSA-1099 box 5 */ netBenefits: number
  /** SSA-1099 box 6 */ federalWithholding: number
}

export interface CareProvider {
  id: string
  name: string
  /** Number, street, city, state and ZIP on one line. */
  address: string
  /** SSN or EIN, digits only. */
  tin: string
  householdEmployee: boolean
  amountPaid: number
}

export interface Student {
  id: string
  name: string
  /** 9 digits. */
  ssn: string
  institution: string
  institutionAddress: string
  /** 9 digits. */
  institutionEin: string
  received1098T: boolean
  /** Tuition and required fees paid in 2025, less tax-free scholarships (Form 1098-T). */
  qualifiedExpenses: number
  /** First four years of college, at least half-time, no prior AOTC for four years. */
  aotcEligible: boolean
}

export interface W2 {
  id: string
  owner: Owner
  employer: string
  /** Box 1 */ wages: number
  /** Box 2 */ federalWithholding: number
  /** Box 3 */ socialSecurityWages: number
  /** Box 4 */ socialSecurityWithheld: number
  /** Box 5 */ medicareWages: number
  /** Box 6 */ medicareWithheld: number
}

export interface Form1099Int {
  id: string
  payer: string
  /** Box 1 + Box 3 */ interest: number
  /** Box 8 */ taxExemptInterest: number
  /** Box 4 */ federalWithholding: number
}

export interface Form1099Div {
  id: string
  payer: string
  /** Box 1a */ ordinaryDividends: number
  /** Box 1b */ qualifiedDividends: number
  /** Box 2a */ capitalGainDistributions: number
  /** Box 4 */ federalWithholding: number
}

export interface CapitalTransaction {
  id: string
  description: string
  term: 'short' | 'long'
  proceeds: number
  costBasis: number
}

export interface BusinessExpenses {
  advertising: number
  carAndTruck: number
  contractLabor: number
  insurance: number
  legalAndProfessional: number
  office: number
  rentOrLease: number
  supplies: number
  taxesAndLicenses: number
  travel: number
  meals: number
  utilities: number
  homeOffice: number
  other: number
}

export interface VehicleInfo {
  /** MM/DD/YYYY */
  placedInService: string
  businessMiles: number
  commutingMiles: number
  otherMiles: number
  availableOffDuty: boolean
  anotherVehicle: boolean
  hasEvidence: boolean
  evidenceWritten: boolean
}

export interface ScheduleCBusiness {
  id: string
  owner: Owner
  name: string
  activity: string
  /** 6-digit principal business code from the Schedule C instructions. */
  businessCode: string
  /** 9 digits; blank if none. */
  ein: string
  address: string
  cityStateZip: string
  accountingMethod: 'cash' | 'accrual'
  materiallyParticipated: boolean
  startedThisYear: boolean
  /** Payments that would require filing Forms 1099 (question I). null = not answered. */
  required1099s: boolean | null
  filed1099s: boolean
  /** Line 32: all investment at risk (used only when there is a loss). */
  allAtRisk: boolean
  vehicle: VehicleInfo
  grossReceipts: number
  returnsAndAllowances: number
  costOfGoodsSold: number
  otherIncome: number
  expenses: BusinessExpenses
}

export interface Adjustments {
  educatorExpenses: number
  hsaDeduction: number
  selfEmployedHealthInsurance: number
  iraDeduction: number
  studentLoanInterest: number
}

export interface Schedule1A {
  qualifiedTips: number
  qualifiedOvertime: number
  carLoanInterest: number
  /** Vehicle identification number for Schedule 1-A line 22. */
  vehicleVin: string
}

export interface ItemizedDeductions {
  medical: number
  stateLocalIncomeOrSalesTax: number
  realEstateTax: number
  personalPropertyTax: number
  mortgageInterest: number
  charityCash: number
  charityNonCash: number
  other: number
}

export type DeductionChoice = 'auto' | 'standard' | 'itemized'

export interface TaxReturnInput {
  version: 1
  filingStatus: FilingStatus
  taxpayer: Person
  spouse: Person
  canBeClaimedAsDependent: boolean
  contact: Contact
  /** Form 1040 digital-asset question. null = not answered. */
  digitalAssets: boolean | null
  /** Schedule B Part III: foreign financial account or foreign trust. */
  foreignAccounts: boolean
  refundDeposit: RefundDeposit
  /** Print the paid preparer block (from the app's preparer profile) on Form 1040. */
  usePaidPreparer: boolean
  /** Third party designee on Form 1040 page 2. */
  designee: { enabled: boolean; name: string; phone: string; pin: string }
  dependents: Dependent[]
  w2s: W2[]
  interest: Form1099Int[]
  dividends: Form1099Div[]
  capitalTransactions: CapitalTransaction[]
  capitalLossCarryover: { shortTerm: number; longTerm: number }
  businesses: ScheduleCBusiness[]
  retirement: Form1099R[]
  socialSecurity: SocialSecurityBenefits[]
  unemployment: number
  otherIncome: number
  adjustments: Adjustments
  schedule1A: Schedule1A
  itemized: ItemizedDeductions
  deductionChoice: DeductionChoice
  dependentCare: { expenses: number; employerBenefits: number; providers: CareProvider[] }
  students: Student[]
  savings: { taxpayer: RetirementSavings; spouse: RetirementSavings }
  priorYear: PriorYear
  /** estimatedByQuarter: payments made by 4/15/25, 6/15/25, 9/15/25 and 1/15/26. estimatedTaxPayments is their sum. */
  payments: { estimatedTaxPayments: number; estimatedByQuarter: [number, number, number, number]; otherWithholding: number }
}

let counter = 0
export const newId = (prefix: string): string => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`

export const emptyPerson = (): Person => ({ firstName: '', lastName: '', ssn: '', occupation: '', presidentialFund: false, fullTimeStudent: false, ipPin: '', age: 0, age65OrOlder: false, blind: false })

export const emptyExpenses = (): BusinessExpenses => ({
  advertising: 0, carAndTruck: 0, contractLabor: 0, insurance: 0, legalAndProfessional: 0, office: 0,
  rentOrLease: 0, supplies: 0, taxesAndLicenses: 0, travel: 0, meals: 0, utilities: 0, homeOffice: 0, other: 0
})

export const EXPENSE_LABELS: Record<keyof BusinessExpenses, string> = {
  advertising: 'Advertising',
  carAndTruck: 'Car and truck',
  contractLabor: 'Contract labor',
  insurance: 'Insurance',
  legalAndProfessional: 'Legal & professional',
  office: 'Office expense',
  rentOrLease: 'Rent or lease',
  supplies: 'Supplies',
  taxesAndLicenses: 'Taxes & licenses',
  travel: 'Travel',
  meals: 'Meals (deductible part)',
  utilities: 'Utilities',
  homeOffice: 'Home office',
  other: 'Other expenses'
}

export const emptyW2 = (owner: Owner = 'taxpayer'): W2 => ({
  id: newId('w2'), owner, employer: '', wages: 0, federalWithholding: 0,
  socialSecurityWages: 0, socialSecurityWithheld: 0, medicareWages: 0, medicareWithheld: 0
})
export const empty1099Int = (): Form1099Int => ({ id: newId('int'), payer: '', interest: 0, taxExemptInterest: 0, federalWithholding: 0 })
export const empty1099Div = (): Form1099Div => ({
  id: newId('div'), payer: '', ordinaryDividends: 0, qualifiedDividends: 0, capitalGainDistributions: 0, federalWithholding: 0
})
export const emptyTransaction = (): CapitalTransaction => ({ id: newId('cap'), description: '', term: 'long', proceeds: 0, costBasis: 0 })
export const emptyVehicle = (): VehicleInfo => ({
  placedInService: '', businessMiles: 0, commutingMiles: 0, otherMiles: 0,
  availableOffDuty: true, anotherVehicle: false, hasEvidence: true, evidenceWritten: true
})
export const emptyBusiness = (owner: Owner = 'taxpayer'): ScheduleCBusiness => ({
  id: newId('biz'), owner, name: '', activity: '', businessCode: '', ein: '', address: '', cityStateZip: '',
  accountingMethod: 'cash', materiallyParticipated: true, startedThisYear: false, required1099s: null, filed1099s: false,
  allAtRisk: true, vehicle: emptyVehicle(), grossReceipts: 0, returnsAndAllowances: 0,
  costOfGoodsSold: 0, otherIncome: 0, expenses: emptyExpenses()
})
export const emptyDependent = (): Dependent => ({
  id: newId('dep'), name: '', relationship: '', age: 0, hasSsn: true, monthsLivedWithYou: 12,
  student: false, disabled: false, childRelationship: true, ssn: ''
})
export const empty1099R = (owner: Owner = 'taxpayer'): Form1099R => ({
  id: newId('ret'), owner, payer: '', grossDistribution: 0, taxableAmount: 0, federalWithholding: 0, code: '7', ira: false
})
export const emptySocialSecurity = (owner: Owner = 'taxpayer'): SocialSecurityBenefits => ({ id: newId('ssa'), owner, netBenefits: 0, federalWithholding: 0 })
export const emptyStudent = (): Student => ({
  id: newId('stu'), name: '', ssn: '', institution: '', institutionAddress: '', institutionEin: '', received1098T: true,
  qualifiedExpenses: 0, aotcEligible: true
})
export const emptyProvider = (): CareProvider => ({ id: newId('care'), name: '', address: '', tin: '', householdEmployee: false, amountPaid: 0 })

export const emptySavings = (): RetirementSavings => ({ iraContributions: 0, electiveDeferrals: 0, distributions: 0 })

export const emptyReturn = (): TaxReturnInput => ({
  version: 1,
  filingStatus: 'single',
  taxpayer: emptyPerson(),
  spouse: emptyPerson(),
  canBeClaimedAsDependent: false,
  contact: { street: '', apt: '', city: '', state: '', zip: '', phone: '', email: '', livedInUsHalfYear: true },
  digitalAssets: null,
  foreignAccounts: false,
  refundDeposit: { routingNumber: '', accountNumber: '', accountType: 'checking' },
  usePaidPreparer: false,
  designee: { enabled: false, name: '', phone: '', pin: '' },
  dependents: [],
  w2s: [],
  interest: [],
  dividends: [],
  capitalTransactions: [],
  capitalLossCarryover: { shortTerm: 0, longTerm: 0 },
  businesses: [],
  retirement: [],
  socialSecurity: [],
  unemployment: 0,
  otherIncome: 0,
  adjustments: { educatorExpenses: 0, hsaDeduction: 0, selfEmployedHealthInsurance: 0, iraDeduction: 0, studentLoanInterest: 0 },
  schedule1A: { qualifiedTips: 0, qualifiedOvertime: 0, carLoanInterest: 0, vehicleVin: '' },
  itemized: {
    medical: 0, stateLocalIncomeOrSalesTax: 0, realEstateTax: 0, personalPropertyTax: 0,
    mortgageInterest: 0, charityCash: 0, charityNonCash: 0, other: 0
  },
  deductionChoice: 'auto',
  dependentCare: { expenses: 0, employerBenefits: 0, providers: [] },
  students: [],
  savings: { taxpayer: emptySavings(), spouse: emptySavings() },
  priorYear: { tax: null, agi: 0, noLiability: false },
  payments: { estimatedTaxPayments: 0, estimatedByQuarter: [0, 0, 0, 0], otherWithholding: 0 }
})

/** Merge stored/imported JSON over defaults so older or partial files still load. */
/** Older files stored only a yearly total of estimated payments; spread it over the four due dates. */
const normalizePayments = (p: Partial<TaxReturnInput['payments']> | undefined): TaxReturnInput['payments'] => {
  const other = p?.otherWithholding ?? 0
  const q = Array.isArray(p?.estimatedByQuarter) && p.estimatedByQuarter.length === 4
    ? (p.estimatedByQuarter.map((n) => Number(n) || 0) as [number, number, number, number])
    : null
  const total = p?.estimatedTaxPayments ?? 0
  if (q && q.some((n) => n > 0)) return { estimatedByQuarter: q, estimatedTaxPayments: q.reduce((a, b) => a + b, 0), otherWithholding: other }
  if (total > 0) {
    const each = Math.floor((total / 4) * 100) / 100
    const first = Math.round((total - each * 3) * 100) / 100
    return { estimatedByQuarter: [first, each, each, each], estimatedTaxPayments: total, otherWithholding: other }
  }
  return { estimatedByQuarter: [0, 0, 0, 0], estimatedTaxPayments: 0, otherWithholding: other }
}

const person = (p: Partial<Person> | undefined): Person => {
  const merged = { ...emptyPerson(), ...(p ?? {}) }
  if (!merged.age && merged.age65OrOlder) merged.age = 65
  return merged
}
/** Version 1 files stored only a "qualifying child" checkbox; map it to an age. */
const dependent = (d: Partial<Dependent> & { qualifyingChild?: boolean }): Dependent => {
  const { qualifyingChild, ...rest } = d
  const merged = { ...emptyDependent(), ...rest }
  if (!rest.age && qualifyingChild !== undefined) merged.age = qualifyingChild ? 10 : 17
  return merged
}

export function normalizeReturn(raw: unknown): TaxReturnInput {
  const base = emptyReturn()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Partial<TaxReturnInput>
  const arr = <T>(v: unknown, make: () => T): T[] =>
    Array.isArray(v) ? v.map((item) => ({ ...make(), ...(item as object) })) : []
  return {
    ...base,
    ...r,
    version: 1,
    taxpayer: person(r.taxpayer),
    spouse: person(r.spouse),
    dependents: Array.isArray(r.dependents) ? r.dependents.map(dependent) : [],
    retirement: arr(r.retirement, empty1099R),
    socialSecurity: arr(r.socialSecurity, emptySocialSecurity),
    students: arr(r.students, emptyStudent),
    dependentCare: { ...base.dependentCare, ...(r.dependentCare ?? {}), providers: arr(r.dependentCare?.providers, emptyProvider) },
    contact: { ...base.contact, ...(r.contact ?? {}) },
    refundDeposit: { ...base.refundDeposit, ...(r.refundDeposit ?? {}) },
    designee: { ...base.designee, ...(r.designee ?? {}) },
    digitalAssets: typeof r.digitalAssets === 'boolean' ? r.digitalAssets : null,
    w2s: arr(r.w2s, emptyW2),
    interest: arr(r.interest, empty1099Int),
    dividends: arr(r.dividends, empty1099Div),
    capitalTransactions: arr(r.capitalTransactions, emptyTransaction),
    capitalLossCarryover: { ...base.capitalLossCarryover, ...(r.capitalLossCarryover ?? {}) },
    businesses: Array.isArray(r.businesses)
      ? r.businesses.map((b) => ({ ...emptyBusiness(), ...b, expenses: { ...emptyExpenses(), ...(b?.expenses ?? {}) }, vehicle: { ...emptyVehicle(), ...(b?.vehicle ?? {}) } }))
      : [],
    adjustments: { ...base.adjustments, ...(r.adjustments ?? {}) },
    schedule1A: { ...base.schedule1A, ...(r.schedule1A ?? {}) },
    itemized: { ...base.itemized, ...(r.itemized ?? {}) },
    savings: { taxpayer: { ...emptySavings(), ...(r.savings?.taxpayer ?? {}) }, spouse: { ...emptySavings(), ...(r.savings?.spouse ?? {}) } },
    priorYear: { ...base.priorYear, ...(r.priorYear ?? {}) },
    payments: normalizePayments(r.payments)
  }
}
