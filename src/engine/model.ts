import type { FilingStatus } from './rules2025.ts'

export type Owner = 'taxpayer' | 'spouse'

export interface Person {
  firstName: string
  lastName: string
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

export interface Student {
  id: string
  name: string
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

export interface ScheduleCBusiness {
  id: string
  owner: Owner
  name: string
  activity: string
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
  dependentCare: { expenses: number; employerBenefits: number }
  students: Student[]
  payments: { estimatedTaxPayments: number; otherWithholding: number }
}

let counter = 0
export const newId = (prefix: string): string => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`

export const emptyPerson = (): Person => ({ firstName: '', lastName: '', age: 0, age65OrOlder: false, blind: false })

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
export const emptyBusiness = (owner: Owner = 'taxpayer'): ScheduleCBusiness => ({
  id: newId('biz'), owner, name: '', activity: '', grossReceipts: 0, returnsAndAllowances: 0,
  costOfGoodsSold: 0, otherIncome: 0, expenses: emptyExpenses()
})
export const emptyDependent = (): Dependent => ({
  id: newId('dep'), name: '', relationship: '', age: 0, hasSsn: true, monthsLivedWithYou: 12,
  student: false, disabled: false, childRelationship: true
})
export const empty1099R = (owner: Owner = 'taxpayer'): Form1099R => ({
  id: newId('ret'), owner, payer: '', grossDistribution: 0, taxableAmount: 0, federalWithholding: 0, code: '7', ira: false
})
export const emptySocialSecurity = (owner: Owner = 'taxpayer'): SocialSecurityBenefits => ({ id: newId('ssa'), owner, netBenefits: 0, federalWithholding: 0 })
export const emptyStudent = (): Student => ({ id: newId('stu'), name: '', qualifiedExpenses: 0, aotcEligible: true })

export const emptyReturn = (): TaxReturnInput => ({
  version: 1,
  filingStatus: 'single',
  taxpayer: emptyPerson(),
  spouse: emptyPerson(),
  canBeClaimedAsDependent: false,
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
  schedule1A: { qualifiedTips: 0, qualifiedOvertime: 0, carLoanInterest: 0 },
  itemized: {
    medical: 0, stateLocalIncomeOrSalesTax: 0, realEstateTax: 0, personalPropertyTax: 0,
    mortgageInterest: 0, charityCash: 0, charityNonCash: 0, other: 0
  },
  deductionChoice: 'auto',
  dependentCare: { expenses: 0, employerBenefits: 0 },
  students: [],
  payments: { estimatedTaxPayments: 0, otherWithholding: 0 }
})

/** Merge stored/imported JSON over defaults so older or partial files still load. */
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
    dependentCare: { ...base.dependentCare, ...(r.dependentCare ?? {}) },
    w2s: arr(r.w2s, emptyW2),
    interest: arr(r.interest, empty1099Int),
    dividends: arr(r.dividends, empty1099Div),
    capitalTransactions: arr(r.capitalTransactions, emptyTransaction),
    capitalLossCarryover: { ...base.capitalLossCarryover, ...(r.capitalLossCarryover ?? {}) },
    businesses: Array.isArray(r.businesses)
      ? r.businesses.map((b) => ({ ...emptyBusiness(), ...b, expenses: { ...emptyExpenses(), ...(b?.expenses ?? {}) } }))
      : [],
    adjustments: { ...base.adjustments, ...(r.adjustments ?? {}) },
    schedule1A: { ...base.schedule1A, ...(r.schedule1A ?? {}) },
    itemized: { ...base.itemized, ...(r.itemized ?? {}) },
    payments: { ...base.payments, ...(r.payments ?? {}) }
  }
}
