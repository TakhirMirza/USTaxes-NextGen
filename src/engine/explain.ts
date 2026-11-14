/**
 * Line-by-line explanations of Form 1040: what goes into each line, from which of your entries or
 * schedules, how it is combined, and where the IRS explains it.
 */
import type { Issue, TaxReturnResult } from './compute.ts'
import type { TaxReturnInput } from './model.ts'
import * as R from './rules2025.ts'

export interface ExplainPart { label: string; amount: number; sign?: '+' | '−' }
export interface Explanation {
  /** How the line is figured, in words. */ formula: string
  parts: ExplainPart[]
  notes: string[]
  refs: { label: string; url: string }[]
  /** Where to change the entries behind this line. */ step?: Issue['step']
}

const IRS = 'https://www.irs.gov'
const I1040 = { label: 'Form 1040 instructions', url: `${IRS}/instructions/i1040gi` }
const about = (label: string, slug: string): { label: string; url: string } => ({ label, url: `${IRS}/forms-pubs/about-${slug}` })
const S1 = about('Schedule 1', 'schedule-1-form-1040')
const S2 = about('Schedule 2', 'schedule-2-form-1040')
const S3 = about('Schedule 3', 'schedule-3-form-1040')
const usd = (n: number): string => `$${Math.round(Math.abs(n)).toLocaleString('en-US')}`
const nz = (parts: ExplainPart[]): ExplainPart[] => parts.filter((p) => Math.round(p.amount) !== 0)

/** How the tax on line 16 splits over the brackets (ordinary income only). */
export function bracketBreakdown(ordinaryIncome: number, fs: TaxReturnInput['filingStatus']): ExplainPart[] {
  const brackets = R.BRACKETS[fs]
  const out: ExplainPart[] = []
  for (let i = 0; i < brackets.length; i++) {
    const [lower, rate] = brackets[i]
    const upper = i + 1 < brackets.length ? brackets[i + 1][0] : Infinity
    if (ordinaryIncome <= lower) break
    const slice = Math.min(ordinaryIncome, upper) - lower
    out.push({ label: `${Math.round(rate * 100)}% on ${usd(slice)} (${usd(lower)}–${upper === Infinity ? 'up' : usd(upper)})`, amount: slice * rate })
  }
  return out
}

