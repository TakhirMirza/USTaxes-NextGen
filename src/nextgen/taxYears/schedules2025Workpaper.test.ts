import { aggregateWorkpaperLines2025, exportWorkpaper2025, importWorkpaper2025, parseWorkpaperCents2025, WorkpaperEntry2025 } from './schedules2025Workpaper'
const allowed = { s1income: ['3'], s1adjustments: ['11'], s2additional: ['1a'], s2other: ['4'], s3credits: ['1'], s3payments: ['9'] }
const entries: WorkpaperEntry2025[] = [
  { id: 1, section: 's1income', line: '3', description: 'Business', amount: '100.20', source: 'Schedule C', reviewed: true },
  { id: 2, section: 's1income', line: '3', description: 'Business', amount: '0.03', source: 'Schedule C', reviewed: true }
]
test('exact cents and multiple sources per IRS line', () => {
  expect(aggregateWorkpaperLines2025(entries).totals['s1income:3']).toBe(10023)
  expect(parseWorkpaperCents2025('0.01')).toBe(1)
  expect(parseWorkpaperCents2025('0.001')).toBeNull()
})
test('roundtrip preserves entries', () => {
  expect(importWorkpaper2025(exportWorkpaper2025(entries), allowed)).toEqual(entries)
})
test('rejects wrong year, duplicate ids and invalid IRS line', () => {
  const exported = exportWorkpaper2025(entries)
  expect(() => importWorkpaper2025(exported.replace('"taxYear": 2025', '"taxYear": 2026').replace('"taxYear":2025', '"taxYear":2026'), allowed)).toThrow()
  expect(() => importWorkpaper2025(exportWorkpaper2025([{ ...entries[0] }, { ...entries[1], id: 1 }]), allowed)).toThrow()
  expect(() => importWorkpaper2025(exportWorkpaper2025([{ ...entries[0] }, { ...entries[1], line: '99' }]), allowed)).toThrow()
})
