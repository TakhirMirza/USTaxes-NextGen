/**
 * State income tax estimate for full-year residents of states this app does not prepare in full yet.
 *
 * Data: Tax Foundation, "State Individual Income Tax Rates and Brackets, as of January 1, 2025"
 * (single and married-filing-jointly brackets, standard deductions, personal exemptions), updated with
 * 2025 changes enacted later in 2025 (Georgia 5.19%, Idaho 5.3%, Utah 4.5%, Ohio 2.75%/3.125%,
 * South Carolina 6%, Maryland's new 6.25%/6.5% brackets and flat standard deduction, Wisconsin's wider
 * 4.4% bracket). Head of household and married filing separately use the single figures.
 *
 * It starts from federal AGI (or federal taxable income where the state does), removes taxable Social
 * Security in states that do not tax it, takes the state's standard deduction and exemptions, applies the
 * brackets, and subtracts exemption credits. State-specific credits, itemized deductions, retirement
 * exclusions, recapture and most local taxes are not figured: the result is an estimate, labeled as such.
 */
import type { TaxReturnInput } from './model.ts'
import type { TaxReturnResult } from './compute.ts'
import { stateInfo } from './states.ts'

type Amount = number | { credit: number } | null
interface StateParams {
  /** [rate, applies to income over] */
  single: [number, number][]
  mfj: [number, number][]
  /** Standard deduction [single, couple]. */
  std: [Amount, Amount]
  /** Personal exemption [single, couple, each dependent]; { credit } = a credit against tax. */
  exemption: [Amount, Amount, Amount]
}

