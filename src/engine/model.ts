import type { FilingStatus, TaxYear } from './rules.ts'
import { DEFAULT_TAX_YEAR, isTaxYear } from './rules.ts'

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
  /** Form 5329 line 2 exception number (01–22) for an early distribution, '' if none. */ earlyExceptionCode: string
  /** Part of the taxable amount the exception covers. */ earlyExceptionAmount: number
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
  /** Box 5: section 199A (qualified REIT) dividends, part of box 1a. */ section199ADividends: number
  /** Box 4 */ federalWithholding: number
}

/** How the sale was reported to you (Form 8949 box): covered = basis reported to the IRS. */
export type BasisReporting = 'covered' | 'noncovered' | 'none'

export interface CapitalTransaction {
  id: string
  description: string
  term: 'short' | 'long'
  /** MM/DD/YYYY, or VARIOUS / INHERITED. */ dateAcquired: string
  /** MM/DD/YYYY. */ dateSold: string
  proceeds: number
  costBasis: number
  reporting: BasisReporting
  /** Reported on Form 1099-DA (digital assets) rather than 1099-B. */ digitalAsset: boolean
  /** Form 8949 column (f), e.g. W for a wash sale, B for incorrect basis. */ adjustmentCode: string
  /** Form 8949 column (g); positive increases the gain (a disallowed wash-sale loss is positive). */ adjustment: number
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

export type HomeOfficeMethod = 'none' | 'simplified' | 'regular' | 'amount'

/** MACRS recovery class (GDS). */
export type PropertyClass = '3' | '5' | '7' | '10' | '15' | '20' | '27.5' | '39'

export const PROPERTY_CLASS_LABELS: Record<PropertyClass, string> = {
  '3': '3-year (tractor units, some tools)',
  '5': '5-year (computers, office machines, cars, appliances in a rental)',
  '7': '7-year (office furniture, fixtures, equipment)',
  '10': '10-year (vessels, single-purpose farm structures)',
  '15': '15-year (land improvements: fences, paving, landscaping)',
  '20': '20-year (farm buildings, municipal sewers)',
  '27.5': '27.5-year residential rental building',
  '39': '39-year nonresidential building or improvement'
}

/** One depreciable asset (Form 4562). */
export interface DepreciableAsset {
  id: string
  description: string
  /** MM/DD/YYYY */ placedInService: string
  cost: number
  /** Percent of business or investment use (0–100). */ businessPct: number
  propertyClass: PropertyClass
  /** Section 179 expense elected for 2025 (business assets placed in service in 2025). */ section179: number
  /** Special depreciation allowance: 'auto' = 100% (40% if acquired before January 20, 2025), '40' = elect 40%, 'none' = elect out. */
  bonus: 'auto' | '40' | 'none'
  /** Acquired (or under binding contract) before January 20, 2025: bonus is 40%. */ acquiredBeforeJan20: boolean
  /** For assets placed in service before 2025: bonus and section 179 claimed in earlier years. */ priorSpecial: number
  /** Use an amount you already figured instead of MACRS. */ manual: boolean
  manualAmount: number
  /** Listed property (Form 4562 Part V): 'auto' = car, truck or van of 6,000 lb or less (depreciation limits apply);
   *  'heavy' = SUV or truck over 6,000 lb (section 179 capped); 'other' = other listed property. */
  listed: 'none' | 'auto' | 'heavy' | 'other'
  /** Vehicle use in 2025 (Form 4562 lines 30–36). */
  vehicle: { businessMiles: number; commutingMiles: number; otherMiles: number; availableOffDuty: boolean; ownerUse: boolean; anotherVehicle: boolean; evidence: boolean; evidenceWritten: boolean }
}

/** Schedule K-1 from a partnership (Form 1065) or an S corporation (Form 1120-S). Box numbers are for the partnership K-1; S corporation boxes differ. */
export interface K1 {
  id: string
  owner: Owner
  kind: 'partnership' | 'scorp'
  entityName: string
  ein: string
  /** You materially participated (nonpassive). */ materialParticipation: boolean
  /** Your basis or amount at risk may be less than a loss (Form 7203 / 6198). */ basisLimited: boolean
  /** Box 1 */ ordinary: number
  /** Box 2 */ rentalRealEstate: number
  /** Box 3 */ otherRental: number
  /** Box 4c (partnership only) */ guaranteedPayments: number
  /** Box 5 (S corp box 4) */ interest: number
  /** Box 6a (S corp 5a) */ ordinaryDividends: number
  /** Box 6b (S corp 5b) */ qualifiedDividends: number
  /** Box 7 (S corp 6) */ royalties: number
  /** Box 8 (S corp 7) */ shortTermGain: number
  /** Box 9a (S corp 8a) */ longTermGain: number
  /** Box 10 (S corp 9) */ section1231: number
  /** Box 12 (S corp 11) */ section179: number
  /** Box 14 code A (partnership only) */ seEarnings: number
  /** Box 20 code Z (S corp box 17 code V): section 199A information. */
  qbi: { income: number; w2Wages: number; ubia: number; sstb: boolean }
  /** Passive loss from this activity disallowed in 2024. */ priorPassiveCarryover: number
  /** Passive rental real estate in which you actively participated (Form 8582 Part IV, $25,000 allowance). */ rentalActiveParticipation: boolean
}

/** Sale of business or rental property (Form 4797). */
export interface PropertySale {
  id: string
  description: string
  /** '1245' = equipment, vehicles, furniture; '1250' = buildings; 'land' = land or other property never depreciated. */
  kind: '1245' | '1250' | 'land'
  usedIn: 'business' | 'rental'
  /** MM/DD/YYYY */ dateAcquired: string
  /** MM/DD/YYYY */ dateSold: string
  salesPrice: number
  /** Cost or other basis plus improvements and expense of sale. */ costBasis: number
  /** Depreciation allowed or allowable, including section 179 and bonus. */ depreciation: number
  /** Reported to you on Form 1099-S or 1099-B (Form 4797 line 1a). */ reportedOn1099: boolean
}

export interface HomeOffice {
  method: HomeOfficeMethod
  /** Square feet used regularly and exclusively for business. */
  officeSqFt: number
  /** Total square feet of the home (regular method). */
  homeSqFt: number
  /** Regular method (Form 8829): whole-home amounts, before the business percentage. */
  mortgageInterest: number
  realEstateTaxes: number
  insurance: number
  utilities: number
  repairs: number
  rent: number
  other: number
  /** Business-use depreciation of the home, already figured (Form 8829 line 42). Used when homeBasis is 0. */
  depreciation: number
  /** Form 8829 line 37: smaller of the home's adjusted basis or its value when first used for business. */
  homeBasis: number
  /** Form 8829 line 38: land included in homeBasis. */
  landValue: number
  /** Date the home was first used for business (MM/DD/YYYY). */
  firstUsed: string
  /** 2024 Form 8829 line 43 (operating expenses carried over). */
  priorOperatingCarryover: number
  /** 2024 Form 8829 line 44 (excess casualty losses and depreciation carried over). */
  priorExcessCarryover: number
  /** Already-figured deduction when method is 'amount'. */
  amount: number
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
  homeOffice: HomeOffice
  /** Equipment and other property depreciated on Form 4562 (Schedule C line 13). */
  assets: DepreciableAsset[]
  /** Form 8995-A inputs, used only above the QBI threshold. */
  qbi: BusinessQbi
  grossReceipts: number
  returnsAndAllowances: number
  costOfGoodsSold: number
  otherIncome: number
  expenses: BusinessExpenses
}

export interface BusinessQbi {
  /** W-2 wages the business paid to employees in 2025. */ w2Wages: number
  /** Unadjusted basis immediately after acquisition of qualified property (UBIA). */ ubia: number
  /** Specified service trade or business: health, law, accounting, consulting, financial services, performing arts, athletics, and similar. */
  sstb: boolean
}

export type RentalType = 'single' | 'multi' | 'vacation' | 'commercial' | 'land' | 'royalties' | 'selfrental' | 'other'

export interface RentalExpenses {
  advertising: number
  auto: number
  cleaning: number
  commissions: number
  insurance: number
  legal: number
  management: number
  mortgageInterest: number
  otherInterest: number
  repairs: number
  supplies: number
  taxes: number
  utilities: number
  depreciation: number
  other: number
}

export interface RentalProperty {
  id: string
  owner: Owner
  address: string
  type: RentalType
  fairRentalDays: number
  personalUseDays: number
  /** Active participation (you make management decisions). Needed for the $25,000 loss allowance. */
  activeParticipation: boolean
  rents: number
  royalties: number
  expenses: RentalExpenses
  /** Buildings, improvements and appliances depreciated on Form 4562 (added to Schedule E line 18). */
  assets: DepreciableAsset[]
  /** Loss from this property not allowed in earlier years (2024 Form 8582). */
  priorUnallowed: number
}

export interface HsaAccount {
  /** HDHP coverage for 2025. 'none' = no HSA activity for this person. */
  coverage: 'none' | 'self' | 'family'
  /** Months of HDHP coverage in 2025 (1–12). */
  monthsCovered: number
  /** Your own contributions for 2025, not through payroll (Form 8889 line 2). */
  personalContributions: number
  /** Employer and payroll (cafeteria plan) contributions, W-2 box 12 code W (line 9). */
  employerContributions: number
  /** Total distributions, Form 1099-SA box 1 (line 14a). */
  distributions: number
  /** Distributions used for qualified medical expenses (line 15). */
  qualifiedExpenses: number
  /** Distribution not subject to the 20% additional tax (age 65+, disabled, or died). */
  exceptionApplies: boolean
  /** Excess contributions carried from 2024 (2024 Form 5329 line 48). */
  priorExcess: number
  /** 2025 excess (and its earnings) withdrawn by the due date of the return. */
  excessWithdrawn: boolean
  /** Value of the HSA on December 31, 2025, including 2025 contributions made in 2026. 0 = not entered. */
  yearEndValue: number
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

/** A what-if variant of the return (compared on the What if step; the return itself is not changed). */
export interface Scenario {
  id: string
  name: string
  filingStatus: FilingStatus | ''
  deductionChoice: DeductionChoice | ''
  /** Extra pre-tax 401(k)/403(b) deferral (lowers W-2 box 1). */ pretax401k: number
  /** Extra deductible traditional IRA contribution. */ ira: number
  /** Extra personal HSA contribution. */ hsa: number
  /** Extra cash donation (itemized). */ charity: number
  otherIncome: number
  /** Extra self-employment net income (Schedule C). */ selfEmployment: number
  longTermGain: number
  shortTermGain: number
  /** Extra estimated tax payment. */ extraPayments: number
}

/** One coded line on Virginia Schedule ADJ (additions 2b–2c, subtractions 6b–6d, deductions 8a–8c). */
export interface VaAdjEntry { id: string; code: string; amount: number; owner: Owner }

/** Virginia Form 760 (full-year resident) inputs that the federal return does not already hold. */
export interface VirginiaInput {
  /** Prepare a Virginia resident return (Form 760). */
  enabled: boolean
  /** Three-digit locality code of the city or county you lived in on January 1, 2026. */
  localityCode: string
  /** MM/DD/YYYY. Printed on Form 760 and used for the age deduction. */
  birthDate: Record<Owner, string>
  /** Virginia income tax withheld: W-2 box 17, 1099-R box 14, 1099-G, VK-1. */
  withholding: Record<Owner, number>
  /** 2025 Virginia estimated payments (Form 760ES), not counting the 2024 overpayment applied. Sum of estimatedByPeriod. */
  estimatedPayments: number
  /** Estimated payments made by May 1, June 15 and Sept. 15, 2025 and Jan. 15, 2026 (Form 760C line 10). */
  estimatedByPeriod: [number, number, number, number]
  /** 2024 Virginia overpayment applied to 2025 estimated tax. */
  priorOverpayment: number
  /** Paid with an extension (Form 760IP). */
  extensionPayments: number
  /** Schedule ADJ line 1: interest on other states' bonds that is tax-exempt federally. */
  otherStateBondInterest: number
  /** Schedule ADJ line 4: interest on U.S. obligations (Treasury bills, notes, bonds, savings bonds; 1099-INT box 3). */
  usObligationInterest: number
  /** Form 760 line 6: state income tax refund included in federal AGI (Schedule 1 line 1). */
  stateRefundInFagi: number
  /** Schedule ADJ line 5: disability income subtraction (instead of an age deduction), up to $20,000 each. */
  disability: Record<Owner, number>
  /** Schedule ADJ line 2a: conformity additions other than bonus depreciation (bonus is figured automatically). */
  otherConformityAddition: number
  /** Schedule ADJ line 6a: conformity subtractions (for example, depreciation on assets that got federal bonus in earlier years). */
  conformitySubtraction: number
  additions: VaAdjEntry[]
  subtractions: VaAdjEntry[]
  deductions: VaAdjEntry[]
  /** Commonwealth Savers (Virginia529) contributions in 2025, per account; deduction code 104 is figured from them. */
  savers: { id: string; owner: Owner; account: string; contributed: number; carryforward: number }[]
  /** Virginia itemized deductions from your own Virginia Schedule A line 19; null = estimate from the federal Schedule A. */
  itemizedOverride: number | null
  /** The state and local tax on federal Schedule A is general sales tax (not income tax). */
  salesTaxElected: boolean
  /** Family VAGI of dependents with income (Schedule ADJ line 10) for the Credit for Low-Income Individuals. */
  dependentsVagi: number
  /** Filing status 3: your spouse's federal AGI, used for the age deduction income test. */
  spouseFagiIfSeparate: number
  /** Spouse's share of Virginia AGI for the Spouse Tax Adjustment; null = split automatically. */
  spouseVagiOverride: number | null
  /** Line 24: credit for tax paid to another state (Schedule OSC line 21). */
  otherStateCredit: number
  /** Line 25: credits from Schedule CR, Section 5, Part 1, line 1A. */
  scheduleCrCredits: number
  /** Line 29: overpayment to apply to 2026 estimated tax. */
  creditForward: number
  /** Line 30: Commonwealth Savers and ABLE contributions from Schedule VAC Section I. */
  vacSavers: number
  /** Line 31: other voluntary contributions from Schedule VAC Section II. */
  vacOther: number
  /** Schedule ADJ line 18: addition to tax you figured yourself (Form 760F, or exceptions 2–4 of Form 760C). Used only when additionToTaxManual. */
  additionToTax: number
  /** Use additionToTax instead of the Form 760C the app figures. */
  additionToTaxManual: boolean
  /** Line 33: consumer's use tax on untaxed out-of-state purchases. */
  useTax: number
  /** Total 2024 Virginia tax after nonrefundable credits (for the 760C safe harbor). null = not entered. */
  priorYearTax: number | null
}

export interface MdCodedEntry { id: string; code: string; amount: number }

/** Maryland Form 502 (full-year resident) inputs that the federal return does not already hold. */
export interface MarylandInput {
  /** 4-digit political subdivision code (county 0100–2400, or a town in it). */
  subdivisionCode: string
  /** Name of the incorporated city or town, if any (blank = the county). */
  subdivisionName: string
  /** Maryland and local tax withheld (W-2 box 17, 1099 state boxes). */
  withholding: number
  /** 2025 estimated payments, 2024 overpayment applied and extension payment. */
  estimatedPayments: number
  stateRefundInFagi: number
  /** Line 2: other states' municipal bond interest. */
  otherStateBondInterest: number
  /** Line 3: State retirement pickup (W-2 box 14). */
  statePickup: number
  additions: MdCodedEntry[]
  /** Form 502SU line ab: interest on U.S. obligations. */
  usObligationInterest: number
  subtractions: MdCodedEntry[]
  /** Totally disabled (pension exclusion). */
  totallyDisabled: Record<Owner, boolean>
  deductionMethod: 'auto' | 'standard' | 'itemized'
  /** Gains excluded on Form 502CG (residence sold for $1.5 million or less, retirement accounts…). */
  capitalGainExclusions: number
  /** Dependent id → MM/DD/YYYY, for Form 502B. */
  dependentBirthDates: Record<string, string>
  /** Other nonrefundable credits from Form 502CR (line 24, besides the senior credit the app figures). */
  otherCredits: number
  /** Local credits from Form 502CR Part BB (line 31). */
  localCredits: number
  /** Refundable credits from Form 502CR Part CC (line 45, besides the child tax credit the app figures). */
  refundableCredits: number
  /** Lines 35–39: Chesapeake Bay, Developmental Disabilities, Cancer, Fair Campaign, Veterans Trust. */
  contributions: [number, number, number, number, number]
  /** Line 49: overpayment applied to 2026 estimated tax. */
  creditForward: number
}
export const emptyMdEntry = (code = ''): MdCodedEntry => ({ id: newId('mdx'), code, amount: 0 })
export const emptyMaryland = (): MarylandInput => ({
  subdivisionCode: '', subdivisionName: '', withholding: 0, estimatedPayments: 0, stateRefundInFagi: 0, otherStateBondInterest: 0, statePickup: 0,
  additions: [], usObligationInterest: 0, subtractions: [], totallyDisabled: { taxpayer: false, spouse: false }, deductionMethod: 'auto',
  capitalGainExclusions: 0, dependentBirthDates: {}, otherCredits: 0, localCredits: 0, refundableCredits: 0, contributions: [0, 0, 0, 0, 0], creditForward: 0
})
const normalizeMaryland = (m: Partial<MarylandInput> | undefined): MarylandInput => {
  const base = emptyMaryland()
  const entries = (x: unknown): MdCodedEntry[] => (Array.isArray(x) ? x.map((e) => ({ ...emptyMdEntry(), ...(e as object) })) : [])
  return {
    ...base, ...(m ?? {}),
    additions: entries(m?.additions), subtractions: entries(m?.subtractions),
    totallyDisabled: { ...base.totallyDisabled, ...(m?.totallyDisabled ?? {}) },
    dependentBirthDates: { ...(m?.dependentBirthDates ?? {}) },
    contributions: Array.isArray(m?.contributions) && m.contributions.length === 5 ? (m.contributions.map((n) => Number(n) || 0) as MarylandInput['contributions']) : base.contributions
  }
}

/** DC Form D-40 (full-year resident) inputs that the federal return does not already hold. */
export interface DcInput {
  /** MM/DD/YYYY, printed on the D-40. */
  birthDate: Record<Owner, string>
  /** DC income tax withheld (W-2 box 17, 1099 state boxes). */
  withholding: number
  /** 2025 estimated payments and 2024 overpayment applied. */
  estimatedPayments: number
  /** Paid with Form FR-127 (extension). */
  extensionPayments: number
  stateRefundInFagi: number
  /** Interest on other states' bonds, tax-exempt federally (now taxed by DC). */
  otherStateBondInterest: number
  otherAdditions: number
  /** Interest and dividends from U.S. Treasury and other U.S. obligations (Schedule I, B-1). */
  usObligationInterest: number
  /** DC College Savings Plan contributions (up to $4,000 per account owner). */
  collegeSavings: number
  /** DC and federal government survivor benefits (62 or older). */
  survivorBenefits: number
  otherSubtractions: number
  /** Everyone had qualifying health coverage all year (else Schedule HSR). */
  fullYearCoverage: boolean
  hsrPayment: number
  /** Schedule H: rent paid or property tax owned in DC for 2025. */
  housing: 'none' | 'rent' | 'own'
  housingAmount: number
  /** Schedule H: H house, A apartment, R rooming house, C condominium, O cooperative. */
  propertyType: 'H' | 'A' | 'R' | 'C' | 'O'
  /** Schedule H: DC property address if different from the home address. */
  propertyAddress: string
  /** Schedule H Section A (renters): landlord. */
  landlord: { name: string; street: string; apt: string; city: string; state: string; zip: string; phone: string }
  /** Schedule H Section B (owners): square, suffix and lot from the real property tax bill. */
  ssl: { square: string; suffix: string; lot: string }
  /** Dependent id → MM/DD/YYYY, for Schedule S. */
  dependentBirthDates: Record<string, string>
  /** Schedule U Part 1a non-refundable credits. */
  nonrefundableCredits: number
  /** Schedule U Part 1b refundable credits (for example, Keep Child Care Affordable, Schedule ELC). */
  refundableCredits: number
  creditForward: number
  contribution: number
}
export const emptyDc = (): DcInput => ({
  birthDate: { taxpayer: '', spouse: '' }, withholding: 0, estimatedPayments: 0, extensionPayments: 0, stateRefundInFagi: 0,
  otherStateBondInterest: 0, otherAdditions: 0, usObligationInterest: 0, collegeSavings: 0, survivorBenefits: 0, otherSubtractions: 0,
  fullYearCoverage: true, hsrPayment: 0, housing: 'none', housingAmount: 0, propertyType: 'A', propertyAddress: '',
  landlord: { name: '', street: '', apt: '', city: '', state: '', zip: '', phone: '' }, ssl: { square: '', suffix: '', lot: '' }, dependentBirthDates: {}, nonrefundableCredits: 0, refundableCredits: 0, creditForward: 0, contribution: 0
})

export interface CaInput {
  /** MM/DD/YYYY, printed on Form 540 (required for the California EITC). */
  birthDate: { taxpayer: string; spouse: string }
  /** County of principal residence at the time of filing. */
  county: string
  /** Line 12: W-2 box 16 state wages; null = use W-2 box 1. */
  stateWages: number | null
  withholding: number
  estimatedPayments: number
  /** Paid with an extension (FTB 3519); reported on line 72 with estimated payments. */
  extensionPayments: number
  /** Schedule CA subtractions not figured from the federal return. */
  stateRefundInFagi: number
  usObligationInterest: number
  otherSubtractions: number
  /** Schedule CA additions not figured from the federal return. */
  otherStateBondInterest: number
  otherAdditions: number
  /** Other Schedule CA Part II itemized adjustments (+ or −), for example job expenses over 2% of AGI. */
  itemizedAdjustment: number
  /** Married filing separately and the spouse itemizes (then you must itemize too). */
  spouseItemizes: boolean
  /** Paid rent at least half of 2025 on a California principal residence not exempt from property tax. */
  rentedHome: boolean
  /** You or your spouse claimed the homeowner’s property tax exemption in 2025. */
  homeownerExemption: boolean
  /** Child or dependent care was provided in California (FTB 3506). */
  careInCalifornia: boolean
  /** One special credit for line 43 (code, name, amount). */
  specialCredit: { code: string; name: string; amount: number }
  /** Line 63: other taxes and credit recapture (for example, FTB 3805P). */
  otherTaxes: number
  /** Married filing separately but separated from your spouse (FTB 3514 checkbox). */
  separatedSpouse: boolean
  fullYearCoverage: boolean
  /** Line 92: Individual Shared Responsibility Penalty from FTB 3853. */
  isrPenalty: number
  /** Line 91: use tax. */
  useTax: number
  /** Line 91 is 0 because the use tax was paid directly to CDTFA (otherwise "No use tax is owed"). */
  useTaxPaidDirectly: boolean
  creditForward: number
  /** One voluntary contribution (code 400–449). */
  contribution: { code: string; amount: number }
  /** Dependent id → MM/DD/YYYY, for FTB 3514. */
  dependentBirthDates: Record<string, string>
}
export const emptyCa = (): CaInput => ({
  birthDate: { taxpayer: '', spouse: '' }, county: '', stateWages: null, withholding: 0, estimatedPayments: 0, extensionPayments: 0,
  stateRefundInFagi: 0, usObligationInterest: 0, otherSubtractions: 0, otherStateBondInterest: 0, otherAdditions: 0, itemizedAdjustment: 0,
  spouseItemizes: false, rentedHome: false, homeownerExemption: false, careInCalifornia: true, specialCredit: { code: '', name: '', amount: 0 },
  otherTaxes: 0, separatedSpouse: false, fullYearCoverage: true, isrPenalty: 0, useTax: 0, useTaxPaidDirectly: false, creditForward: 0,
  contribution: { code: '', amount: 0 }, dependentBirthDates: {}
})

export interface NyInput {
  /** MM/DD/YYYY; printed on IT-201 as MMDDYYYY. */
  birthDate: { taxpayer: string; spouse: string }
  /** 'nyc' = New York City resident all year, 'yonkers' = Yonkers resident all year. */
  locality: 'none' | 'nyc' | 'yonkers'
  county: string
  schoolDistrict: string
  /** Three-digit school district code number from the IT-201 instructions. */
  schoolDistrictCode: string
  withholding: number
  nycWithholding: number
  yonkersWithholding: number
  /** Estimated payments and amount paid with Form IT-370. */
  estimatedPayments: number
  stateRefundInFagi: number
  /** Line 20: interest on other states' and their localities' bonds. */
  otherStateBondInterest: number
  /** Line 21: public employee 414(h) contributions (W-2 box 14). */
  pension414h: number
  /** Line 22: NY 529 distributions to add back. */
  nys529Distributions: number
  otherAdditions: number
  /** Line 26: NYS, local and federal government pensions, by owner. */
  govPensions: Record<Owner, number>
  /** Line 28: interest on U.S. government bonds. */
  usBondInterest: number
  /** Line 29: pension exclusion, null = figured from 1099-R income for people 60 or older. */
  pensionExclusionOverride: Record<Owner, number | null>
  /** Line 30: contributions to New York's 529 plan (up to $5,000 / $10,000) and taxable 529 earnings. */
  nys529Contributions: number
  nys529Earnings: number
  otherSubtractions: number
  /** Form IT-196: job expenses and other miscellaneous deductions (lines 21–24, before the 2% floor). */
  itemizedMiscellaneous: number
  residentCredit: number
  otherNonrefundableCredits: number
  otherTaxes: number
  nycNonrefundableCredits: number
  /** Form IT-216 line 23: care expenses paid for children under 4 (null = figured from the children's ages). */
  careExpensesUnder4: number | null
  realPropertyCredit: number
  collegeTuitionCredit: number
  otherRefundableCredits: number
  /** Line 59: use the sales and use tax chart; otherwise salesTax. */
  salesTaxChart: boolean
  salesTax: number
  contributions: number
  creditForward: number
  /** Dependent id → MM/DD/YYYY, for item H and IT-213. */
  dependentBirthDates: Record<string, string>
}
export const emptyNy = (): NyInput => ({
  birthDate: { taxpayer: '', spouse: '' }, locality: 'none', county: '', schoolDistrict: '', schoolDistrictCode: '',
  withholding: 0, nycWithholding: 0, yonkersWithholding: 0, estimatedPayments: 0, stateRefundInFagi: 0, otherStateBondInterest: 0,
  pension414h: 0, nys529Distributions: 0, otherAdditions: 0, govPensions: { taxpayer: 0, spouse: 0 }, usBondInterest: 0,
  pensionExclusionOverride: { taxpayer: null, spouse: null }, nys529Contributions: 0, nys529Earnings: 0, otherSubtractions: 0, itemizedMiscellaneous: 0,
  residentCredit: 0, otherNonrefundableCredits: 0, otherTaxes: 0, nycNonrefundableCredits: 0, careExpensesUnder4: null, realPropertyCredit: 0,
  collegeTuitionCredit: 0, otherRefundableCredits: 0, salesTaxChart: false, salesTax: 0, contributions: 0, creditForward: 0,
  dependentBirthDates: {}
})

export interface IlInput {
  /** MM/DD/YYYY. */
  birthDate: { taxpayer: string; spouse: string }
  county: string
  withholding: number
  /** IL-1040-ES and IL-505-I payments, including a prior-year overpayment applied. */
  estimatedPayments: number
  passThroughWithholding: number
  /** Illinois income tax refund included in federal income (line 6). */
  stateRefundInFagi: number
  /** Schedule M line 13: contributions to Bright Start, Bright Directions or College Illinois (up to $10,000 / $20,000). */
  collegeSavings: number
  /** Schedule M line 22: U.S. Treasury and agency interest. */
  usObligationInterest: number
  otherAdditions: number
  otherSubtractions: number
  /** Line 15: tax paid to another state (Schedule CR). */
  otherStateCredit: number
  /** Line 16: property tax and K-12 education expense credits (Schedule ICR). */
  icrCredit: number
  /** Line 17: Schedule 1299-C credits. */
  otherCredits: number
  /** Line 21: use the UT Table instead of useTax. */
  useTaxTable: boolean
  useTax: number
  donations: number
  creditForward: number
  /** Dependent id → MM/DD/YYYY, for Schedule IL-E/EITC. */
  dependentBirthDates: Record<string, string>
}
export const emptyIl = (): IlInput => ({
  birthDate: { taxpayer: '', spouse: '' }, county: '', withholding: 0, estimatedPayments: 0, passThroughWithholding: 0, stateRefundInFagi: 0,
  collegeSavings: 0, usObligationInterest: 0, otherAdditions: 0, otherSubtractions: 0, otherStateCredit: 0, icrCredit: 0, otherCredits: 0,
  useTaxTable: false, useTax: 0, donations: 0, creditForward: 0, dependentBirthDates: {}
})

export interface PaInput {
  schoolDistrict: string
  /** Five-digit school code from the PA-40 instructions. */
  schoolCode: string
  /** Line 1a: PA compensation (W-2 box 16); null = W-2 box 1 plus elective deferrals. */
  compensation: number | null
  /** Line 1b: unreimbursed employee business expenses (Schedule UE). */
  unreimbursedExpenses: number
  /** Federal-tax-exempt interest from other states' bonds (taxable in PA). */
  otherStateBondInterest: number
  /** Interest on U.S. obligations (not taxable in PA). */
  usObligationInterest: number
  /** Line 8: gambling and lottery winnings (PA Schedule T). */
  gamblingWinnings: number
  /** Schedule O: 529 plan contributions by owner (up to $19,000 per beneficiary each). */
  tuitionContributions: Record<Owner, number>
  withholding: number
  priorYearCredit: number
  estimatedPayments: number
  extensionPayment: number
  /** Line 22: resident credit for tax paid to other states (Schedule G-L). */
  residentCredit: number
  /** Line 23: other credits (Schedule OC). */
  otherCredits: number
  useTax: number
  /** Schedule SP Section III lines 2–10 not on the federal return (alimony, gifts, insurance proceeds, …). */
  otherEligibilityIncome: number
  /** Married filing separately: the spouse's eligibility income, for Tax Forgiveness. */
  spouseEligibilityIncome: number
  creditForward: number
}
export const emptyPa = (): PaInput => ({
  schoolDistrict: '', schoolCode: '', compensation: null, unreimbursedExpenses: 0, otherStateBondInterest: 0, usObligationInterest: 0,
  gamblingWinnings: 0, tuitionContributions: { taxpayer: 0, spouse: 0 }, withholding: 0, priorYearCredit: 0, estimatedPayments: 0,
  extensionPayment: 0, residentCredit: 0, otherCredits: 0, useTax: 0, otherEligibilityIncome: 0, spouseEligibilityIncome: 0, creditForward: 0
})

export interface NcInput {
  county: string
  withholding: Record<Owner, number>
  estimatedPayments: number
  /** Paid with an extension (Form D-410). */
  extensionPayment: number
  stateRefundInFagi: number
  otherStateBondInterest: number
  usObligationInterest: number
  /** Schedule S line 20: Bailey retirement benefits (N.C., local or federal government, vested by Aug 12, 1989). */
  baileyRetirement: number
  /** Schedule S line 21: uniformed services retirement. */
  militaryRetirement: number
  otherAdditions: number
  otherDeductions: number
  /** Married filing separately and the spouse itemizes (then the NC standard deduction is 0). */
  spouseItemizes: boolean
  /** Line 16: tax credits from Form D-400TC. */
  taxCredits: number
  useTax: number
  /** Certify that no consumer use tax is due (when useTax is 0). */
  noUseTaxDue: boolean
  creditForward: number
  contributions: number
}
export const emptyNc = (): NcInput => ({
  county: '', withholding: { taxpayer: 0, spouse: 0 }, estimatedPayments: 0, extensionPayment: 0, stateRefundInFagi: 0, otherStateBondInterest: 0,
  usObligationInterest: 0, baileyRetirement: 0, militaryRetirement: 0, otherAdditions: 0, otherDeductions: 0, spouseItemizes: false, taxCredits: 0,
  useTax: 0, noUseTaxDue: true, creditForward: 0, contributions: 0
})

/** State copy of a W-2 or 1099-R: the IDs and state amounts a withholding schedule asks for. */
export interface StateStatement {
  /** Employer or payer federal ID (W-2 box b, 1099-R payer's TIN). */
  ein: string
  /** Employer's or payer's state ID number (W-2 box 15, 1099-R box 15). */
  stateId: string
  /** State wages or distribution (W-2 box 16, 1099-R box 16); null = same as federal. */
  stateIncome: number | null
  /** State income tax withheld (W-2 box 17, 1099-R box 14). */
  stateTax: number
}
export const emptyStatement = (): StateStatement => ({ ein: '', stateId: '', stateIncome: null, stateTax: 0 })
const normalizeStatements = (x: Record<string, Partial<StateStatement>> | undefined): Record<string, StateStatement> =>
  Object.fromEntries(Object.entries(x ?? {}).map(([k, v]) => [k, { ...emptyStatement(), ...v }]))

export interface GaInput {
  /** Date of birth, MM/DD/YYYY (Form 500 line 1; needed for the retirement exclusion). */
  birthDate: Record<Owner, string>
  /** Permanently and totally disabled (retirement exclusion before age 62). */
  disabled: Record<Owner, boolean>
  /** Date of disability, MM/DD/YYYY. */
  disabilityDate: Record<Owner, string>
  /** Taxable military retirement in federal AGI, by owner (Schedule 1 line 7b/7e, under age 62). */
  militaryRetirement: Record<Owner, number>
  /** Georgia W-2 details by W-2 id (income statements and line 24). */
  w2: Record<string, StateStatement>
  /** Georgia tax withheld on 1099s (line 24, beyond W-2s). */
  withholding1099: number
  /** Line 25: Georgia tax withheld on G2-A, G2-FL, G2-LP or G2-RP. */
  otherWithholding: number
  estimatedPayments: number
  /** Line 7b: unborn dependents (with a detectable heartbeat). */
  unbornDependents: number
  otherStateBondInterest: number
  usObligationInterest: number
  /** Schedule 1 line 9: Path2College 529 contributions (up to $4,000 per beneficiary, $8,000 joint). */
  path2College: number
  otherAdditions: number
  otherSubtractions: number
  /** Married filing separately and the spouse itemizes (then Georgia itemizing is required). */
  spouseItemizes: boolean
  /** Line 12b: income taxes paid to other states and other itemized adjustments. */
  itemizedAdjustment: number
  /** Line 18: credit for tax paid to other states. */
  otherStateCredit: number
  /** IND-CR credits other than child and dependent care (lines 1, 3–12 of the summary). */
  otherIndCr: number
  /** Line 21: Schedule 2 credits (the return must then be e-filed). */
  schedule2Credits: number
  creditForward: number
  /** Lines 32–41: donations, by line number. */
  donations: Record<string, number>
  driversLicense: string
  driversLicenseState: string
  email: string
}
export const emptyGa = (): GaInput => ({
  birthDate: { taxpayer: '', spouse: '' }, disabled: { taxpayer: false, spouse: false }, disabilityDate: { taxpayer: '', spouse: '' },
  militaryRetirement: { taxpayer: 0, spouse: 0 }, w2: {}, withholding1099: 0, otherWithholding: 0, estimatedPayments: 0, unbornDependents: 0,
  otherStateBondInterest: 0, usObligationInterest: 0, path2College: 0, otherAdditions: 0, otherSubtractions: 0, spouseItemizes: false,
  itemizedAdjustment: 0, otherStateCredit: 0, otherIndCr: 0, schedule2Credits: 0, creditForward: 0, donations: {}, driversLicense: '',
  driversLicenseState: '', email: ''
})

export interface OhInput {
  /** Four-digit school district number. */
  schoolDistrict: string
  /** Ohio county (first four letters go on the form). */
  county: string
  /** Ohio W-2 details by W-2 id (Schedule of Ohio Withholding Part B). */
  w2: Record<string, StateStatement>
  /** Ohio 1099-R details by 1099-R id (Part C). */
  r1099: Record<string, StateStatement>
  /** Other Ohio withholding (W-2G, 1099-NEC, 1099-G). */
  otherWithholding: number
  /** Estimated and extension payments and the 2024 credit carryforward (line 15). */
  estimatedPayments: number
  otherStateBondInterest: number
  usObligationInterest: number
  stateRefundInFagi: number
  /** Schedule of Adjustments line 37: 529 plan contributions (up to $4,000 per beneficiary). */
  contributions529: number
  /** Line 34: uniformed services retirement income. */
  uniformedRetirement: number
  /** Lines 42–43: disability and survivor benefits. */
  disabilitySurvivor: number
  /** Line 44: unreimbursed medical and health care expenses (from the worksheet). */
  medicalExpenses: number
  /** Line 9: 168(k) and 179 depreciation add-back. */
  depreciationAddback: number
  otherAdditions: number
  otherDeductions: number
  /** Schedule of Business Income line 9: other business income or loss. */
  otherBusinessIncome: number
  /** Schedule of Credits line 39: resident credit for tax paid to other states (Ohio IT RC). */
  residentCredit: number
  /** Other nonrefundable credits (Schedule of Credits lines 14–35). */
  otherCredits: number
  useTax: number
  creditForward: number
  /** Line 25a–f donations, by letter. */
  donations: Record<string, number>
  dependentBirthDates: Record<string, string>
}
export const emptyOh = (): OhInput => ({
  schoolDistrict: '', county: '', w2: {}, r1099: {}, otherWithholding: 0, estimatedPayments: 0, otherStateBondInterest: 0, usObligationInterest: 0,
  stateRefundInFagi: 0, contributions529: 0, uniformedRetirement: 0, disabilitySurvivor: 0, medicalExpenses: 0, depreciationAddback: 0,
  otherAdditions: 0, otherDeductions: 0, otherBusinessIncome: 0, residentCredit: 0, otherCredits: 0, useTax: 0, creditForward: 0, donations: {},
  dependentBirthDates: {}
})

export interface NjInput {
  /** Four-digit county/municipality code (table in the NJ-1040 instructions). */
  municipalityCode: string
  /** New Jersey W-2 details by W-2 id (box 16 wages, box 17 tax). */
  w2: Record<string, StateStatement>
  /** NJ tax withheld on 1099s and W-2Gs. */
  otherWithholding: number
  /** Estimated payments, extension payment and 2024 credit (line 57). */
  estimatedPayments: number
  usObligationInterest: number
  otherStateBondInterest: number
  /** Line 20a override: taxable pensions, annuities and IRA withdrawals under NJ rules (null = federal taxable amount). */
  pensionTaxable: number | null
  /** Line 20b override: excludable part of pensions and IRA withdrawals (null = gross minus taxable). */
  pensionExcludable: number | null
  gamblingWinnings: number
  alimonyReceived: number
  otherIncome: number
  alimonyPaid: number
  /** Worksheet F line 1: unreimbursed medical expenses. */
  medicalExpenses: number
  /** Blind or disabled (Social Security guidelines) on December 31. */
  disabled: Record<Owner, boolean>
  /** Honorably discharged veteran ($6,000 exemption). */
  veteran: Record<Owner, boolean>
  /** Dependents under 22 attending college full time (line 12). */
  collegeDependents: number
  housing: 'none' | 'own' | 'rent' | 'both'
  /** Property taxes paid on the main home (your share). */
  propertyTax: number
  /** Rent paid for the main home (your share). */
  rentPaid: number
  /** Line 44: credit for income taxes paid to other jurisdictions (Schedule NJ-COJ). */
  otherJurisdictionCredit: number
  useTax: number
  creditForward: number
  /** Lines 70–74 donations, by line. */
  donations: Record<string, number>
  /** Someone in the household had no health coverage for part of 2025 (Schedule NJ-HCC). */
  missingCoverage: boolean
  /** $1 to the Gubernatorial Elections Fund. */
  electionFund: Record<Owner, boolean>
  dependentBirthYears: Record<string, string>
}
export const emptyNj = (): NjInput => ({
  municipalityCode: '', w2: {}, otherWithholding: 0, estimatedPayments: 0, usObligationInterest: 0, otherStateBondInterest: 0,
  pensionTaxable: null, pensionExcludable: null, gamblingWinnings: 0, alimonyReceived: 0, otherIncome: 0, alimonyPaid: 0, medicalExpenses: 0,
  disabled: { taxpayer: false, spouse: false }, veteran: { taxpayer: false, spouse: false }, collegeDependents: 0, housing: 'none',
  propertyTax: 0, rentPaid: 0, otherJurisdictionCredit: 0, useTax: 0, creditForward: 0, donations: {}, missingCoverage: false,
  electionFund: { taxpayer: false, spouse: false }, dependentBirthYears: {}
})

export interface MaInput {
  /** Massachusetts W-2 details by W-2 id (box 16 wages, box 17 tax). */
  w2: Record<string, StateStatement>
  /** Massachusetts tax withheld on 1099s (line 38b) and other forms (38c). */
  withholding1099: number
  otherWithholding: number
  /** 2024 overpayment applied (line 39). */
  priorOverpayment: number
  estimatedPayments: number
  extensionPayment: number
  /** Interest from deposits in Massachusetts banks (line 5). */
  maBankInterest: number
  usObligationInterest: number
  otherStateBondInterest: number
  /** Exempt contributory U.S. or Massachusetts government pensions included in federal taxable pensions. */
  governmentPension: number
  /** Schedule X line 2: IRA/Keogh contributions previously taxed by Massachusetts recovered this year. */
  iraBasisRecovered: number
  lotteryWinnings: number
  /** Rent paid for the principal residence in Massachusetts (line 14). */
  rentPaid: number
  /** Schedule Y line 15: MBTA, tolls and other commuter costs paid, by person. */
  commuter: Record<Owner, number>
  /** Schedule Y line 18a: Massachusetts 529 (U.Fund/U.Plan) contributions. */
  collegeSavings: number
  /** Other Schedule Y deductions. */
  otherDeductions: number
  /** Line 30: credit for tax due to another state. */
  otherStateCredit: number
  /** Line 31: other credits (Schedule CMS). */
  otherCredits: number
  /** Line 44: Senior Circuit Breaker Credit (Schedule CB). */
  circuitBreaker: number
  /** Dependents (or spouse) who are disabled or 65+ and qualify for the $440 credit beyond children under 13. */
  extraFamilyCredit: number
  useTax: number
  creditForward: number
  /** Line 33a–f donations, by letter. */
  donations: Record<string, number>
  /** Served in Operation Enduring Freedom, Iraqi Freedom, Noble Eagle or Sinai Peninsula. */
  veteran: Record<Owner, boolean>
  electionFund: Record<Owner, boolean>
  /** Dates of birth, MM/DD/YYYY (Schedule HC line 1). */
  birthDate: Record<Owner, string>
  /** Dependents' dates of birth by dependent id (Schedule DI). */
  dependentBirthDates: Record<string, string>
  /** Schedule HC: health coverage for 2025, by person. */
  health: Record<Owner, MaHealth>
  /** Schedule X line 1: taxable alimony received. */
  alimonyReceived: number
  /** Schedule X line 3: gambling winnings other than the Massachusetts lottery. */
  otherGambling: number
  /** Schedule X line 4: fees and other 5.0% income. */
  otherIncome: number
  /** Schedule Y line 2: penalty on early savings withdrawal. */
  earlyWithdrawalPenalty: number
  /** Schedule Y line 3: deductible alimony paid. */
  alimonyPaid: number
  /** Schedule Y line 12: undergraduate student loan interest (instead of line 10). */
  undergradLoanInterest: number
  /** Unused Massachusetts short-term losses from 2024 (2024 Schedule B line 40). */
  shortTermCarryover: number
  /** Unused Massachusetts long-term losses from 2024 (2024 Schedule D line 23). */
  longTermCarryover: number
}
/** Schedule HC coverage for one person. */
export interface MaHealth {
  /** Line 3: Minimum Creditable Coverage for the full year, part of the year, or none. */
  coverage: 'full' | 'part' | 'none'
  /** Line 4a–e: kinds of coverage. */
  plans: { private: boolean; masshealth: boolean; medicare: boolean; military: boolean; other: boolean }
  /** Line 4f/4g: insurer or program name and subscriber number (Form MA 1099-HC). */
  insurer: string
  subscriber: string
  /** Line 7: months with MCC coverage (January = 0), for part-year coverage. */
  months: boolean[]
}
export const emptyMaHealth = (): MaHealth => ({ coverage: 'full', plans: { private: true, masshealth: false, medicare: false, military: false, other: false }, insurer: '', subscriber: '', months: Array(12).fill(true) })
const normalizeMaHealth = (h: Partial<MaHealth> | undefined): MaHealth => {
  const e = emptyMaHealth()
  return { ...e, ...(h ?? {}), plans: { ...e.plans, ...(h?.plans ?? {}) }, months: Array.from({ length: 12 }, (_, i) => (Array.isArray(h?.months) ? h.months[i] !== false : true)) }
}
export const emptyMa = (): MaInput => ({
  w2: {}, withholding1099: 0, otherWithholding: 0, priorOverpayment: 0, estimatedPayments: 0, extensionPayment: 0, maBankInterest: 0,
  usObligationInterest: 0, otherStateBondInterest: 0, governmentPension: 0, iraBasisRecovered: 0, lotteryWinnings: 0, rentPaid: 0,
  commuter: { taxpayer: 0, spouse: 0 }, collegeSavings: 0, otherDeductions: 0, otherStateCredit: 0, otherCredits: 0, circuitBreaker: 0,
  extraFamilyCredit: 0, useTax: 0, creditForward: 0, donations: {}, veteran: { taxpayer: false, spouse: false }, electionFund: { taxpayer: false, spouse: false },
  birthDate: { taxpayer: '', spouse: '' }, dependentBirthDates: {}, health: { taxpayer: emptyMaHealth(), spouse: emptyMaHealth() },
  alimonyReceived: 0, otherGambling: 0, otherIncome: 0, earlyWithdrawalPenalty: 0, alimonyPaid: 0, undergradLoanInterest: 0, shortTermCarryover: 0, longTermCarryover: 0
})

export interface AzInput {
  /** Arizona W-2 details by W-2 id (line 53). */
  w2: Record<string, StateStatement>
  /** Arizona tax withheld on 1099-Rs and other 1099s. */
  withholding1099: number
  /** Line 54a: 2025 estimated payments (and 2024 overpayment applied). */
  estimatedPayments: number
  /** Line 55: extension payment (Form 204). */
  extensionPayment: number
  /** Line 15: interest on other states' municipal bonds. */
  otherStateBondInterest: number
  /** Line 28: interest on U.S. obligations. */
  usObligationInterest: number
  /** Line 29a: U.S., Arizona state or local government pension in federal AGI, by owner ($2,500 each). */
  governmentPension: Record<Owner, number>
  /** Line 29b: military retired or retainer pay in federal AGI, by owner. */
  militaryRetirement: Record<Owner, number>
  /** Line 32: pay for active service in the reserves, National Guard or armed forces. */
  activeMilitaryPay: number
  /** Line 23 worksheet: net long-term gain from assets acquired after 2011 (null = not entered). */
  ltcgAfter2011: number | null
  /** Line 34a/34b: 529 and ABLE contributions, and the number of beneficiaries. */
  contributions529: number
  contributionsAble: number
  beneficiaries: number
  /** Box 11a: qualifying parents and grandparents ($10,000 each). */
  qualifyingParents: number
  /** Box 40E: other exemptions ($2,300 each). */
  otherExemptions: number
  /** Page 5 and 6 totals. */
  otherAdditions: number
  otherSubtractions: number
  /** Line 43: adjustments that lower federal itemized deductions (Arizona Schedule A). */
  itemizedAdjustment: number
  /** Married filing separately and the spouse itemizes. */
  spouseItemizes: boolean
  /** Worksheet 5C: 2025 gifts for which an Arizona tax credit is claimed. */
  charityCreditGifts: number
  /** Worksheet 3C: charitable contribution carryover. */
  charityCarryover: number
  /** Line 51 (Form 301 credits) and line 58 (other refundable credits). */
  nonrefundableCredits: number
  refundableCredits: number
  /** Line 62: overpayment applied to 2026 estimated tax. */
  creditForward: number
  /** Lines 64–74 voluntary gifts, by line number. */
  donations: Record<string, number>
  politicalParty: '' | 'Democratic' | 'Libertarian' | 'Republican'
}
export const emptyAz = (): AzInput => ({
  w2: {}, withholding1099: 0, estimatedPayments: 0, extensionPayment: 0, otherStateBondInterest: 0, usObligationInterest: 0,
  governmentPension: { taxpayer: 0, spouse: 0 }, militaryRetirement: { taxpayer: 0, spouse: 0 }, activeMilitaryPay: 0, ltcgAfter2011: null,
  contributions529: 0, contributionsAble: 0, beneficiaries: 1, qualifyingParents: 0, otherExemptions: 0, otherAdditions: 0, otherSubtractions: 0,
  itemizedAdjustment: 0, spouseItemizes: false, charityCreditGifts: 0, charityCarryover: 0, nonrefundableCredits: 0, refundableCredits: 0,
  creditForward: 0, donations: {}, politicalParty: ''
})

export interface CoInput {
  /** Colorado W-2 details by W-2 id (line 24). */
  w2: Record<string, StateStatement>
  withholding1099: number
  /** Line 25: prior-year overpayment carried forward. */
  priorCarryforward: number
  /** Line 26: 2025 quarterly estimated payments. */
  estimatedPayments: number
  /** Line 27: extension payment (DR 0158-I). */
  extensionPayment: number
  /** The state and local tax on federal Schedule A is sales tax, not income tax (then no line 2 addback). */
  deductedSalesTax: boolean
  /** Line 9: interest on non-Colorado state and local bonds (also TABOR line 36). */
  otherStateBondInterest: number
  /** Line 9: other additions. */
  otherAdditions: number
  /** DR 0104AD line 1: state income tax refund in federal AGI (Schedule 1 line 1). */
  stateRefundInFagi: number
  /** DR 0104AD line 2. */
  usObligationInterest: number
  /** DR 0104AD lines 7/8: military retirement in federal taxable income, by owner (under 55). */
  militaryRetirement: Record<Owner, number>
  /** DR 0104AD lines 10/11: CollegeInvest and Colorado ABLE contributions, and beneficiaries. */
  collegeInvest: number
  coloradoAble: number
  beneficiaries: number
  /** DR 0104AD line 19: Colorado FAMLI benefits in federal income. */
  famliBenefits: number
  /** DR 0104AD line 20. */
  otherSubtractions: number
  /** DR 0104CR Part II: credit for tax paid to another state, and other credits. */
  otherStateCredit: number
  nonrefundableCredits: number
  refundableCredits: number
  /** Eligible for the TABOR sales tax refund (full-year resident, generally 18 or older on January 1, 2025). */
  tabor: boolean
  /** Line 41: overpayment carried to 2026. */
  creditForward: number
  /** Driver's license or state ID: state, last 4 characters, date of issue. */
  idState: Record<Owner, string>
  idLast4: Record<Owner, string>
  idIssued: Record<Owner, string>
  birthDate: Record<Owner, string>
}
export const emptyCo = (): CoInput => ({
  w2: {}, withholding1099: 0, priorCarryforward: 0, estimatedPayments: 0, extensionPayment: 0, deductedSalesTax: false, otherStateBondInterest: 0,
  otherAdditions: 0, stateRefundInFagi: 0, usObligationInterest: 0, militaryRetirement: { taxpayer: 0, spouse: 0 }, collegeInvest: 0, coloradoAble: 0, beneficiaries: 1,
  famliBenefits: 0, otherSubtractions: 0, otherStateCredit: 0, nonrefundableCredits: 0, refundableCredits: 0, tabor: true, creditForward: 0,
  idState: { taxpayer: '', spouse: '' }, idLast4: { taxpayer: '', spouse: '' }, idIssued: { taxpayer: '', spouse: '' }, birthDate: { taxpayer: '', spouse: '' }
})

export interface MnInput {
  /** Minnesota W-2 details by W-2 id (Schedule M1W, line 20). */
  w2: Record<string, StateStatement>
  withholding1099: number
  /** Line 21: 2025 estimated and extension payments. */
  estimatedPayments: number
  birthDate: Record<Owner, string>
  county: string
  /** State Elections Campaign Fund party codes (11, 12, 14, 16, 17, 18, 99). */
  campaignCode: Record<Owner, string>
  /** Schedule M1M line 1/2: other states’ bond interest and fund dividends. */
  otherStateBondInterest: number
  otherAdditions: number
  /** Line 6: state income tax refund in federal AGI. */
  stateRefundInFagi: number
  /** Schedule M1M line 14: interest on U.S. bonds. */
  usObligationInterest: number
  /** Line 13: K–12 education expenses for qualifying children. */
  k12Expenses: number
  /** Line 15 (Schedule M1529): contributions to a 529 plan. */
  contributions529: number
  /** Line 20: active-duty military pay. */
  activeMilitaryPay: number
  /** Line 25: military pension or retirement pay in federal AGI. */
  militaryPension: number
  otherSubtractions: number
  /** Schedule M1SA total when you itemize in Minnesota (null = estimate from federal Schedule A). */
  itemized: number | null
  /** Married filing separately and the spouse itemizes. */
  spouseItemizes: boolean
  /** Line 16 (Schedule M1C): marriage credit and other nonrefundable credits. */
  nonrefundableCredits: number
  /** Schedule M1REF lines 1, 3–13 (care credit, K–12 credit, renter’s credit…). */
  refundableCredits: number
  /** Line 18: Nongame Wildlife Fund. */
  nongame: number
  /** Line 30: refund applied to 2026 estimated tax. */
  creditForward: number
}
export const emptyMn = (): MnInput => ({
  w2: {}, withholding1099: 0, estimatedPayments: 0, birthDate: { taxpayer: '', spouse: '' }, county: '', campaignCode: { taxpayer: '', spouse: '' },
  otherStateBondInterest: 0, otherAdditions: 0, stateRefundInFagi: 0, usObligationInterest: 0, k12Expenses: 0, contributions529: 0, activeMilitaryPay: 0,
  militaryPension: 0, otherSubtractions: 0, itemized: null, spouseItemizes: false, nonrefundableCredits: 0, refundableCredits: 0, nongame: 0, creditForward: 0
})

export interface WiInput {
  /** Wisconsin W-2 details by W-2 id (line 28). */
  w2: Record<string, StateStatement>
  withholding1099: number
  /** Line 29: 2025 estimated payments and 2024 overpayment applied. */
  estimatedPayments: number
  /** Tax district: city, village or town, its name and county; 4-digit school district number. */
  districtType: '' | 'city' | 'village' | 'town'
  districtName: string
  county: string
  schoolDistrict: string
  /** Head of household while married (fill in the spouse’s name and SSN). */
  hohMarried: boolean
  /** Line 2 (Schedule I): adjustments for federal law Wisconsin has not adopted. */
  scheduleIAdjustment: number
  /** Schedule AD: other states’ bond interest and other additions. */
  otherStateBondInterest: number
  otherAdditions: number
  /** Schedule SB subtractions. */
  stateRefundInFagi: number
  usObligationInterest: number
  /** Retirement benefits Wisconsin exempts (military, certain federal, state and local plans) and the retirement income subtraction. */
  retirementSubtraction: number
  /** Edvest / Tomorrow’s Scholar and ABLE contributions (Schedule SB). */
  collegeSavings: number
  medicalInsurance: number
  privateSchoolTuition: number
  otherSubtractions: number
  /** Line 14 (Schedule WI-2441): additional child and dependent care credit. */
  additionalCareCredit: number
  /** Line 16: rent paid (heat included / not included) and property taxes on your home. */
  rentHeatIncluded: number
  rentHeatNotIncluded: number
  propertyTaxes: number
  /** Line 19 (Schedule CR) and line 20 (Schedule OS). */
  nonrefundableCredits: number
  otherStateCredit: number
  otherStateCode: string
  /** Line 23: use tax on untaxed out-of-state purchases. */
  useTax: number
  /** Line 33 homestead credit and line 35 Schedule CR refundable credits. */
  homesteadCredit: number
  refundableCredits: number
  /** Schedule 3 donations 1a–1h. */
  donations: Record<string, number>
  /** Line 42: overpayment applied to 2026 estimated tax. */
  creditForward: number
}
export const emptyWi = (): WiInput => ({
  w2: {}, withholding1099: 0, estimatedPayments: 0, districtType: '', districtName: '', county: '', schoolDistrict: '', hohMarried: false,
  scheduleIAdjustment: 0, otherStateBondInterest: 0, otherAdditions: 0, stateRefundInFagi: 0, usObligationInterest: 0, retirementSubtraction: 0,
  collegeSavings: 0, medicalInsurance: 0, privateSchoolTuition: 0, otherSubtractions: 0, additionalCareCredit: 0, rentHeatIncluded: 0,
  rentHeatNotIncluded: 0, propertyTaxes: 0, nonrefundableCredits: 0, otherStateCredit: 0, otherStateCode: '', useTax: 0, homesteadCredit: 0,
  refundableCredits: 0, donations: {}, creditForward: 0
})

export interface InInput {
  /** Indiana W-2 details by W-2 id: state tax withheld (box 17). */
  w2: Record<string, StateStatement>
  /** Indiana county tax withheld (W-2 box 19 and 1099s). */
  countyWithheld: number
  /** Indiana state tax withheld on 1099s. */
  withholding1099: number
  /** Schedule 5 line 4: 2025 estimated and extension payments. */
  estimatedPayments: number
  /** Two-digit county codes (Schedule CT-40) for where each person lived and worked on January 1, 2025. */
  countyLived: Record<Owner, string>
  countyWorked: Record<Owner, string>
  /** Schedule 2 line 1: rent paid on your Indiana home, months and landlord. */
  rentPaid: number
  monthsRented: number
  landlord: string
  /** Schedule 2 line 2: Indiana property tax on your home. */
  propertyTax: number
  monthsLivedHome: number
  /** Schedule 2 lines 3, 4, 7, 8. */
  stateRefundInFagi: number
  usObligationInterest: number
  activeMilitaryPay: number
  /** Number of dependent children in private school or homeschool ($1,000 each). */
  privateSchoolChildren: number
  otherDeductions: number
  /** Schedule 1: out-of-state municipal bond interest and other add-backs. */
  otherStateBondInterest: number
  otherAddBacks: number
  /** Schedule IN-DEP box F: dependent children claimed for the additional exemption for the first time. */
  firstTimeChildren: number
  /** Schedule 3 line 6: adopted children (Schedule IN-DEP-A). */
  adoptedChildren: number
  /** Schedule 4 line 1: use tax. */
  useTax: number
  /** Schedule 5 lines 7–11 and Schedule 6 credits. */
  refundableCredits: number
  otherStateCredit: number
  collegeCredit: number
  offsetCredits: number
  /** Schedule IN-DONATE. */
  donations: number
  /** Line 19c: overpayment applied to 2026 estimated tax. */
  creditForward: number
}
export const emptyIn = (): InInput => ({
  w2: {}, countyWithheld: 0, withholding1099: 0, estimatedPayments: 0, countyLived: { taxpayer: '', spouse: '' }, countyWorked: { taxpayer: '', spouse: '' },
  rentPaid: 0, monthsRented: 12, landlord: '', propertyTax: 0, monthsLivedHome: 12, stateRefundInFagi: 0, usObligationInterest: 0, activeMilitaryPay: 0,
  privateSchoolChildren: 0, otherDeductions: 0, otherStateBondInterest: 0, otherAddBacks: 0, firstTimeChildren: 0, adoptedChildren: 0, useTax: 0,
  refundableCredits: 0, otherStateCredit: 0, collegeCredit: 0, offsetCredits: 0, donations: 0, creditForward: 0
})

export interface ScInput {
  /** South Carolina W-2 details by W-2 id (line 16). */
  w2: Record<string, StateStatement>
  /** Line 20: other SC withholding (1099s). */
  withholding1099: number
  /** Lines 17 and 18: estimated payments and extension payment. */
  estimatedPayments: number
  extensionPayment: number
  /** County code from the SC1040 instructions, and dates of birth (MM/DD/YYYY). */
  countyCode: string
  birthDate: Record<Owner, string>
  /** Line d: interest on other states’ obligations; line e: other additions (the QBI deduction is added automatically). */
  otherStateBondInterest: number
  otherAdditions: number
  /** Line f: state tax refund in federal income. */
  stateRefundInFagi: number
  /** Line g: total and permanent disability retirement income. */
  disabilityRetirement: number
  /** Line k: contributions to Future Scholar or the SC Tuition Prepayment Program. */
  collegeSavings: number
  /** Line m: interest on U.S. government obligations. */
  usObligationInterest: number
  /** Lines p-4/p-5: military retirement income, by owner. */
  militaryRetirement: Record<Owner, number>
  /** Line s: workdays for the $16 subsistence allowance (police, firefighters, EMS). */
  subsistenceDays: number
  /** Line v: other subtractions. */
  otherSubtractions: number
  /** Line 13 (SC1040TC) other nonrefundable credits, line 21 tuition credit and line 22 other refundable credits. */
  nonrefundableCredits: number
  tuitionCredit: number
  refundableCredits: number
  /** Line 26 use tax, line 27 credit to 2026, line 28 check-off contributions (I-330). */
  useTax: number
  creditForward: number
  checkoffs: number
}
export const emptySc = (): ScInput => ({
  w2: {}, withholding1099: 0, estimatedPayments: 0, extensionPayment: 0, countyCode: '', birthDate: { taxpayer: '', spouse: '' }, otherStateBondInterest: 0,
  otherAdditions: 0, stateRefundInFagi: 0, disabilityRetirement: 0, collegeSavings: 0, usObligationInterest: 0, militaryRetirement: { taxpayer: 0, spouse: 0 },
  subsistenceDays: 0, otherSubtractions: 0, nonrefundableCredits: 0, tuitionCredit: 0, refundableCredits: 0, useTax: 0, creditForward: 0, checkoffs: 0
})

export type LaRetirementCode = '02E' | '03E' | '04E' | '05E'
export interface LaInput {
  /** Louisiana W-2 details by W-2 id (line 27). */
  w2: Record<string, StateStatement>
  /** Line 27: Louisiana tax withheld on 1099s; lines 28–30: 2024 credit carried forward, estimated and extension payments. */
  withholding1099: number
  priorYearCredit: number
  estimatedPayments: number
  extensionPayment: number
  /** Dates of birth (MM/DD/YYYY) for the return and each dependent (by dependent id). */
  birthDate: Record<Owner, string>
  dependentBirthDates: Record<string, string>
  /** Schedule E line 2A: interest and dividends on other states’ bonds. */
  otherStateBondInterest: number
  /** Schedule E 01E: interest and dividends on U.S. government obligations. */
  usObligationInterest: number
  /** Schedule E 02E–05E: exempt retirement benefits by code and owner; month and year retired (MMYYYY); 05E system name. */
  exemptRetirement: Record<LaRetirementCode, Record<Owner, number>>
  retired: Record<Owner, string>
  otherRetirementSystem: string
  /** Schedule E 09E START contributions, 10E military pay exclusion, 17E–19E school expense deductions. */
  startContributions: number
  militaryPay: number
  schoolTuition: number
  homeSchool: number
  publicSchool: number
  /** One more Schedule E exempt income line: code (two digits before E), description, amount. */
  otherExempt: { code: string; description: string; amount: number }
  /** Schedule C line 1A/1B: tax paid to other states (Form R-10606). */
  otherStateTax: number
  otherStateCredit: number
  /** Line 17 (Schedule F) and line 26 (Schedule I) totals. */
  otherRefundableCredits: number
  priority4Credits: number
  /** Schedule J line 3 (carryforward of the nonrefundable child care credit from 2020–2024) and one more priority 3 credit. */
  childCareCarryforward: number
  otherCredit: { code: string; description: string; amount: number }
  /** Line 23A consumer use tax, 23B electric/hybrid road usage fee (R-19000A), line 37 credit to 2026. */
  useTax: number
  roadUsageFee: number
  creditForward: number
}
export const emptyLa = (): LaInput => ({
  w2: {}, withholding1099: 0, priorYearCredit: 0, estimatedPayments: 0, extensionPayment: 0, birthDate: { taxpayer: '', spouse: '' }, dependentBirthDates: {},
  otherStateBondInterest: 0, usObligationInterest: 0,
  exemptRetirement: { '02E': { taxpayer: 0, spouse: 0 }, '03E': { taxpayer: 0, spouse: 0 }, '04E': { taxpayer: 0, spouse: 0 }, '05E': { taxpayer: 0, spouse: 0 } },
  retired: { taxpayer: '', spouse: '' }, otherRetirementSystem: '', startContributions: 0, militaryPay: 0, schoolTuition: 0, homeSchool: 0, publicSchool: 0,
  otherExempt: { code: '', description: '', amount: 0 }, otherStateTax: 0, otherStateCredit: 0, otherRefundableCredits: 0, priority4Credits: 0,
  childCareCarryforward: 0, otherCredit: { code: '', description: '', amount: 0 }, useTax: 0, roadUsageFee: 0, creditForward: 0
})

export interface AlRetirementInfo {
  /** Exempt from Alabama tax (defined benefit plan, Alabama or federal government, military, TVA, railroad). */
  exempt: boolean
  reason: string
  fein: string
  stateId: string
  stateTax: number
}
export interface AlDriverLicense { state: string; number: string; issued: string; expires: string }
export interface AlInput {
  /** Alabama W-2 details by W-2 id (Schedule W-2). */
  w2: Record<string, StateStatement>
  /** Schedule RS details by 1099-R id. */
  retirement: Record<string, AlRetirementInfo>
  /** Schedule B: U.S. obligation interest (exempt) and taxable out-of-state municipal interest, by 1099-INT id. */
  interest: Record<string, { usObligation: number; taxableMuni: number }>
  /** Schedule W-2 line 17: Alabama tax withheld on 1099s other than 1099-R and on W-2Gs. */
  withholdingOther: number
  /** Line 23: estimated and extension payments. */
  estimatedPayments: number
  birthDate: Record<Owner, string>
  license: Record<Owner, AlDriverLicense>
  /** Part II adjustments only Alabama allows (lines 8–11, 13–15). */
  collegeSavings: number
  smallEmployerHealth: number
  homeRetrofit: number
  catastropheSavings: number
  homeBuyerSavings: number
  firefighterInsurance: number
  ableContributions: number
  /** Schedule A line 11: date the new vehicle was bought (MM/DD/YYYY); the interest and VIN come from Schedule 1-A. */
  vehiclePurchaseDate: string
  /** Schedule OC nonrefundable credits (line 18) and refundable credits (line 25). */
  nonrefundableCredits: number
  refundableCredits: number
  /** Line 19 (Schedule ATP): consumer use tax. */
  useTax: number
  /** Line 33: amount applied to 2026 estimated tax. */
  creditForward: number
}
export const emptyAl = (): AlInput => ({
  w2: {}, retirement: {}, interest: {}, withholdingOther: 0, estimatedPayments: 0, birthDate: { taxpayer: '', spouse: '' },
  license: { taxpayer: { state: '', number: '', issued: '', expires: '' }, spouse: { state: '', number: '', issued: '', expires: '' } },
  collegeSavings: 0, smallEmployerHealth: 0, homeRetrofit: 0, catastropheSavings: 0, homeBuyerSavings: 0, firefighterInsurance: 0, ableContributions: 0,
  vehiclePurchaseDate: '', nonrefundableCredits: 0, refundableCredits: 0, useTax: 0, creditForward: 0
})

export interface OrInput {
  /** Oregon W-2 details by W-2 id (line 33). */
  w2: Record<string, StateStatement>
  /** Line 33: Oregon tax withheld on 1099s; line 34: 2024 refund applied; line 35: 2025 estimated and extension payments. */
  withholding1099: number
  priorYearRefundApplied: number
  estimatedPayments: number
  /** Dates of birth (MM/DD/YYYY) for the return and each dependent; dependent relationship codes (Table 3) and qualifying disability. */
  birthDate: Record<Owner, string>
  dependentBirthDates: Record<string, string>
  dependentCodes: Record<string, string>
  childDisability: Record<string, boolean>
  severeDisability: Record<Owner, boolean>
  /** Line 32: 2024 Oregon tax liability (2024 OR-40 line 24, less codes 802/815) and the election to donate the kicker. */
  kickerLiability2024: number
  donateKicker: boolean
  /** Line 26: political contributions. */
  politicalContributions: number
  /** Schedule OR-ASC: 158 other states’ bond interest; 315 U.S. bond interest; 307 federal pension subtraction. */
  otherStateBondInterest: number
  usObligationInterest: number
  federalPension: number
  otherAddition: { code: string; amount: number }
  otherSubtraction: { code: string; amount: number }
  /** Code 802: tax paid to another state (state abbreviation and credit). */
  otherStateCredit: { state: string; amount: number }
  /** Codes 896 / 897: Oregon College Savings Plan and ABLE contributions. */
  collegeSavings: number
  ableContributions: number
  /** Retirement income credit (811): household income, when it differs from the default (federal AGI without Social Security, plus tax-exempt interest). */
  householdIncome: number | null
  /** WFHDC (895): credit percentage from the WFHDC calculator or Publication OR-WFHDC-TB, as a decimal; provider relationship codes. */
  wfhdcPercent: number
  /** Line 48: refund applied to 2026 estimated tax. */
  creditForward: number
}
export const emptyOr = (): OrInput => ({
  w2: {}, withholding1099: 0, priorYearRefundApplied: 0, estimatedPayments: 0, birthDate: { taxpayer: '', spouse: '' }, dependentBirthDates: {}, dependentCodes: {},
  childDisability: {}, severeDisability: { taxpayer: false, spouse: false }, kickerLiability2024: 0, donateKicker: false, politicalContributions: 0,
  otherStateBondInterest: 0, usObligationInterest: 0, federalPension: 0, otherAddition: { code: '', amount: 0 }, otherSubtraction: { code: '', amount: 0 },
  otherStateCredit: { state: '', amount: 0 }, collegeSavings: 0, ableContributions: 0, householdIncome: null, wfhdcPercent: 0, creditForward: 0
})

export interface KyInput {
  /** Kentucky W-2 details by W-2 id (Schedule KW-2, line 31a). */
  w2: Record<string, StateStatement>
  /** Line 31a: Kentucky tax withheld on 1099s; line 31b: 2025 estimated and extension payments. */
  withholdingOther: number
  estimatedPayments: number
  /** Schedule M line 1: other states’ municipal bond interest; line 8: U.S. government interest; line 13: active duty military pay. */
  otherStateBondInterest: number
  usObligationInterest: number
  militaryPay: number
  /** Schedule M lines 5 and 14: other additions and subtractions. */
  otherAdditions: number
  otherSubtractions: number
  /** Schedule ITC Section B: Kentucky National Guard members. */
  nationalGuard: Record<Owner, boolean>
  /** Line 15: Schedule ITC Section A credits; line 23: education tuition credit (Form 8863-K). */
  itcCredits: number
  tuitionCredit: number
  /** Line 27: Kentucky use tax. Line 40: credit forward to 2026. */
  useTax: number
  creditForward: number
  /** Driver’s license or state ID numbers (page 3). */
  license: Record<Owner, string>
  /** Use a joint return (status 3) even when both spouses had income. */
  forceJoint: boolean
}
export const emptyKy = (): KyInput => ({
  w2: {}, withholdingOther: 0, estimatedPayments: 0, otherStateBondInterest: 0, usObligationInterest: 0, militaryPay: 0, otherAdditions: 0, otherSubtractions: 0,
  nationalGuard: { taxpayer: false, spouse: false }, itcCredits: 0, tuitionCredit: 0, useTax: 0, creditForward: 0, license: { taxpayer: '', spouse: '' }, forceJoint: false
})

export type OkRetirementKind = 'other' | 'okgov' | 'csrs' | 'military' | 'railroad'
export interface OkInput {
  /** Oklahoma W-2 details by W-2 id (line 21). */
  w2: Record<string, StateStatement>
  /** Line 21: Oklahoma tax withheld on 1099s; lines 22–23: estimated and extension payments. */
  withholding1099: number
  estimatedPayments: number
  extensionPayment: number
  /** County of residence (page 1) and dates of birth for each dependent (MM/DD/YYYY). */
  county: string
  dependentBirthDates: Record<string, string>
  /** Schedule 511-A: the kind of each 1099-R (by id), CSRS claim numbers, U.S. interest and other subtractions (with the type number). */
  retirementKind: Record<string, OkRetirementKind>
  csrsClaim: Record<Owner, string>
  usObligationInterest: number
  otherSubtraction: { code: string; amount: number }
  /** Schedule 511-B: other states’ bond interest and other additions (with the type number). */
  otherStateBondInterest: number
  otherAddition: { code: string; amount: number }
  /** Schedule 511-C: military pay exclusion, 529 contributions and other adjustments. */
  militaryPay: number
  collegeSavings: number
  otherAdjustment: { code: string; amount: number }
  /** Lines 16–17: credit for tax paid to another state (511-TX) and other credits (511-CR, with its line number). */
  otherStateCredit: number
  otherCredit: { code: string; amount: number }
  /** Line 19: use tax (null: none due, certified). Line 25: sales tax relief credit (Form 538-S). */
  useTax: number
  salesTaxCredit: number
  /** Line 35: refund applied to 2026 estimated tax. */
  creditForward: number
}
export const emptyOk = (): OkInput => ({
  w2: {}, withholding1099: 0, estimatedPayments: 0, extensionPayment: 0, county: '', dependentBirthDates: {}, retirementKind: {}, csrsClaim: { taxpayer: '', spouse: '' },
  usObligationInterest: 0, otherSubtraction: { code: '', amount: 0 }, otherStateBondInterest: 0, otherAddition: { code: '', amount: 0 }, militaryPay: 0, collegeSavings: 0,
  otherAdjustment: { code: '', amount: 0 }, otherStateCredit: 0, otherCredit: { code: '', amount: 0 }, useTax: 0, salesTaxCredit: 0, creditForward: 0
})

export type CtRetirementKind = 'standard' | 'military' | 'railroad' | 'ctrb' | 'roth'
export interface CtPropertyTax { town: string; description: string; datePaid: string; amount: number }
export interface CtInput {
  /** Connecticut W-2 details by W-2 id (withholding schedule, lines 18a–18e). */
  w2: Record<string, StateStatement>
  /** One 1099 with Connecticut tax withheld (payer FEIN, Connecticut income, tax). */
  other1099: { ein: string; income: number; tax: number }
  /** Line 19: estimated payments and prior-year overpayment applied; line 20: extension payment. */
  estimatedPayments: number
  extensionPayment: number
  /** City or town of residence if different from the mailing address. */
  townOfResidence: string
  /** Schedule 1: other states’ bond interest (31), U.S. interest (39), CHET contributions (48), ABLE (48d), other items. */
  otherStateBondInterest: number
  usObligationInterest: number
  chetContributions: number
  ableContributions: number
  otherAddition: { description: string; amount: number }
  otherSubtraction: { description: string; amount: number }
  /** Kind of each 1099-R (by id): standard (IRA or pension), military, railroad, Connecticut teachers’ retirement or Roth. */
  retirementKind: Record<string, CtRetirementKind>
  /** Schedule 3: property tax paid on the primary residence and motor vehicles. */
  residence: CtPropertyTax
  auto1: CtPropertyTax
  auto2: CtPropertyTax
  /** Line 7 (Schedule 2), line 13 (Schedule CT-IT Credit) and line 15 (use tax). */
  otherStateCredit: number
  itCredits: number
  useTax: number
  /** Line 23: overpayment applied to 2026 estimated tax. */
  creditForward: number
}
const emptyPropertyTax = (): CtPropertyTax => ({ town: '', description: '', datePaid: '', amount: 0 })
export const emptyCt = (): CtInput => ({
  w2: {}, other1099: { ein: '', income: 0, tax: 0 }, estimatedPayments: 0, extensionPayment: 0, townOfResidence: '', otherStateBondInterest: 0, usObligationInterest: 0,
  chetContributions: 0, ableContributions: 0, otherAddition: { description: '', amount: 0 }, otherSubtraction: { description: '', amount: 0 }, retirementKind: {},
  residence: emptyPropertyTax(), auto1: emptyPropertyTax(), auto2: emptyPropertyTax(), otherStateCredit: 0, itCredits: 0, useTax: 0, creditForward: 0
})

export interface UtInput {
  /** Utah W-2 details by W-2 id (TC-40W, line 33). */
  w2: Record<string, StateStatement>
  /** Line 33: Utah tax withheld on 1099s (TC-40W); line 34: 2025 prepayments and 2024 refund applied. */
  withholding1099: number
  prepayments: number
  /** Dates of birth (MM/DD/YYYY) — needed for the retirement credit (born on or before Dec. 31, 1952). */
  birthDate: Record<Owner, string>
  /** TC-40A Part 2 code 71: U.S. government obligation interest (and Utah municipal bond interest in federal AGI). */
  usObligationInterest: number
  /** TC-40A Part 1 code 57: non-Utah municipal bond interest. */
  otherStateBondInterest: number
  /** Kind of each 1099-R (by id): military retirement (credit code AJ) or railroad retirement (subtraction code 78). */
  retirementKind: Record<string, 'standard' | 'military' | 'railroad'>
  /** TC-40A Part 3 code 20: my529 credit (TC-675H box 1A or 1B). */
  my529Credit: number
  /** TC-40A Part 4: credit for income tax paid to another state (code 17) and one more nonapportionable credit. */
  otherStateCredit: number
  otherCredit: { code: string; amount: number }
  /** Line 31: Utah use tax. Line 43: voluntary subtractions from the refund (TC-40 page 3, Part 6) — not supported. */
  useTax: number
}
export const emptyUt = (): UtInput => ({
  w2: {}, withholding1099: 0, prepayments: 0, birthDate: { taxpayer: '', spouse: '' }, usObligationInterest: 0, otherStateBondInterest: 0, retirementKind: {},
  my529Credit: 0, otherStateCredit: 0, otherCredit: { code: '', amount: 0 }, useTax: 0
})

export type IaRetirementKind = 'standard' | 'military' | 'railroad' | 'nonqualified'
export interface IaInput {
  /** Iowa W-2 details by W-2 id (line 28). */
  w2: Record<string, StateStatement>
  /** Line 28: Iowa tax withheld on 1099s; line 29: 2025 estimated and other payments. */
  withholdingOther: number
  estimatedPayments: number
  /** Step 1: dates of birth (MM/DD/YYYY), county number and school district number (residence on 12/31/2025). */
  birthDate: Record<Owner, string>
  countyNo: string
  schoolDistrictNo: string
  /** Line 19: school district / EMS surtax rate in percent, from table 41-027. */
  surtaxRate: number
  /** Schedule 1 line 1: U.S. government interest (B) and other states’ municipal bond interest (A). */
  usObligationInterest: number
  otherStateBondInterest: number
  /** Kind of each 1099-R (by id): military retirement (line 4), railroad (line 7 at any age), nonqualified (not excluded). */
  retirementKind: Record<string, IaRetirementKind>
  /** Line 7: disabled (retirement income excluded before 55). */
  disabled: Record<Owner, boolean>
  /** Schedule 1 line 6: active duty military pay. */
  activeDutyPay: number
  /** Schedule 1 lines 14–16: Iowa 529 contributions, health insurance premiums (65+), Iowa capital gains deduction (IA 100). */
  iowa529: number
  healthInsurance: number
  capitalGainsDeduction: number
  /** Schedule 1 line 11 (other income, A or B) and line 19 (other adjustments, B), each with its code. */
  otherAddition: { code: string; amount: number }
  otherSubtraction: { code: string; amount: number }
  otherAdjustment: { code: string; amount: number }
  /** Line 9: K-12 tuition and textbooks by dependent id; line 24 ECDC: early childhood expenses by dependent id (age 3–5). */
  tuition: Record<string, number>
  earlyChildhood: Record<string, number>
  /** Line 10, 15, 17, 23, 26: other credits. */
  volunteerCredit: number
  outOfStateCredit: number
  otherNonrefundable: number
  fuelTaxCredit: number
  otherRefundable: number
  /** Line 21: contributions. */
  fishWildlife: number
  childAbuse: number
  /** Line 33: overpayment applied to 2026 estimated tax. */
  creditForward: number
  license: Record<Owner, string>
}
export const emptyIa = (): IaInput => ({
  w2: {}, withholdingOther: 0, estimatedPayments: 0, birthDate: { taxpayer: '', spouse: '' }, countyNo: '', schoolDistrictNo: '', surtaxRate: 0,
  usObligationInterest: 0, otherStateBondInterest: 0, retirementKind: {}, disabled: { taxpayer: false, spouse: false }, activeDutyPay: 0,
  iowa529: 0, healthInsurance: 0, capitalGainsDeduction: 0, otherAddition: { code: '', amount: 0 }, otherSubtraction: { code: '', amount: 0 }, otherAdjustment: { code: '', amount: 0 },
  tuition: {}, earlyChildhood: {}, volunteerCredit: 0, outOfStateCredit: 0, otherNonrefundable: 0, fuelTaxCredit: 0, otherRefundable: 0,
  fishWildlife: 0, childAbuse: 0, creditForward: 0, license: { taxpayer: '', spouse: '' }
})

export interface KsInput {
  /** Kansas W-2 details by W-2 id (line 19). */
  w2: Record<string, StateStatement>
  /** Line 19: Kansas tax withheld on 1099s; lines 20–21: estimated and extension payments. */
  withholdingOther: number
  estimatedPayments: number
  extensionPayment: number
  /** Header: school district number and county abbreviation (residence on Dec. 31). */
  schoolDistrict: string
  county: string
  /** Schedule S additions: A1 other states’ bond interest, A2 KPERS contributions (W-2 box 14), A8 other. */
  otherStateBondInterest: number
  kpersContributions: number
  otherAdditions: number
  /** Schedule S subtractions: A12 U.S. interest, A13 state refund in FAGI, A16 529, A21 ABLE, A25 other. */
  usObligationInterest: number
  stateRefundInFagi: number
  qtp529: number
  able: number
  otherSubtractions: number
  /** 1099-Rs exempt from Kansas tax (A14: KPERS, federal civil service, military, railroad retirement), by id. */
  exemptRetirement: Record<string, boolean>
  /** Disabled veteran personal exemptions (count, including yourself). */
  disabledVeterans: number
  /** Line 13 and 15: credit for taxes paid to other states, other credits. */
  otherStateCredit: number
  otherCredits: number
  /** Lines 35–42: voluntary contributions by line number. */
  contributions: Record<string, number>
  /** Line 34: credit forward to 2026. */
  creditForward: number
}
export const emptyKs = (): KsInput => ({
  w2: {}, withholdingOther: 0, estimatedPayments: 0, extensionPayment: 0, schoolDistrict: '', county: '', otherStateBondInterest: 0, kpersContributions: 0, otherAdditions: 0,
  usObligationInterest: 0, stateRefundInFagi: 0, qtp529: 0, able: 0, otherSubtractions: 0, exemptRetirement: {}, disabledVeterans: 0, otherStateCredit: 0, otherCredits: 0,
  contributions: {}, creditForward: 0
})

export type ArRetirementKind = 'standard' | 'military' | 'nonqualified'
export interface ArInput {
  /** Arkansas W-2 details by W-2 id (line 39A). */
  w2: Record<string, StateStatement>
  /** Line 39B: Arkansas tax withheld on 1099s and AR-K1s; lines 40–41: estimated and extension payments. */
  withholding1099: number
  estimatedPayments: number
  extensionPayment: number
  /** Line 9: U.S. military pay included in W-2 wages (exempt). */
  militaryPay: Record<Owner, number>
  /** Line 10: interest on U.S. obligations (exempt). */
  usObligationInterest: number
  /** Kind of each 1099-R (by id): employer pension / qualified IRA (line 18, $6,000 exemption), military (line 17, exempt), nonqualified (line 16). */
  retirementKind: Record<string, ArRetirementKind>
  /** Line 7A: deaf on Dec. 31, 2025. */
  deaf: Record<Owner, boolean>
  /** Line 22: other income / depreciation differences (AR-OI); line 24: Arkansas-only adjustments beyond the federal ones (AR1000ADJ). */
  otherIncome: number
  extraAdjustments: number
  /** Line 36: other credits (AR1000TC) besides the additional credit for qualified individuals. */
  otherCredits: number
  /** Lines 48–49: credit forward to 2026 and check-off contributions. */
  creditForward: number
  checkoff: number
}
export const emptyAr = (): ArInput => ({
  w2: {}, withholding1099: 0, estimatedPayments: 0, extensionPayment: 0, militaryPay: { taxpayer: 0, spouse: 0 }, usObligationInterest: 0, retirementKind: {},
  deaf: { taxpayer: false, spouse: false }, otherIncome: 0, extraAdjustments: 0, otherCredits: 0, creditForward: 0, checkoff: 0
})

export type NeRetirementKind = 'standard' | 'military' | 'railroad' | 'csrs'
export interface NeInput {
  /** Nebraska W-2 details by W-2 id (line 36). */
  w2: Record<string, StateStatement>
  /** Line 37: Nebraska tax withheld on 1099s and W-2Gs; line 40: estimated and extension payments. */
  withholdingOther: number
  estimatedPayments: number
  /** High school district code (residence on Dec. 31). */
  schoolDistrictCode: string
  /** Schedule I: line 1 other states’ municipal bond interest; line 14 state refund in FAGI; line 15 U.S. obligation interest. */
  otherStateBondInterest: number
  stateRefundInFagi: number
  usObligationInterest: number
  /** Kind of each 1099-R (by id): military (line 32), railroad (line 18), CSRS (line 38), all excluded. */
  retirementKind: Record<string, NeRetirementKind>
  /** Schedule I line 20: Nebraska Educational Savings Plan contributions; line 22: Enable plan contributions. */
  collegeSavings: number
  enable: number
  /** Line 19: credit for tax paid to another state (Schedule II). */
  otherStateCredit: number
  /** Line 58: use tax; line 61: applied to 2026; line 62: Wildlife Conservation Fund. */
  useTax: number
  creditForward: number
  wildlife: number
}
export const emptyNe = (): NeInput => ({
  w2: {}, withholdingOther: 0, estimatedPayments: 0, schoolDistrictCode: '', otherStateBondInterest: 0, stateRefundInFagi: 0, usObligationInterest: 0,
  retirementKind: {}, collegeSavings: 0, enable: 0, otherStateCredit: 0, useTax: 0, creditForward: 0, wildlife: 0
})

export interface MsInput {
  /** Mississippi W-2 details by W-2 id (Form 80-107; line 24). */
  w2: Record<string, StateStatement>
  /** Line 24: Mississippi tax withheld on 1099s; line 25: estimated and extension payments. */
  withholding1099: number
  estimatedPayments: number
  /** Two-digit county code (from the instructions). */
  countyCode: string
  /** 80-108 Part II: U.S. obligation interest (nontaxable); other states’ municipal bond interest (taxable in Mississippi). */
  usObligationInterest: number
  otherStateBondInterest: number
  /** Line 55: National Guard or Reserve pay (up to $15,000 each); lines 56–57: MPACT and MACS contributions; line 64: ABLE. */
  guardPay: Record<Owner, number>
  mpact: number
  macs: number
  able: number
  /** Line 18: credit for tax paid to another state (80-160); line 19: other credits (80-401); line 21: use tax. */
  otherStateCredit: number
  otherCredits: number
  useTax: number
  /** Line 32: applied to 2026; 80-108 Part III check-offs by fund. */
  creditForward: number
  contributions: Record<string, number>
}
export const emptyMs = (): MsInput => ({
  w2: {}, withholding1099: 0, estimatedPayments: 0, countyCode: '', usObligationInterest: 0, otherStateBondInterest: 0, guardPay: { taxpayer: 0, spouse: 0 },
  mpact: 0, macs: 0, able: 0, otherStateCredit: 0, otherCredits: 0, useTax: 0, creditForward: 0, contributions: {}
})

export type WvRetirementKind = 'standard' | 'military' | 'railroad' | 'police' | 'wvPublic' | 'federal'
export interface WvInput {
  /** West Virginia W-2 details by W-2 id (line 15). */
  w2: Record<string, StateStatement>
  /** Line 15: West Virginia tax withheld on 1099s; line 16: estimated and extension payments. */
  withholdingOther: number
  estimatedPayments: number
  /** Dates of birth (MM/DD/YYYY): dependents by id (exemption list) and you / your spouse (Schedule M line 47). */
  dependentBirthDate: Record<string, string>
  birthYear: Record<Owner, string>
  /** Schedule M line 47: permanently and totally disabled (certified by a physician). */
  disabled: Record<Owner, boolean>
  /** Kind of each 1099-R (by id): military (32), railroad (40), WV police / fire (31), WV teachers’ / PERS (33a), federal (33b). */
  retirementKind: Record<string, WvRetirementKind>
  /** Schedule M: line 29 U.S. obligation interest; line 38 state refund in FAGI; line 39 WV 529; line 43 ABLE; line 52 other states’ bond interest. */
  usObligationInterest: number
  stateRefundInFagi: number
  wv529: number
  able: number
  otherStateBondInterest: number
  /** RECAP line 1: credit for income tax paid to another state (Schedule E); other RECAP credits. */
  otherStateCredit: number
  otherCredits: number
  /** Line 21A: motor vehicle property tax adjustment credit (refundable); line 13: use tax. */
  motorVehicleCredit: number
  useTax: number
  /** Line 26 donations (A Children’s Trust Fund, B Veterans Assistance, C Veterans Cemetery); line 27: credit forward. */
  donations: Record<'A' | 'B' | 'C', number>
  creditForward: number
}
export const emptyWv = (): WvInput => ({
  w2: {}, withholdingOther: 0, estimatedPayments: 0, dependentBirthDate: {}, birthYear: { taxpayer: '', spouse: '' }, disabled: { taxpayer: false, spouse: false },
  retirementKind: {}, usObligationInterest: 0, stateRefundInFagi: 0, wv529: 0, able: 0, otherStateBondInterest: 0, otherStateCredit: 0, otherCredits: 0,
  motorVehicleCredit: 0, useTax: 0, donations: { A: 0, B: 0, C: 0 }, creditForward: 0
})

export type NmRetirementKind = 'standard' | 'military' | 'railroad'
export interface NmInput {
  /** New Mexico W-2 details by W-2 id (line 27). */
  w2: Record<string, StateStatement>
  /** Line 27: New Mexico tax withheld on 1099s; line 30: estimated payments. */
  withholdingOther: number
  estimatedPayments: number
  /** Dates of birth (MM/DD/CCYY): you / your spouse (1f, 2f) and dependents by id. */
  birthDate: Record<Owner, string>
  dependentBirthDate: Record<string, string>
  /** Kind of each 1099-R (by id): armed forces retirement (PIT-ADJ 24, up to $30,000 each) or railroad (PIT-ADJ 10). */
  retirementKind: Record<string, NmRetirementKind>
  /** PIT-ADJ: line 1 other states’ bond interest; line 9 U.S. obligation interest; line 15 NM 529; line 17 active duty pay; line 21 state refund in FAGI. */
  otherStateBondInterest: number
  usObligationInterest: number
  nm529: number
  activeDutyPay: number
  stateRefundInFagi: number
  /** PIT-ADJ 18 / PIT-RC 23: unreimbursed medical care expenses of $28,000 or more (65 or older). */
  bigMedical: boolean
  /** PIT-RC sections 3–4: property tax billed on your principal residence, rent paid (and whether a government entity paid part), county for section 4. */
  propertyTax: number
  rentPaid: number
  rentGovernmentPaid: boolean
  county: '' | 'LA' | 'SF' | 'DA' | 'BL'
  /** PIT-RC section 5: child day care worksheet by dependent id (days of care in New Mexico, amount paid per day); you work or attend school. */
  dayCare: Record<string, { days: number; rate: number }>
  /** PIT-RC line 24: special needs adopted child tax credit ($1,500 per certified child). */
  specialNeedsAdoptions: number
  /** Line 20 worksheet: the other state’s name, tax, taxable income and the income taxed by both states. */
  otherState: { name: string; tax: number; taxableIncome: number; doubleTaxed: number }
  /** PIT-CR: business-related credits (code, approval number, applied to tax due, refunded). */
  crCredits: { code: string; approval: string; applied: number; refund: number }[]
  /** Line 40 / PIT-D: voluntary contributions from the refund by PIT-D line (2–10, 12–17), and political party choices (line 11, $2 each: 1–6). */
  contributions: Record<string, number>
  party: Record<Owner, string>
  /** Line 41: applied to 2026 estimated tax. Driver’s license numbers (or NONE / DECLINED). */
  creditForward: number
  license: Record<Owner, string>
}
export const emptyNm = (): NmInput => ({
  w2: {}, withholdingOther: 0, estimatedPayments: 0, birthDate: { taxpayer: '', spouse: '' }, dependentBirthDate: {}, retirementKind: {},
  otherStateBondInterest: 0, usObligationInterest: 0, nm529: 0, activeDutyPay: 0, stateRefundInFagi: 0, bigMedical: false,
  propertyTax: 0, rentPaid: 0, rentGovernmentPaid: false, county: '', dayCare: {}, specialNeedsAdoptions: 0,
  otherState: { name: '', tax: 0, taxableIncome: 0, doubleTaxed: 0 }, crCredits: [], contributions: {}, party: { taxpayer: '', spouse: '' }, creditForward: 0, license: { taxpayer: '', spouse: '' }
})

export type HiRetirementKind = 'standard' | 'employer'
export interface HiInput {
  /** Hawaii W-2 details by W-2 id (line 37). */
  w2: Record<string, StateStatement>
  /** Line 37: Hawaii tax withheld on 1099-Gs and N-2s; lines 38–40: estimated payments, 2024 overpayment applied, extension payment. */
  withholdingOther: number
  estimatedPayments: number
  priorYearApplied: number
  extensionPayment: number
  /** Each 1099-R (by id): taxed in Hawaii, or a qualifying distribution from an employer-funded or government pension (line 13). */
  retirementKind: Record<string, HiRetirementKind>
  /** Line 8 COLA / ERS wage difference; line 9 out-of-state bond interest; line 10 other additions. */
  wageDifference: number
  otherStateBondInterest: number
  otherAdditions: number
  /** Line 15 military reserve / National Guard pay (up to $8,636); line 16 individual housing account; line 18 other subtractions (U.S. interest and others). */
  guardPay: number
  housingAccount: number
  usObligationInterest: number
  otherSubtractions: number
  /** Line 25: blind, deaf or totally disabled ($7,000 exemption, Form N-172). */
  disabled: Record<Owner, boolean>
  /** Schedule X Part I: rent paid for units fully subject to real property tax, and exclusions (utilities, parking, subsidies). */
  rentPaid: number
  rentExclusions: number
  /** Schedule X line 4: address of the rental unit (with apartment number). */
  rentalAddress: string
  /** Line 31: child passenger restraint systems bought ($25 each); line 32: other refundable credits (Schedule CR). */
  carSeats: number
  refundableCredits: number
  /** Line 35: nonrefundable credits (Schedule CR). */
  nonrefundableCredits: number
  /** Lines 43a–c contributions ($2 / $5 / $5 each) and the $3 election campaign fund. */
  schools: Record<Owner, boolean>
  libraries: Record<Owner, boolean>
  violence: Record<Owner, boolean>
  electionFund: Record<Owner, boolean>
  /** Line 46: applied to 2026 estimated tax. Occupations for the signature block. */
  creditForward: number
  occupation: Record<Owner, string>
}
export const emptyHi = (): HiInput => ({
  w2: {}, withholdingOther: 0, estimatedPayments: 0, priorYearApplied: 0, extensionPayment: 0, retirementKind: {}, wageDifference: 0, otherStateBondInterest: 0,
  otherAdditions: 0, guardPay: 0, housingAccount: 0, usObligationInterest: 0, otherSubtractions: 0, disabled: { taxpayer: false, spouse: false },
  rentPaid: 0, rentExclusions: 0, rentalAddress: '', carSeats: 0, refundableCredits: 0, nonrefundableCredits: 0,
  schools: { taxpayer: false, spouse: false }, libraries: { taxpayer: false, spouse: false }, violence: { taxpayer: false, spouse: false },
  electionFund: { taxpayer: false, spouse: false }, creditForward: 0, occupation: { taxpayer: '', spouse: '' }
})

/** Idaho Form 39R line 8e: which 1099-R benefits qualify for the retirement benefits deduction. */
export type IdRetirementKind = 'none' | 'military' | 'qualified'
export interface IdInput {
  /** Idaho withholding per W-2 (boxes 15–17). */
  w2: Record<string, StateStatement>
  withholdingOther: number
  /** Line 47: Form 51 estimated and extension payments plus the 2024 overpayment applied. */
  estimatedPayments: number
  /** Line 48: tax paid or withheld by a pass-through entity (Form ID K-1). */
  passThrough: number
  dependentBirthDates: Record<string, string>
  /** Form 39R Part B line 8: military retirement, or CSRS / Idaho firefighter / Idaho city police benefits. */
  retirementKind: Record<string, IdRetirementKind>
  /** Classified as disabled (for the retirement benefits deduction at 62 to 64). */
  disabled: Record<Owner, boolean>
  /** Form 39R Part A. */
  otherStateBondInterest: number
  otherAdditions: number
  /** Form 39R Part B. */
  stateRefund: number
  usObligationInterest: number
  healthPremiums: number
  longTermCarePremiums: number
  collegeSavings: number
  otherSubtractions: number
  /** Form 39R Part C: credit for tax paid to another state. */
  otherState: { name: string; income: number; tax: number }
  /** Form 39R Part D: credits for contributions to educational entities, youth facilities and live-organ donation. */
  partDCredits: number
  /** Form 39R Part E: family members age 65+ or developmentally disabled you kept a home for ($100 each, up to 3). */
  homeMembers: { name: string; ssn: string; relationship: string; birthDate: string; disabled: boolean }[]
  /** Line 28: use tax on untaxed purchases. */
  useTax: number
  /** Line 31: received Idaho public assistance (no $10 permanent building fund tax). */
  publicAssistance: boolean
  /** Line 42: approved Parental Choice Tax Credit expenses. */
  parentalChoice: number
  /** Line 43: donate the food tax credit to the Cooperative Welfare Fund. */
  donateFoodCredit: boolean
  /** Lines 33–40: donations. */
  donations: Record<string, number>
  creditForward: number
}

export const emptyId = (): IdInput => ({
  w2: {}, withholdingOther: 0, estimatedPayments: 0, passThrough: 0, dependentBirthDates: {}, retirementKind: {}, disabled: { taxpayer: false, spouse: false },
  otherStateBondInterest: 0, otherAdditions: 0, stateRefund: 0, usObligationInterest: 0, healthPremiums: 0, longTermCarePremiums: 0, collegeSavings: 0,
  otherSubtractions: 0, otherState: { name: '', income: 0, tax: 0 }, partDCredits: 0, homeMembers: [], useTax: 0, publicAssistance: false, parentalChoice: 0,
  donateFoodCredit: false, donations: {}, creditForward: 0
})

/** Maine Schedule 1S line 4: how a 1099-R counts for the pension income deduction. */
export type MePensionKind = 'eligible' | 'military' | 'none'
export interface MeInput {
  w2: Record<string, StateStatement>
  withholdingOther: number
  /** Line 25b: 2025 estimated tax, 2024 overpayment applied, extension and real estate withholding payments. */
  estimatedPayments: number
  pensionKind: Record<string, MePensionKind>
  /** Schedule 1A. */
  otherStateBondInterest: number
  mainePersContributions: number
  otherAdditions: number
  /** Schedule 1S. */
  usObligationInterest: number
  stateRefund: number
  mainePersPickup: number
  /** Line 8: 529 contributions and the number of beneficiaries ($1,000 each). */
  tuition529: number
  tuitionBeneficiaries: number
  maineBondInterest: number
  otherSubtractions: number
  /** Schedule A: part of child care expenses paid to a Star 5 (quality certificate) provider, credited at 50%. */
  star5Expenses: number
  otherRefundableCredits: number
  otherNonrefundableCredits: number
  otherJurisdiction: { name: string; income: number; tax: number }
  /** Schedule PTFC/STFC. */
  birthDates: Record<Owner, string>
  propertyTax: number
  rentPaid: number
  rentIncludesUtilities: boolean
  /** Known amount of heat / utilities / furniture in the rent; null = use 15%. */
  rentUtilities: number | null
  landlord: string
  propertyLocation: string
  veteranDisabled: boolean
  /** Lines 30–31. */
  useTax: number
  contributions: number
  cleanElection: Record<Owner, boolean>
  farmingFishing: boolean
  creditForward: number
  occupation: Record<Owner, string>
}

export const emptyMe = (): MeInput => ({
  w2: {}, withholdingOther: 0, estimatedPayments: 0, pensionKind: {}, otherStateBondInterest: 0, mainePersContributions: 0, otherAdditions: 0,
  usObligationInterest: 0, stateRefund: 0, mainePersPickup: 0, tuition529: 0, tuitionBeneficiaries: 0, maineBondInterest: 0, otherSubtractions: 0,
  star5Expenses: 0, otherRefundableCredits: 0, otherNonrefundableCredits: 0, otherJurisdiction: { name: '', income: 0, tax: 0 },
  birthDates: { taxpayer: '', spouse: '' }, propertyTax: 0, rentPaid: 0, rentIncludesUtilities: false, rentUtilities: null, landlord: '', propertyLocation: '',
  veteranDisabled: false, useTax: 0, contributions: 0, cleanElection: { taxpayer: false, spouse: false }, farmingFishing: false, creditForward: 0,
  occupation: { taxpayer: '', spouse: '' }
})

export interface MtInput {
  w2: Record<string, StateStatement>
  /** Line 11b: Montana tax withheld on 1099s; 11c / 11d: pass-through entity credit and K-1 withholding. */
  withholding1099: number
  passThroughCredit: number
  k1Withholding: number
  estimatedPayments: number
  priorYearApplied: number
  extensionPayment: number
  /** Schedule I additions. */
  otherStateBondInterest: number
  otherAdditions: number
  otherAdditionsCode: string
  /** Schedule I subtractions. */
  stateRefund: number
  usObligationInterest: number
  activeDutyPay: number
  workingMilitaryRetirement: number
  tuition529: number
  ableDeposits: number
  tier1Railroad: number
  tier2Railroad: number
  otherSubtractions: number
  otherSubtractionsCode: string
  /** Schedule III. */
  otherStateCredit: { state: string; amount: number }
  otherNonrefundableCredits: number
  refundableCredits: number
  /** Schedule 2EC: elderly homeowner/renter credit (62 or older). */
  elderly: { claim: boolean; householdSize: number; otherHouseholdIncome: number; governmentAssistance: number; propertyTaxBilled: number; rentPaid: number; physicalAddress: string }
  /** Schedule IV line 1a–1d. */
  contributions: Record<string, number>
  birthDates: Record<Owner, string>
  creditForward: number
}

export const emptyMt = (): MtInput => ({
  w2: {}, withholding1099: 0, passThroughCredit: 0, k1Withholding: 0, estimatedPayments: 0, priorYearApplied: 0, extensionPayment: 0,
  otherStateBondInterest: 0, otherAdditions: 0, otherAdditionsCode: '', stateRefund: 0, usObligationInterest: 0, activeDutyPay: 0, workingMilitaryRetirement: 0,
  tuition529: 0, ableDeposits: 0, tier1Railroad: 0, tier2Railroad: 0, otherSubtractions: 0, otherSubtractionsCode: '',
  otherStateCredit: { state: '', amount: 0 }, otherNonrefundableCredits: 0, refundableCredits: 0,
  elderly: { claim: false, householdSize: 1, otherHouseholdIncome: 0, governmentAssistance: 0, propertyTaxBilled: 0, rentPaid: 0, physicalAddress: '' },
  contributions: {}, birthDates: { taxpayer: '', spouse: '' }, creditForward: 0
})

export interface RiInput {
  w2: Record<string, StateStatement>
  /** Schedule W: Rhode Island tax withheld on 1099s (payer, federal ID, amount). */
  other1099: { payer: string; ein: string; code: string; owner: Owner; tax: number }[]
  estimatedPayments: number
  /** Dates of birth (Schedule M lines 1s / 1t, Schedule E, RI-1040H). */
  birthDates: Record<Owner, string>
  dependentBirthDates: Record<string, string>
  /** Schedule M decreasing modifications. */
  usObligationInterest: number
  railroadRetirement: number
  tuition529: number
  /** 1099-R ids that are pensions/annuities (line 1t) or military service pensions (line 1v). */
  pensionKind: Record<string, 'pension' | 'military' | 'none'>
  otherDecreasing: number
  /** Schedule M increasing modifications. */
  otherStateBondInterest: number
  otherIncreasing: number
  /** Schedule II: credit for tax paid to another state. */
  otherState: { state: string; income: number; tax: number }
  /** Schedule CR total (other Rhode Island credits). */
  otherCredits: number
  /** Line 12a: use tax; 12b: individual mandate penalty (0 with full-year coverage). */
  useTax: number
  fullYearCoverage: boolean
  mandatePenalty: number
  /** Checkoff contributions, lines 30–37. */
  checkoffs: Record<string, number>
  electoral: boolean
  electoralParty: string
  /** RI-1040H property tax relief. */
  relief: { claim: boolean; owner: boolean; propertyTax: number; rent: number; householdSize: number; dependentsUnder18: number; publicAssistance: number; otherNontaxable: number; disabled: boolean; landlord: string }
  driversLicense: Record<Owner, string>
  creditForward: number
}

export const emptyRi = (): RiInput => ({
  w2: {}, other1099: [], estimatedPayments: 0, birthDates: { taxpayer: '', spouse: '' }, dependentBirthDates: {}, usObligationInterest: 0, railroadRetirement: 0, tuition529: 0,
  pensionKind: {}, otherDecreasing: 0, otherStateBondInterest: 0, otherIncreasing: 0, otherState: { state: '', income: 0, tax: 0 }, otherCredits: 0, useTax: 0,
  fullYearCoverage: true, mandatePenalty: 0, checkoffs: {}, electoral: false, electoralParty: '',
  relief: { claim: false, owner: false, propertyTax: 0, rent: 0, householdSize: 1, dependentsUnder18: 0, publicAssistance: 0, otherNontaxable: 0, disabled: false, landlord: '' },
  driversLicense: { taxpayer: '', spouse: '' }, creditForward: 0
})

export interface DeInput {
  /** Delaware W-2 and 1099-R details by id (PIT-RSS Schedule IV, line 35). */
  w2: Record<string, StateStatement>
  r1099: Record<string, StateStatement>
  /** Joint federal return: 'auto' uses the cheaper of status 2 (joint) and status 4 (combined separate). */
  status: 'auto' | 'joint' | 'combined'
  /** Status 4: the spouse’s share of federal AGI (column A, line 1); null = worked out from who earned what. */
  spouseAgi: number | null
  deduction: 'auto' | 'standard' | 'itemized'
  /** Lines 2–3 additions and lines 5, 7 subtractions (split evenly on status 4). */
  otherStateBondInterest: number
  fiduciaryAdditions: number
  usObligationInterest: number
  otherSubtractions: number
  /** Line 6: the pension is a U.S. military pension (under 60: up to $12,500). */
  militaryPension: Record<Owner, boolean>
  /** Line 8a: Tier II railroad retirement in federal AGI; retirement distributions used for higher education. */
  railroadRetirement: Record<Owner, number>
  higherEducation: Record<Owner, number>
  /** Line 8b: deposits to Delaware 529 plans and ABLE accounts. */
  tuition529: Record<Owner, number>
  able: Record<Owner, number>
  /** Line 11: totally and permanently disabled. */
  disabled: Record<Owner, boolean>
  /** PIT-RSA line 5b: the federal state-and-local tax is general sales tax. */
  salesTax: boolean
  /** Lines 14–16 and 18. */
  foreignTaxes: number
  charityMiles: number
  unionDues: Record<Owner, number>
  landAdjustment: number
  /** Line 28 / Schedule I. */
  otherState: { state: string; owner: Owner; income: number; tax: number }
  /** Line 29: volunteer fire company number. */
  firefighter: Record<Owner, string>
  /** PIT-CRS amounts by line. */
  crs: Record<string, number>
  estimatedPayments: number
  /** Schedule V: S corporation payments. */
  sCorp: { fein: string; name: string; owner: Owner; amount: number }[]
  /** Line 39: REW-EST real estate payments. */
  realEstatePayments: number
  /** Schedule II: dates of birth of EITC children. */
  dependentBirthDates: Record<string, string>
  /** Schedule III: contributions by letter (A–U). */
  contributions: Record<string, number>
  creditForward: number
  dmvId: string
}

export const emptyDe = (): DeInput => ({
  w2: {}, r1099: {}, status: 'auto', spouseAgi: null, deduction: 'auto', otherStateBondInterest: 0, fiduciaryAdditions: 0, usObligationInterest: 0, otherSubtractions: 0,
  militaryPension: { taxpayer: false, spouse: false }, railroadRetirement: { taxpayer: 0, spouse: 0 }, higherEducation: { taxpayer: 0, spouse: 0 },
  tuition529: { taxpayer: 0, spouse: 0 }, able: { taxpayer: 0, spouse: 0 }, disabled: { taxpayer: false, spouse: false }, salesTax: false,
  foreignTaxes: 0, charityMiles: 0, unionDues: { taxpayer: 0, spouse: 0 }, landAdjustment: 0, otherState: { state: '', owner: 'taxpayer', income: 0, tax: 0 },
  firefighter: { taxpayer: '', spouse: '' }, crs: {}, estimatedPayments: 0, sCorp: [], realEstatePayments: 0, dependentBirthDates: {}, contributions: {}, creditForward: 0, dmvId: ''
})

export interface VtInput {
  /** Vermont W-2 and 1099-R details by id (line 26a). */
  w2: Record<string, StateStatement>
  r1099: Record<string, StateStatement>
  /** 3-digit school district code (required) and the 911 physical address on 12/31/2025 (blank = mailing address). */
  schoolCode: string
  physicalAddress: string
  /** Full-year minimum essential coverage (healthcare coverage code). */
  coverage: Record<Owner, boolean>
  birthDates: Record<Owner, string>
  /** IN-112 Part I. */
  vtObligationInterest: number
  bonusDepreciation: number
  usObligationInterest: number
  /** IN-153 Part II (percentage exclusion): used only when chosen. Gains held three years or less, and gains on homes,
   * depreciable personal property and publicly traded securities held longer (not eligible). */
  capitalGainsMethod: 'flat' | 'percentage'
  cg: { shortHeld: number; homes: number; personalProperty: number; publicSecurities: number }
  priorBonusDepreciation: number
  taxableRefunds: number
  medicalNonAllowable: number
  retirementChoice: 'auto' | 'ss' | 'pension'
  /** Pension from a public retirement system not covered by Social Security (CSRS, state systems). */
  publicPension: number
  militaryRetirement: number
  railroadRetirement: number
  bondInterest: number
  bondKind: '' | 'VSAC' | 'Build America' | 'VT Telecom' | 'VT Public'
  studentLoanInterest: number
  /** IN-113 Part II: exempt military pay and months on active duty. */
  militaryPay: number
  activeDutyMonths: number
  /** IN-117: credit for tax paid to another state or Canadian province. */
  otherState: { state: string; income: number; tax: number; bonusAdded: number; muniInterest: number; bonusSubtracted: number; usInterest: number }
  /** IN-119 Part I (adjustments) and Part II (credits by line: earned in 2025 and carryforward). */
  in119: {
    itcRecapture: number; lumpSumTax: number; vtRecapture: number; elderlyCredit: number; vtInvestmentCredit: number; farmAveraging: number; solarCarryforward: number
    higherEdContribution: number; entityName: string; entityFein: string; credits: Record<string, { earned: number; carry: number }>
  }
  /** Child care contribution worksheet line 2: self-employment earnings from work outside Vermont. */
  seOutsideVt: number
  useTax: { mode: 'none' | 'estimate' | 'amount'; amount: number }
  /** Lines 24a–24d. */
  contributions: Record<string, number>
  estimatedPayments: number
  realEstateWithholding: number
  /** Lines 28a / 28b. */
  creditForward: number
  propertyTaxCredit: number
  veteran: boolean
  /** RCC-146 renter credit claim. */
  renter: { claim: boolean; county: string; span: string; address: string; unit: string; town: string; sharedWithAdult: boolean; subsidized: boolean; subsidizedMonths: number; monthsRented: number; applyToTax: boolean }
  /** HS-122 and Schedule HI-144. */
  homestead: {
    file: boolean; claimCredit: boolean; span: string; location: string; town: string; businessUse: number; rentalUse: number; otherBuildings: boolean
    housesiteValue: number; educationTax: number; municipalTax: number; ownership: number
    publicAssistance: number; otherBenefits: number; workersComp: number; alimony: number; childSupportAndGifts: number; passThroughIncome: number; otherIncome: number
    childSupportPaid: number; alimonyPaid: number; otherPeopleIncome: number
  }
}

export const emptyVt = (): VtInput => ({
  w2: {}, r1099: {}, schoolCode: '', physicalAddress: '', coverage: { taxpayer: true, spouse: true }, birthDates: { taxpayer: '', spouse: '' },
  vtObligationInterest: 0, bonusDepreciation: 0, usObligationInterest: 0, capitalGainsMethod: 'flat', cg: { shortHeld: 0, homes: 0, personalProperty: 0, publicSecurities: 0 }, priorBonusDepreciation: 0, taxableRefunds: 0,
  medicalNonAllowable: 0, retirementChoice: 'auto', publicPension: 0, militaryRetirement: 0, railroadRetirement: 0, bondInterest: 0, bondKind: '', studentLoanInterest: 0,
  militaryPay: 0, activeDutyMonths: 0,
  otherState: { state: '', income: 0, tax: 0, bonusAdded: 0, muniInterest: 0, bonusSubtracted: 0, usInterest: 0 },
  in119: { itcRecapture: 0, lumpSumTax: 0, vtRecapture: 0, elderlyCredit: 0, vtInvestmentCredit: 0, farmAveraging: 0, solarCarryforward: 0, higherEdContribution: 0, entityName: '', entityFein: '', credits: {} },
  seOutsideVt: 0, useTax: { mode: 'none', amount: 0 }, contributions: {},
  estimatedPayments: 0, realEstateWithholding: 0, creditForward: 0, propertyTaxCredit: 0, veteran: false,
  renter: { claim: false, county: '', span: '', address: '', unit: '', town: '', sharedWithAdult: false, subsidized: false, subsidizedMonths: 0, monthsRented: 12, applyToTax: false },
  homestead: {
    file: false, claimCredit: false, span: '', location: '', town: '', businessUse: 0, rentalUse: 0, otherBuildings: false, housesiteValue: 0, educationTax: 0, municipalTax: 0, ownership: 100,
    publicAssistance: 0, otherBenefits: 0, workersComp: 0, alimony: 0, childSupportAndGifts: 0, passThroughIncome: 0, otherIncome: 0, childSupportPaid: 0, alimonyPaid: 0, otherPeopleIncome: 0
  }
})

export interface NdInput {
  /** North Dakota W-2 and 1099-R details by id (line 26), plus withholding on other 1099s / ND K-1s. */
  w2: Record<string, StateStatement>
  r1099: Record<string, StateStatement>
  otherWithholding: number
  /** Item B: 5-digit school district code; Item C: income source code (1–12). */
  schoolCode: string
  incomeSourceCode: string
  /** Line 2: planned gift / endowment credit adjustment. */
  plannedGift: number
  /** Schedule ND-1SA (lines 3 and 16 of ND-1). */
  sa: {
    lumpSum: number; sCorpLoss: number; renaissance: number; newBusiness: number; organDonor: number; workforce: number
    stillborn: number; stillbornCertificate: string; stillbornDate: string; collegeReimbursement: number; sCorpIncome: number
    ownsNdRealProperty: boolean; counties: string
  }
  usObligationInterest: number
  /** Capital gain worksheet line 6: part of the net long-term gain already in lines 7 or 16. */
  gainInOtherLines: number
  nativeAmerican: number
  /** Line 8: taxable Railroad Retirement Board benefits by owner; the part of Form 1040 line 6b that is Tier 1 RRB. */
  railroad: Record<Owner, number>
  rrbTier1InSs: number
  peaceOfficer: number
  militaryPay: number
  collegeSave: number
  militaryRetirement: number
  /** Schedule ND-1CR: the other state, income from there (line 1b), the part earned while a resident (1c) and its tax (6). */
  cr: { state: string; sourceIncome: number; residentIncome: number; tax: number }
  /** Schedule ND-1TC credit amounts by line, and the counts, wages and date asked for on lines 8b–c, 11b–c, 12a, 15c, 25b–c. */
  tc: Record<string, number>
  tcInfo: Record<string, string>
  estimatedPayments: number
  creditForward: number
  /** Veterans’ Postwar Trust Fund, Watchable Wildlife Fund, Trees for ND Trust Fund. */
  contributions: Record<string, number>
  consent1099g: boolean
}

export const emptyNd = (): NdInput => ({
  w2: {}, r1099: {}, otherWithholding: 0, schoolCode: '', incomeSourceCode: '', plannedGift: 0,
  sa: { lumpSum: 0, sCorpLoss: 0, renaissance: 0, newBusiness: 0, organDonor: 0, workforce: 0, stillborn: 0, stillbornCertificate: '', stillbornDate: '', collegeReimbursement: 0, sCorpIncome: 0, ownsNdRealProperty: false, counties: '' }, usObligationInterest: 0,
  gainInOtherLines: 0, nativeAmerican: 0, railroad: { taxpayer: 0, spouse: 0 }, rrbTier1InSs: 0, peaceOfficer: 0, militaryPay: 0, collegeSave: 0, militaryRetirement: 0,
  cr: { state: '', sourceIncome: 0, residentIncome: 0, tax: 0 }, tc: {}, tcInfo: {}, estimatedPayments: 0, creditForward: 0, contributions: {}, consent1099g: false
})

export interface MoInput {
  /** Missouri W-2 and 1099-R details by id (line 37). */
  w2: Record<string, StateStatement>
  r1099: Record<string, StateStatement>
  /** County of residence (as on the form’s list). */
  county: string
  /** Married filing combined: the spouse’s share of federal AGI (line 1S); null = worked out from who earned what. */
  spouseAgi: number | null
  disabled: Record<Owner, boolean>
  /** Taxable Social Security of a person under 62 that is disability (SSDI). */
  ssDisability: Record<Owner, boolean>
  /** MO-A Part 1 additions (lines 1, 2) and subtractions (8, 9, 10, 11 with railroad, 12, 13, 15). */
  muniInterest: Record<Owner, number>
  otherAdditions: Record<Owner, number>
  usInterest: Record<Owner, number>
  stateRefund: Record<Owner, number>
  militaryRetirement: Record<Owner, number>
  railroad: Record<Owner, number>
  otherSubtractions: Record<Owner, number>
  tuition529: Record<Owner, number>
  healthPremiums: Record<Owner, number>
  able: Record<Owner, number>
  /** MO-A Part 3 Section A: taxable public (government) pensions. */
  publicPension: Record<Owner, number>
  /** MO-A Part 2 line 10: city earnings taxes included in state and local income taxes. */
  earningsTax: number
  /** Lines 16–24. */
  ltcInsurance: number
  healthShare: number
  activeDuty: number
  inactiveDuty: number
  farmland: number
  foster: number
  /** MO-CR: credit for income tax paid to another state. */
  otherState: { state: string; owner: Owner; income: number; tax: number }
  otherTaxes: number
  estimatedPayments: number
  extensionPayment: number
  /** Line 42: MO-TC total. */
  miscCredits: number
  creditForward: number
  mostDeposit: number
  /** Line 51 trust funds by letter (a–l). */
  trustFunds: Record<string, number>
  /** MO-PTS / MO-CRP property tax credit (65+, 100% disabled, 60+ surviving spouse). */
  pts: {
    claim: boolean; qualification: 'A' | 'B' | 'C' | 'D'; owner: boolean; propertyTax: number; rent: number; rentPercent: number
    otherIncome: number; veteransBenefits: number; publicAssistance: number; nontaxableRrb: number
    rentalAddress: string; rentalApt: string; rentalCity: string; rentalZip: string; landlordName: string; landlordAddress: string; landlordCity: string; landlordState: string; landlordZip: string; landlordPhone: string
  }
  birthDates: Record<Owner, string>
}

export const emptyMo = (): MoInput => ({
  w2: {}, r1099: {}, county: '', spouseAgi: null, disabled: { taxpayer: false, spouse: false }, ssDisability: { taxpayer: false, spouse: false },
  muniInterest: { taxpayer: 0, spouse: 0 }, otherAdditions: { taxpayer: 0, spouse: 0 }, usInterest: { taxpayer: 0, spouse: 0 }, stateRefund: { taxpayer: 0, spouse: 0 },
  militaryRetirement: { taxpayer: 0, spouse: 0 }, railroad: { taxpayer: 0, spouse: 0 }, otherSubtractions: { taxpayer: 0, spouse: 0 }, tuition529: { taxpayer: 0, spouse: 0 },
  healthPremiums: { taxpayer: 0, spouse: 0 }, able: { taxpayer: 0, spouse: 0 }, publicPension: { taxpayer: 0, spouse: 0 }, earningsTax: 0,
  ltcInsurance: 0, healthShare: 0, activeDuty: 0, inactiveDuty: 0, farmland: 0, foster: 0, otherState: { state: '', owner: 'taxpayer', income: 0, tax: 0 },
  otherTaxes: 0, estimatedPayments: 0, extensionPayment: 0, miscCredits: 0, creditForward: 0, mostDeposit: 0, trustFunds: {},
  pts: {
    claim: false, qualification: 'A', owner: false, propertyTax: 0, rent: 0, rentPercent: 100, otherIncome: 0, veteransBenefits: 0, publicAssistance: 0, nontaxableRrb: 0,
    rentalAddress: '', rentalApt: '', rentalCity: '', rentalZip: '', landlordName: '', landlordAddress: '', landlordCity: '', landlordState: '', landlordZip: '', landlordPhone: ''
  },
  birthDates: { taxpayer: '', spouse: '' }
})

export interface MiInput {
  /** Five-digit school district code from the MI-1040 instructions. */
  schoolDistrictCode: string
  withholding: number
  /** Estimated tax, extension payments and 2024 credit forward. */
  estimatedPayments: number
  stateRefundInFagi: number
  otherStateBondInterest: number
  usObligationInterest: number
  /** Schedule 1 line 11: military or railroad retirement included in AGI. */
  militaryRetirement: number
  /** Retirement/pension benefits from public (government) employment included in AGI, by owner. */
  publicPensions: Record<Owner, number>
  /** Year of birth, for the retirement subtraction (Schedule 1 line 24). */
  birthYear: Record<Owner, number>
  /** Line 9b: special exemptions (deaf, blind, paraplegic, totally and permanently disabled), count. */
  specialExemptions: number
  /** Line 9c: qualified disabled veterans, count. */
  disabledVeterans: number
  otherAdditions: number
  otherSubtractions: number
  /** Line 18: tax imposed by government units outside Michigan (credit). */
  otherStateCredit: number
  useTax: number
  contributions: number
  creditForward: number
  /** MI-1040CR: homestead. */
  housing: 'none' | 'own' | 'rent'
  /** 2025 property taxes levied on the homestead (owners). */
  propertyTax: number
  /** 2025 taxable value of the homestead (owners; over $165,400 is not eligible). */
  taxableValue: number
  /** Rent paid for the homestead in 2025 (renters). */
  rentPaid: number
  /** Medical insurance/HMO premiums paid (reduces total household resources). */
  medicalPremiums: number
  /** Other household resources not on the federal return (child support, gifts, nontaxable income, FIP). */
  otherHouseholdResources: number
}
export const emptyMi = (): MiInput => ({
  schoolDistrictCode: '', withholding: 0, estimatedPayments: 0, stateRefundInFagi: 0, otherStateBondInterest: 0, usObligationInterest: 0,
  militaryRetirement: 0, publicPensions: { taxpayer: 0, spouse: 0 }, birthYear: { taxpayer: 0, spouse: 0 }, specialExemptions: 0, disabledVeterans: 0,
  otherAdditions: 0, otherSubtractions: 0, otherStateCredit: 0, useTax: 0, contributions: 0, creditForward: 0,
  housing: 'none', propertyTax: 0, taxableValue: 0, rentPaid: 0, medicalPremiums: 0, otherHouseholdResources: 0
})

export interface StateGenericInput {
  /** State income tax withheld: W-2 box 17, 1099 state boxes. */
  withholding: number
  /** 2025 state estimated payments, including a 2024 overpayment applied. */
  estimatedPayments: number
  /** Local income tax rate in percent (county or city), applied to state taxable income. */
  localRate: number
  /** Net state additions (+) and subtractions (−) you know of. */
  adjustments: number
  /** State credits you know of (against tax). */
  otherCredits: number
}
export const emptyStateGeneric = (): StateGenericInput => ({ withholding: 0, estimatedPayments: 0, localRate: 0, adjustments: 0, otherCredits: 0 })

export interface TaxReturnInput {
  version: 1
  /** The tax year this return is for (2025 return filed in 2026, 2026 return filed in 2027, ...). */
  taxYear: TaxYear
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
  rentals: RentalProperty[]
  /** Schedule E lines A–B: payments that would require Forms 1099. null = not answered. */
  rentalForms1099: { required: boolean | null; filed: boolean }
  /** Passive losses from 2024 that were not allowed (Form 8582), carried into 2025. */
  priorPassiveCarryover: number
  /** QBI and REIT/PTP losses carried from 2024 (Form 8995 lines 3 and 7, as positive numbers). */
  qbiCarryforward: { business: number; reitPtp: number }
  /** Section 179 deduction disallowed in 2024 (2024 Form 4562 line 13). */
  section179Carryover: number
  /** Sales of business and rental property (Form 4797). */
  propertySales: PropertySale[]
  /** Schedules K-1 from partnerships and S corporations. */
  k1s: K1[]
  /** Net section 1231 losses from 2020–2024 not yet recaptured (Form 4797 line 8). */
  prior1231Losses: number
  hsa: { taxpayer: HsaAccount; spouse: HsaAccount }
  /** Alternative minimum tax inputs (Form 6251) beyond what the return already knows. */
  amt: { isoBargainElement: number; privateActivityBondInterest: number; otherAdjustments: number }
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
  /** What-if scenarios kept with the return. */
  scenarios: Scenario[]
  /** State lived in all of 2025 (two-letter code), '' = not chosen yet. Decides which state return is prepared. */
  residentState: string
  /** Inputs for the state estimate (states not yet prepared in full). */
  stateGeneric: StateGenericInput
  /** Virginia resident return (Form 760). */
  virginia: VirginiaInput
  /** Maryland resident return (Form 502). */
  maryland: MarylandInput
  /** DC resident return (Form D-40). */
  dc: DcInput
  /** California resident return (Form 540). */
  ca: CaInput
  /** New York resident return (Form IT-201). */
  ny: NyInput
  /** Illinois resident return (Form IL-1040). */
  il: IlInput
  /** Pennsylvania resident return (Form PA-40). */
  pa: PaInput
  /** North Carolina resident return (Form D-400). */
  nc: NcInput
  /** Michigan resident return (Form MI-1040). */
  mi: MiInput
  /** Georgia resident return (Form 500). */
  ga: GaInput
  /** Ohio resident return (Form IT 1040). */
  oh: OhInput
  /** New Jersey resident return (Form NJ-1040). */
  nj: NjInput
  /** Massachusetts resident return (Form 1). */
  ma: MaInput
  /** Arizona resident return (Form 140). */
  az: AzInput
  /** Colorado resident return (DR 0104). */
  co: CoInput
  /** Minnesota resident return (Form M1). */
  mn: MnInput
  /** Wisconsin resident return (Form 1). */
  wi: WiInput
  /** Indiana resident return (Form IT-40). */
  in: InInput
  /** South Carolina resident return (SC1040). */
  sc: ScInput
  la: LaInput
  al: AlInput
  or: OrInput
  ky: KyInput
  ok: OkInput
  ct: CtInput
  ut: UtInput
  ia: IaInput
  ks: KsInput
  ar: ArInput
  ne: NeInput
  ms: MsInput
  wv: WvInput
  nm: NmInput
  hi: HiInput
  id: IdInput
  me: MeInput
  mt: MtInput
  ri: RiInput
  de: DeInput
  vt: VtInput
  nd: NdInput
  mo: MoInput
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
  id: newId('div'), payer: '', ordinaryDividends: 0, qualifiedDividends: 0, capitalGainDistributions: 0, section199ADividends: 0, federalWithholding: 0
})
export const emptyTransaction = (): CapitalTransaction => ({
  id: newId('cap'), description: '', term: 'long', dateAcquired: '', dateSold: '', proceeds: 0, costBasis: 0,
  reporting: 'covered', digitalAsset: false, adjustmentCode: '', adjustment: 0
})
export const emptyVehicle = (): VehicleInfo => ({
  placedInService: '', businessMiles: 0, commutingMiles: 0, otherMiles: 0,
  availableOffDuty: true, anotherVehicle: false, hasEvidence: true, evidenceWritten: true
})
export const emptyHomeOffice = (): HomeOffice => ({
  method: 'none', officeSqFt: 0, homeSqFt: 0, mortgageInterest: 0, realEstateTaxes: 0, insurance: 0,
  utilities: 0, repairs: 0, rent: 0, other: 0, depreciation: 0, amount: 0,
  homeBasis: 0, landValue: 0, firstUsed: '', priorOperatingCarryover: 0, priorExcessCarryover: 0
})
export const emptyRentalExpenses = (): RentalExpenses => ({
  advertising: 0, auto: 0, cleaning: 0, commissions: 0, insurance: 0, legal: 0, management: 0, mortgageInterest: 0,
  otherInterest: 0, repairs: 0, supplies: 0, taxes: 0, utilities: 0, depreciation: 0, other: 0
})
export const RENTAL_EXPENSE_LABELS: Record<keyof RentalExpenses, string> = {
  advertising: 'Advertising', auto: 'Auto and travel', cleaning: 'Cleaning and maintenance', commissions: 'Commissions',
  insurance: 'Insurance', legal: 'Legal and professional fees', management: 'Management fees',
  mortgageInterest: 'Mortgage interest paid to banks (1098)', otherInterest: 'Other interest', repairs: 'Repairs',
  supplies: 'Supplies', taxes: 'Taxes', utilities: 'Utilities', depreciation: 'Depreciation (from Form 4562)', other: 'Other'
}
export const RENTAL_TYPE_LABELS: Record<RentalType, string> = {
  single: 'Single family residence', multi: 'Multi-family residence', vacation: 'Vacation or short-term rental',
  commercial: 'Commercial', land: 'Land', royalties: 'Royalties', selfrental: 'Self-rental', other: 'Other'
}
export const emptyRental = (owner: Owner = 'taxpayer'): RentalProperty => ({
  id: newId('rent'), owner, address: '', type: 'single', fairRentalDays: 365, personalUseDays: 0, activeParticipation: true,
  rents: 0, royalties: 0, expenses: emptyRentalExpenses(), assets: [], priorUnallowed: 0
})
export const emptyAsset = (propertyClass: PropertyClass = '5'): DepreciableAsset => ({
  id: newId('asset'), description: '', placedInService: '', cost: 0, businessPct: 100, propertyClass, section179: 0,
  bonus: 'auto', acquiredBeforeJan20: false, priorSpecial: 0, manual: false, manualAmount: 0, listed: 'none',
  vehicle: { businessMiles: 0, commutingMiles: 0, otherMiles: 0, availableOffDuty: true, ownerUse: true, anotherVehicle: false, evidence: true, evidenceWritten: true }
})
export const emptyK1 = (owner: Owner = 'taxpayer'): K1 => ({
  id: newId('k1'), owner, kind: 'partnership', entityName: '', ein: '', materialParticipation: true, basisLimited: false,
  ordinary: 0, rentalRealEstate: 0, otherRental: 0, guaranteedPayments: 0, interest: 0, ordinaryDividends: 0, qualifiedDividends: 0,
  royalties: 0, shortTermGain: 0, longTermGain: 0, section1231: 0, section179: 0, seEarnings: 0,
  qbi: { income: 0, w2Wages: 0, ubia: 0, sstb: false }, priorPassiveCarryover: 0, rentalActiveParticipation: false
})
export const emptySale = (): PropertySale => ({
  id: newId('sale'), description: '', kind: '1245', usedIn: 'business', dateAcquired: '', dateSold: '', salesPrice: 0, costBasis: 0, depreciation: 0, reportedOn1099: true
})
export const emptyHsa = (): HsaAccount => ({
  coverage: 'none', monthsCovered: 12, personalContributions: 0, employerContributions: 0, distributions: 0, qualifiedExpenses: 0, exceptionApplies: false,
  priorExcess: 0, excessWithdrawn: false, yearEndValue: 0
})

export const emptyBusiness = (owner: Owner = 'taxpayer'): ScheduleCBusiness => ({
  id: newId('biz'), owner, name: '', activity: '', businessCode: '', ein: '', address: '', cityStateZip: '',
  accountingMethod: 'cash', materiallyParticipated: true, startedThisYear: false, required1099s: null, filed1099s: false,
  allAtRisk: true, vehicle: emptyVehicle(), homeOffice: emptyHomeOffice(), assets: [], qbi: { w2Wages: 0, ubia: 0, sstb: false }, grossReceipts: 0, returnsAndAllowances: 0,
  costOfGoodsSold: 0, otherIncome: 0, expenses: emptyExpenses()
})
export const emptyDependent = (): Dependent => ({
  id: newId('dep'), name: '', relationship: '', age: 0, hasSsn: true, monthsLivedWithYou: 12,
  student: false, disabled: false, childRelationship: true, ssn: ''
})
export const empty1099R = (owner: Owner = 'taxpayer'): Form1099R => ({
  id: newId('ret'), owner, payer: '', grossDistribution: 0, taxableAmount: 0, federalWithholding: 0, code: '7', ira: false,
  earlyExceptionCode: '', earlyExceptionAmount: 0
})
export const emptySocialSecurity = (owner: Owner = 'taxpayer'): SocialSecurityBenefits => ({ id: newId('ssa'), owner, netBenefits: 0, federalWithholding: 0 })
export const emptyStudent = (): Student => ({
  id: newId('stu'), name: '', ssn: '', institution: '', institutionAddress: '', institutionEin: '', received1098T: true,
  qualifiedExpenses: 0, aotcEligible: true
})
export const emptyProvider = (): CareProvider => ({ id: newId('care'), name: '', address: '', tin: '', householdEmployee: false, amountPaid: 0 })

export const emptyVaEntry = (code = ''): VaAdjEntry => ({ id: newId('vadj'), code, amount: 0, owner: 'taxpayer' })
export const emptyVaSavers = (): VirginiaInput['savers'][number] => ({ id: newId('vacs'), owner: 'taxpayer', account: '', contributed: 0, carryforward: 0 })
export const emptyVirginia = (): VirginiaInput => ({
  enabled: false, localityCode: '', birthDate: { taxpayer: '', spouse: '' }, withholding: { taxpayer: 0, spouse: 0 },
  estimatedPayments: 0, estimatedByPeriod: [0, 0, 0, 0], priorOverpayment: 0, extensionPayments: 0, otherStateBondInterest: 0, usObligationInterest: 0,
  stateRefundInFagi: 0, disability: { taxpayer: 0, spouse: 0 }, otherConformityAddition: 0, conformitySubtraction: 0,
  additions: [], subtractions: [], deductions: [], savers: [], itemizedOverride: null, salesTaxElected: false,
  dependentsVagi: 0, spouseFagiIfSeparate: 0, spouseVagiOverride: null, otherStateCredit: 0, scheduleCrCredits: 0,
  creditForward: 0, vacSavers: 0, vacOther: 0, additionToTax: 0, additionToTaxManual: false, useTax: 0, priorYearTax: null
})

const normalizeVirginia = (v: Partial<VirginiaInput> | undefined): VirginiaInput => {
  const base = emptyVirginia()
  const entries = (x: unknown): VaAdjEntry[] => (Array.isArray(x) ? x.map((e) => ({ ...emptyVaEntry(), ...(e as object) })) : [])
  const periods = Array.isArray(v?.estimatedByPeriod) && v.estimatedByPeriod.length === 4
    ? (v.estimatedByPeriod.map((n) => Number(n) || 0) as [number, number, number, number]) : null
  // Older files kept only a yearly total: spread it over the four due dates.
  const total = Number(v?.estimatedPayments) || 0
  const estimatedByPeriod: [number, number, number, number] = periods && periods.some((n) => n > 0) ? periods
    : total > 0 ? [total / 4, total / 4, total / 4, total / 4] : [0, 0, 0, 0]
  // A manual addition to tax from before Form 760C was figured stays manual.
  const additionToTaxManual = typeof v?.additionToTaxManual === 'boolean' ? v.additionToTaxManual : (Number(v?.additionToTax) || 0) > 0
  return {
    ...base, ...(v ?? {}),
    estimatedByPeriod, estimatedPayments: estimatedByPeriod.reduce((a, b) => a + b, 0), additionToTaxManual,
    birthDate: { ...base.birthDate, ...(v?.birthDate ?? {}) },
    withholding: { ...base.withholding, ...(v?.withholding ?? {}) },
    disability: { ...base.disability, ...(v?.disability ?? {}) },
    additions: entries(v?.additions), subtractions: entries(v?.subtractions), deductions: entries(v?.deductions),
    savers: Array.isArray(v?.savers) ? v.savers.map((x) => ({ ...emptyVaSavers(), ...x })) : []
  }
}

export const emptySavings = (): RetirementSavings => ({ iraContributions: 0, electiveDeferrals: 0, distributions: 0 })

export const emptyReturn = (): TaxReturnInput => ({
  version: 1,
  taxYear: DEFAULT_TAX_YEAR,
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
  rentals: [],
  rentalForms1099: { required: null, filed: false },
  priorPassiveCarryover: 0,
  qbiCarryforward: { business: 0, reitPtp: 0 },
  section179Carryover: 0,
  propertySales: [],
  k1s: [],
  prior1231Losses: 0,
  hsa: { taxpayer: emptyHsa(), spouse: emptyHsa() },
  amt: { isoBargainElement: 0, privateActivityBondInterest: 0, otherAdjustments: 0 },
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
  payments: { estimatedTaxPayments: 0, estimatedByQuarter: [0, 0, 0, 0], otherWithholding: 0 },
  scenarios: [],
  residentState: '',
  stateGeneric: emptyStateGeneric(),
  virginia: emptyVirginia(),
  maryland: emptyMaryland(),
  dc: emptyDc(),
  ca: emptyCa(),
  ny: emptyNy(),
  il: emptyIl(),
  pa: emptyPa(),
  nc: emptyNc(),
  mi: emptyMi(),
  ga: emptyGa(),
  oh: emptyOh(),
  nj: emptyNj(),
  ma: emptyMa(),
  az: emptyAz(),
  co: emptyCo(),
  mn: emptyMn(),
  wi: emptyWi(),
  in: emptyIn(),
  sc: emptySc(),
  la: emptyLa(),
  al: emptyAl(),
  or: emptyOr(),
  ky: emptyKy(),
  ok: emptyOk(),
  ct: emptyCt(),
  ut: emptyUt(), ia: emptyIa(), ks: emptyKs(), ar: emptyAr(), ne: emptyNe(), ms: emptyMs(), wv: emptyWv(), nm: emptyNm(), hi: emptyHi(), id: emptyId(), me: emptyMe(), mt: emptyMt(), ri: emptyRi(), de: emptyDe(), vt: emptyVt(), nd: emptyNd(), mo: emptyMo()
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

/** Older files had a single "HSA deduction" adjustment; treat it as the taxpayer's own self-only contribution. */
const normalizeAsset = (a: DepreciableAsset): DepreciableAsset => ({ ...a, vehicle: { ...emptyAsset().vehicle, ...(a.vehicle ?? {}) } })

const normalizeHsa = (h: Partial<TaxReturnInput['hsa']> | undefined, legacyDeduction: number): TaxReturnInput['hsa'] => {
  const out = { taxpayer: { ...emptyHsa(), ...(h?.taxpayer ?? {}) }, spouse: { ...emptyHsa(), ...(h?.spouse ?? {}) } }
  if (!h && legacyDeduction > 0) out.taxpayer = { ...out.taxpayer, coverage: 'self', personalContributions: legacyDeduction }
  return out
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

/** Older returns kept one rental carryover for all properties; it now belongs to a property (Form 8582 Part IV). */
function migratePassiveCarryover(ret: TaxReturnInput): TaxReturnInput {
  if (!(ret.priorPassiveCarryover > 0) || !ret.rentals.length || ret.rentals.some((p) => p.priorUnallowed > 0)) return ret
  const target = ret.rentals.find((p) => p.activeParticipation) ?? ret.rentals[0]
  return { ...ret, priorPassiveCarryover: 0, rentals: ret.rentals.map((p) => (p.id === target.id ? { ...p, priorUnallowed: ret.priorPassiveCarryover } : p)) }
}

export function normalizeReturn(raw: unknown): TaxReturnInput {
  const base = emptyReturn()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Partial<TaxReturnInput>
  const arr = <T>(v: unknown, make: () => T): T[] =>
    Array.isArray(v) ? v.map((item) => ({ ...make(), ...(item as object) })) : []
  return migratePassiveCarryover({
    ...base,
    ...r,
    filingStatus: (['single', 'mfj', 'mfs', 'hoh', 'qss'] as const).includes(r.filingStatus as FilingStatus) ? (r.filingStatus as FilingStatus) : 'single',
    version: 1,
    // Returns saved before years were added are 2025 returns.
    taxYear: isTaxYear(r.taxYear) ? r.taxYear : 2025,
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
      ? r.businesses.map((b) => {
        const expenses = { ...emptyExpenses(), ...(b?.expenses ?? {}) }
        const homeOffice = { ...emptyHomeOffice(), ...(b?.homeOffice ?? {}) }
        // Older files kept a home office amount among the expenses; move it to the "already figured" method.
        if (expenses.homeOffice > 0 && homeOffice.method === 'none') { homeOffice.method = 'amount'; homeOffice.amount = expenses.homeOffice }
        expenses.homeOffice = 0
        return { ...emptyBusiness(), ...b, expenses, homeOffice, vehicle: { ...emptyVehicle(), ...(b?.vehicle ?? {}) }, qbi: { ...emptyBusiness().qbi, ...(b?.qbi ?? {}) }, assets: arr(b?.assets, emptyAsset).map(normalizeAsset) }
      })
      : [],
    schedule1A: { ...base.schedule1A, ...(r.schedule1A ?? {}) },
    itemized: { ...base.itemized, ...(r.itemized ?? {}) },
    rentals: Array.isArray(r.rentals) ? r.rentals.map((x) => ({ ...emptyRental(), ...x, expenses: { ...emptyRentalExpenses(), ...(x?.expenses ?? {}) }, assets: arr(x?.assets, emptyAsset).map(normalizeAsset) })) : [],
    rentalForms1099: { ...base.rentalForms1099, ...(r.rentalForms1099 ?? {}) },
    hsa: normalizeHsa(r.hsa, r.adjustments?.hsaDeduction ?? 0),
    adjustments: { ...base.adjustments, ...(r.adjustments ?? {}), hsaDeduction: 0 },
    amt: { ...base.amt, ...(r.amt ?? {}) },
    qbiCarryforward: { ...base.qbiCarryforward, ...(r.qbiCarryforward ?? {}) },
    propertySales: arr(r.propertySales, emptySale),
    k1s: arr(r.k1s, emptyK1).map((k) => ({ ...k, qbi: { ...emptyK1().qbi, ...(k.qbi ?? {}) } })),
    savings: { taxpayer: { ...emptySavings(), ...(r.savings?.taxpayer ?? {}) }, spouse: { ...emptySavings(), ...(r.savings?.spouse ?? {}) } },
    priorYear: { ...base.priorYear, ...(r.priorYear ?? {}) },
    payments: normalizePayments(r.payments),
    scenarios: Array.isArray(r.scenarios) ? r.scenarios.map((x) => ({
      id: newId('scn'), name: 'Scenario', filingStatus: '', deductionChoice: '', pretax401k: 0, ira: 0, hsa: 0, charity: 0,
      otherIncome: 0, selfEmployment: 0, longTermGain: 0, shortTermGain: 0, extraPayments: 0, ...(x as object)
    })) : [],
    // Before the state picker, a Virginia return was switched on with virginia.enabled.
    residentState: typeof r.residentState === 'string' ? r.residentState.toUpperCase() : r.virginia?.enabled ? 'VA' : '',
    stateGeneric: { ...emptyStateGeneric(), ...(r.stateGeneric ?? {}) },
    virginia: normalizeVirginia(r.virginia),
    maryland: normalizeMaryland(r.maryland),
    dc: { ...emptyDc(), ...(r.dc ?? {}), birthDate: { ...emptyDc().birthDate, ...(r.dc?.birthDate ?? {}) }, landlord: { ...emptyDc().landlord, ...(r.dc?.landlord ?? {}) }, ssl: { ...emptyDc().ssl, ...(r.dc?.ssl ?? {}) }, dependentBirthDates: { ...(r.dc?.dependentBirthDates ?? {}) } },
    ca: { ...emptyCa(), ...(r.ca ?? {}), birthDate: { ...emptyCa().birthDate, ...(r.ca?.birthDate ?? {}) }, specialCredit: { ...emptyCa().specialCredit, ...(r.ca?.specialCredit ?? {}) }, contribution: { ...emptyCa().contribution, ...(r.ca?.contribution ?? {}) }, dependentBirthDates: { ...(r.ca?.dependentBirthDates ?? {}) }, stateWages: typeof r.ca?.stateWages === 'number' ? r.ca.stateWages : null },
    ny: { ...emptyNy(), ...(r.ny ?? {}), birthDate: { ...emptyNy().birthDate, ...(r.ny?.birthDate ?? {}) }, govPensions: { ...emptyNy().govPensions, ...(r.ny?.govPensions ?? {}) }, pensionExclusionOverride: { ...emptyNy().pensionExclusionOverride, ...(r.ny?.pensionExclusionOverride ?? {}) }, dependentBirthDates: { ...(r.ny?.dependentBirthDates ?? {}) } },
    il: { ...emptyIl(), ...(r.il ?? {}), birthDate: { ...emptyIl().birthDate, ...(r.il?.birthDate ?? {}) }, dependentBirthDates: { ...(r.il?.dependentBirthDates ?? {}) } },
    pa: { ...emptyPa(), ...(r.pa ?? {}), tuitionContributions: { ...emptyPa().tuitionContributions, ...(r.pa?.tuitionContributions ?? {}) }, compensation: typeof r.pa?.compensation === 'number' ? r.pa.compensation : null },
    nc: { ...emptyNc(), ...(r.nc ?? {}), withholding: { ...emptyNc().withholding, ...(r.nc?.withholding ?? {}) } },
    mi: { ...emptyMi(), ...(r.mi ?? {}), publicPensions: { ...emptyMi().publicPensions, ...(r.mi?.publicPensions ?? {}) }, birthYear: { ...emptyMi().birthYear, ...(r.mi?.birthYear ?? {}) } },
    ga: { ...emptyGa(), ...(r.ga ?? {}), birthDate: { ...emptyGa().birthDate, ...(r.ga?.birthDate ?? {}) }, disabled: { ...emptyGa().disabled, ...(r.ga?.disabled ?? {}) }, disabilityDate: { ...emptyGa().disabilityDate, ...(r.ga?.disabilityDate ?? {}) }, militaryRetirement: { ...emptyGa().militaryRetirement, ...(r.ga?.militaryRetirement ?? {}) }, w2: normalizeStatements(r.ga?.w2), donations: { ...(r.ga?.donations ?? {}) } },
    oh: { ...emptyOh(), ...(r.oh ?? {}), w2: normalizeStatements(r.oh?.w2), r1099: normalizeStatements(r.oh?.r1099), donations: { ...(r.oh?.donations ?? {}) }, dependentBirthDates: { ...(r.oh?.dependentBirthDates ?? {}) } },
    nj: { ...emptyNj(), ...(r.nj ?? {}), w2: normalizeStatements(r.nj?.w2), disabled: { ...emptyNj().disabled, ...(r.nj?.disabled ?? {}) }, veteran: { ...emptyNj().veteran, ...(r.nj?.veteran ?? {}) }, electionFund: { ...emptyNj().electionFund, ...(r.nj?.electionFund ?? {}) }, donations: { ...(r.nj?.donations ?? {}) }, dependentBirthYears: { ...(r.nj?.dependentBirthYears ?? {}) }, pensionTaxable: typeof r.nj?.pensionTaxable === 'number' ? r.nj.pensionTaxable : null, pensionExcludable: typeof r.nj?.pensionExcludable === 'number' ? r.nj.pensionExcludable : null },
    ma: { ...emptyMa(), ...(r.ma ?? {}), w2: normalizeStatements(r.ma?.w2), commuter: { ...emptyMa().commuter, ...(r.ma?.commuter ?? {}) }, veteran: { ...emptyMa().veteran, ...(r.ma?.veteran ?? {}) }, electionFund: { ...emptyMa().electionFund, ...(r.ma?.electionFund ?? {}) }, donations: { ...(r.ma?.donations ?? {}) }, birthDate: { ...emptyMa().birthDate, ...(r.ma?.birthDate ?? {}) }, dependentBirthDates: { ...(r.ma?.dependentBirthDates ?? {}) }, health: { taxpayer: normalizeMaHealth(r.ma?.health?.taxpayer), spouse: normalizeMaHealth(r.ma?.health?.spouse) } },
    az: { ...emptyAz(), ...(r.az ?? {}), w2: normalizeStatements(r.az?.w2), governmentPension: { ...emptyAz().governmentPension, ...(r.az?.governmentPension ?? {}) }, militaryRetirement: { ...emptyAz().militaryRetirement, ...(r.az?.militaryRetirement ?? {}) }, donations: { ...(r.az?.donations ?? {}) } },
    co: { ...emptyCo(), ...(r.co ?? {}), w2: normalizeStatements(r.co?.w2), militaryRetirement: { ...emptyCo().militaryRetirement, ...(r.co?.militaryRetirement ?? {}) }, idState: { ...emptyCo().idState, ...(r.co?.idState ?? {}) }, idLast4: { ...emptyCo().idLast4, ...(r.co?.idLast4 ?? {}) }, idIssued: { ...emptyCo().idIssued, ...(r.co?.idIssued ?? {}) }, birthDate: { ...emptyCo().birthDate, ...(r.co?.birthDate ?? {}) } },
    mn: { ...emptyMn(), ...(r.mn ?? {}), w2: normalizeStatements(r.mn?.w2), birthDate: { ...emptyMn().birthDate, ...(r.mn?.birthDate ?? {}) }, campaignCode: { ...emptyMn().campaignCode, ...(r.mn?.campaignCode ?? {}) } },
    wi: { ...emptyWi(), ...(r.wi ?? {}), w2: normalizeStatements(r.wi?.w2), donations: { ...(r.wi?.donations ?? {}) } },
    in: { ...emptyIn(), ...(r.in ?? {}), w2: normalizeStatements(r.in?.w2), countyLived: { ...emptyIn().countyLived, ...(r.in?.countyLived ?? {}) }, countyWorked: { ...emptyIn().countyWorked, ...(r.in?.countyWorked ?? {}) } },
    sc: { ...emptySc(), ...(r.sc ?? {}), w2: normalizeStatements(r.sc?.w2), birthDate: { ...emptySc().birthDate, ...(r.sc?.birthDate ?? {}) }, militaryRetirement: { ...emptySc().militaryRetirement, ...(r.sc?.militaryRetirement ?? {}) } },
    la: (() => {
      const e = emptyLa(); const x: Partial<LaInput> = r.la ?? {}
      return { ...e, ...x, w2: normalizeStatements(x.w2), birthDate: { ...e.birthDate, ...(x.birthDate ?? {}) }, dependentBirthDates: { ...(x.dependentBirthDates ?? {}) },
        exemptRetirement: Object.fromEntries((['02E', '03E', '04E', '05E'] as const).map((k) => [k, { ...e.exemptRetirement[k], ...(x.exemptRetirement?.[k] ?? {}) }])) as LaInput['exemptRetirement'],
        retired: { ...e.retired, ...(x.retired ?? {}) }, otherExempt: { ...e.otherExempt, ...(x.otherExempt ?? {}) }, otherCredit: { ...e.otherCredit, ...(x.otherCredit ?? {}) } }
    })(),
    ia: (() => {
      const e = emptyIa(); const x: Partial<IaInput> = r.ia ?? {}
      return {
        ...e, ...x, w2: normalizeStatements(x.w2), birthDate: { ...e.birthDate, ...(x.birthDate ?? {}) }, retirementKind: { ...(x.retirementKind ?? {}) }, disabled: { ...e.disabled, ...(x.disabled ?? {}) },
        otherAddition: { ...e.otherAddition, ...(x.otherAddition ?? {}) }, otherSubtraction: { ...e.otherSubtraction, ...(x.otherSubtraction ?? {}) }, otherAdjustment: { ...e.otherAdjustment, ...(x.otherAdjustment ?? {}) },
        tuition: { ...(x.tuition ?? {}) }, earlyChildhood: { ...(x.earlyChildhood ?? {}) }, license: { ...e.license, ...(x.license ?? {}) }
      }
    })(),
    ks: (() => {
      const e = emptyKs(); const x: Partial<KsInput> = r.ks ?? {}
      return { ...e, ...x, w2: normalizeStatements(x.w2), exemptRetirement: { ...(x.exemptRetirement ?? {}) }, contributions: { ...(x.contributions ?? {}) } }
    })(),
    ar: (() => {
      const e = emptyAr(); const x: Partial<ArInput> = r.ar ?? {}
      return { ...e, ...x, w2: normalizeStatements(x.w2), militaryPay: { ...e.militaryPay, ...(x.militaryPay ?? {}) }, retirementKind: { ...(x.retirementKind ?? {}) }, deaf: { ...e.deaf, ...(x.deaf ?? {}) } }
    })(),
    ne: (() => {
      const e = emptyNe(); const x: Partial<NeInput> = r.ne ?? {}
      return { ...e, ...x, w2: normalizeStatements(x.w2), retirementKind: { ...(x.retirementKind ?? {}) } }
    })(),
    ms: (() => {
      const e = emptyMs(); const x: Partial<MsInput> = r.ms ?? {}
      return { ...e, ...x, w2: normalizeStatements(x.w2), guardPay: { ...e.guardPay, ...(x.guardPay ?? {}) }, contributions: { ...(x.contributions ?? {}) } }
    })(),
    wv: (() => {
      const e = emptyWv(); const x: Partial<WvInput> = r.wv ?? {}
      return {
        ...e, ...x, w2: normalizeStatements(x.w2), dependentBirthDate: { ...(x.dependentBirthDate ?? {}) }, birthYear: { ...e.birthYear, ...(x.birthYear ?? {}) },
        disabled: { ...e.disabled, ...(x.disabled ?? {}) }, retirementKind: { ...(x.retirementKind ?? {}) }, donations: { ...e.donations, ...(x.donations ?? {}) }
      }
    })(),
    hi: (() => {
      const e = emptyHi(); const x: Partial<HiInput> = r.hi ?? {}
      const pair = (k: 'disabled' | 'schools' | 'libraries' | 'violence' | 'electionFund') => ({ ...e[k], ...(x[k] ?? {}) })
      return {
        ...e, ...x, w2: normalizeStatements(x.w2), retirementKind: { ...(x.retirementKind ?? {}) }, disabled: pair('disabled'), schools: pair('schools'),
        libraries: pair('libraries'), violence: pair('violence'), electionFund: pair('electionFund'), occupation: { ...e.occupation, ...(x.occupation ?? {}) }
      }
    })(),
    mo: (() => {
      const e = emptyMo(); const x: Partial<MoInput> = r.mo ?? {}
      const own = (k: keyof MoInput) => ({ ...(e[k] as object), ...((x[k] ?? {}) as object) })
      return {
        ...e, ...x, w2: normalizeStatements(x.w2), r1099: normalizeStatements(x.r1099), spouseAgi: typeof x.spouseAgi === 'number' ? x.spouseAgi : null,
        disabled: own('disabled'), ssDisability: own('ssDisability'), muniInterest: own('muniInterest'), otherAdditions: own('otherAdditions'), usInterest: own('usInterest'),
        stateRefund: own('stateRefund'), militaryRetirement: own('militaryRetirement'), railroad: own('railroad'), otherSubtractions: own('otherSubtractions'),
        tuition529: own('tuition529'), healthPremiums: own('healthPremiums'), able: own('able'), publicPension: own('publicPension'), otherState: own('otherState'),
        trustFunds: { ...(x.trustFunds ?? {}) }, pts: own('pts'), birthDates: own('birthDates')
      } as MoInput
    })(),
    nd: (() => {
      const e = emptyNd(); const x: Partial<NdInput> = r.nd ?? {}
      return { ...e, ...x, w2: normalizeStatements(x.w2), r1099: normalizeStatements(x.r1099), railroad: { ...e.railroad, ...(x.railroad ?? {}) }, sa: { ...e.sa, ...(x.sa ?? {}) }, cr: { ...e.cr, ...(x.cr ?? {}) }, tc: { ...(x.tc ?? {}) }, tcInfo: { ...(x.tcInfo ?? {}) }, contributions: { ...(x.contributions ?? {}) } }
    })(),
    vt: (() => {
      const e = emptyVt(); const x: Partial<VtInput> = r.vt ?? {}
      return {
        ...e, ...x, w2: normalizeStatements(x.w2), r1099: normalizeStatements(x.r1099), coverage: { ...e.coverage, ...(x.coverage ?? {}) }, birthDates: { ...e.birthDates, ...(x.birthDates ?? {}) },
        useTax: { ...e.useTax, ...(x.useTax ?? {}) }, contributions: { ...(x.contributions ?? {}) }, homestead: { ...e.homestead, ...(x.homestead ?? {}) },
        cg: { ...e.cg, ...(x.cg ?? {}) }, otherState: { ...e.otherState, ...(x.otherState ?? {}) }, renter: { ...e.renter, ...(x.renter ?? {}) },
        in119: { ...e.in119, ...(x.in119 ?? {}), credits: { ...(x.in119?.credits ?? {}) } }
      }
    })(),
    de: (() => {
      const e = emptyDe(); const x: Partial<DeInput> = r.de ?? {}
      const own = <T,>(k: 'militaryPension' | 'railroadRetirement' | 'higherEducation' | 'tuition529' | 'able' | 'disabled' | 'unionDues' | 'firefighter') => ({ ...e[k], ...((x[k] ?? {}) as object) }) as T
      return {
        ...e, ...x, w2: normalizeStatements(x.w2), r1099: normalizeStatements(x.r1099), spouseAgi: typeof x.spouseAgi === 'number' ? x.spouseAgi : null,
        militaryPension: own('militaryPension'), railroadRetirement: own('railroadRetirement'), higherEducation: own('higherEducation'), tuition529: own('tuition529'),
        able: own('able'), disabled: own('disabled'), unionDues: own('unionDues'), firefighter: own('firefighter'), otherState: { ...e.otherState, ...(x.otherState ?? {}) },
        crs: { ...(x.crs ?? {}) }, sCorp: Array.isArray(x.sCorp) ? x.sCorp.map((o) => ({ fein: o.fein ?? '', name: o.name ?? '', owner: o.owner === 'spouse' ? 'spouse' as const : 'taxpayer' as const, amount: Number(o.amount) || 0 })) : [],
        dependentBirthDates: { ...(x.dependentBirthDates ?? {}) }, contributions: { ...(x.contributions ?? {}) }
      }
    })(),
    ri: (() => {
      const e = emptyRi(); const x: Partial<RiInput> = r.ri ?? {}
      return {
        ...e, ...x, w2: normalizeStatements(x.w2), other1099: Array.isArray(x.other1099) ? x.other1099.map((o) => ({ payer: o.payer ?? '', ein: o.ein ?? '', code: o.code ?? '', owner: o.owner === 'spouse' ? 'spouse' : 'taxpayer', tax: Number(o.tax) || 0 })) : [],
        birthDates: { ...e.birthDates, ...(x.birthDates ?? {}) }, dependentBirthDates: { ...(x.dependentBirthDates ?? {}) }, pensionKind: { ...(x.pensionKind ?? {}) },
        otherState: { ...e.otherState, ...(x.otherState ?? {}) }, checkoffs: { ...(x.checkoffs ?? {}) }, relief: { ...e.relief, ...(x.relief ?? {}) },
        driversLicense: { ...e.driversLicense, ...(x.driversLicense ?? {}) }
      }
    })(),
    mt: (() => {
      const e = emptyMt(); const x: Partial<MtInput> = r.mt ?? {}
      return {
        ...e, ...x, w2: normalizeStatements(x.w2), otherStateCredit: { ...e.otherStateCredit, ...(x.otherStateCredit ?? {}) }, elderly: { ...e.elderly, ...(x.elderly ?? {}) },
        contributions: { ...(x.contributions ?? {}) }, birthDates: { ...e.birthDates, ...(x.birthDates ?? {}) }
      }
    })(),
    me: (() => {
      const e = emptyMe(); const x: Partial<MeInput> = r.me ?? {}
      return {
        ...e, ...x, w2: normalizeStatements(x.w2), pensionKind: { ...(x.pensionKind ?? {}) }, otherJurisdiction: { ...e.otherJurisdiction, ...(x.otherJurisdiction ?? {}) },
        birthDates: { ...e.birthDates, ...(x.birthDates ?? {}) }, cleanElection: { ...e.cleanElection, ...(x.cleanElection ?? {}) }, occupation: { ...e.occupation, ...(x.occupation ?? {}) },
        rentUtilities: typeof x.rentUtilities === 'number' ? x.rentUtilities : null
      }
    })(),
    id: (() => {
      const e = emptyId(); const x: Partial<IdInput> = r.id ?? {}
      return {
        ...e, ...x, w2: normalizeStatements(x.w2), dependentBirthDates: { ...(x.dependentBirthDates ?? {}) }, retirementKind: { ...(x.retirementKind ?? {}) },
        disabled: { ...e.disabled, ...(x.disabled ?? {}) }, otherState: { ...e.otherState, ...(x.otherState ?? {}) }, donations: { ...(x.donations ?? {}) },
        homeMembers: Array.isArray(x.homeMembers) ? x.homeMembers.map((m) => ({ name: m.name ?? '', ssn: m.ssn ?? '', relationship: m.relationship ?? '', birthDate: m.birthDate ?? '', disabled: !!m.disabled })) : []
      }
    })(),
    nm: (() => {
      const e = emptyNm(); const x: Partial<NmInput> = r.nm ?? {}
      return {
        ...e, ...x, w2: normalizeStatements(x.w2), birthDate: { ...e.birthDate, ...(x.birthDate ?? {}) }, dependentBirthDate: { ...(x.dependentBirthDate ?? {}) },
        retirementKind: { ...(x.retirementKind ?? {}) }, license: { ...e.license, ...(x.license ?? {}) }, dayCare: { ...(x.dayCare ?? {}) },
        otherState: { ...e.otherState, ...(x.otherState ?? {}) }, contributions: x.contributions && typeof x.contributions === 'object' ? { ...x.contributions } : {}, party: { ...e.party, ...(x.party ?? {}) }, crCredits: Array.isArray(x.crCredits) ? x.crCredits.map((c) => ({ code: c.code ?? '', approval: c.approval ?? '', applied: c.applied ?? 0, refund: c.refund ?? 0 })) : []
      }
    })(),
    al: (() => {
      const e = emptyAl(); const x: Partial<AlInput> = r.al ?? {}
      return { ...e, ...x, w2: normalizeStatements(x.w2), retirement: { ...(x.retirement ?? {}) }, interest: { ...(x.interest ?? {}) }, birthDate: { ...e.birthDate, ...(x.birthDate ?? {}) },
        license: { taxpayer: { ...e.license.taxpayer, ...(x.license?.taxpayer ?? {}) }, spouse: { ...e.license.spouse, ...(x.license?.spouse ?? {}) } } }
    })(),
    or: (() => {
      const e = emptyOr(); const x: Partial<OrInput> = r.or ?? {}
      return { ...e, ...x, w2: normalizeStatements(x.w2), birthDate: { ...e.birthDate, ...(x.birthDate ?? {}) }, dependentBirthDates: { ...(x.dependentBirthDates ?? {}) },
        dependentCodes: { ...(x.dependentCodes ?? {}) }, childDisability: { ...(x.childDisability ?? {}) }, severeDisability: { ...e.severeDisability, ...(x.severeDisability ?? {}) },
        otherAddition: { ...e.otherAddition, ...(x.otherAddition ?? {}) }, otherSubtraction: { ...e.otherSubtraction, ...(x.otherSubtraction ?? {}) }, otherStateCredit: { ...e.otherStateCredit, ...(x.otherStateCredit ?? {}) } }
    })(),
    ky: (() => {
      const e = emptyKy(); const x: Partial<KyInput> = r.ky ?? {}
      return { ...e, ...x, w2: normalizeStatements(x.w2), nationalGuard: { ...e.nationalGuard, ...(x.nationalGuard ?? {}) }, license: { ...e.license, ...(x.license ?? {}) } }
    })(),
    ok: (() => {
      const e = emptyOk(); const x: Partial<OkInput> = r.ok ?? {}
      return { ...e, ...x, w2: normalizeStatements(x.w2), dependentBirthDates: { ...(x.dependentBirthDates ?? {}) }, retirementKind: { ...(x.retirementKind ?? {}) }, csrsClaim: { ...e.csrsClaim, ...(x.csrsClaim ?? {}) },
        otherSubtraction: { ...e.otherSubtraction, ...(x.otherSubtraction ?? {}) }, otherAddition: { ...e.otherAddition, ...(x.otherAddition ?? {}) }, otherAdjustment: { ...e.otherAdjustment, ...(x.otherAdjustment ?? {}) }, otherCredit: { ...e.otherCredit, ...(x.otherCredit ?? {}) } }
    })(),
    ct: (() => {
      const e = emptyCt(); const x: Partial<CtInput> = r.ct ?? {}
      return { ...e, ...x, w2: normalizeStatements(x.w2), other1099: { ...e.other1099, ...(x.other1099 ?? {}) }, otherAddition: { ...e.otherAddition, ...(x.otherAddition ?? {}) },
        otherSubtraction: { ...e.otherSubtraction, ...(x.otherSubtraction ?? {}) }, retirementKind: { ...(x.retirementKind ?? {}) },
        residence: { ...e.residence, ...(x.residence ?? {}) }, auto1: { ...e.auto1, ...(x.auto1 ?? {}) }, auto2: { ...e.auto2, ...(x.auto2 ?? {}) } }
    })(),
    ut: (() => {
      const e = emptyUt(); const x: Partial<UtInput> = r.ut ?? {}
      return { ...e, ...x, w2: normalizeStatements(x.w2), birthDate: { ...e.birthDate, ...(x.birthDate ?? {}) }, retirementKind: { ...(x.retirementKind ?? {}) }, otherCredit: { ...e.otherCredit, ...(x.otherCredit ?? {}) } }
    })()
  })
}
