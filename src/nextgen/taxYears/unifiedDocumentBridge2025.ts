/** Development-only source reconciliation. Never computes allowable deductions or tax. */
export type BridgeFinding = { code: string; severity: 'blocked' | 'review'; detail: string; destination: 'income' | 'deductions' }
export type BridgeInput = {
  year: string
  wageEntries: { employer: string; wages: string; withholding: string }[]
  interestSelected: boolean
  interest1040: string
  interestPayer1040: string
  scheduleA: { medical: string; stateTaxes: string; propertyTaxes: string; mortgageInterest: string; charity: string }
  scheduleB: { interestPayers: { label: string; amount: string }[]; dividends: string }
  deductionChoice: string
}
const toCents = (s: string): number | null => {
  const t = s.trim()
  if (!/^\d+(?:\.\d{1,2})?$/.test(t)) return null
  const parts = t.split('.')
  const whole = Number(parts[0]); const fraction = Number((parts[1] || '').padEnd(2, '0'))
  const result = whole * 100 + fraction
  return Number.isSafeInteger(result) ? result : null
}
export function reconcileUnifiedDocuments2025(input: BridgeInput) {
  const findings: BridgeFinding[] = []
  const add = (code: string, severity: BridgeFinding['severity'], detail: string, destination: BridgeFinding['destination']) => findings.push({ code, severity, detail, destination })
  if (input.year !== '2025') add('YEAR_UNSUPPORTED', 'blocked', 'This source bridge is implemented only for fictional 2025 scenarios.', 'income')
  let wageCents = 0; let withholdingCents = 0
  input.wageEntries.forEach((w, i) => {
    const active = Boolean(w.employer.trim() || w.wages.trim() || w.withholding.trim())
    if (!active) return
    const wages = toCents(w.wages); const withholding = toCents(w.withholding)
    if (!w.employer.trim() || wages === null || withholding === null) add(`W2_${i + 1}_INCOMPLETE`, 'blocked', `W-2 row ${i + 1} needs an employer, wages and withholding.`, 'income')
    else { wageCents += wages; withholdingCents += withholding; if (withholding > wages) add(`W2_${i + 1}_WITHHOLDING`, 'review', `W-2 row ${i + 1} withholding exceeds wages; verify source document.`, 'income') }
  })
  const aValues = Object.entries(input.scheduleA)
  let rawScheduleACents = 0
  aValues.forEach(([field, amount]) => {
    if (!amount.trim()) return
    const parsed = toCents(amount)
    if (parsed === null) add(`A_${field}_INVALID`, 'blocked', `Schedule A ${field} must be a nonnegative amount with up to two decimals.`, 'deductions')
    else rawScheduleACents += parsed
  })
  const hasA = aValues.some(([, v]) => v.trim() !== '')
  if (hasA) add('A_LIMITS_UNVERIFIED', 'blocked', 'Schedule A entries are raw expenses. AGI limits, SALT caps, eligibility and standard-vs-itemized comparison are not computed.', 'deductions')
  if (hasA && input.deductionChoice === 'standard') add('A_STANDARD_CONFLICT', 'review', 'Schedule A expenses exist while standard deduction is selected; confirm intended deduction path.', 'deductions')
  const bActive = input.scheduleB.interestPayers.some(p => p.amount.trim() || p.label.trim())
  let interestBCents = 0
  input.scheduleB.interestPayers.forEach((p, i) => {
    if (!p.amount.trim() && !p.label.trim()) return
    const value = toCents(p.amount)
    if (!p.label.trim() || value === null) add(`B_PAYER_${i + 1}_INCOMPLETE`, 'blocked', `Schedule B payer ${i + 1} needs a label and valid amount.`, 'income')
    else interestBCents += value
  })
  const sourceInterest = input.interest1040.trim() ? toCents(input.interest1040) : null
  if (input.interestSelected && (sourceInterest === null || !input.interestPayer1040.trim())) add('INT_SOURCE_INCOMPLETE', 'blocked', 'Selected 1099-INT source requires payer and a valid interest amount.', 'income')
  if (bActive && !input.interestSelected) add('B_SOURCE_UNSELECTED', 'blocked', 'Schedule B interest exists but 1099-INT interest is not selected in the income workflow.', 'income')
  if (bActive && sourceInterest !== null && sourceInterest !== interestBCents) add('INTEREST_MISMATCH', 'blocked', 'Schedule B interest total differs from the 1099-INT draft. These are two views of income, not amounts to add together.', 'income')
  const dividendCents = input.scheduleB.dividends.trim() ? toCents(input.scheduleB.dividends) : 0
  if (dividendCents === null) add('DIVIDENDS_INVALID', 'blocked', 'Schedule B dividends must be a valid nonnegative amount.', 'income')
  else if (input.scheduleB.dividends.trim()) add('DIVIDENDS_NOT_POSTED', 'blocked', 'Ordinary dividends need a verified 1099-DIV source and qualified-dividend review before Form 1040 mapping.', 'income')
  if (bActive) add('B_FILING_REQUIREMENTS', 'review', 'Schedule B filing requirements and foreign-account questions still need separate verification.', 'income')
  const blocked = findings.filter(f => f.severity === 'blocked').length
  return { findings, blocked, review: findings.length - blocked, wageCents, withholdingCents, interest1040Cents: sourceInterest, interestBCents, rawScheduleACents, dividendCents, readyForFiling: false as const }
}
