/** Versioned, deliberately non-identifying development scenario. Never use for taxpayer PII. */
export type FictionalWorkspace = {
  version: 1
  year: string
  filingStatus: string
  hasDependents: string
  deduction: string
  incomeKinds: string[]
  wages: { id: number; employer: string; wages: string; withholding: string }[]
  interest: string
  payer: string
  basicDeductionConfirmed: boolean
  noOtherItemsConfirmed: boolean
  ordinaryTaxMethodConfirmed: boolean
}
export const WORKSPACE_KEY = 'ustaxes-nextgen-fictional-v1'
const allowedKinds = ['W-2 wages','1099-INT interest','1099-DIV dividends','1099-NEC / self-employment','Capital gains','Retirement income','Rental income','Other income']
const money = (v: unknown): boolean => typeof v === 'string' && (v === '' || (/^\d+(?:\.\d{1,2})?$/.test(v) && Number.isSafeInteger(Math.round(Number(v) * 100))))
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
export function parseFictionalWorkspace(input: unknown): FictionalWorkspace | null {
  if (!isRecord(input) || input.version !== 1 || !['2025','2026','2027','2028'].includes(String(input.year)) ||
    !['single','joint','separate','head','survivor'].includes(String(input.filingStatus)) ||
    !['yes','no','unknown'].includes(String(input.hasDependents)) ||
    !['standard','itemized','unknown'].includes(String(input.deduction)) ||
    !Array.isArray(input.incomeKinds) || input.incomeKinds.length > allowedKinds.length ||
    !input.incomeKinds.every((v: unknown) => typeof v === 'string' && allowedKinds.includes(v)) ||
    !Array.isArray(input.wages) || input.wages.length > 100 ||
    !input.wages.every((w: unknown) => isRecord(w) && Number.isSafeInteger(w.id) && (w.id as number) > 0 && typeof w.employer === 'string' && w.employer.length <= 120 && money(w.wages) && money(w.withholding)) ||
    !money(input.interest) || typeof input.payer !== 'string' || input.payer.length > 120 ||
    !['basicDeductionConfirmed','noOtherItemsConfirmed','ordinaryTaxMethodConfirmed'].every(k => typeof input[k] === 'boolean')) return null
  const ids = (input.wages as {id:number}[]).map(w => w.id)
  if (new Set(ids).size !== ids.length || new Set(input.incomeKinds).size !== input.incomeKinds.length) return null
  return {
    version: 1, year: input.year as string, filingStatus: input.filingStatus as string,
    hasDependents: input.hasDependents as string, deduction: input.deduction as string,
    incomeKinds: [...input.incomeKinds] as string[],
    wages: (input.wages as FictionalWorkspace['wages']).map(w => ({ ...w })),
    interest: input.interest as string, payer: input.payer as string,
    basicDeductionConfirmed: input.basicDeductionConfirmed as boolean,
    noOtherItemsConfirmed: input.noOtherItemsConfirmed as boolean,
    ordinaryTaxMethodConfirmed: input.ordinaryTaxMethodConfirmed as boolean
  }
}
export function readFictionalWorkspace(): FictionalWorkspace | null {
  try {
    const raw = window.sessionStorage.getItem(WORKSPACE_KEY)
    return raw ? parseFictionalWorkspace(JSON.parse(raw)) : null
  } catch { return null }
}
