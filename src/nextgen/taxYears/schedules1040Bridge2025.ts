/** Read-only cross-step candidate totals. Not authoritative Form 1040 postings. */
export interface Schedule1040Candidates2025 {
  line8: number | null
  line10: number | null
  line17: number | null
  line20: number | null
  line23: number | null
  line31: number | null
  blocked: boolean
  entryCount: number
}
export const emptySchedule1040Candidates2025 = (): Schedule1040Candidates2025 => ({
  line8: null, line10: null, line17: null, line20: null, line23: null, line31: null,
  blocked: true, entryCount: 0
})
