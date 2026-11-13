/**
 * Form 4797 (2025): sales of business and rental property.
 *
 * Property held more than a year: depreciable property sold at a gain goes through Part III
 * (section 1245 recapture is ordinary; buildings depreciated straight line have no recapture),
 * the rest of the gain and any loss is section 1231 (Part I). A net 1231 gain is a long-term
 * capital gain on Schedule D line 11, less any 1231 losses from the last five years; a net 1231 loss
 * is ordinary. Property held a year or less is ordinary (Part II line 10).
 */
import type { PropertySale } from './model.ts'
import { holdingTermFromDates, parseDate } from './capital.ts'

const r = (n: number): number => Math.round(n)
const pos = (n: number): number => Math.max(0, n)

export interface SaleResult {
  id: string; description: string; kind: PropertySale['kind']; usedIn: PropertySale['usedIn']
  dateAcquired: string; dateSold: string
  salesPrice: number; costBasis: number; depreciation: number; adjustedBasis: number; gain: number
  longTerm: boolean
  /** Where it is reported: Part I line 2, Part II line 10, or Part III. */ part: 'I' | 'II' | 'III'
  /** Part III: line 25b (section 1245) or 26g (section 1250). */ recapture: number
  /** Unrecaptured section 1250 gain (taxed at up to 25%). */ unrecaptured1250: number
}

export interface Form4797Result {
  sales: SaleResult[]
  line1a: number
  /** Part I */ line2: number; line6: number; line7: number; line8: number; line9: number
  /** Part II */ line10: number; line11: number; line12: number; line13: number; line17: number; line18b: number
  /** Part III */ line30: number; line31: number; line32: number
  /** Long-term capital gain for Schedule D line 11. */ scheduleDGain: number
  /** Unrecaptured section 1250 gain for Schedule D line 19. */ unrecaptured1250: number
  /** Net gain from rental property (net investment income). */ rentalNet: number
  /** 1231 losses still to recapture in later years (line 8 less what line 12 used). */ remaining1231Losses: number
  issues: string[]
}

export function form4797(sales: PropertySale[], prior1231Losses: number): Form4797Result {
  const issues: string[] = []
  const results: SaleResult[] = sales.map((x, i) => {
    const label = x.description.trim() || `Property sale ${i + 1}`
    const term = holdingTermFromDates(x.dateAcquired, x.dateSold)
    if (!term) issues.push(`${label}: enter the dates acquired and sold (MM/DD/YYYY).`)
    const sold = parseDate(x.dateSold)
    if (sold && sold.getUTCFullYear() !== 2025) issues.push(`${label}: the sale date is not in 2025.`)
    const depreciation = x.kind === 'land' ? 0 : r(pos(x.depreciation))
    if (x.kind === 'land' && x.depreciation > 0) issues.push(`${label}: land is not depreciated; choose equipment or building if depreciation was taken.`)
    const adjustedBasis = r(pos(x.costBasis)) - depreciation
    const gain = r(x.salesPrice) - adjustedBasis
    const longTerm = term !== 'short'
    let part: SaleResult['part'] = 'II'
    let recapture = 0
    let unrecaptured1250 = 0
    if (longTerm) {
      if (gain > 0 && depreciation > 0) {
        part = 'III'
        if (x.kind === '1245') recapture = Math.min(gain, depreciation)
        if (x.kind === '1250') unrecaptured1250 = Math.min(gain, depreciation)
      } else part = 'I'
    }
    return {
      id: x.id, description: label, kind: x.kind, usedIn: x.usedIn, dateAcquired: x.dateAcquired, dateSold: x.dateSold,
      salesPrice: r(x.salesPrice), costBasis: r(pos(x.costBasis)), depreciation, adjustedBasis, gain, longTerm, part, recapture, unrecaptured1250
    }
  })
  const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0)
  const line1a = r(sum(sales.filter((x) => x.reportedOn1099).map((x) => x.salesPrice)))
  const line2 = sum(results.filter((x) => x.part === 'I').map((x) => x.gain))
  const partIII = results.filter((x) => x.part === 'III')
  const line30 = sum(partIII.map((x) => x.gain))
  const line31 = sum(partIII.map((x) => x.recapture))
  const line32 = line30 - line31
  const line6 = line32
  const line7 = line2 + line6
  const line8 = line7 > 0 ? r(pos(prior1231Losses)) : 0
  const line9 = line7 > 0 ? pos(line7 - line8) : 0
  const line12 = line7 > 0 ? Math.min(line7, line8) : 0
  const line11 = line7 < 0 ? line7 : 0
  const line10 = sum(results.filter((x) => x.part === 'II').map((x) => x.gain))
  const line13 = line31
  const line17 = line10 + line11 + line12 + line13
  // Unrecaptured section 1250 gain cannot exceed the 1231 gain that reaches Schedule D.
  const unrecaptured1250 = Math.min(sum(results.map((x) => x.unrecaptured1250)), line9)
  const rentalNet = sum(results.filter((x) => x.usedIn === 'rental').map((x) => x.gain))
  return {
    sales: results, line1a, line2, line6, line7, line8, line9, line10, line11, line12, line13, line17, line18b: line17,
    line30, line31, line32, scheduleDGain: line9, unrecaptured1250, rentalNet,
    remaining1231Losses: line7 > 0 ? pos(r(pos(prior1231Losses)) - line7) : r(pos(prior1231Losses)), issues
  }
}
