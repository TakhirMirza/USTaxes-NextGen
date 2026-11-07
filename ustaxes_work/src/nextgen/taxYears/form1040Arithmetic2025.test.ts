import { reconcileForm1040Arithmetic2025, VerifiedTaxComponents2025 } from './form1040Arithmetic2025'
import { map2025SourcesTo1040 } from './taxEngineCore2025'

const mapping = () => map2025SourcesTo1040({
  year: 2025, filingStatus: 'single', w2: [{ id: '1', employer: 'Example', box1: '75000.00', box2: '9000.00' }], interest: [],
  standardDeductionFactsConfirmed: true, taxpayerUnder65AndNotBlind: true,
  spouseUnder65AndNotBlind: true, notClaimableAsDependent: true, noOtherIncomeAdjustmentsCreditsOrTaxes: true
})
const verified: VerifiedTaxComponents2025 = {
  line16TaxCents: 800000, line17Schedule2Part1Cents: 0, line19ChildTaxCreditCents: 0,
  line20Schedule3Part1Cents: 0, line23OtherTaxesCents: 0, line26EstimatedPaymentsCents: 0,
  line27aEarnedIncomeCreditCents: 0, line28AdditionalChildTaxCreditCents: 0,
  line29EducationCreditCents: 0, line31OtherPaymentsCents: 0
}
test('blocks absent independent tax review', () => {
  expect(reconcileForm1040Arithmetic2025(mapping(), verified, false).status).toBe('blocked')
  expect(reconcileForm1040Arithmetic2025(mapping(), null, true).status).toBe('blocked')
})
test('reconciles externally reviewed tax and withholding without authorizing filing', () => {
  const result = reconcileForm1040Arithmetic2025(mapping(), verified, true)
  expect(result.status).toBe('reconciled')
  expect(result.filingReady).toBe(false)
  if (result.status === 'reconciled') {
    expect(result.lines['24']).toBe(800000)
    expect(result.lines['33']).toBe(900000)
    expect(result.lines['34']).toBe(100000)
    expect(result.lines['37']).toBe(0)
  }
})
test('calculates amount owed when verified taxes exceed payments', () => {
  const result = reconcileForm1040Arithmetic2025(mapping(), { ...verified, line16TaxCents: 1200000 }, true)
  expect(result.status).toBe('reconciled')
  if (result.status === 'reconciled') expect(result.lines['37']).toBe(300000)
})
test('blocks malformed and overflow external inputs', () => {
  expect(reconcileForm1040Arithmetic2025(mapping(), { ...verified, line16TaxCents: -1 }, true).status).toBe('blocked')
  expect(reconcileForm1040Arithmetic2025(mapping(), { ...verified, line16TaxCents: 0.5 }, true).status).toBe('blocked')
  expect(reconcileForm1040Arithmetic2025(mapping(), { ...verified, line16TaxCents: 100000000000000, line17Schedule2Part1Cents: 1 }, true).status).toBe('blocked')
})
test('blocks invalid source mapping even with externally reviewed tax', () => {
  const invalid = map2025SourcesTo1040({ year: 2025, filingStatus: 'single', w2: [{ id: '1', employer: '', box1: '10', box2: '1' }], interest: [], standardDeductionFactsConfirmed: true, taxpayerUnder65AndNotBlind: true, spouseUnder65AndNotBlind: true, notClaimableAsDependent: true, noOtherIncomeAdjustmentsCreditsOrTaxes: true })
  expect(reconcileForm1040Arithmetic2025(invalid, verified, true).status).toBe('blocked')
})