const DATA: Record<string, StateParams> = {
  AL: { single: [[0.02, 0], [0.04, 500], [0.05, 3000]], mfj: [[0.02, 0], [0.04, 1000], [0.05, 6000]], std: [3000, 8500], exemption: [1500, 3000, 1000] },
  AR: { single: [[0.02, 0], [0.039, 4500]], mfj: [[0.02, 0], [0.039, 4500]], std: [2410, 4820], exemption: [{ credit: 29 }, { credit: 58 }, { credit: 29 }] },
  AZ: { single: [[0.025, 0]], mfj: [[0.025, 0]], std: [15000, 30000], exemption: [null, null, { credit: 100 }] },
  CA: { single: [[0.01, 0], [0.02, 10756], [0.04, 25499], [0.06, 40245], [0.08, 55866], [0.093, 70606], [0.103, 360659], [0.113, 432787], [0.123, 721314], [0.133, 1e+06]], mfj: [[0.01, 0], [0.02, 21512], [0.04, 50998], [0.06, 80490], [0.08, 111732], [0.093, 141732], [0.103, 721318], [0.113, 865574], [0.123, 1e+06], [0.133, 1.44263e+06]], std: [5540, 11080], exemption: [{ credit: 149 }, { credit: 298 }, { credit: 461 }] },
  CO: { single: [[0.044, 0]], mfj: [[0.044, 0]], std: [15000, 30000], exemption: [null, null, null] },
  CT: { single: [[0.02, 0], [0.045, 10000], [0.055, 50000], [0.06, 100000], [0.065, 200000], [0.069, 250000], [0.0699, 500000]], mfj: [[0.02, 0], [0.045, 20000], [0.055, 100000], [0.06, 200000], [0.065, 400000], [0.069, 500000], [0.0699, 1e+06]], std: [null, null], exemption: [15000, 24000, 0] },
  DC: { single: [[0.04, 0], [0.06, 10000], [0.065, 40000], [0.085, 60000], [0.0925, 250000], [0.0975, 500000], [0.1075, 1e+06]], mfj: [[0.04, 0], [0.06, 10000], [0.065, 40000], [0.085, 60000], [0.0925, 250000], [0.0975, 500000], [0.1075, 1e+06]], std: [15000, 30000], exemption: [null, null, null] },
  DE: { single: [[0.022, 2000], [0.039, 5000], [0.048, 10000], [0.052, 20000], [0.0555, 25000], [0.066, 60000]], mfj: [[0.022, 2000], [0.039, 5000], [0.048, 10000], [0.052, 20000], [0.0555, 25000], [0.066, 60000]], std: [3250, 6500], exemption: [{ credit: 110 }, { credit: 220 }, { credit: 110 }] },
  GA: { single: [[0.0539, 0]], mfj: [[0.0539, 0]], std: [12000, 24000], exemption: [null, null, 4000] },
  HI: { single: [[0.014, 0], [0.032, 9600], [0.055, 14400], [0.064, 19200], [0.068, 24000], [0.072, 36000], [0.076, 48000], [0.079, 125000], [0.0825, 175000], [0.09, 225000], [0.1, 275000], [0.11, 325000]], mfj: [[0.014, 0], [0.032, 19200], [0.055, 28800], [0.064, 38400], [0.068, 48000], [0.072, 72000], [0.076, 96000], [0.079, 250000], [0.0825, 350000], [0.09, 450000], [0.1, 550000], [0.11, 650000]], std: [4400, 8800], exemption: [1144, 2288, 1144] },
  IA: { single: [[0.038, 0]], mfj: [[0.038, 0]], std: [null, null], exemption: [{ credit: 40 }, { credit: 80 }, { credit: 40 }] },
  ID: { single: [[0.05695, 4673]], mfj: [[0.05695, 9346]], std: [15000, 30000], exemption: [null, null, null] },
  IL: { single: [[0.0495, 0]], mfj: [[0.0495, 0]], std: [null, null], exemption: [2850, 5700, 2850] },
  IN: { single: [[0.03, 0]], mfj: [[0.03, 0]], std: [null, null], exemption: [1000, 2000, 1000] },
  KS: { single: [[0.052, 0], [0.0558, 23000]], mfj: [[0.052, 0], [0.0558, 46000]], std: [3605, 8240], exemption: [9160, 18320, 2320] },
  KY: { single: [[0.04, 0]], mfj: [[0.04, 0]], std: [3270, 6540], exemption: [null, null, null] },
  LA: { single: [[0.03, 0]], mfj: [[0.03, 0]], std: [12500, 25000], exemption: [null, null, null] },
  MA: { single: [[0.05, 0], [0.09, 1.08315e+06]], mfj: [[0.05, 0], [0.09, 1.08315e+06]], std: [null, null], exemption: [4400, 8800, 1000] },
  MD: { single: [[0.02, 0], [0.03, 1000], [0.04, 2000], [0.0475, 3000], [0.05, 100000], [0.0525, 125000], [0.055, 150000], [0.0575, 250000]], mfj: [[0.02, 0], [0.03, 1000], [0.04, 2000], [0.0475, 3000], [0.05, 150000], [0.0525, 175000], [0.055, 225000], [0.0575, 300000]], std: [2700, 5450], exemption: [3200, 6400, 3200] },
  ME: { single: [[0.058, 0], [0.0675, 26800], [0.0715, 63450]], mfj: [[0.058, 0], [0.0675, 53600], [0.0715, 126900]], std: [15000, 30000], exemption: [5150, 10300, { credit: 300 }] },
  MI: { single: [[0.0425, 0]], mfj: [[0.0425, 0]], std: [null, null], exemption: [5800, 11600, 5800] },
  MN: { single: [[0.0535, 0], [0.068, 32570], [0.0785, 106990], [0.0985, 198630]], mfj: [[0.0535, 0], [0.068, 47620], [0.0785, 189180], [0.0985, 330410]], std: [14950, 29900], exemption: [null, null, 5200] },
  MO: { single: [[0.02, 1313], [0.025, 2626], [0.03, 3939], [0.035, 5252], [0.04, 6565], [0.045, 7878], [0.047, 9191]], mfj: [[0.02, 1313], [0.025, 2626], [0.03, 3939], [0.035, 5252], [0.04, 6565], [0.045, 7878], [0.047, 9191]], std: [15000, 30000], exemption: [null, null, null] },
  MS: { single: [[0.044, 10000]], mfj: [[0.044, 10000]], std: [2300, 4600], exemption: [6000, 12000, 1500] },
  MT: { single: [[0.047, 0], [0.059, 21100]], mfj: [[0.047, 0], [0.059, 42200]], std: [15000, 30000], exemption: [null, null, null] },
  NC: { single: [[0.0425, 0]], mfj: [[0.0425, 0]], std: [12750, 25500], exemption: [null, null, null] },
  ND: { single: [[0.0195, 48475], [0.025, 244825]], mfj: [[0.0195, 80975], [0.025, 298075]], std: [15000, 30000], exemption: [null, null, null] },
  NE: { single: [[0.0246, 0], [0.0351, 4030], [0.0501, 24120], [0.052, 38870]], mfj: [[0.0246, 0], [0.0351, 8040], [0.0501, 48250], [0.052, 77730]], std: [8600, 17200], exemption: [{ credit: 171 }, { credit: 342 }, { credit: 171 }] },
  NJ: { single: [[0.014, 0], [0.0175, 20000], [0.035, 35000], [0.05525, 40000], [0.0637, 75000], [0.0897, 500000], [0.1075, 1e+06]], mfj: [[0.014, 0], [0.0175, 20000], [0.0245, 50000], [0.035, 70000], [0.05525, 80000], [0.0637, 150000], [0.0897, 500000], [0.1075, 1e+06]], std: [null, null], exemption: [1000, 2000, 1500] },
  NM: { single: [[0.015, 0], [0.032, 5500], [0.043, 16500], [0.047, 33500], [0.049, 66500], [0.059, 210000]], mfj: [[0.015, 0], [0.032, 8000], [0.043, 25000], [0.047, 50000], [0.049, 100000], [0.059, 315000]], std: [15000, 30000], exemption: [null, null, 4000] },
  NY: { single: [[0.04, 0], [0.045, 8500], [0.0525, 11700], [0.055, 13900], [0.06, 80650], [0.0685, 215400], [0.0965, 1.07755e+06], [0.103, 5e+06], [0.109, 2.5e+07]], mfj: [[0.04, 0], [0.045, 17150], [0.0525, 23600], [0.055, 27900], [0.06, 161550], [0.0685, 323200], [0.0965, 2.15535e+06], [0.103, 5e+06], [0.109, 2.5e+07]], std: [8000, 16050], exemption: [null, null, 1000] },
  OH: { single: [[0.0275, 26050], [0.035, 100000]], mfj: [[0.0275, 26050], [0.035, 100000]], std: [null, null], exemption: [2400, 4800, 2400] },
  OK: { single: [[0.0025, 0], [0.0075, 1000], [0.0175, 2500], [0.0275, 3750], [0.0375, 4900], [0.0475, 7200]], mfj: [[0.0025, 0], [0.0075, 2000], [0.0175, 5000], [0.0275, 7500], [0.0375, 9800], [0.0475, 14400]], std: [6350, 12700], exemption: [1000, 2000, 1000] },
  OR: { single: [[0.0475, 0], [0.0675, 4400], [0.0875, 11050], [0.099, 125000]], mfj: [[0.0475, 0], [0.0675, 8800], [0.0875, 22100], [0.099, 250000]], std: [2800, 5600], exemption: [{ credit: 250 }, { credit: 500 }, { credit: 250 }] },
  PA: { single: [[0.0307, 0]], mfj: [[0.0307, 0]], std: [null, null], exemption: [null, null, null] },
  RI: { single: [[0.0375, 0], [0.0475, 79900], [0.0599, 181650]], mfj: [[0.0375, 0], [0.0475, 79900], [0.0599, 181650]], std: [10900, 21800], exemption: [5100, 10200, 5100] },
  SC: { single: [[0, 0], [0.03, 3560], [0.062, 17830]], mfj: [[0, 0], [0.03, 3560], [0.062, 17830]], std: [15000, 30000], exemption: [null, null, 4790] },
  UT: { single: [[0.0455, 0]], mfj: [[0.0455, 0]], std: [{ credit: 900 }, { credit: 1800 }], exemption: [null, null, 2046] },
  VT: { single: [[0.0335, 0], [0.066, 47900], [0.076, 116000], [0.0875, 242000]], mfj: [[0.0335, 0], [0.066, 79950], [0.076, 193300], [0.0875, 294600]], std: [7400, 14850], exemption: [5100, 10200, 5100] },
  WI: { single: [[0.035, 0], [0.044, 14680], [0.053, 29370], [0.0765, 323290]], mfj: [[0.035, 0], [0.044, 19580], [0.053, 39150], [0.0765, 431060]], std: [13560, 25110], exemption: [700, 1400, 700] },
  WV: { single: [[0.0222, 0], [0.0296, 10000], [0.0333, 25000], [0.0444, 40000], [0.0482, 60000]], mfj: [[0.0222, 0], [0.0296, 10000], [0.0333, 25000], [0.0444, 40000], [0.0482, 60000]], std: [null, null], exemption: [2000, 4000, 2000] },
}