export function explainLine(line: string, input: TaxReturnInput, res: TaxReturnResult): Explanation | null {
  const f = res.f1040
  const joint = input.filingStatus === 'mfj'
  const mine = <T extends { owner: string }>(xs: T[]): T[] => xs.filter((x) => joint || x.owner === 'taxpayer')
  const k1 = mine(input.k1s ?? [])
  switch (line) {
    case '1a':
      return { formula: 'Box 1 of every W-2.', parts: mine(input.w2s).map((w) => ({ label: w.employer || 'W-2', amount: w.wages })), notes: [], refs: [I1040], step: 'income' }
    case '1e':
      return { formula: 'Dependent care benefits from your employer (W-2 box 10) above the amount you can exclude.', parts: [{ label: 'Benefits received', amount: res.form2441.partIII?.line12 ?? 0 }, { label: 'Excluded', amount: (res.form2441.partIII?.line12 ?? 0) - f['1e'], sign: '−' }], notes: [], refs: [about('Form 2441', 'form-2441')], step: 'credits' }
    case '1z':
      return { formula: 'Line 1a plus lines 1b through 1h.', parts: nz([{ label: 'W-2 wages (1a)', amount: f['1a'] }, { label: 'Taxable dependent care benefits (1e)', amount: f['1e'], sign: '+' }]), notes: [], refs: [I1040], step: 'income' }
    case '2a':
      return { formula: 'Tax-exempt interest (1099-INT box 8). Not taxed, but it counts in some income limits, such as for Social Security benefits.', parts: input.interest.filter((i) => i.taxExemptInterest).map((i) => ({ label: i.payer || '1099-INT', amount: i.taxExemptInterest })), notes: [], refs: [I1040], step: 'income' }
    case '2b':
      return {
        formula: 'Taxable interest: 1099-INT boxes 1 and 3, and interest from Schedules K-1.',
        parts: nz([...input.interest.map((i) => ({ label: i.payer || '1099-INT', amount: i.interest })), ...k1.map((k) => ({ label: `${k.entityName || 'K-1'} (K-1)`, amount: k.interest }))]),
        notes: f['2b'] > 1500 ? ['Over $1,500, so Schedule B lists each payer.'] : [], refs: [I1040, about('Schedule B', 'schedule-b-form-1040')], step: 'income'
      }
    case '3a':
    case '3b':
      return {
        formula: line === '3b' ? 'Ordinary dividends: 1099-DIV box 1a, and K-1 dividends.' : 'Qualified dividends (1099-DIV box 1b): taxed at the lower capital gain rates on line 16.',
        parts: nz([...input.dividends.map((d) => ({ label: d.payer || '1099-DIV', amount: line === '3b' ? d.ordinaryDividends : Math.min(d.qualifiedDividends, d.ordinaryDividends) })),
          ...k1.map((k) => ({ label: `${k.entityName || 'K-1'} (K-1)`, amount: line === '3b' ? k.ordinaryDividends : Math.min(k.qualifiedDividends, k.ordinaryDividends) }))]),
        notes: [], refs: [I1040], step: 'income'
      }
    case '4a': case '4b': case '5a': case '5b': {
      const ira = line.startsWith('4')
      const taxable = line.endsWith('b')
      const forms = mine(input.retirement).filter((d) => d.ira === ira)
      return {
        formula: `${ira ? 'IRA' : 'Pension and annuity'} distributions from Form 1099-R, ${taxable ? 'taxable part (box 2a)' : 'total (box 1)'}.`,
        parts: forms.map((d) => ({ label: d.payer || '1099-R', amount: taxable ? d.taxableAmount : d.grossDistribution })),
        notes: taxable ? ['Rollovers, qualified charitable distributions and after-tax money are not taxable.'] : [], refs: [I1040], step: 'income'
      }
    }
    case '6a':
      return { formula: 'Net Social Security benefits (SSA-1099 box 5).', parts: mine(input.socialSecurity).map((s) => ({ label: s.owner === 'spouse' ? 'Spouse' : 'You', amount: s.netBenefits })), notes: [], refs: [I1040], step: 'income' }
    case '6b':
      return {
        formula: 'Up to 85% of benefits are taxable, depending on your other income plus half the benefits (Social Security Benefits Worksheet).',
        parts: [{ label: 'Benefits (6a)', amount: f['6a'] }, { label: `Taxable (${f['6a'] > 0 ? Math.round((f['6b'] / f['6a']) * 100) : 0}%)`, amount: f['6b'] }],
        notes: [], refs: [I1040, about('Publication 915', 'publication-915')], step: 'income'
      }
    case '7a': {
      const d = res.scheduleD
      return {
        formula: 'Schedule D line 16 (or 21 for a loss): short-term plus long-term gains and losses.',
        parts: nz([{ label: 'Net short-term gain or loss', amount: d.shortTerm }, { label: 'Net long-term gain or loss (incl. 4797 and distributions)', amount: d.longTerm, sign: '+' }]),
        notes: d.net < 0 && f['7a'] !== d.net ? [`A net capital loss is limited to ${usd(-f['7a'])} this year; ${usd(d.carryoverShort + d.carryoverLong)} carries to 2026.`] : [],
        refs: [about('Schedule D', 'schedule-d-form-1040')], step: 'income'
      }
    }
    case '8': {
      const s = res.schedule1
      return {
        formula: 'Schedule 1, line 10: additional income.',
        parts: nz([{ label: 'Business income (Schedule C)', amount: s.businessIncome }, { label: 'Other gains or losses (Form 4797)', amount: s.otherGains }, { label: 'Rentals, partnerships, S corporations (Schedule E)', amount: s.rentalIncome }, { label: 'Unemployment', amount: s.unemployment }, { label: 'Taxable HSA distributions', amount: s.hsaTaxable }, { label: 'Other income', amount: s.otherIncome }]),
        notes: [], refs: [S1], step: 'income'
      }
    }
    case '9':
      return {
        formula: 'Lines 1z, 2b, 3b, 4b, 5b, 6b, 7a and 8 added together.',
        parts: nz(['1z', '2b', '3b', '4b', '5b', '6b', '7a', '8'].map((l) => ({ label: `Line ${l}`, amount: f[l] }))), notes: [], refs: [I1040]
      }
    case '10': {
      const labels: Record<string, string> = { deductibleHalfOfSeTax: 'Deductible part of self-employment tax', selfEmployedHealthInsurance: 'Self-employed health insurance', hsaDeduction: 'HSA deduction (Form 8889)', iraDeduction: 'IRA deduction', studentLoanInterest: 'Student loan interest', educatorExpenses: 'Educator expenses', earlyWithdrawalPenalty: 'Penalty on early savings withdrawal' }
      return { formula: 'Schedule 1, line 26: adjustments to income.', parts: nz(Object.entries(res.schedule1.adjustments).map(([k, v]) => ({ label: labels[k] ?? k, amount: v }))), notes: [], refs: [S1], step: 'deductions' }
    }
    case '11a':
      return { formula: 'Line 9 minus line 10.', parts: [{ label: 'Total income (9)', amount: f['9'] }, { label: 'Adjustments (10)', amount: f['10'], sign: '−' }], notes: ['Many credits and deductions phase out based on AGI.'], refs: [I1040] }
    case '12e': {
      const d = res.deduction
      return {
        formula: `The larger of the standard deduction and your itemized deductions, unless you chose one. Used: ${d.used}.`,
        parts: [{ label: 'Standard deduction', amount: d.standard }, { label: 'Itemized deductions (Schedule A)', amount: d.itemized }],
        notes: d.used === 'itemized' ? [`State and local taxes counted: ${usd(res.scheduleA.taxes)} (the 2025 cap is ${usd(res.scheduleA.saltCap)}).`] : [],
        refs: [I1040, about('Schedule A', 'schedule-a-form-1040')], step: 'deductions'
      }
    }
    case '13a': {
      const q = res.qbi
      return {
        formula: `20% of qualified business income, limited to 20% of taxable income before this deduction less net capital gain (Form ${q.form === '8995a' ? '8995-A' : '8995'}).`,
        parts: nz([...q.businesses.map((b) => ({ label: `${b.name}: 20% of ${usd(b.line2)}`, amount: q.form === '8995a' ? b.line15 : b.line3 })), { label: 'REIT dividends (20%)', amount: q.reitComponent }, { label: 'Income limit', amount: q.incomeLimit }]),
        notes: q.lossCarryforward > 0 ? [`Qualified business loss carried to 2026: ${usd(q.lossCarryforward)}.`] : [], refs: [about('Form 8995', 'form-8995')], step: 'income'
      }
    }
    case '13b': {
      const a = res.schedule1A
      return {
        formula: 'Schedule 1-A (new for 2025): no tax on tips, no tax on overtime, car loan interest, and the enhanced deduction for seniors.',
        parts: nz([{ label: 'Qualified tips', amount: a.tips }, { label: 'Qualified overtime', amount: a.overtime }, { label: 'Car loan interest', amount: a.carLoanInterest }, { label: 'Enhanced deduction for seniors', amount: a.senior }]),
        notes: a.magi > 150000 ? [`Phase-outs apply at your modified AGI of ${usd(a.magi)}.`] : [], refs: [I1040], step: 'deductions'
      }
    }
    case '14':
      return { formula: 'Lines 12e, 13a and 13b added together.', parts: nz([{ label: 'Standard or itemized (12e)', amount: f['12e'] }, { label: 'QBI deduction (13a)', amount: f['13a'], sign: '+' }, { label: 'Schedule 1-A (13b)', amount: f['13b'], sign: '+' }]), notes: [], refs: [I1040] }
    case '15':
      return { formula: 'Line 11a minus line 14 (not less than zero).', parts: [{ label: 'AGI (11a)', amount: f['11a'] }, { label: 'Deductions (14)', amount: f['14'], sign: '−' }], notes: [], refs: [I1040] }
    case '16': {
      const pref = Math.min(f['15'], f['3a'] + res.scheduleD.preferentialGain)
      const method = res.scheduleD19 > 0 ? 'Schedule D Tax Worksheet (unrecaptured section 1250 gain at up to 25%)'
        : pref > 0 ? 'Qualified Dividends and Capital Gain Tax Worksheet'
          : f['15'] < 100000 ? 'Tax Table (taxable income under $100,000, figured on $50 ranges)' : 'Tax Computation Worksheet'
      const ordinary = Math.max(0, f['15'] - pref)
      return {
        formula: `Figured with the ${method}.`,
        parts: [...bracketBreakdown(ordinary, input.filingStatus), ...(pref > 0 ? [{ label: `Qualified dividends and long-term gains: ${usd(pref)} at 0%, 15% or 20%`, amount: Math.max(0, f['16'] - bracketBreakdown(ordinary, input.filingStatus).reduce((t, p) => t + p.amount, 0)) }] : [])],
        notes: [`Top bracket for ordinary income: ${Math.round((R.BRACKETS[input.filingStatus].filter(([lower]) => ordinary > lower).pop()?.[1] ?? 0.1) * 100)}%.`, ...(f['15'] < 100000 && pref === 0 ? ['The Tax Table uses the middle of each $50 range, so the total may differ by a few dollars from the brackets shown.'] : [])],
        refs: [I1040]
      }
    }
    case '17': {
      const a = res.form6251
      return { formula: 'Alternative minimum tax: tentative minimum tax over your regular tax (Form 6251).', parts: [{ label: 'AMT income (line 4)', amount: a.line4 }, { label: 'Exemption (line 5)', amount: a.line5, sign: '−' }, { label: 'Tentative minimum tax (line 9)', amount: a.line9 }, { label: 'Regular tax (line 10)', amount: a.line10, sign: '−' }], notes: [], refs: [about('Form 6251', 'form-6251')], step: 'income' }
    }
    case '18':
      return { formula: 'Line 16 plus line 17.', parts: nz([{ label: 'Tax (16)', amount: f['16'] }, { label: 'AMT (17)', amount: f['17'], sign: '+' }]), notes: [], refs: [I1040] }
    case '19': {
      const c = res.schedule8812
      return {
        formula: 'Child tax credit ($2,200 per qualifying child under 17) and credit for other dependents ($500), limited by your tax; the rest may be refundable on line 28.',
        parts: nz([{ label: `${c.qualifyingChildren} children, ${c.otherDependents} other dependents`, amount: c.creditBeforePhaseout }, { label: 'Phase-out above the AGI limit', amount: c.phaseoutReduction, sign: '−' }, { label: 'Used against your tax', amount: c.nonrefundable }]),
        notes: [], refs: [about('Schedule 8812', 'schedule-8812-form-1040')], step: 'about'
      }
    }
    case '20': {
      const s = res.schedule3
      return { formula: 'Schedule 3, line 8: nonrefundable credits.', parts: nz([{ label: 'Child and dependent care (Form 2441)', amount: s.dependentCare }, { label: 'Education credits (Form 8863)', amount: s.education }, { label: 'Saver’s credit (Form 8880)', amount: s.saversCredit }]), notes: [], refs: [S3], step: 'credits' }
    }
    case '22':
      return { formula: 'Line 18 minus line 21 (credits), not less than zero.', parts: [{ label: 'Tax (18)', amount: f['18'] }, { label: 'Credits (21)', amount: f['21'], sign: '−' }], notes: [], refs: [I1040] }
    case '23': {
      const s = res.schedule2
      return {
        formula: 'Schedule 2, line 21: other taxes.',
        parts: nz([{ label: 'Self-employment tax', amount: s.selfEmploymentTax }, { label: 'Additional Medicare tax (0.9%)', amount: s.additionalMedicareTax }, { label: 'Net investment income tax (3.8%)', amount: s.netInvestmentIncomeTax }, { label: 'Additional tax on early distributions', amount: s.earlyDistributionTax }, { label: '6% tax on excess HSA contributions', amount: s.hsaExcessTax }, { label: 'Additional 20% tax on HSA distributions', amount: s.hsaAdditionalTax }]),
        notes: [], refs: [S2], step: 'income'
      }
    }
    case '24':
      return { formula: 'Line 22 plus line 23.', parts: [{ label: 'Tax after credits (22)', amount: f['22'] }, { label: 'Other taxes (23)', amount: f['23'], sign: '+' }], notes: [`Effective rate: ${f['9'] > 0 ? ((f['24'] / f['9']) * 100).toFixed(1) : '0.0'}% of total income.`], refs: [I1040] }
    case '25d':
      return {
        formula: 'Federal income tax withheld.',
        parts: nz([...mine(input.w2s).map((w) => ({ label: `${w.employer || 'W-2'} (box 2)`, amount: w.federalWithholding })), { label: '1099 forms (25b)', amount: f['25b'] }, { label: 'Additional Medicare tax withheld (25c)', amount: f['25c'] }]),
        notes: [], refs: [I1040], step: 'income'
      }
    case '26':
      return { formula: 'Estimated tax payments for 2025, including any 2024 overpayment applied.', parts: input.payments.estimatedByQuarter.map((n, i) => ({ label: ['Paid by Apr 15, 2025', 'Paid by Jun 16, 2025', 'Paid by Sep 15, 2025', 'Paid by Jan 15, 2026'][i], amount: n })).filter((p) => p.amount), notes: [], refs: [I1040], step: 'credits' }
    case '27a': {
      const e = res.eic
      return { formula: 'Earned income credit, from the EIC tables, based on earned income, AGI and qualifying children.', parts: [{ label: `Earned income, ${e.qualifyingChildren} qualifying children`, amount: e.earnedIncome }, { label: 'Credit', amount: e.credit }], notes: [], refs: [about('Schedule EIC', 'schedule-eic-form-1040')], step: 'credits' }
    }
    case '28':
      return { formula: 'Refundable part of the child tax credit (Schedule 8812, up to $1,700 per child).', parts: [{ label: 'Additional child tax credit', amount: res.schedule8812.refundable }], notes: [], refs: [about('Schedule 8812', 'schedule-8812-form-1040')], step: 'about' }
    case '29':
      return { formula: '40% of the American opportunity credit is refundable (Form 8863).', parts: [{ label: 'Refundable AOTC', amount: res.form8863.aotcRefundable }], notes: [], refs: [about('Form 8863', 'form-8863')], step: 'credits' }
    case '31':
      return { formula: 'Social Security tax withheld over the 2025 maximum when you had more than one employer (Schedule 3).', parts: [{ label: 'Excess withheld', amount: res.schedule3.excessSocialSecurity }], notes: [], refs: [S3], step: 'income' }
    case '33':
      return { formula: 'Lines 25d, 26 and 32 (refundable credits) added together.', parts: nz([{ label: 'Withholding (25d)', amount: f['25d'] }, { label: 'Estimated payments (26)', amount: f['26'] }, { label: 'Refundable credits (32)', amount: f['32'] }]), notes: [], refs: [I1040] }
    case '34':
      return { formula: 'Line 33 minus line 24, less any estimated tax penalty (line 38).', parts: nz([{ label: 'Payments (33)', amount: f['33'] }, { label: 'Total tax (24)', amount: f['24'], sign: '−' }, { label: 'Penalty (38)', amount: f['38'], sign: '−' }]), notes: [], refs: [I1040] }
    case '37':
      return { formula: 'Line 24 minus line 33, plus any estimated tax penalty (line 38).', parts: nz([{ label: 'Total tax (24)', amount: f['24'] }, { label: 'Payments (33)', amount: f['33'], sign: '−' }, { label: 'Penalty (38)', amount: f['38'], sign: '+' }]), notes: [], refs: [I1040] }
    case '38':
      return { formula: 'Underpayment penalty (Form 2210): 7% a year on each quarter’s shortfall, from its due date until paid.', parts: [{ label: 'Penalty', amount: f['38'] }], notes: ['Paying 100% of last year’s tax (110% above $150,000 AGI) through withholding or estimates avoids it.'], refs: [about('Form 2210', 'form-2210')], step: 'credits' }
    default:
      return null
  }
}
