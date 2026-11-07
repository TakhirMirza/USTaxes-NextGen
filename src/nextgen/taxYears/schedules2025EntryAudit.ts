/** Conservative pre-posting review for 2025 Schedules 1, 2 and 3.
 * This does not replace IRS eligibility worksheets or authorize filing.
 */
export type ScheduleSection2025 = 's1income' | 's1adjustments' | 's2additional' | 's2other' | 's3credits' | 's3payments'
export type ScheduleEntryAuditInput2025 = {
  id: number
  section: ScheduleSection2025
  line: string
  description: string
  amount: string
  source: string
  reviewed: boolean
}
export type ScheduleAuditIssue2025 = { code: string; message: string; entryIds: number[] }
export type ScheduleAudit2025 = { blocked: boolean; issues: ScheduleAuditIssue2025[]; totalsCents: Record<ScheduleSection2025, number> }
const sectionNames: ScheduleSection2025[] = ['s1income', 's1adjustments', 's2additional', 's2other', 's3credits', 's3payments']
const cents = (raw: string): number | null => {
  if (!/^(0|[1-9]\d{0,11})(\.\d{1,2})?$/.test(raw.trim())) return null
  const [dollars, fractional = ''] = raw.trim().split('.')
  const result = Number(dollars) * 100 + Number(fractional.padEnd(2, '0'))
  return Number.isSafeInteger(result) ? result : null
}
const normalized = (raw: string): string => raw.trim().replace(/\s+/g, ' ').toLowerCase()
export const auditScheduleEntries2025 = (entries: ScheduleEntryAuditInput2025[]): ScheduleAudit2025 => {
  const totalsCents = sectionNames.reduce((result, section) => ({ ...result, [section]: 0 }), {} as Record<ScheduleSection2025, number>)
  const issues: ScheduleAuditIssue2025[] = []
  const add = (code: string, message: string, entryIds: number[]) => issues.push({ code, message, entryIds })
  if (entries.length > 250) add('LIMIT', 'Maximum 250 source entries exceeded.', [])
  const ids = new Set<number>()
  const seen = new Map<string, number>()
  for (const entry of entries) {
    if (!Number.isSafeInteger(entry.id) || entry.id <= 0 || ids.has(entry.id)) add('ID', 'Source entry ID is missing or duplicated.', [entry.id])
    ids.add(entry.id)
    if (!sectionNames.includes(entry.section)) { add('SECTION', 'Unknown IRS schedule section.', [entry.id]); continue }
    const amount = cents(entry.amount)
    if (amount === null) add('AMOUNT', 'Amount must be a nonnegative dollar amount with at most two decimals.', [entry.id])
    if (!entry.line.trim() || !entry.description.trim() || !entry.source.trim()) add('SOURCE', 'IRS line, description and supporting source are required.', [entry.id])
    if (!entry.reviewed) add('REVIEW', 'Source has not been reviewed.', [entry.id])
    if (amount !== null) {
      const total = totalsCents[entry.section] + amount
      if (!Number.isSafeInteger(total)) add('OVERFLOW', 'Section total exceeds safe cent precision.', [entry.id])
      else totalsCents[entry.section] = total
    }
    // Exact same source/line/amount is a potential duplicate, not automatically a tax error.
    if (amount !== null && entry.source.trim()) {
      const key = [entry.section, normalized(entry.line), normalized(entry.source), amount].join('|')
      const previous = seen.get(key)
      if (previous !== undefined) add('POTENTIAL_DUPLICATE', 'Same source, IRS line and amount appear more than once; reconcile before posting.', [previous, entry.id])
      else seen.set(key, entry.id)
    }
  }
  return { blocked: issues.length > 0, issues, totalsCents }
}