// ── 2025 changes enacted after January 1, 2025 ──
DATA.GA = { ...DATA.GA, single: [[0.0519, 0]], mfj: [[0.0519, 0]] }
DATA.ID = { ...DATA.ID, single: [[0.053, 4673]], mfj: [[0.053, 9346]] }
DATA.UT = { ...DATA.UT, single: [[0.045, 0]], mfj: [[0.045, 0]] }
DATA.OH = { ...DATA.OH, single: [[0.0275, 26050], [0.03125, 100000]], mfj: [[0.0275, 26050], [0.03125, 100000]] }
DATA.SC = { ...DATA.SC, single: [[0, 0], [0.03, 3560], [0.06, 17830]], mfj: [[0, 0], [0.03, 3560], [0.06, 17830]] }
DATA.MD = {
  ...DATA.MD, std: [3350, 6700],
  single: [...DATA.MD.single, [0.0625, 500000], [0.065, 1000000]],
  mfj: [...DATA.MD.mfj, [0.0625, 600000], [0.065, 1200000]]
}
DATA.WI = { ...DATA.WI, single: [[0.035, 0], [0.044, 14680], [0.053, 50480], [0.0765, 323290]], mfj: [[0.035, 0], [0.044, 19580], [0.053, 67300], [0.0765, 431060]] }

