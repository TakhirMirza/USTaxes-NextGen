import { FilingStatus2025, filingStatuses2025, preview2025OrdinaryWages } from './preview2025'
import { parseWageInput2025 } from './wageInput2025'
import { decide2025Line16 } from './irsLine16Decision2025'

/** One immutable snapshot: changing either input must invalidate earlier method confirmations. */
export interface LivePreviewScenario2025 {
  wages: string
  /** Optional W-2 Box 2 withholding, displayed as context only. */
  federalWithholding?: string
  status: FilingStatus2025
  ordinaryConfirmed: boolean
  specialRuledOut: boolean
}

export type LivePreviewChange2025 =
  | { kind: 'wages'; value: string }
  | { kind: 'federalWithholding'; value: string }
  | { kind: 'status'; value: FilingStatus2025 }
  | { kind: 'ordinaryConfirmed'; value: boolean }
  | { kind: 'specialRuledOut'; value: boolean }

export function updateLivePreviewScenario2025(state: LivePreviewScenario2025, change: LivePreviewChange2025): LivePreviewScenario2025 {
  if (change.kind === 'wages') {
    if (change.value === state.wages) return state
    return { ...state, wages: change.value, ordinaryConfirmed: false, specialRuledOut: false }
  }
  if (change.kind === 'federalWithholding') {
    if (change.value === (state.federalWithholding ?? '')) return state
    return { ...state, federalWithholding: change.value }
  }
  if (change.kind === 'status') {
    if (!filingStatuses2025.some(option => option.value === change.value)) throw new RangeError('Invalid filing status')
    if (change.value === state.status) return state
    return { ...state, status: change.value, ordinaryConfirmed: false, specialRuledOut: false }
  }
  if (change.kind === 'ordinaryConfirmed') return { ...state, ordinaryConfirmed: change.value }
  return { ...state, specialRuledOut: change.value }
}

export function calculateLivePreviewScenario2025(state: LivePreviewScenario2025) {
  const wages = parseWageInput2025(state.wages)
  const withholdingText = state.federalWithholding ?? ''
  const withholding = withholdingText.trim() === '' ? null : parseWageInput2025(withholdingText)
  const withholdingValid = withholdingText.trim() === '' || withholding !== null
  const withholdingWithinWages = wages === null || withholding === null || withholding <= wages
  if (wages === null || !withholdingValid || !withholdingWithinWages) return { valid: false as const, result: null, line16: null }
  const result = preview2025OrdinaryWages(wages, state.status)
  const line16 = decide2025Line16({
    taxableIncome: result.taxableOrdinaryIncome,
    status: state.status,
    ordinaryIncomeMethodApplicable: state.ordinaryConfirmed,
    specialTaxWorksheetRequired: state.specialRuledOut ? false : undefined,
  })
  return { valid: true as const, result, line16 }
}
