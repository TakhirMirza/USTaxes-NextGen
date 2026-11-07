/** Federal 2025 preparation readiness: deterministic, conservative, non-filing review.
 * This module deliberately never computes IRS line 16, a refund or an amount due.
 */
import { Form1040Mapping2025 } from './taxEngineCore2025'

export type ReviewSeverity2025 = 'blocked' | 'passed' | 'not-implemented'
export interface ReviewItem2025 {
  id: string
  title: string
  status: ReviewSeverity2025
  detail: string
  relatedLines: string[]
}
export interface FederalReview2025 {
  taxYear: 2025
  filingReady: false
  canExportFilingForm: false
  canEfile: false
  mappingValid: boolean
  items: ReviewItem2025[]
  summary: { passed: number; blocked: number; notImplemented: number }
}

export function reviewFederalReturn2025(mapping: Form1040Mapping2025): FederalReview2025 {
  const items: ReviewItem2025[] = []
  const add = (id: string, title: string, status: ReviewSeverity2025, detail: string, relatedLines: string[]): void => {
    items.push({ id, title, status, detail, relatedLines })
  }
  add('sources', 'Source document validation', mapping.status === 'mapped' ? 'passed' : 'blocked',
    mapping.status === 'mapped' ? 'Limited W-2 and 1099-INT source mapping passed.' : mapping.blockers.join(' ') || 'Source mapping is blocked.', ['1a', '2b', '25a'])
  add('income', 'Income and AGI mapping', mapping.status === 'mapped' ? 'passed' : 'blocked',
    'Only W-2 Box 1 and 1099-INT Box 1 are supported. Other income and adjustments require separate review.', ['9', '11a'])
  add('deduction', 'Standard deduction mapping', mapping.status === 'mapped' ? 'passed' : 'blocked',
    'Basic standard deduction only; age, blindness, dependent, and other eligibility conditions must be reviewed.', ['12e', '15'])
  add('tax', 'IRS line 16 tax computation', 'not-implemented',
    'IRS Tax Table, Tax Computation Worksheet, capital gain rates and special methods are not verified.', ['16'])
  add('credits', 'Credits and additional taxes', 'not-implemented',
    'Schedules 1, 1-A, 2, 3, 8812 and all applicable credits and additional taxes require coverage.', ['19', '20', '23', '24'])
  add('payments', 'Payments and refund / amount due', 'not-implemented',
    'W-2 withholding is mapped, but other payments, refundable credits, refund and amount due are not implemented.', ['25d', '33', '34', '37'])
  add('identity', 'Identity, signature and filing eligibility', 'not-implemented',
    'Taxpayer identification, residency, filing status, dependents, signature and submission checks are not supported.', [])
  add('output', 'Official IRS form PDF and e-file', 'not-implemented',
    'No filing PDF or IRS electronic submission is authorized or available.', [])
  return {
    taxYear: 2025, filingReady: false, canExportFilingForm: false, canEfile: false,
    mappingValid: mapping.status === 'mapped', items,
    summary: {
      passed: items.filter(i => i.status === 'passed').length,
      blocked: items.filter(i => i.status === 'blocked').length,
      notImplemented: items.filter(i => i.status === 'not-implemented').length
    }
  }
}
