/** Explicit eligibility facts; unknown must never be treated as eligible. */
export type Answer2025 = 'yes' | 'no' | 'unknown'
export type ProfileFacts2025 = {
  taxpayer65: Answer2025
  taxpayerBlind: Answer2025
  spouse65: Answer2025
  spouseBlind: Answer2025
  claimableDependent: Answer2025
}
export const emptyProfileFacts2025 = (): ProfileFacts2025 => ({ taxpayer65: 'unknown', taxpayerBlind: 'unknown', spouse65: 'unknown', spouseBlind: 'unknown', claimableDependent: 'unknown' })
export const isAnswer2025 = (v: unknown): v is Answer2025 => v === 'yes' || v === 'no' || v === 'unknown'
export function parseProfileFacts2025(v: unknown): ProfileFacts2025 | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const f = v as Record<string, unknown>
  if (!['taxpayer65', 'taxpayerBlind', 'spouse65', 'spouseBlind', 'claimableDependent'].every(k => isAnswer2025(f[k]))) return null
  return { taxpayer65: f.taxpayer65 as Answer2025, taxpayerBlind: f.taxpayerBlind as Answer2025, spouse65: f.spouse65 as Answer2025, spouseBlind: f.spouseBlind as Answer2025, claimableDependent: f.claimableDependent as Answer2025 }
}
export function reviewProfileFacts2025(f: ProfileFacts2025, filingStatus: string) {
  const married = filingStatus === 'joint' || filingStatus === 'separate'
  const taxpayerUnder65AndNotBlind = f.taxpayer65 === 'no' && f.taxpayerBlind === 'no'
  const spouseUnder65AndNotBlind = !married || (f.spouse65 === 'no' && f.spouseBlind === 'no')
  const notClaimableAsDependent = f.claimableDependent === 'no'
  const unresolved = [
    ...(f.taxpayer65 === 'unknown' ? ['Taxpayer age 65+ status not reviewed'] : []),
    ...(f.taxpayerBlind === 'unknown' ? ['Taxpayer blindness status not reviewed'] : []),
    ...(married && f.spouse65 === 'unknown' ? ['Spouse age 65+ status not reviewed'] : []),
    ...(married && f.spouseBlind === 'unknown' ? ['Spouse blindness status not reviewed'] : []),
    ...(f.claimableDependent === 'unknown' ? ['Claimable-as-dependent status not reviewed'] : []),
  ]
  return { taxpayerUnder65AndNotBlind, spouseUnder65AndNotBlind, notClaimableAsDependent, unresolved,
    simpleStandardDeductionEligible: taxpayerUnder65AndNotBlind && spouseUnder65AndNotBlind && notClaimableAsDependent }
}
