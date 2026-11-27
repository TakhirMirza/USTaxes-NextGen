/**
 * 2025 audit: state income tax on given taxable incomes, checked against the published 2025 rate schedules and worksheets
 * (each expected value is figured here, independently of the engines, from the schedule cited next to it).
 * Incomes are at or above the point where each state's tax table gives way to its rate schedule.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { alTax } from './al2025.ts'
import { coTax } from './co2025.ts'
import { dcTax } from './dc2025.ts'
import { deTax } from './de2025.ts'
import { hiTax } from './hi2025.ts'
import { ksTax } from './ks2025.ts'
import { maTax } from './ma2025.ts'
import { mdTax } from './md2025.ts'
import { meTax } from './me2025.ts'
import { mnTax } from './mn2025.ts'
import { moTax } from './mo2025.ts'
import { mtOrdinaryTax } from './mt2025.ts'
import { ndTax } from './nd2025.ts'
import { neTax } from './ne2025.ts'
import { njTax } from './nj2025.ts'
import { nmTax } from './nm2025.ts'
import { ohTax } from './oh2025.ts'
import { okTax } from './ok2025.ts'
import { orTax } from './or2025.ts'
import { riTax } from './ri2025.ts'
import { scTax } from './sc2025.ts'
import { vaTax } from './va2025.ts'
import { wvTax } from './wv2025.ts'

/** Tax from a bracket list [[lower bound, rate], ...]. */
const brackets = (x: number, b: [number, number][]): number => b.reduce((t, [lo, rate], i) => t + Math.max(0, Math.min(x, b[i + 1]?.[0] ?? Infinity) - lo) * rate, 0)
const near = (got: number, want: number, what: string): void => assert.ok(Math.abs(got - want) <= 1, `${what}: ${got} vs ${want}`)

test('Alabama: Form 40/40NR worksheet over $100,000 ($4,958 / $4,918 + 5%) and the last table row', () => {
  assert.equal(alTax(150000, false), 4958 + 2500)
  assert.equal(alTax(150000, true), 4918 + 2500)
  assert.equal(alTax(99950, false), 4958)
  assert.equal(alTax(99950, true), 4918)
})

test('Ohio: R.C. 5747.02(A)(3)(b), 2025 — $342.00 + 2.75% over $26,050; $2,394.32 + 3.125% over $100,000', () => {
  near(ohTax(60000), 342 + 0.0275 * (60000 - 26050), 'OH 60k')
  near(ohTax(125000), 2394.32 + 0.03125 * 25000, 'OH 125k')
  assert.equal(ohTax(26000), 0)
})

test('Oklahoma: 0.25%–4.75% brackets (single to $7,200, joint to $14,400)', () => {
  near(okTax(150000, false), brackets(150000, [[0, 0.0025], [1000, 0.0075], [2500, 0.0175], [3750, 0.0275], [4900, 0.0375], [7200, 0.0475]]), 'OK single')
  near(okTax(150000, true), brackets(150000, [[0, 0.0025], [2000, 0.0075], [5000, 0.0175], [7500, 0.0275], [9800, 0.0375], [14400, 0.0475]]), 'OK joint')
})

test('Flat-rate states: Colorado 4.4%, Massachusetts 5% (the 4% surtax is figured on Form 1 line 22, not in maTax)', () => {
  near(coTax(200000), 8800, 'CO')
  near(maTax(200000), 10000, 'MA')
})

