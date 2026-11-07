/** Non-filing Schedule 1/2/3 workpaper: exact-cent line aggregation and portable review records. */
export const WORKPAPER_SECTIONS_2025 = ['s1income', 's1adjustments', 's2additional', 's2other', 's3credits', 's3payments'] as const
export type WorkpaperSection2025 = typeof WORKPAPER_SECTIONS_2025[number]
export interface WorkpaperEntry2025 {
  id: number
  section: WorkpaperSection2025
  line: string
  description: string
  amount: string
  source: string
  reviewed: boolean
}
export interface WorkpaperDocument2025 {
  schema: 'ustaxes-nextgen-schedules-workpaper'
  version: 1
  taxYear: 2025
  entries: WorkpaperEntry2025[]
}
const money = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/
export function parseWorkpaperCents2025(value: string): number | null {
  if (typeof value !== 'string' || !money.test(value)) return null
  const [whole, fraction = ''] = value.split('.')
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(cents) ? cents : null
}
export function aggregateWorkpaperLines2025(entries: readonly WorkpaperEntry2025[]) {
  const totals: Record<string, number> = {}
  const issues: string[] = []
  for (const entry of entries) {
    const cents = parseWorkpaperCents2025(entry.amount)
    if (cents === null) { issues.push(`Entry ${entry.id}: invalid amount`); continue }
    if (!entry.reviewed || !entry.source.trim() || !entry.description.trim()) {
      issues.push(`Entry ${entry.id}: source, description and review required`)
      continue
    }
    const key = `${entry.section}:${entry.line}`
    const sum = (totals[key] || 0) + cents
    if (!Number.isSafeInteger(sum)) { issues.push(`Entry ${entry.id}: unsafe total`); continue }
    totals[key] = sum
  }
  return { totals, issues, entryCount: entries.length, reviewedCount: entries.length - issues.length }
}
export function exportWorkpaper2025(entries: readonly WorkpaperEntry2025[]): string {
  const document: WorkpaperDocument2025 = { schema: 'ustaxes-nextgen-schedules-workpaper', version: 1, taxYear: 2025, entries: entries.map(e => ({ ...e })) }
  return JSON.stringify(document, null, 2)
}
export function importWorkpaper2025(raw: string, allowedLines: Readonly<Record<WorkpaperSection2025, readonly string[]>>): WorkpaperEntry2025[] {
  if (raw.length > 2_000_000) throw new Error('Workpaper exceeds size limit')
  const parsed: unknown = JSON.parse(raw)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('Invalid workpaper document')
  const doc = parsed as Partial<WorkpaperDocument2025>
  if (doc.schema !== 'ustaxes-nextgen-schedules-workpaper' || doc.version !== 1 || doc.taxYear !== 2025 || !Array.isArray(doc.entries) || doc.entries.length > 250) throw new Error('Unsupported workpaper schema or tax year')
  const ids = new Set<number>()
  return doc.entries.map((item: unknown) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) throw new Error('Invalid workpaper entry')
    const e = item as Partial<WorkpaperEntry2025>
    if (!Number.isSafeInteger(e.id) || (e.id as number) <= 0 || ids.has(e.id as number) ||
      !WORKPAPER_SECTIONS_2025.includes(e.section as WorkpaperSection2025) ||
      typeof e.line !== 'string' || !allowedLines[e.section as WorkpaperSection2025].includes(e.line) ||
      typeof e.description !== 'string' || e.description.length > 500 ||
      typeof e.source !== 'string' || e.source.length > 500 ||
      typeof e.amount !== 'string' || parseWorkpaperCents2025(e.amount) === null ||
      typeof e.reviewed !== 'boolean') throw new Error('Invalid workpaper entry fields')
    ids.add(e.id as number)
    return { id: e.id as number, section: e.section as WorkpaperSection2025, line: e.line, description: e.description, amount: e.amount, source: e.source, reviewed: e.reviewed }
  })
}
