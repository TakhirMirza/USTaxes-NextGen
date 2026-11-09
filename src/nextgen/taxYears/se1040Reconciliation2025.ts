/** 2025 Schedule C -> Schedule 1 / SE -> Schedule 2 -> Form 1040 review workpaper.
 * Independent arithmetic reconciliation, NOT a tax return posting engine.
 * All amounts are integer cents; missing amounts must never silently become zero.
 */
export type SE1040ReviewInput2025 = {
  scheduleCProfitCents: number | null
  schedule1Line3Cents: number | null
  schedule1OtherIncomeCents: number | null
  schedule1Line10Cents: number | null
  schedule1Line15Cents: number | null
  schedule1OtherAdjustmentsCents: number | null
  schedule1Line26Cents: number | null
  scheduleSELine12Cents: number | null
  scheduleSELine13Cents: number | null
  schedule2Line4Cents: number | null
  schedule2OtherTaxesCents: number | null
  schedule2Line21Cents: number | null
  form1040Line8Cents: number | null
  form1040Line10Cents: number | null
  form1040Line23Cents: number | null
  scheduleCReviewed: boolean
  scheduleSEReviewed: boolean
  otherSchedule1IncomeReviewed: boolean
  otherSchedule1AdjustmentsReviewed: boolean
  otherSchedule2TaxesReviewed: boolean
}
export type SE1040ReviewResult2025 = {
  status: 'blocked' | 'reconciled-not-posted'
  filingReady: false
  blockers: string[]
  trace: {source: string; target: string; amountCents: number}[]
}
const MAX = 100000000000
const valid = (n: number | null): n is number => n !== null && Number.isSafeInteger(n) && n >= 0 && n <= MAX
export function reconcileSETo1040Workpaper2025(input: SE1040ReviewInput2025): SE1040ReviewResult2025 {
  const blockers: string[] = []
  const trace: SE1040ReviewResult2025['trace'] = []
  const amountFields = [
    'scheduleCProfitCents','schedule1Line3Cents','schedule1OtherIncomeCents','schedule1Line10Cents',
    'schedule1Line15Cents','schedule1OtherAdjustmentsCents','schedule1Line26Cents',
    'scheduleSELine12Cents','scheduleSELine13Cents','schedule2Line4Cents',
    'schedule2OtherTaxesCents','schedule2Line21Cents','form1040Line8Cents',
    'form1040Line10Cents','form1040Line23Cents'
  ] as const
  for (const key of amountFields) if (!valid(input[key])) blockers.push(`${key}: an explicit, nonnegative integer-cent amount is required.`)
  for (const key of ['scheduleCReviewed','scheduleSEReviewed','otherSchedule1IncomeReviewed',
    'otherSchedule1AdjustmentsReviewed','otherSchedule2TaxesReviewed'] as const) {
    if (input[key] !== true) blockers.push(`${key}: independent source review is required.`)
  }
  if (blockers.length) return {status:'blocked',filingReady:false,blockers,trace}
  const x = input as {[K in typeof amountFields[number]]: number} & SE1040ReviewInput2025
  const equal = (condition:boolean, explanation:string) => { if (!condition) blockers.push(explanation) }
  const sum = (...values:number[]) => values.reduce((a,b)=>a+b,0)
  equal(x.scheduleCProfitCents === x.schedule1Line3Cents,'Schedule C profit must match Schedule 1 line 3.')
  equal(sum(x.schedule1Line3Cents,x.schedule1OtherIncomeCents)===x.schedule1Line10Cents,'Schedule 1 income must reconcile to line 10.')
  equal(x.schedule1Line10Cents===x.form1040Line8Cents,'Schedule 1 line 10 must match Form 1040 line 8.')
  equal(x.scheduleSELine13Cents===x.schedule1Line15Cents,'Schedule SE line 13 must match Schedule 1 line 15.')
  equal(sum(x.schedule1Line15Cents,x.schedule1OtherAdjustmentsCents)===x.schedule1Line26Cents,'Schedule 1 adjustments must reconcile to line 26.')
  equal(x.schedule1Line26Cents===x.form1040Line10Cents,'Schedule 1 line 26 must match Form 1040 line 10.')
  equal(x.scheduleSELine12Cents===x.schedule2Line4Cents,'Schedule SE line 12 must match Schedule 2 line 4.')
  equal(sum(x.schedule2Line4Cents,x.schedule2OtherTaxesCents)===x.schedule2Line21Cents,'Schedule 2 taxes must reconcile to line 21.')
  equal(x.schedule2Line21Cents===x.form1040Line23Cents,'Schedule 2 line 21 must match Form 1040 line 23.')
  equal(x.scheduleSELine13Cents===Math.round(x.scheduleSELine12Cents/2),'Schedule SE line 13 must equal one-half of line 12 (cent-level workpaper rounding).')
  if (blockers.length) return {status:'blocked',filingReady:false,blockers,trace}
  for (const [source,target,amountCents] of [
    ['Schedule C line 31','Schedule 1 line 3',x.scheduleCProfitCents],
    ['Schedule 1 line 10','Form 1040 line 8',x.schedule1Line10Cents],
    ['Schedule SE line 13','Schedule 1 line 15',x.scheduleSELine13Cents],
    ['Schedule 1 line 26','Form 1040 line 10',x.schedule1Line26Cents],
    ['Schedule SE line 12','Schedule 2 line 4',x.scheduleSELine12Cents],
    ['Schedule 2 line 21','Form 1040 line 23',x.schedule2Line21Cents]
  ] as const) trace.push({source,target,amountCents})
  return {status:'reconciled-not-posted',filingReady:false,blockers:[],trace}
}
