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
  ma: emptyMa()
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
    ma: { ...emptyMa(), ...(r.ma ?? {}), w2: normalizeStatements(r.ma?.w2), commuter: { ...emptyMa().commuter, ...(r.ma?.commuter ?? {}) }, veteran: { ...emptyMa().veteran, ...(r.ma?.veteran ?? {}) }, electionFund: { ...emptyMa().electionFund, ...(r.ma?.electionFund ?? {}) }, donations: { ...(r.ma?.donations ?? {}) }, birthDate: { ...emptyMa().birthDate, ...(r.ma?.birthDate ?? {}) }, dependentBirthDates: { ...(r.ma?.dependentBirthDates ?? {}) }, health: { taxpayer: normalizeMaHealth(r.ma?.health?.taxpayer), spouse: normalizeMaHealth(r.ma?.health?.spouse) } }
  })
}
