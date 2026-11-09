import { normalizeReturn } from '../engine/model.ts'
import type { TaxReturnInput } from '../engine/model.ts'

/** A made-up household that touches most of the app: two jobs, two children, daycare, college, a side business. */
export function exampleReturn(): TaxReturnInput {
  return normalizeReturn({
    filingStatus: 'mfj',
    taxpayer: { firstName: 'Maria', lastName: 'Example', ssn: '400010001', age: 38, occupation: 'Medical assistant' },
    spouse: { firstName: 'David', lastName: 'Example', ssn: '400010002', age: 40, occupation: 'Electrician' },
    contact: { street: '100 Sample St', city: 'Springfield', state: 'VA', zip: '22150', livedInUsHalfYear: true },
    digitalAssets: false,
    dependents: [
      { id: 'ex-d1', name: 'Lucy Example', relationship: 'Daughter', age: 7, ssn: '400010003', hasSsn: true, monthsLivedWithYou: 12, childRelationship: true },
      { id: 'ex-d2', name: 'Sam Example', relationship: 'Son', age: 3, ssn: '400010004', hasSsn: true, monthsLivedWithYou: 12, childRelationship: true }
    ],
    w2s: [
      { id: 'ex-w1', owner: 'taxpayer', employer: 'Springfield Clinic', wages: 30000, federalWithholding: 1500, socialSecurityWages: 30000, socialSecurityWithheld: 1860, medicareWages: 30000, medicareWithheld: 435 },
      { id: 'ex-w2', owner: 'spouse', employer: 'Bright Line Electric', wages: 12000, federalWithholding: 600, socialSecurityWages: 12000, socialSecurityWithheld: 744, medicareWages: 12000, medicareWithheld: 174 }
    ],
    interest: [{ id: 'ex-i1', payer: 'Community Credit Union', interest: 320 }],
    businesses: [{
      id: 'ex-b1', owner: 'spouse', name: 'David’s Weekend Repairs', activity: 'Home electrical repair', businessCode: '238210',
      required1099s: false, grossReceipts: 6500, expenses: { supplies: 1400, advertising: 200 }
    }],
    savings: { taxpayer: { iraContributions: 0, electiveDeferrals: 2900, distributions: 0 }, spouse: { iraContributions: 1000, electiveDeferrals: 0, distributions: 0 } },
    dependentCare: { expenses: 5200, employerBenefits: 0, providers: [{ id: 'ex-p1', name: 'Sunny Days Preschool', address: '20 Elm Ave, Springfield, VA 22150', tin: '540000001', amountPaid: 5200 }] },
    priorYear: { tax: 900, agi: 44000, noLiability: false }
  })
}

/** True when the return already has something worth keeping. */
export function hasEntries(r: TaxReturnInput): boolean {
  return !!(r.taxpayer.firstName || r.taxpayer.lastName || r.w2s.length || r.businesses.length || r.dependents.length ||
    r.interest.length || r.dividends.length || r.retirement.length || r.socialSecurity.length)
}