/** States that start from federal taxable income (the federal deduction is already taken). */
const FROM_FEDERAL_TAXABLE = new Set(['CO', 'MT', 'NM', 'ND', 'SC'])
/** States that tax some Social Security benefits in 2025 (the estimate keeps the federally taxable amount). */
const TAXES_SOCIAL_SECURITY = new Set(['CO', 'CT', 'MN', 'MT', 'NM', 'RI', 'UT', 'VT', 'WV'])
/** Local income taxes on the state return or filed locally (not in the estimate unless a rate is entered). */
const LOCAL_TAX = new Set(['AL', 'IN', 'IA', 'KY', 'MD', 'MI', 'MO', 'NY', 'OH', 'PA'])

const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)

export function bracketTax(income: number, brackets: [number, number][]): number {
  let tax = 0
  brackets.forEach(([rate, over], i) => {
    const next = brackets[i + 1]?.[1] ?? Infinity
    if (income > over) tax += (Math.min(income, next) - over) * rate
  })
  return tax
}

export interface StateEstimate {
  code: string
  name: string
  /** Where the state starts. */
  startLabel: string
  start: number
  socialSecurity: number
  otherAdjustments: number
  income: number
  deductionLabel: string
  deduction: number
  exemptions: number
  taxable: number
  tax: number
  credits: number
  local: number
  minimumTax: number
  totalTax: number
  withholding: number
  estimatedPayments: number
  payments: number
  refund: number
  owed: number
  /** What the estimate leaves out for this state. */
  notes: string[]
}

