import { stepFromV2Path, v2PathForStep } from './v2Routes'

describe('NextGen 2.0 stable step navigation', () => {
  it('provides stable deep links for each step', () => {
    expect(v2PathForStep('overview')).toBe('/start')
    expect(v2PathForStep('profile')).toBe('/v2/profile')
    expect(v2PathForStep('income')).toBe('/v2/income')
    expect(v2PathForStep('deductions')).toBe('/v2/deductions')
    expect(v2PathForStep('review')).toBe('/v2/review')
  })
  it('recovers the correct step on browser refresh or back navigation', () => {
    expect(stepFromV2Path('/start')).toBe('overview')
    expect(stepFromV2Path('/v2/income')).toBe('income')
    expect(stepFromV2Path('/v2/review/')).toBe('review')
  })
  it('fails closed to overview for unknown routes', () => {
    expect(stepFromV2Path('/v2/invalid')).toBe('overview')
    expect(stepFromV2Path('/v2/review/other')).toBe('overview')
  })
})
