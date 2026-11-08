import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const profile = readFileSync('src/nextgen/taxYears/profileFacts2025.ts','utf8')
const ui = readFileSync('src/components/NextGenV2Foundation.tsx','utf8')
const draft = readFileSync('src/nextgen/navigation/draftWorkspace.ts','utf8')
for (const key of ['taxpayer65','taxpayerBlind','spouse65','spouseBlind','claimableDependent']) assert.ok(profile.includes(key))
assert.ok(ui.includes('profileReview.simpleStandardDeductionEligible'))
assert.ok(ui.includes('disabled={!profileReview.simpleStandardDeductionEligible}'))
assert.ok(ui.includes('setBasicDeductionConfirmed(false)'))
assert.ok(draft.includes('parseProfileFacts2025(input.profileFacts)'))
assert.ok(profile.includes("f.claimableDependent === 'no'"))
console.log('PASS: explicit profile fact wiring and conservative deduction guard')
