/**
 * Virginia Form 760C (2025): underpayment of estimated tax by individuals.
 *
 * Part I compares each quarter's required installment with what was paid by its due date. Part II
 * voids the addition for any quarter where payments to date covered the matching share of the 2024
 * tax (Exception 1). Part III charges 9% a year (0.00025 a day) on each underpayment from its due date
 * until it was paid, at the latest May 1, 2026.
 *
 * Withholding counts as paid in equal parts on the four due dates; the 2024 overpayment applied counts
 * on May 1, 2025. Payments are applied to the earliest installment still unpaid, so a later payment
 * shortens the time an earlier underpayment runs. Exceptions 2–4 (prior-year income at 2025 rates and
 * the annualized-income methods) need month-by-month figures and are not figured here.
 */
export const VA_760C_DAILY_RATE = 0.00025
export const VA_760C_DUE = ['2025-05-01', '2025-06-15', '2025-09-15', '2026-01-15'] as const
export const VA_760C_RETURN_DUE = '2026-05-01'
export const VA_760C_EXCEPTION1 = [0.25, 0.5, 0.75, 1]

const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)
const day = (iso: string): number => Date.parse(`${iso}T00:00:00Z`) / 86400000
const usDate = (iso: string): string => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`

export interface Va760cInput {
  /** Line 1: 2025 tax after the spouse tax adjustment and nonrefundable credits. */
  tax: number
  /** Line 3: 2024 tax after STA and credits; null = not known (the 90% test alone is used). */
  priorYearTax: number | null
  withholding: number
  priorOverpayment: number
  /** Estimated payments made by each due date (May 1, June 15, Sept. 15, Jan. 15). */
  estimated: [number, number, number, number]
}

export interface Va760cColumn {
  due: string
  /** Line 7 */ required: number
  /** Line 8 */ withheld: number
  /** Line 9 */ overpaymentCredit: number
  /** Line 10 */ estimated: number
  /** Line 11: negative = overpayment */ line11: number
  /** Line 13: payments credited to this installment by its due date (its own payments plus earlier overpayments). */ line13: number
  /** Line 14: underpayment at the due date (0 if none). */ underpayment: number
  /** Line 15: everything paid from January 1, 2025 through the due date. */ paidToDate: number
  /** Line 16: 2024 tax × 25/50/75/100%. */ exception1: number | null
  exceptionMet: boolean
  /** Lines 21–24: one row per date the underpayment was paid off. */
  pieces: { amount: number; paid: string; days: number; addition: number }[]
  addition: number
}

export interface Va760cResult {
  line1: number; line2: number; line3: number | null; line4: number; line5: number
  columns: Va760cColumn[]
  totalUnderpayment: number
  /** Not required: tax $150 or less, or underpayments total $150 or less. */
  notRequired: boolean
  reason: string
  /** Line 25 */ addition: number
}

export function compute760c(input: Va760cInput): Va760cResult {
  const line1 = r(pos(input.tax))
  const line2 = r(line1 * 0.9)
  const line3 = input.priorYearTax === null ? null : r(pos(input.priorYearTax))
  const line4 = line3 === null ? line2 : Math.min(line2, line3)
  const line5 = 4
  const quarter = line4 / line5
  const withheldEach = pos(input.withholding) / 4

  // Each period's own payments go to its installment first. An overpayment (Late Payment/Overpayment
  // Table) pays off earlier underpayments, oldest first, as of its due date; what is left counts toward
  // later installments. Anything still unpaid runs until May 1, 2026.
  const outstanding: { col: number; amount: number }[] = []
  const pieces: { amount: number; paid: string }[][] = VA_760C_DUE.map(() => [])
  let pool = 0
  let paidToDate = 0
  const columns: Va760cColumn[] = VA_760C_DUE.map((due, i) => {
    const withheld = withheldEach
    const overpaymentCredit = i === 0 ? pos(input.priorOverpayment) : 0
    const estimated = pos(input.estimated[i])
    const own = withheld + overpaymentCredit + estimated
    paidToDate += own
    const line11 = quarter - own
    let excess = pos(own - quarter)
    for (const o of outstanding) {
      if (excess <= 0.004) break
      const used = Math.min(o.amount, excess)
      if (used > 0) { pieces[o.col].push({ amount: used, paid: due }); o.amount -= used; excess -= used }
    }
    let shortfall = pos(quarter - own)
    const fromPool = Math.min(pool, shortfall)
    pool = pool - fromPool + excess
    shortfall -= fromPool
    if (shortfall > 0.004) outstanding.push({ col: i, amount: shortfall })
    const exception1 = line3 === null ? null : line3 * VA_760C_EXCEPTION1[i]
    return {
      due, required: quarter, withheld, overpaymentCredit, estimated, line11, line13: quarter - shortfall, underpayment: shortfall > 0.004 ? shortfall : 0,
      paidToDate, exception1, exceptionMet: exception1 !== null && paidToDate >= exception1, pieces: [], addition: 0
    }
  })
  for (const o of outstanding) if (o.amount > 0.004) pieces[o.col].push({ amount: o.amount, paid: VA_760C_RETURN_DUE })
  columns.forEach((c, i) => {
    if (c.exceptionMet) return
    c.pieces = pieces[i].map((p) => {
      const days = Math.round(day(p.paid) - day(c.due))
      return { amount: p.amount, paid: p.paid, days, addition: p.amount * days * VA_760C_DAILY_RATE }
    })
    c.addition = c.pieces.reduce((t, p) => t + p.addition, 0)
  })
  const totalUnderpayment = columns.reduce((s, c) => s + c.underpayment, 0)
  let notRequired = false
  let reason = ''
  if (line1 <= 150) { notRequired = true; reason = 'Your 2025 tax after credits is $150 or less.' }
  else if (totalUnderpayment <= 150) { notRequired = true; reason = 'Your underpayments total $150 or less.' }
  else if (columns.every((c) => c.exceptionMet || c.underpayment === 0)) { notRequired = true; reason = 'Payments by each due date covered 25%, 50%, 75% and 100% of your 2024 tax (Exception 1).' }
  const addition = notRequired ? 0 : Math.round(columns.reduce((s, c) => s + c.addition, 0) * 100) / 100
  return { line1, line2, line3, line4, line5, columns, totalUnderpayment, notRequired, reason, addition }
}

export { usDate as va760cDate }
