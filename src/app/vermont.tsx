/**
 * The Vermont part of the State step: Form IN-111 with Schedules IN-112, IN-113, IN-117, IN-119 and IN-153, the
 * Homestead Declaration / Property Tax Credit Claim (HS-122 with HI-144) and the Renter Credit Claim (RCC-146).
 */
import { ReactElement, useMemo, useState } from 'react'
import type { Owner, Person, VtInput } from '../engine/model.ts'
import { computeVermont } from '../engine/vt2025.ts'
import { buildVtPacket } from '../pdf/vt2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { Check, Choice, MoneyField, NumberField, Section, TextField, usd } from './fields'
import { StatementRows } from './statements'
import type { StepProps } from './steps'

const LINES: [line: string, label: string][] = [
  ['1', 'Federal adjusted gross income'], ['2', 'Net modifications (IN-112)'], ['3', 'Federal AGI with modifications'], ['4', 'Standard deduction'],
  ['5e', 'Personal exemptions'], ['7', 'Vermont taxable income'], ['8', 'Vermont income tax'], ['9', 'Tax adjustments (IN-119)'], ['13', 'Charitable contribution credit'],
  ['14', 'Vermont income tax'], ['16', 'Adjusted Vermont income tax'], ['17', 'Credit for tax paid to another state (IN-117)'], ['18', 'Vermont tax credits (IN-119)'],
  ['20', 'Tax after credits'], ['21', 'Child care contribution (self-employed)'], ['22', 'Use tax'], ['24e', 'Voluntary contributions'], ['25', 'Total taxes and contributions'],
  ['26a', 'Vermont tax withheld'], ['26b', 'Estimated payments'], ['26c', 'Refundable credits (IN-112)'], ['26d', 'Real estate withholding'], ['26f', 'Total payments and credits'],
  ['28a', 'Applied to 2026 estimated tax'], ['28b', 'Applied to the property tax bill'], ['29', 'Refund'], ['32', 'Amount due']
]
const ALWAYS = new Set(['1', '7', '8', '16', '20', '25', '26f'])
const KEY = new Set(['20', '29', '32'])
const FUNDS: [string, string][] = [['24a', 'Vermont Veterans Fund'], ['24b', 'Green Up Vermont'], ['24c', 'Nongame Wildlife Fund'], ['24d', 'Vermont Children’s Trust Foundation']]
const IN119_CREDITS: [string, string][] = [['2', 'Charitable housing'], ['3', 'Qualified sale of mobile home park'], ['4', 'Research and development'], ['5', 'Affordable housing'], ['6', 'Historic rehabilitation'], ['7', 'Facade improvement'], ['8', 'Code improvements']]
const COUNTIES = ['Addison', 'Bennington', 'Caledonia', 'Chittenden', 'Essex', 'Franklin', 'Grand Isle', 'Lamoille', 'Orange', 'Orleans', 'Rutland', 'Washington', 'Windham', 'Windsor']
const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback
const date = (s: string): string => (/^\d{8}$/.test(s.trim()) ? `${s.slice(0, 2)}/${s.slice(2, 4)}/${s.slice(4)}` : s)

