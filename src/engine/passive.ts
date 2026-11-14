/**
 * Form 8582 (2025), Passive Activity Loss Limitations.
 *
 * Activities are rental real estate with active participation (Part IV) and all other passive
 * activities (Part V): rentals without active participation and K-1 businesses in which you did not
 * materially participate. Losses are allowed up to passive income plus the special allowance of up to
 * $25,000 for actively managed rentals (phased out between $100,000 and $150,000 of MAGI). The
 * allowance is spread over the rental losses (Part VI), the remaining unallowed loss over every loss
 * activity in proportion (Part VII), and the allowed loss per activity is Part VIII.
 */
import type { FilingStatus } from './rules2025.ts'
import * as R from './rules2025.ts'

const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)
const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0)

export interface PassiveActivity {
  id: string; name: string
  group: 'rental' | 'other'
  /** Current-year net income (+) or loss (−). */ net: number
  /** Prior years' unallowed loss (positive). */ prior: number
  /** Where the allowed loss is reported, e.g. "Sch. E, line 22". */ reportedOn: string
}

export interface ActivityResult extends PassiveActivity {
  /** Part IV/V columns. */ a: number; b: number; c: number; d: number; e: number
  specialAllowance: number
  unallowed: number
  /** Loss (current plus prior) that may be deducted this year. */ allowed: number
}

export interface Form8582Result {
  required: boolean
  activities: ActivityResult[]
  line1a: number; line1b: number; line1c: number; line1d: number
  line2a: number; line2b: number; line2c: number; line2d: number
  line3: number
  line4: number; line5: number; line6: number; line7: number; line8: number; line9: number
  line10: number; line11: number
  /** Total unallowed (carried to 2026). */ unallowed: number
  partVI: { id: string; name: string; reportedOn: string; loss: number; ratio: number; allowance: number; net: number }[]
  partVII: { id: string; name: string; reportedOn: string; loss: number; ratio: number; unallowed: number }[]
}

export function form8582(activities: PassiveActivity[], fs: FilingStatus, magi: number): Form8582Result {
  const acts = activities.map((x) => {
    const a = x.net > 0 ? r(x.net) : 0
    const b = x.net < 0 ? r(-x.net) : 0
    const c = r(pos(x.prior))
    const overall = a - b - c
    return { ...x, a, b, c, d: overall > 0 ? overall : 0, e: overall < 0 ? -overall : 0, specialAllowance: 0, unallowed: 0, allowed: b + c }
  })
  const rent = acts.filter((x) => x.group === 'rental')
  const other = acts.filter((x) => x.group === 'other')
  const line1a = sum(rent.map((x) => x.a)); const line1b = sum(rent.map((x) => x.b)); const line1c = sum(rent.map((x) => x.c))
  const line1d = line1a - line1b - line1c
  const line2a = sum(other.map((x) => x.a)); const line2b = sum(other.map((x) => x.b)); const line2c = sum(other.map((x) => x.c))
  const line2d = line2a - line2b - line2c
  const line3 = line1d + line2d
  const required = acts.some((x) => x.b > 0 || x.c > 0)
  let line4 = 0, line5 = 0, line6 = 0, line7 = 0, line8 = 0, line9 = 0
  const line10 = line1a + line2a
  const partVI: Form8582Result['partVI'] = []
  const partVII: Form8582Result['partVII'] = []
  if (line3 >= 0) {
    return { required, activities: acts, line1a, line1b, line1c, line1d, line2a, line2b, line2c, line2d, line3, line4, line5, line6, line7, line8, line9, line10, line11: line1b + line1c + line2b + line2c, unallowed: 0, partVI, partVII }
  }
  if (line1d < 0 && fs !== 'mfs') {
    line4 = Math.min(-line1d, -line3)
    line5 = R.PASSIVE_PHASEOUT_START + R.PASSIVE_ALLOWANCE / R.PASSIVE_PHASEOUT_RATE
    line6 = r(pos(magi))
    if (line6 < line5) {
      line7 = line5 - line6
      line8 = Math.min(r(line7 * R.PASSIVE_PHASEOUT_RATE), R.PASSIVE_ALLOWANCE)
    }
    line9 = Math.min(line4, line8)
  }
  const line11 = line9 + line10
  // Part VI: spread the special allowance over rental activities with an overall loss.
  const rentLosses = rent.filter((x) => x.e > 0)
  const rentLossTotal = sum(rentLosses.map((x) => x.e))
  if (line9 > 0) {
    let given = 0
    rentLosses.forEach((x, i) => {
      const ratio = x.e / rentLossTotal
      const allowance = i === rentLosses.length - 1 ? line9 - given : r(line9 * ratio)
      given += allowance
      x.specialAllowance = allowance
      partVI.push({ id: x.id, name: x.name, reportedOn: x.reportedOn, loss: x.e, ratio, allowance, net: x.e - allowance })
    })
  }
  // Part VII: the unallowed loss over every loss activity after the allowance.
  const unallowedTotal = -line3 - line9
  const losers = acts.filter((x) => x.e - x.specialAllowance > 0)
  const loserTotal = sum(losers.map((x) => x.e - x.specialAllowance))
  let assigned = 0
  losers.forEach((x, i) => {
    const loss = x.e - x.specialAllowance
    const ratio = loss / loserTotal
    const unallowed = i === losers.length - 1 ? unallowedTotal - assigned : r(unallowedTotal * ratio)
    assigned += unallowed
    x.unallowed = unallowed
    partVII.push({ id: x.id, name: x.name, reportedOn: x.reportedOn, loss, ratio, unallowed })
  })
  for (const x of acts) x.allowed = x.b + x.c - x.unallowed
  return { required, activities: acts, line1a, line1b, line1c, line1d, line2a, line2b, line2c, line2d, line3, line4, line5, line6, line7, line8, line9, line10, line11, unallowed: unallowedTotal, partVI, partVII }
}