test('Graduated schedules: HI, KS, MD, ME, MN, MO, MT, ND, NE, NJ, NM, OR, RI, SC, VA, WV, DE, DC', () => {
  const x = 150000
  near(hiTax(x, 'single'), brackets(x, [[0, 0.014], [9600, 0.032], [14400, 0.055], [19200, 0.064], [24000, 0.068], [36000, 0.072], [48000, 0.076], [125000, 0.079], [175000, 0.0825], [225000, 0.09], [275000, 0.1], [325000, 0.11]]), 'HI')
  near(ksTax(x, false), brackets(x, [[0, 0.052], [23000, 0.0558]]), 'KS single')
  near(ksTax(x, true), brackets(x, [[0, 0.052], [46000, 0.0558]]), 'KS joint')
  near(mdTax(x, 1), brackets(x, [[0, 0.02], [1000, 0.03], [2000, 0.04], [3000, 0.0475], [100000, 0.05], [125000, 0.0525], [150000, 0.055], [250000, 0.0575], [500000, 0.0625], [1000000, 0.065]]), 'MD single')
  near(mdTax(600000, 2), brackets(600000, [[0, 0.02], [1000, 0.03], [2000, 0.04], [3000, 0.0475], [150000, 0.05], [175000, 0.0525], [225000, 0.055], [300000, 0.0575], [600000, 0.0625], [1200000, 0.065]]), 'MD joint')
  near(meTax(x, 'single'), brackets(x, [[0, 0.058], [26800, 0.0675], [63450, 0.0715]]), 'ME single')
  near(meTax(x, 'mfj'), brackets(x, [[0, 0.058], [53600, 0.0675], [126900, 0.0715]]), 'ME joint')
  near(mnTax(x, 'single'), brackets(x, [[0, 0.0535], [32570, 0.068], [106990, 0.0785], [198630, 0.0985]]), 'MN single')
  near(mnTax(400000, 'mfj'), brackets(400000, [[0, 0.0535], [47620, 0.068], [189180, 0.0785], [330410, 0.0985]]), 'MN joint')
  near(moTax(x), brackets(x, [[1313, 0.02], [2626, 0.025], [3939, 0.03], [5252, 0.035], [6565, 0.04], [7878, 0.045], [9191, 0.047]]), 'MO')
  near(mtOrdinaryTax(x, 'single'), brackets(x, [[0, 0.047], [21100, 0.059]]), 'MT single')
  near(mtOrdinaryTax(x, 'mfj'), brackets(x, [[0, 0.047], [42200, 0.059]]), 'MT joint')
  near(ndTax(300000, 'single'), brackets(300000, [[48475, 0.0195], [244825, 0.025]]), 'ND single')
  near(neTax(x, 'single'), brackets(x, [[0, 0.0246], [4030, 0.0351], [24120, 0.0501], [38870, 0.052]]), 'NE single')
  near(neTax(x, 'mfj'), brackets(x, [[0, 0.0246], [8040, 0.0351], [48250, 0.0501], [77730, 0.052]]), 'NE joint')
  near(njTax(x, 'single'), brackets(x, [[0, 0.014], [20000, 0.0175], [35000, 0.035], [40000, 0.05525], [75000, 0.0637], [500000, 0.0897], [1000000, 0.1075]]), 'NJ single')
  near(njTax(x, 'mfj'), brackets(x, [[0, 0.014], [20000, 0.0175], [50000, 0.0245], [70000, 0.035], [80000, 0.05525], [150000, 0.0637], [500000, 0.0897], [1000000, 0.1075]]), 'NJ joint')
  // New Mexico: the Department's 2025 Tax Rate Table (PIT-TRT) for income over $100,000 is $2 below the statutory schedule
  // (single $4,356 / $9,746; joint $4,087 / $14,622 against $4,358 / $4,089 in §7-2-7). PIT-1 line 18 uses the table, as the engine does.
  near(nmTax(250000, 'single'), 9746 + 0.059 * 40000, 'NM single (PIT-TRT)')
  near(nmTax(400000, 'mfj'), 14622 + 0.059 * 85000, 'NM joint (PIT-TRT)')
  near(nmTax(250000, 'single') + 2, brackets(250000, [[0, 0.015], [5500, 0.032], [16500, 0.043], [33500, 0.047], [66500, 0.049], [210000, 0.059]]), 'NM single vs statute')
  // Oregon 2025 tax rate charts (OR-40 instructions): S $4,065 + 8.75% over $50,000, $10,627 + 9.9% over $125,000; J $3,756 / $21,256.
  near(orTax(x, false), 10627 + 0.099 * 25000, 'OR single')
  near(orTax(100000, false), 4065 + 0.0875 * 50000, 'OR single 100k')
  near(orTax(300000, true), 21256 + 0.099 * 50000, 'OR joint')
  near(orTax(30000, false), 661 + 0.0875 * (30050 - 11100), 'OR table row $30,000–$30,100 (midpoint, chart S brackets $4,400 / $11,100)')
  near(riTax(200000), brackets(200000, [[0, 0.0375], [79900, 0.0475], [181650, 0.0599]]), 'RI')
  near(scTax(x), brackets(x, [[3560, 0.03], [17830, 0.06]]), 'SC')
  near(vaTax(x), brackets(x, [[0, 0.02], [3000, 0.03], [5000, 0.05], [17000, 0.0575]]), 'VA')
  near(wvTax(x, false).tax, brackets(x, [[0, 0.0222], [10000, 0.0296], [25000, 0.0333], [40000, 0.0444], [60000, 0.0482]]), 'WV')
  near(deTax(x), brackets(x, [[2000, 0.022], [5000, 0.039], [10000, 0.048], [20000, 0.052], [25000, 0.0555], [60000, 0.066]]), 'DE')
  near(dcTax(x), brackets(x, [[0, 0.04], [10000, 0.06], [40000, 0.065], [60000, 0.085], [250000, 0.0925], [500000, 0.0975], [1000000, 0.1075]]), 'DC')
})