export function VermontStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const d = ret.vt
  const vt = useMemo(() => computeVermont(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<VtInput>): void => set((r) => ({ ...r, vt: { ...r.vt, ...p } }))
  const putH = (p: Partial<VtInput['homestead']>): void => put({ homestead: { ...d.homestead, ...p } })
  const putR = (p: Partial<VtInput['renter']>): void => put({ renter: { ...d.renter, ...p } })
  const putO = (p: Partial<VtInput['otherState']>): void => put({ otherState: { ...d.otherState, ...p } })
  const putQ = (p: Partial<VtInput['in119']>): void => put({ in119: { ...d.in119, ...p } })
  const putCg = (p: Partial<VtInput['cg']>): void => put({ cg: { ...d.cg, ...p } })
  const married = ret.filingStatus === 'mfj'
  const owners: Owner[] = married ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const packet = buildVtPacket(ret, result, vt, preparer)
  const L = vt.lines
  const owes = L['32'] > 0
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  const r1099 = ret.retirement.filter((x) => owners.includes(x.owner))
  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadVermontForms }) => downloadVermontForms(ret, result, vt, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }
  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'Vermont: you owe' : 'Vermont refund'}</p>
          <p className="va-result-amount">{usd(owes ? L['32'] : L['29'])}</p>
        </div>
        <dl>
          <div><dt>Vermont taxable income</dt><dd>{usd(L['7'])}</dd></div>
          <div><dt>Tax after credits</dt><dd>{usd(L['20'])}</dd></div>
          <div><dt>Refundable credits</dt><dd>{usd(L['26c'])}</dd></div>
        </dl>
      </div>

      <Section title="Vermont return" intro="Vermont starts from federal AGI, takes a $7,650 standard deduction ($15,300 joint, $11,450 head of household) and $5,300 per exemption, and taxes the rest at 3.35% to 8.75%.">
        <div className="grid">
          <TextField label="School district code" hint="3 digits, required; see the list in the booklet" autoComplete="off" value={d.schoolCode} onChange={(s) => put({ schoolCode: s.replace(/\D/g, '').slice(0, 3) })} />
          <TextField label="911 physical address on 12/31/2025" hint="Leave blank if it’s your mailing address" autoComplete="off" value={d.physicalAddress} onChange={(s) => put({ physicalAddress: s })} />
          {owners.map((o) => (
            <TextField key={o} label={`${names[o]}: date of birth`} hint="Next to the signature" placeholder="mm/dd/yyyy" autoComplete="off" value={d.birthDates[o]} onChange={(s) => put({ birthDates: { ...d.birthDates, [o]: date(s) } })} />
          ))}
          {owners.map((o) => (
            <Check key={`c${o}`} label={`${names[o]} had health coverage all year`} hint="Healthcare coverage code" checked={d.coverage[o]} onChange={(v) => put({ coverage: { ...d.coverage, [o]: v } })} />
          ))}
          <Check label="Veteran (discharge record from the uniformed services)" hint="$250 refundable credit with AGI up to $25,000, none from $30,000" checked={d.veteran} onChange={(v) => put({ veteran: v })} />
        </div>
      </Section>

      <Section title="Vermont withholding and payments" intro="From the state section of each W-2 (boxes 15–17) and 1099-R (boxes 14–16).">
        {w2s.length > 0
          ? <StatementRows kind="w2" state="Vermont" items={w2s.map((w) => ({ id: w.id, title: `${w.employer.trim() || 'W-2'} (${names[w.owner]})`, federal: w.wages }))} value={d.w2} onChange={(w2) => put({ w2 })} />
          : <p className="why">No W-2s entered.</p>}
        {r1099.length > 0 && <StatementRows kind="1099r" state="Vermont" items={r1099.map((x) => ({ id: x.id, title: `${x.payer.trim() || '1099-R'} (${names[x.owner]})`, federal: x.taxableAmount }))} value={d.r1099} onChange={(r) => put({ r1099: r })} />}
        <div className="grid">
          <MoneyField label="2025 estimated, extension and carried-forward payments" hint="Line 26b" value={d.estimatedPayments} onChange={(n) => put({ estimatedPayments: n })} />
          <MoneyField label="Real estate withholding (Form RW-171)" hint="Line 26d" value={d.realEstateWithholding} onChange={(n) => put({ realEstateWithholding: n })} />
          {L['27'] > 0 && <MoneyField label="Apply to 2026 estimated tax" hint="Line 28a" value={d.creditForward} onChange={(n) => put({ creditForward: n })} />}
          {L['27'] > 0 && <MoneyField label="Apply to the 2026/2027 homestead property tax bill" hint="Line 28b; the state adds 1%" value={d.propertyTaxCredit} onChange={(n) => put({ propertyTaxCredit: n })} />}
        </div>
      </Section>

      {(L['30'] > 0 || d.in152.priorTax !== null) && (
        <Section title="Underpaid estimated tax (Worksheet IN-152)" intro="If less than 90% of this year’s tax (or 100% of last year’s) was paid by each quarterly due date, Vermont adds interest and a 1% a month penalty on line 31. The worksheet is kept with your records.">
          <div className="grid">
            <Check label="Figure the interest and penalty" hint="Needs your 2024 Vermont tax" checked={d.in152.priorTax !== null} onChange={(v) => put({ in152: { ...d.in152, priorTax: v ? 0 : null } })} />
            {d.in152.priorTax !== null && <MoneyField label="2024 Vermont tax minus credits" hint="2024 IN-111 line 20 minus line 26c; line 2" value={d.in152.priorTax} onChange={(n) => put({ in152: { ...d.in152, priorTax: n } })} />}
            {d.in152.priorTax !== null && <TextField label="Date the balance was paid in full" hint="MM/DD/YYYY; blank means April 15, 2026 (line 7)" autoComplete="off" value={d.in152.paidDate} onChange={(s) => put({ in152: { ...d.in152, paidDate: s } })} />}
            {d.in152.priorTax !== null && <Check label="Estimated payments were not spread evenly over the four due dates" hint="Line 5b" checked={d.in152.quarterly !== null} onChange={(v) => put({ in152: { ...d.in152, quarterly: v ? [0, 0, 0, 0] : null } })} />}
            {d.in152.priorTax !== null && d.in152.quarterly && ['By April 15, 2025 (with the 2024 carryforward)', 'By June 15, 2025', 'By Sept. 15, 2025', 'By Jan. 15, 2026'].map((label, i) => (
              <MoneyField key={label} label={label} value={d.in152.quarterly![i]} onChange={(n) => { const q = [...d.in152.quarterly!] as [number, number, number, number]; q[i] = n; put({ in152: { ...d.in152, quarterly: q } }) }} />
            ))}
          </div>
          {vt.in152 && <p className="why">Interest {usd(vt.in152.l11)} + penalty {usd(vt.in152.l14)} = {usd(vt.in152.l15)} on line 31.</p>}
        </Section>
      )}

      <Section title="Additions and subtractions (IN-112)" intro="Other states’ municipal bond interest, the medical deduction and the child, care and earned income credits are worked out from your return.">
        <div className="grid">
          <MoneyField label="Vermont municipal bond interest included in tax-exempt interest" hint="Line 2" value={d.vtObligationInterest} onChange={(n) => put({ vtObligationInterest: n })} />
          <MoneyField label="2025 federal bonus depreciation" hint="Line 4" value={d.bonusDepreciation} onChange={(n) => put({ bonusDepreciation: n })} />
          <MoneyField label="Interest on U.S. government obligations" hint="Line 7" value={d.usObligationInterest} onChange={(n) => put({ usObligationInterest: n })} />
          <MoneyField label="Prior years’ bonus depreciation adjustment" hint="Line 9" value={d.priorBonusDepreciation} onChange={(n) => put({ priorBonusDepreciation: n })} />
          <MoneyField label="Taxable refunds of state and local income tax" hint="Line 10; from Schedule 1" value={d.taxableRefunds} onChange={(n) => put({ taxableRefunds: n })} />
          <MoneyField label="Retirement community fees in medical expenses" hint="Medical worksheet line 1b" value={d.medicalNonAllowable} onChange={(n) => put({ medicalNonAllowable: n })} />
          <MoneyField label="Public pension not covered by Social Security" hint="Line 12; CSRS or state system, up to $10,000" value={d.publicPension} onChange={(n) => put({ publicPension: n })} />
          <MoneyField label="Taxable military retirement / survivor benefits" hint="Line 13; phased out from $125,000 to $175,000 AGI" value={d.militaryRetirement} onChange={(n) => put({ militaryRetirement: n })} />
          <MoneyField label="Railroad retirement (Tier 1 and 2) in federal AGI" hint="Line 14" value={d.railroadRetirement} onChange={(n) => put({ railroadRetirement: n })} />
          <MoneyField label="VSAC, Build America, VT Telecom or VPPSA bond interest" hint="Line 15" value={d.bondInterest} onChange={(n) => put({ bondInterest: n })} />
          <MoneyField label="Student loan interest paid in 2025" hint="Line 16a; residents" value={d.studentLoanInterest} onChange={(n) => put({ studentLoanInterest: n })} />
          <MoneyField label="Exempt active-duty military pay" hint="IN-113 line 32" value={d.militaryPay} onChange={(n) => put({ militaryPay: n })} />
          {d.militaryPay > 0 && <NumberField label="Months on active duty" max={12} value={d.activeDutyMonths} onChange={(n) => put({ activeDutyMonths: n })} />}
        </div>
        {d.bondInterest > 0 && (
          <Choice legend="Bond issuer (line 15)" value={d.bondKind} onChange={(bondKind) => put({ bondKind })} options={[
            { value: 'VSAC', label: 'VSAC' }, { value: 'Build America', label: 'Build America' }, { value: 'VT Telecom', label: 'VT Telecom Authority' }, { value: 'VT Public', label: 'VT Public Power Supply Authority' }
          ]} />
        )}
        {(result.f1040['6b'] ?? 0) > 0 && d.publicPension > 0 && (
          <Choice legend="Retirement income exemption (only one)" value={d.retirementChoice} onChange={(retirementChoice) => put({ retirementChoice })} options={[
            { value: 'auto', label: 'Whichever is larger' }, { value: 'ss', label: 'Social Security' }, { value: 'pension', label: 'Public pension' }
          ]} />
        )}
      </Section>

      <Section title="Capital gains exclusion (IN-153)" intro={`Exclusion ${usd(vt.p1['8'])}: the flat exclusion is the lesser of $5,000 or your net long-term gain. 40% of gains on business assets held more than three years may be more.`}>
        <Choice legend="Exclusion" value={d.capitalGainsMethod} onChange={(capitalGainsMethod) => put({ capitalGainsMethod })} options={[
          { value: 'flat', label: 'Flat exclusion' }, { value: 'percentage', label: 'Percentage exclusion too', hint: 'Uses whichever is larger' }
        ]} />
        {d.capitalGainsMethod === 'percentage' && (
          <div className="grid">
            <MoneyField label="Gain on assets held three years or less" hint="Line 11" value={d.cg.shortHeld} onChange={(n) => putCg({ shortHeld: n })} />
            <MoneyField label="Gain on homes held longer" hint="Line 13a; not eligible" value={d.cg.homes} onChange={(n) => putCg({ homes: n })} />
            <MoneyField label="Gain on depreciable personal property held longer" hint="Line 13b; not eligible" value={d.cg.personalProperty} onChange={(n) => putCg({ personalProperty: n })} />
            <MoneyField label="Gain on publicly traded stocks and bonds held longer" hint="Line 13c; not eligible" value={d.cg.publicSecurities} onChange={(n) => putCg({ publicSecurities: n })} />
          </div>
        )}
      </Section>

      <Section title="Credit for tax paid to another state (IN-117)" intro={vt.in117 ? `Credit ${usd(L['17'])}.` : 'Only if another state or Canadian province taxed income that Vermont also taxes.'}>
        <div className="grid">
          <TextField label="State or province" hint="Two letters" autoComplete="off" value={d.otherState.state} onChange={(s) => putO({ state: s.toUpperCase().slice(0, 2) })} />
          <MoneyField label="AGI taxed there and in Vermont" hint="Line 2" value={d.otherState.income} onChange={(n) => putO({ income: n })} />
          <MoneyField label="Income tax paid there on that income" hint="Line 20" value={d.otherState.tax} onChange={(n) => putO({ tax: n })} />
          {d.otherState.tax > 0 && <>
            <MoneyField label="Bonus depreciation addback taxed in both" hint="Line 3" value={d.otherState.bonusAdded} onChange={(n) => putO({ bonusAdded: n })} />
            <MoneyField label="Non-Vermont bond interest taxed in both" hint="Line 4" value={d.otherState.muniInterest} onChange={(n) => putO({ muniInterest: n })} />
            <MoneyField label="Bonus depreciation subtracted there" hint="Line 6" value={d.otherState.bonusSubtracted} onChange={(n) => putO({ bonusSubtracted: n })} />
            <MoneyField label="U.S. interest subtracted there" hint="Line 7" value={d.otherState.usInterest} onChange={(n) => putO({ usInterest: n })} />
          </>}
        </div>
      </Section>

      <Section title="Other taxes and credits" intro="24% of the federal additional tax on early retirement or HSA distributions is added automatically (IN-119 line 1).">
        <div className="grid">
          <MoneyField label="Self-employment earnings from work outside Vermont" hint="Child care contribution worksheet line 2" value={d.seOutsideVt} onChange={(n) => put({ seOutsideVt: n })} />
        </div>
        <Choice legend="Use tax on untaxed purchases (line 22)" value={d.useTax.mode} onChange={(mode) => put({ useTax: { ...d.useTax, mode } })} options={[
          { value: 'none', label: 'None due', hint: 'You certify that none is owed' }, { value: 'estimate', label: 'Use the estimate table', hint: 'By AGI' }, { value: 'amount', label: 'Enter the amount' }
        ]} />
        {d.useTax.mode === 'amount' && <div className="grid"><MoneyField label="Use tax" hint="From the use tax worksheet" value={d.useTax.amount} onChange={(n) => put({ useTax: { ...d.useTax, amount: n } })} /></div>}
        <details>
          <summary>IN-119 adjustments and Vermont tax credits</summary>
          <div className="grid">
            <MoneyField label="Recapture of federal investment tax credit" hint="IN-119 line 2" value={d.in119.itcRecapture} onChange={(n) => putQ({ itcRecapture: n })} />
            <MoneyField label="Tax on lump-sum distributions (Form 4972)" hint="Line 3" value={d.in119.lumpSumTax} onChange={(n) => putQ({ lumpSumTax: n })} />
            <MoneyField label="Recapture of Vermont credits" hint="Line 6" value={d.in119.vtRecapture} onChange={(n) => putQ({ vtRecapture: n })} />
            <MoneyField label="Credit for the elderly or disabled (Schedule R)" hint="Line 8" value={d.in119.elderlyCredit} onChange={(n) => putQ({ elderlyCredit: n })} />
            <MoneyField label="Investment tax credit, Vermont-based" hint="Line 9" value={d.in119.vtInvestmentCredit} onChange={(n) => putQ({ vtInvestmentCredit: n })} />
            <MoneyField label="Vermont farm income averaging credit" hint="Line 10" value={d.in119.farmAveraging} onChange={(n) => putQ({ farmAveraging: n })} />
            <MoneyField label="Vermont solar energy credit carryforward" hint="Line 13" value={d.in119.solarCarryforward} onChange={(n) => putQ({ solarCarryforward: n })} />
            <MoneyField label="Vermont 529 contributions eligible for the credit" hint="Part II line 1; 10%" value={d.in119.higherEdContribution} onChange={(n) => putQ({ higherEdContribution: n })} />
            {IN119_CREDITS.map(([k, label]) => (
              <MoneyField key={k} label={`${label}: earned in 2025 + carryforward`} hint={`Part II line ${k}`} value={(d.in119.credits[k]?.earned ?? 0) + (d.in119.credits[k]?.carry ?? 0)}
                onChange={(n) => putQ({ credits: { ...d.in119.credits, [k]: { earned: n, carry: 0 } } })} />
            ))}
            <TextField label="Business entity name (credits through an S corporation, LLC or partnership)" autoComplete="off" value={d.in119.entityName} onChange={(s) => putQ({ entityName: s })} />
            <TextField label="Entity FEIN" autoComplete="off" value={d.in119.entityFein} onChange={(s) => putQ({ entityFein: s })} />
          </div>
        </details>
      </Section>

      <Section title="Voluntary contributions" intro="Lines 24a–24d: taken from your refund or added to what you owe.">
        <div className="grid">
          {FUNDS.map(([k, label]) => <MoneyField key={k} label={label} hint={`Line ${k}`} value={d.contributions[k] ?? 0} onChange={(n) => put({ contributions: { ...d.contributions, [k]: n } })} />)}
        </div>
      </Section>

      <Section title="Homestead declaration and property tax credit (HS-122)" intro="Homeowners must declare their Vermont home every year. With household income up to $115,400 you can also claim a property tax credit; the Department works it out and puts it on your 2026/2027 property tax bill.">
        <div className="grid">
          <Check label="I own and live in my Vermont home (file the homestead declaration)" checked={d.homestead.file} onChange={(v) => putH({ file: v })} />
          {d.homestead.file && <Check label="Also claim the property tax credit" hint="Schedule HI-144 is filled in from your return" checked={d.homestead.claimCredit} onChange={(v) => putH({ claimCredit: v })} />}
        </div>
        {d.homestead.file && (
          <div className="grid">
            <TextField label="SPAN (11 digits, from the property tax bill)" autoComplete="off" value={d.homestead.span} onChange={(s) => putH({ span: s })} />
            <TextField label="Location of the homestead" hint="Number and street, not a PO box" autoComplete="off" value={d.homestead.location} onChange={(s) => putH({ location: s })} />
            <TextField label="City or town of legal residence on April 1, 2026" autoComplete="off" value={d.homestead.town} onChange={(s) => putH({ town: s })} />
            <NumberField label="Business use of the dwelling (%)" hint="Only if over 25%" max={100} value={d.homestead.businessUse} onChange={(n) => putH({ businessUse: n })} />
            <NumberField label="Rental use of the dwelling (%)" max={100} value={d.homestead.rentalUse} onChange={(n) => putH({ rentalUse: n })} />
            <Check label="Other buildings on the parcel are rented or used for business" checked={d.homestead.otherBuildings} onChange={(v) => putH({ otherBuildings: v })} />
            {d.homestead.claimCredit && <>
              <MoneyField label="Housesite value" hint="B4; 2025/2026 bill" value={d.homestead.housesiteValue} onChange={(n) => putH({ housesiteValue: n })} />
              <MoneyField label="Housesite education tax" hint="B5" value={d.homestead.educationTax} onChange={(n) => putH({ educationTax: n })} />
              <MoneyField label="Housesite municipal tax" hint="B6" value={d.homestead.municipalTax} onChange={(n) => putH({ municipalTax: n })} />
              <NumberField label="Ownership interest of household members (%)" hint="B7" max={100} value={d.homestead.ownership} onChange={(n) => putH({ ownership: n })} />
              <MoneyField label="Cash public assistance" hint="HI-144 line a" value={d.homestead.publicAssistance} onChange={(n) => putH({ publicAssistance: n })} />
              <MoneyField label="SSI, veterans’ and railroad benefits not on the SSA-1099" hint="Line b" value={d.homestead.otherBenefits} onChange={(n) => putH({ otherBenefits: n })} />
              <MoneyField label="Workers’ compensation" hint="Line c" value={d.homestead.workersComp} onChange={(n) => putH({ workersComp: n })} />
              <MoneyField label="Alimony and support money received" hint="Line g" value={d.homestead.alimony} onChange={(n) => putH({ alimony: n })} />
              <MoneyField label="Child support and cash gifts received" hint="Line h; gifts over $6,500" value={d.homestead.childSupportAndGifts} onChange={(n) => putH({ childSupportAndGifts: n })} />
              <MoneyField label="Partnership, S corporation, farm, trust income" hint="Line m; losses count as zero" value={d.homestead.passThroughIncome} onChange={(n) => putH({ passThroughIncome: n })} />
              <MoneyField label="Other nontaxable income" hint="Line n" value={d.homestead.otherIncome} onChange={(n) => putH({ otherIncome: n })} />
              <MoneyField label="Child support paid" hint="Line q" value={d.homestead.childSupportPaid} onChange={(n) => putH({ childSupportPaid: n })} />
              <MoneyField label="Alimony paid" hint="Line r2" value={d.homestead.alimonyPaid} onChange={(n) => putH({ alimonyPaid: n })} />
              <MoneyField label="Income of other household members" hint="Column 3" value={d.homestead.otherPeopleIncome} onChange={(n) => putH({ otherPeopleIncome: n })} />
            </>}
          </div>
        )}
        {vt.hi144 && <p className="why">Household income (HI-144 line z): {usd(vt.hi144.z)}.</p>}
      </Section>

      <Section title="Renter credit (RCC-146)" intro="For full-year Vermont residents who rented in Vermont for at least six months. The Department works out the credit from your income, household size and county.">
        <div className="grid">
          <Check label="Claim the renter credit" checked={d.renter.claim} onChange={(v) => putR({ claim: v })} />
          {d.renter.claim && <>
            <TextField label="SPAN of the rental unit" hint="tax.vermont.gov/span-finder or your landlord" autoComplete="off" value={d.renter.span} onChange={(s) => putR({ span: s })} />
            <TextField label="Physical address of the rental on 12/31/2025" autoComplete="off" value={d.renter.address} onChange={(s) => putR({ address: s })} />
            <TextField label="Unit" autoComplete="off" value={d.renter.unit} onChange={(s) => putR({ unit: s })} />
            <TextField label="City or town of the rental" autoComplete="off" value={d.renter.town} onChange={(s) => putR({ town: s })} />
            <NumberField label="Months rented in 2025" max={12} value={d.renter.monthsRented} onChange={(n) => putR({ monthsRented: n })} />
            <Check label="Shared the unit with another adult (not your spouse)" checked={d.renter.sharedWithAdult} onChange={(v) => putR({ sharedWithAdult: v })} />
            <Check label="Rent was subsidized" checked={d.renter.subsidized} onChange={(v) => putR({ subsidized: v })} />
            {d.renter.subsidized && <NumberField label="Months subsidized" max={12} value={d.renter.subsidizedMonths} onChange={(n) => putR({ subsidizedMonths: n })} />}
            <Check label="Use the renter credit to pay income tax due" checked={d.renter.applyToTax} onChange={(v) => putR({ applyToTax: v })} />
          </>}
        </div>
        {d.renter.claim && (
          <Choice legend="County of the rental unit" value={d.renter.county} onChange={(county) => putR({ county })} columns={4} options={COUNTIES.map((c) => ({ value: c, label: c }))} />
        )}
      </Section>

      {vt.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">{vt.issues.map((t) => <li key={t} className="issue is-warning"><span className="issue-kind">Check</span><span>{t}</span></li>)}</ul>
        </Section>
      )}

      <Section title="Form IN-111" intro={vt.adjustment < 1 ? `Income adjustment ${(vt.adjustment * 100).toFixed(4)}% (exempt military pay, IN-113). Whole dollars.` : 'Whole dollars.'}>
        <table className="lines"><tbody>
          {LINES.filter(([k]) => ALWAYS.has(k) || (L[k] ?? 0) !== 0).map(([k, label]) => (
            <tr key={k} className={KEY.has(k) ? 'is-key' : ''}><th scope="row"><span className="line-no">{k}</span>{label}</th><td>{usd(L[k] ?? 0)}</td></tr>
          ))}
        </tbody></table>
      </Section>

      <Section title="Vermont forms" intro="Filled in on this device from the official Vermont Department of Taxes forms.">
        <ul className="form-list">{packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Include these yourself.</strong><ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul></div>
        )}
        <div className="actions"><button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download Vermont forms (PDF)'}</button></div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <p className="why">Sign page 2 of IN-111{married ? ' (both spouses)' : ''}{d.homestead.file ? ', HS-122' : ''}{d.renter.claim ? ' and RCC-146' : ''}. With a payment, mail to Vermont Department of Taxes, PO Box 1779, Montpelier VT 05601-1779; otherwise PO Box 1881, Montpelier VT 05601-1881. Due April 15, 2026.</p>
      </Section>
    </div>
  )
}
