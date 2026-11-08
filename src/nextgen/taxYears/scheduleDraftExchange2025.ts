import { emptyScheduleDraft2025, ScheduleDraft2025 } from '../../components/NextGen2025ScheduleEditors'

export const SCHEDULE_DRAFT_KEY = 'ustaxes-nextgen-schedule-ab-draft-2025'
const moneyField = (v: unknown): v is string => typeof v === 'string' && v.length <= 64
export function parseScheduleDraft2025(input: unknown): ScheduleDraft2025 | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const o = input as Record<string, unknown>
  for (const field of ['medical','stateTaxes','propertyTaxes','mortgageInterest','charity','dividends']) {
    if (!moneyField(o[field])) return null
  }
  if (!Array.isArray(o.interestPayers) || o.interestPayers.length < 1 || o.interestPayers.length > 50) return null
  const ids = new Set<number>()
  for (const row of o.interestPayers) {
    if (!row || typeof row !== 'object' || !Number.isSafeInteger(row.id) || row.id < 1 || ids.has(row.id) ||
      typeof row.label !== 'string' || row.label.length > 200 || !moneyField(row.amount)) return null
    ids.add(row.id)
  }
  return {
    medical: o.medical as string, stateTaxes: o.stateTaxes as string, propertyTaxes: o.propertyTaxes as string,
    mortgageInterest: o.mortgageInterest as string, charity: o.charity as string,
    dividends: o.dividends as string,
    interestPayers: o.interestPayers.map((r: {id:number;label:string;amount:string}) => ({id:r.id,label:r.label,amount:r.amount}))
  }
}
export function readScheduleDraft2025(): ScheduleDraft2025 {
  try {
    const raw = window.sessionStorage.getItem(SCHEDULE_DRAFT_KEY)
    return raw ? parseScheduleDraft2025(JSON.parse(raw)) || emptyScheduleDraft2025() : emptyScheduleDraft2025()
  } catch { return emptyScheduleDraft2025() }
}