const amountOf = (a: Amount): number => (typeof a === 'number' ? a : 0)
const creditOf = (a: Amount): number => (a && typeof a === 'object' ? a.credit : 0)

export function estimateStateTax(ret: TaxReturnInput, res: TaxReturnResult): StateEstimate | null {
  const code = ret.residentState
  const p = DATA[code]
  const info = stateInfo(code)
  if (!p || !info) return null
  const g = ret.stateGeneric
  const f = res.f1040
  const joint = ret.filingStatus === 'mfj' || ret.filingStatus === 'qss'
  const notes: string[] = []
  const deps = ret.dependents.length
  const fagi = f['11a']

  // Starting point
  let start: number
  let startLabel: string
  if (FROM_FEDERAL_TAXABLE.has(code)) { start = f['15']; startLabel = 'Federal taxable income' }
  else { start = fagi; startLabel = 'Federal adjusted gross income' }
  let socialSecurity = 0
  if (!TAXES_SOCIAL_SECURITY.has(code) && f['6b'] > 0) socialSecurity = f['6b']
  if (TAXES_SOCIAL_SECURITY.has(code) && f['6b'] > 0) notes.push(`${info.name} taxes some Social Security benefits but has its own exclusions; the estimate counts the federally taxable amount.`)
  if (code === 'PA') {
    // Pennsylvania taxes classes of income and does not tax retirement distributions or Social Security.
    const retirement = ret.retirement.reduce((s, x) => s + x.taxableAmount, 0)
    socialSecurity = f['6b']
    start = fagi - retirement
    notes.push('Pennsylvania taxes eight classes of income with no deductions for most federal adjustments; retirement distributions are left out here.')
  }
  const otherAdjustments = r(g.adjustments)
  const income = r(start - socialSecurity + otherAdjustments)

  // Deduction
  let deduction = 0
  let deductionLabel = 'Standard deduction'
  const std = p.std[joint ? 1 : 0]
  if (FROM_FEDERAL_TAXABLE.has(code)) { deductionLabel = 'Included in federal taxable income'; deduction = 0 }
  else if (code === 'PA') { deductionLabel = 'No deduction in Pennsylvania' }
  else if (typeof std === 'number') {
    deduction = std
    if (code === 'AL') {
      // Alabama: reduced for AGI over $25,999 ($25 or $175 per $500), not below $2,500 / $5,000.
      const steps = Math.max(0, Math.ceil((fagi - 25999) / 500))
      deduction = joint ? Math.max(5000, 8500 - 175 * steps) : Math.max(2500, 3000 - 25 * steps)
    }
    if (code === 'WI') {
      const [from, to] = joint ? [28209, 155169] : [19549, 132549]
      deduction = fagi <= from ? std : fagi >= to ? 0 : std * (to - fagi) / (to - from)
      notes.push('Wisconsin’s standard deduction shrinks as income rises; the estimate scales it evenly between the start and end of the phase-out.')
    }
    if (code === 'RI') deduction = phase(std, fagi, 254250, 283250)
    if (code === 'MD') deduction = std
  } else if (std && typeof std === 'object') {
    deductionLabel = 'Standard deduction (a credit in this state)'
  } else deductionLabel = 'No standard deduction'
  if (res.deduction.used === 'itemized' && typeof std === 'number' && !FROM_FEDERAL_TAXABLE.has(code) && code !== 'PA') {
    notes.push(`You itemized federally. ${info.name} may allow its own itemized deductions instead of the standard deduction; the estimate uses the standard deduction.`)
  }

  // Exemptions
  const personal = p.exemption[joint ? 1 : 0]
  const perDependent = p.exemption[2]
  let exemptions = amountOf(personal) + amountOf(perDependent) * deps
  let credits = creditOf(personal) + creditOf(perDependent) * deps
  if (code === 'IL' && fagi > (joint ? 500000 : 250000)) exemptions = 0
  if (code === 'MD') exemptions = phase(exemptions, fagi, joint ? 150000 : 100000, joint ? 200000 : 150000)
  if (code === 'CT') exemptions = pos(exemptions - 1000 * Math.ceil(pos(fagi - (joint ? 48000 : 30000)) / 1000))
  if (code === 'RI') exemptions = phase(exemptions, fagi, 254250, 283250)
  if (code === 'OH') exemptions = (1 + (joint ? 1 : 0) + deps) * (fagi <= 40000 ? 2400 : fagi <= 80000 ? 2150 : 1900)
  if (code === 'OR' && fagi > (joint ? 200000 : 100000)) credits -= creditOf(personal) + creditOf(perDependent) * deps
  if (code === 'UT') {
    // Utah taxpayer credit: 6% of the federal deduction plus dependent exemptions, phased out at 1.3% of income over the base.
    const base = 0.06 * ((res.deduction.used === 'itemized' ? res.deduction.itemized : res.deduction.standard) + 2046 * deps)
    credits = pos(base - 0.013 * pos(fagi - (joint ? 35304 : 17652)))
    exemptions = 0
  }

  if (code === 'AL') {
    deduction += f['22']
    deductionLabel = 'Standard deduction and federal income tax'
  }
  const taxable = r(pos(income - deduction - exemptions))
  let brackets = joint ? p.mfj : p.single
  if (code === 'AR' && taxable <= 89600) brackets = [[0, 0], [0.02, 5300], [0.03, 10600], [0.034, 15100], [0.039, 25000]]
  let tax = r(bracketTax(taxable, brackets))
  credits = r(Math.min(tax, pos(credits) + pos(g.otherCredits)))
  let minimumTax = 0
  if (code === 'VT' && fagi > 150000) minimumTax = pos(r(0.03 * fagi) - (tax - credits))
  const local = r(pos(g.localRate) / 100 * taxable)
  const totalTax = pos(tax - credits) + minimumTax + local
  const withholding = r(pos(g.withholding))
  const estimatedPayments = r(pos(g.estimatedPayments))
  const payments = withholding + estimatedPayments
  if (code === 'AL') notes.push('Alabama lets you deduct federal income tax paid; the estimate uses your 2025 federal income tax.')
  if (['MO', 'OR'].includes(code)) notes.push(`${info.name} allows a limited deduction for federal income tax that the estimate leaves out.`)
  if (['CT', 'NY'].includes(code) && fagi > 100000) notes.push(`${info.name} recaptures the benefit of its lower brackets from higher incomes; the estimate does not.`)
  if (code === 'CT') notes.push('Connecticut’s personal tax credit (1–75% based on income) is not in the estimate.')
  if (LOCAL_TAX.has(code)) notes.push(`${info.name} has local income taxes${code === 'MD' ? ' (each county sets its own rate, about 2.25%–3.30%)' : ''}. Enter your local rate to include it.`)
  if (ret.filingStatus === 'hoh' || ret.filingStatus === 'mfs') notes.push('Head of household and married filing separately are figured with single brackets and deductions.')
  if (code === 'MA' && fagi > 1000000) notes.push('Massachusetts adds a 4% surtax on income over $1,083,150.')
  tax = r(tax)
  return {
    code, name: info.name, startLabel, start: r(start), socialSecurity: r(socialSecurity), otherAdjustments, income, deductionLabel, deduction: r(deduction),
    exemptions: r(exemptions), taxable, tax, credits, local, minimumTax, totalTax, withholding, estimatedPayments, payments,
    refund: pos(payments - totalTax), owed: pos(totalTax - payments), notes
  }
}

/** Linear phase-out of an amount between two income levels. */
function phase(amount: number, income: number, from: number, to: number): number {
  if (income <= from) return amount
  if (income >= to) return 0
  return amount * (to - income) / (to - from)
}

export const hasStateEstimate = (code: string): boolean => code in DATA
