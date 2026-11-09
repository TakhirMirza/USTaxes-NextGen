import { ReactElement } from 'react'
import type { TaxReturnInput, Owner, BusinessExpenses, Person } from '../engine/model.ts'
import { EXPENSE_LABELS, emptyBusiness, emptyDependent, emptyProvider, emptyStudent, emptyTransaction, emptyW2, empty1099Div, empty1099Int, empty1099R, emptySocialSecurity } from '../engine/model.ts'
import type { TaxReturnResult } from '../engine/compute.ts'
import { careQualifyingPerson, ctcChild, eicChild } from '../engine/compute.ts'
import { FILING_STATUS_LABELS } from '../engine/rules2025.ts'
import type { FilingStatus } from '../engine/rules2025.ts'
import { Check, Choice, DigitsField, DocList, MoneyField, NumberField, Section, Tags, TextField, usd } from './fields'

export type Setter = (fn: (r: TaxReturnInput) => TaxReturnInput) => void
export interface StepProps { ret: TaxReturnInput; set: Setter; result: TaxReturnResult }

type ListKey = 'w2s' | 'interest' | 'dividends' | 'capitalTransactions' | 'businesses' | 'dependents' | 'retirement' | 'socialSecurity' | 'students'
function listOps<K extends ListKey>(set: Setter, key: K) {
  type Item = TaxReturnInput[K][number]
  return {
    add: (item: Item) => set((r) => ({ ...r, [key]: [...(r[key] as Item[]), item] })),
    remove: (id: string) => set((r) => ({ ...r, [key]: (r[key] as Item[]).filter((x) => x.id !== id) })),
    patch: (id: string, p: Partial<Item>) => set((r) => ({ ...r, [key]: (r[key] as Item[]).map((x) => (x.id === id ? { ...x, ...p } : x)) }))
  }
}

function OwnerPicker({ ret, value, onChange }: { ret: TaxReturnInput; value: Owner; onChange: (o: Owner) => void }): ReactElement | null {
  if (ret.filingStatus !== 'mfj') return null
  const name = (p: Person, fallback: string): string => p.firstName.trim() || fallback
  return (
    <Choice legend="Whose form is this?" value={value} onChange={onChange}
      options={[{ value: 'taxpayer', label: name(ret.taxpayer, 'Mine') }, { value: 'spouse', label: name(ret.spouse, 'My spouse’s') }]} />
  )
}

// ── About you ───────────────────────────────────────────────────────────────
export function AboutStep({ ret, set }: StepProps): ReactElement {
  const person = (who: 'taxpayer' | 'spouse', p: Partial<Person>): void => set((r) => ({ ...r, [who]: { ...r[who], ...p } }))
  const contact = (p: Partial<TaxReturnInput['contact']>): void => set((r) => ({ ...r, contact: { ...r.contact, ...p } }))
  const deps = listOps(set, 'dependents')
  const married = ret.filingStatus === 'mfj' || ret.filingStatus === 'mfs'
  const statusHints: Record<FilingStatus, string> = {
    single: 'Unmarried on December 31, 2025',
    mfj: 'Married, one return for both of you',
    mfs: 'Married, each files their own return',
    hoh: 'Unmarried and paid over half the cost of a home for a qualifying person',
    qss: 'Spouse died in 2023 or 2024 and you have a dependent child'
  }
  return (
    <>
      <Section title="Filing status" intro="Your status on December 31, 2025 sets your tax brackets and standard deduction.">
        <Choice legend="Filing status" value={ret.filingStatus} onChange={(v) => set((r) => ({ ...r, filingStatus: v }))}
          options={(Object.keys(FILING_STATUS_LABELS) as FilingStatus[]).map((k) => ({ value: k, label: FILING_STATUS_LABELS[k], hint: statusHints[k] }))} />
      </Section>

      <Section title="You">
        <div className="grid-3">
          <TextField label="First name" value={ret.taxpayer.firstName} onChange={(v) => person('taxpayer', { firstName: v })} />
          <TextField label="Last name" value={ret.taxpayer.lastName} onChange={(v) => person('taxpayer', { lastName: v })} />
          <NumberField label="Age" hint="On Dec 31, 2025" value={ret.taxpayer.age} onChange={(n) => person('taxpayer', { age: n, age65OrOlder: n >= 65 })} />
        </div>
        <div className="grid" style={{ marginTop: 16 }}>
          <DigitsField label="Social Security number" length={9} groups={[3, 2, 4]} placeholder="123-45-6789" value={ret.taxpayer.ssn} onChange={(v) => person('taxpayer', { ssn: v })} />
          <TextField label="Occupation" value={ret.taxpayer.occupation} onChange={(v) => person('taxpayer', { occupation: v })} />
        </div>
        <div className="checks">
          <Check label="I am blind" checked={ret.taxpayer.blind} onChange={(v) => person('taxpayer', { blind: v })} />
          <Check label="I was a full-time student for at least 5 months of 2025" checked={ret.taxpayer.fullTimeStudent} onChange={(v) => person('taxpayer', { fullTimeStudent: v })} />
          <Check label="Someone can claim me as a dependent" checked={ret.canBeClaimedAsDependent} onChange={(v) => set((r) => ({ ...r, canBeClaimedAsDependent: v }))} />
        </div>
      </Section>

      {ret.filingStatus === 'mfj' && (
        <Section title="Your spouse">
          <div className="grid-3">
            <TextField label="First name" value={ret.spouse.firstName} onChange={(v) => person('spouse', { firstName: v })} />
            <TextField label="Last name" value={ret.spouse.lastName} onChange={(v) => person('spouse', { lastName: v })} />
            <NumberField label="Age" hint="On Dec 31, 2025" value={ret.spouse.age} onChange={(n) => person('spouse', { age: n, age65OrOlder: n >= 65 })} />
          </div>
          <div className="grid" style={{ marginTop: 16 }}>
            <DigitsField label="Spouse’s Social Security number" length={9} groups={[3, 2, 4]} placeholder="123-45-6789" value={ret.spouse.ssn} onChange={(v) => person('spouse', { ssn: v })} />
            <TextField label="Spouse’s occupation" value={ret.spouse.occupation} onChange={(v) => person('spouse', { occupation: v })} />
          </div>
          <div className="checks">
            <Check label="My spouse is blind" checked={ret.spouse.blind} onChange={(v) => person('spouse', { blind: v })} />
            <Check label="My spouse was a full-time student for at least 5 months of 2025" checked={ret.spouse.fullTimeStudent} onChange={(v) => person('spouse', { fullTimeStudent: v })} />
          </div>
        </Section>
      )}
      {married && ret.filingStatus === 'mfs' && <p className="note">On a separate return, enter only your own income and deductions.</p>}

      <Section title="Home address" intro="Printed on Form 1040. Your information stays in this browser.">
        <div className="grid">
          <div className="span-2"><TextField label="Street address" value={ret.contact.street} onChange={(v) => contact({ street: v })} /></div>
          <TextField label="Apt. no." value={ret.contact.apt} onChange={(v) => contact({ apt: v })} />
          <TextField label="City" value={ret.contact.city} onChange={(v) => contact({ city: v })} />
          <TextField label="State" placeholder="VA" value={ret.contact.state} onChange={(v) => contact({ state: v.toUpperCase().slice(0, 2) })} />
          <DigitsField label="ZIP code" length={9} groups={[5, 4]} validLengths={[5, 9]} value={ret.contact.zip} onChange={(v) => contact({ zip: v })} hint="5 or 9 digits" />
          <TextField label="Phone" value={ret.contact.phone} onChange={(v) => contact({ phone: v })} />
          <TextField label="Email" value={ret.contact.email} onChange={(v) => contact({ email: v })} />
        </div>
        <div className="checks">
          <Check label={ret.filingStatus === 'mfj' ? 'Our main home was in the U.S. for more than half of 2025' : 'My main home was in the U.S. for more than half of 2025'}
            checked={ret.contact.livedInUsHalfYear} onChange={(v) => contact({ livedInUsHalfYear: v })} />
          <Check label="Send $3 to the Presidential Election Campaign Fund" hint="Does not change your tax or refund." checked={ret.taxpayer.presidentialFund} onChange={(v) => person('taxpayer', { presidentialFund: v })} />
          {ret.filingStatus === 'mfj' && <Check label="My spouse also wants to send $3" checked={ret.spouse.presidentialFund} onChange={(v) => person('spouse', { presidentialFund: v })} />}
        </div>
      </Section>

      <Section title="Dependents" intro="Children and relatives you support. Credits are checked for each one: Child Tax Credit up to $2,200, Earned Income Credit, and child care.">
        <DocList items={ret.dependents} addLabel="Add a dependent" emptyText="No dependents added."
          title={(d, i) => d.name.trim() || `Dependent ${i + 1}`}
          onAdd={() => deps.add(emptyDependent())} onRemove={deps.remove}
          render={(d) => (
            <>
              <TextField label="Full name" value={d.name} onChange={(v) => deps.patch(d.id, { name: v })} />
              <TextField label="Relationship" placeholder="Son, daughter, parent…" value={d.relationship} onChange={(v) => deps.patch(d.id, { relationship: v })} />
              <DigitsField label="Social Security number" length={9} groups={[3, 2, 4]} placeholder="123-45-6789" value={d.ssn} onChange={(v) => deps.patch(d.id, { ssn: v })} />
              <span />
              <NumberField label="Age on Dec 31, 2025" hint="Enter 0 for a baby born in 2025" value={d.age} onChange={(n) => deps.patch(d.id, { age: n })} />
              <NumberField label="Months lived with you in 2025" max={12} suffix="of 12" value={d.monthsLivedWithYou} onChange={(n) => deps.patch(d.id, { monthsLivedWithYou: n })} />
              <div className="span-2 checks">
                <Check label="Child, stepchild, foster child, brother or sister, or a descendant of one" checked={d.childRelationship} onChange={(v) => deps.patch(d.id, { childRelationship: v })} />
                <Check label="Has a Social Security number valid for work" checked={d.hasSsn} onChange={(v) => deps.patch(d.id, { hasSsn: v })} />
                <Check label="Full-time student for at least 5 months of 2025" checked={d.student} onChange={(v) => deps.patch(d.id, { student: v })} />
                <Check label="Permanently and totally disabled" checked={d.disabled} onChange={(v) => deps.patch(d.id, { disabled: v })} />
              </div>
              <div className="span-2">
                <Tags items={[
                  { label: ctcChild(d) ? 'Child Tax Credit' : 'Other dependent credit', on: true },
                  { label: 'Earned Income Credit', on: eicChild(d) },
                  { label: 'Child care credit', on: careQualifyingPerson(d) }
                ]} />
              </div>
            </>
          )} />
      </Section>
    </>
  )
}

// ── Income ──────────────────────────────────────────────────────────────────
export function IncomeStep({ ret, set, result }: StepProps): ReactElement {
  const w2 = listOps(set, 'w2s')
  const int = listOps(set, 'interest')
  const div = listOps(set, 'dividends')
  const cap = listOps(set, 'capitalTransactions')
  const biz = listOps(set, 'businesses')
  const ret1099r = listOps(set, 'retirement')
  const ssa = listOps(set, 'socialSecurity')
  const bizResult = (id: string) => result.scheduleC.find((b) => b.id === id)
  return (
    <>
      <Section title="Digital assets" intro="Form 1040 asks every filer. Answer Yes if at any time in 2025 you received crypto or other digital assets as a reward, award or payment, or sold, exchanged or otherwise disposed of them. Simply holding them is No.">
        <Choice legend="Digital assets" value={ret.digitalAssets === null ? '' : ret.digitalAssets ? 'yes' : 'no'}
          onChange={(v) => set((r) => ({ ...r, digitalAssets: v === 'yes' }))}
          options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes', hint: 'Report sales as investment sales below' }]} />
      </Section>

      <Section title="Wages" intro="One entry for each Form W-2 you received.">
        <DocList items={ret.w2s} addLabel="Add a W-2" emptyText="No W-2s yet. Skip this if you had no job income."
          title={(w, i) => w.employer.trim() || `W-2 ${i + 1}`}
          onAdd={() => w2.add(emptyW2())} onRemove={w2.remove}
          render={(w) => (
            <>
              <div className="span-2"><TextField label="Employer" value={w.employer} onChange={(v) => w2.patch(w.id, { employer: v })} /></div>
              <div className="span-2"><OwnerPicker ret={ret} value={w.owner} onChange={(v) => w2.patch(w.id, { owner: v })} /></div>
              <MoneyField label="Wages, tips, other compensation" box="Box 1" value={w.wages} onChange={(n) => w2.patch(w.id, { wages: n })} />
              <MoneyField label="Federal income tax withheld" box="Box 2" value={w.federalWithholding} onChange={(n) => w2.patch(w.id, { federalWithholding: n })} />
              <MoneyField label="Social Security wages" box="Box 3" value={w.socialSecurityWages} onChange={(n) => w2.patch(w.id, { socialSecurityWages: n })} />
              <MoneyField label="Social Security tax withheld" box="Box 4" value={w.socialSecurityWithheld} onChange={(n) => w2.patch(w.id, { socialSecurityWithheld: n })} />
              <MoneyField label="Medicare wages" box="Box 5" value={w.medicareWages} onChange={(n) => w2.patch(w.id, { medicareWages: n })} />
              <MoneyField label="Medicare tax withheld" box="Box 6" value={w.medicareWithheld} onChange={(n) => w2.patch(w.id, { medicareWithheld: n })} />
            </>
          )} />
      </Section>

      <Section title="Interest" intro="Form 1099-INT from banks and brokers.">
        <DocList items={ret.interest} addLabel="Add a 1099-INT" emptyText="No interest income."
          title={(x, i) => x.payer.trim() || `1099-INT ${i + 1}`}
          onAdd={() => int.add(empty1099Int())} onRemove={int.remove}
          render={(x) => (
            <>
              <div className="span-2"><TextField label="Payer" value={x.payer} onChange={(v) => int.patch(x.id, { payer: v })} /></div>
              <MoneyField label="Taxable interest" box="Box 1 + 3" value={x.interest} onChange={(n) => int.patch(x.id, { interest: n })} />
              <MoneyField label="Tax-exempt interest" box="Box 8" value={x.taxExemptInterest} onChange={(n) => int.patch(x.id, { taxExemptInterest: n })} />
              <MoneyField label="Federal tax withheld" box="Box 4" value={x.federalWithholding} onChange={(n) => int.patch(x.id, { federalWithholding: n })} />
            </>
          )} />
      </Section>

      <Section title="Dividends" intro="Form 1099-DIV from funds and brokerage accounts.">
        <DocList items={ret.dividends} addLabel="Add a 1099-DIV" emptyText="No dividend income."
          title={(x, i) => x.payer.trim() || `1099-DIV ${i + 1}`}
          onAdd={() => div.add(empty1099Div())} onRemove={div.remove}
          render={(x) => (
            <>
              <div className="span-2"><TextField label="Payer" value={x.payer} onChange={(v) => div.patch(x.id, { payer: v })} /></div>
              <MoneyField label="Total ordinary dividends" box="Box 1a" value={x.ordinaryDividends} onChange={(n) => div.patch(x.id, { ordinaryDividends: n })} />
              <MoneyField label="Qualified dividends" box="Box 1b" value={x.qualifiedDividends} onChange={(n) => div.patch(x.id, { qualifiedDividends: n })} />
              <MoneyField label="Capital gain distributions" box="Box 2a" value={x.capitalGainDistributions} onChange={(n) => div.patch(x.id, { capitalGainDistributions: n })} />
              <MoneyField label="Federal tax withheld" box="Box 4" value={x.federalWithholding} onChange={(n) => div.patch(x.id, { federalWithholding: n })} />
            </>
          )} />
      </Section>

      {result.scheduleB.required && (
        <Section title="Foreign accounts" intro="Your interest or dividends are over $1,500, so Schedule B asks this question.">
          <Check label="In 2025 I had a financial account in a foreign country, or received a distribution from or was involved with a foreign trust"
            hint="Leave unchecked to answer No on Schedule B, Part III." checked={ret.foreignAccounts} onChange={(v) => set((r) => ({ ...r, foreignAccounts: v }))} />
        </Section>
      )}

      <Section title="Sales of stock and other investments" intro="From Form 1099-B. Long-term means you held it more than one year."
        aside={ret.capitalTransactions.length > 0 ? <span className="pill">Net {usd(result.scheduleD.net)}</span> : undefined}>
        <DocList items={ret.capitalTransactions} addLabel="Add a sale" emptyText="No investment sales."
          title={(x, i) => x.description.trim() || `Sale ${i + 1}`}
          onAdd={() => cap.add(emptyTransaction())} onRemove={cap.remove}
          render={(x) => (
            <>
              <div className="span-2"><TextField label="Description" placeholder="100 sh. XYZ Corp" value={x.description} onChange={(v) => cap.patch(x.id, { description: v })} /></div>
              <div className="span-2">
                <Choice legend="Holding period" value={x.term} onChange={(v) => cap.patch(x.id, { term: v })}
                  options={[{ value: 'short', label: 'Short-term', hint: 'One year or less' }, { value: 'long', label: 'Long-term', hint: 'More than one year' }]} />
              </div>
              <MoneyField label="Proceeds" box="Box 1d" value={x.proceeds} onChange={(n) => cap.patch(x.id, { proceeds: n })} />
              <MoneyField label="Cost basis" box="Box 1e" value={x.costBasis} onChange={(n) => cap.patch(x.id, { costBasis: n })} />
            </>
          )} />
        <details className="more">
          <summary>Capital loss carried over from 2024</summary>
          <div className="grid">
            <MoneyField label="Short-term carryover" value={ret.capitalLossCarryover.shortTerm} onChange={(n) => set((r) => ({ ...r, capitalLossCarryover: { ...r.capitalLossCarryover, shortTerm: n } }))} />
            <MoneyField label="Long-term carryover" value={ret.capitalLossCarryover.longTerm} onChange={(n) => set((r) => ({ ...r, capitalLossCarryover: { ...r.capitalLossCarryover, longTerm: n } }))} />
          </div>
        </details>
      </Section>

      <Section title="Self-employment" intro="Freelance, gig or small-business income reported on Schedule C. Self-employment tax is figured for you.">
        <DocList items={ret.businesses} addLabel="Add a business" emptyText="No self-employment income."
          title={(b, i) => b.name.trim() || `Business ${i + 1}`}
          onAdd={() => biz.add(emptyBusiness())} onRemove={biz.remove}
          render={(b) => {
            const res = bizResult(b.id)
            const exp = (k: keyof BusinessExpenses, n: number): void => biz.patch(b.id, { expenses: { ...b.expenses, [k]: n } })
            return (
              <>
                <TextField label="Business name" value={b.name} onChange={(v) => biz.patch(b.id, { name: v })} />
                <TextField label="What you do" placeholder="Web design, rideshare…" value={b.activity} onChange={(v) => biz.patch(b.id, { activity: v })} />
                <div className="span-2"><OwnerPicker ret={ret} value={b.owner} onChange={(v) => biz.patch(b.id, { owner: v })} /></div>
                <DigitsField label="Principal business code" length={6} hint="6 digits, from the list in the Schedule C instructions (irs.gov/ScheduleC)" value={b.businessCode} onChange={(v) => biz.patch(b.id, { businessCode: v })} />
                <DigitsField label="Employer ID number (EIN)" length={9} groups={[2, 7]} hint="Leave blank if you don’t have one" value={b.ein} onChange={(v) => biz.patch(b.id, { ein: v })} />
                <details className="more span-2" open={!!(b.address || b.cityStateZip)}>
                  <summary>Business address (if different from your home)</summary>
                  <div className="grid">
                    <TextField label="Street address" value={b.address} onChange={(v) => biz.patch(b.id, { address: v })} />
                    <TextField label="City, state, ZIP" value={b.cityStateZip} onChange={(v) => biz.patch(b.id, { cityStateZip: v })} />
                  </div>
                </details>
                <div className="span-2">
                  <Choice legend="Accounting method" value={b.accountingMethod} onChange={(v) => biz.patch(b.id, { accountingMethod: v })}
                    options={[{ value: 'cash', label: 'Cash', hint: 'Income when received, expenses when paid' }, { value: 'accrual', label: 'Accrual' }]} />
                </div>
                <div className="span-2 checks">
                  <Check label="I materially participated in this business in 2025" hint="You worked in it regularly, continuously and substantially" checked={b.materiallyParticipated} onChange={(v) => biz.patch(b.id, { materiallyParticipated: v })} />
                  <Check label="I started or acquired this business in 2025" checked={b.startedThisYear} onChange={(v) => biz.patch(b.id, { startedThisYear: v })} />
                </div>
                <div className="span-2">
                  <Choice legend="Did you pay anyone $600 or more (contractors, rent) that would require you to file a Form 1099?" value={b.required1099s === null ? '' : b.required1099s ? 'yes' : 'no'}
                    onChange={(v) => biz.patch(b.id, { required1099s: v === 'yes' })}
                    options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }]} />
                  {b.required1099s && <div className="checks"><Check label="I filed (or will file) those Forms 1099" checked={b.filed1099s} onChange={(v) => biz.patch(b.id, { filed1099s: v })} /></div>}
                </div>
                <MoneyField label="Gross receipts or sales" hint="Include all 1099-NEC and 1099-K income" value={b.grossReceipts} onChange={(n) => biz.patch(b.id, { grossReceipts: n })} />
                <MoneyField label="Returns and allowances" value={b.returnsAndAllowances} onChange={(n) => biz.patch(b.id, { returnsAndAllowances: n })} />
                <MoneyField label="Cost of goods sold" value={b.costOfGoodsSold} onChange={(n) => biz.patch(b.id, { costOfGoodsSold: n })} />
                <MoneyField label="Other business income" value={b.otherIncome} onChange={(n) => biz.patch(b.id, { otherIncome: n })} />
                <details className="more span-2" open={Object.values(b.expenses).some((v) => v > 0)}>
                  <summary>Expenses {res && res.totalExpenses > 0 ? `· ${usd(res.totalExpenses)}` : ''}</summary>
                  <div className="grid">
                    {(Object.keys(EXPENSE_LABELS) as (keyof BusinessExpenses)[]).map((k) => (
                      <MoneyField key={k} label={EXPENSE_LABELS[k]} value={b.expenses[k]} onChange={(n) => exp(k, n)} />
                    ))}
                  </div>
                </details>
                {b.expenses.carAndTruck > 0 && (
                  <details className="more span-2" open>
                    <summary>Vehicle details (Schedule C, Part IV)</summary>
                    <div className="grid">
                      <TextField label="Date placed in service for business" placeholder="MM/DD/YYYY" value={b.vehicle.placedInService} onChange={(v) => biz.patch(b.id, { vehicle: { ...b.vehicle, placedInService: v.replace(/[^0-9/]/g, '').slice(0, 10) } })} />
                      <NumberField label="Business miles in 2025" max={999999} value={b.vehicle.businessMiles} onChange={(n) => biz.patch(b.id, { vehicle: { ...b.vehicle, businessMiles: n } })} />
                      <NumberField label="Commuting miles" max={999999} value={b.vehicle.commutingMiles} onChange={(n) => biz.patch(b.id, { vehicle: { ...b.vehicle, commutingMiles: n } })} />
                      <NumberField label="Other personal miles" max={999999} value={b.vehicle.otherMiles} onChange={(n) => biz.patch(b.id, { vehicle: { ...b.vehicle, otherMiles: n } })} />
                    </div>
                    <div className="checks">
                      <Check label="The vehicle was available for personal use during off-duty hours" checked={b.vehicle.availableOffDuty} onChange={(v) => biz.patch(b.id, { vehicle: { ...b.vehicle, availableOffDuty: v } })} />
                      <Check label="I (or my spouse) have another vehicle for personal use" checked={b.vehicle.anotherVehicle} onChange={(v) => biz.patch(b.id, { vehicle: { ...b.vehicle, anotherVehicle: v } })} />
                      <Check label="I have evidence to support the deduction" checked={b.vehicle.hasEvidence} onChange={(v) => biz.patch(b.id, { vehicle: { ...b.vehicle, hasEvidence: v } })} />
                      {b.vehicle.hasEvidence && <Check label="The evidence is written (a mileage log)" checked={b.vehicle.evidenceWritten} onChange={(v) => biz.patch(b.id, { vehicle: { ...b.vehicle, evidenceWritten: v } })} />}
                    </div>
                  </details>
                )}
                {res && (
                  <p className={`span-2 result-line ${res.netProfit < 0 ? 'is-loss' : ''}`}>
                    Net {res.netProfit < 0 ? 'loss' : 'profit'} <strong>{usd(res.netProfit)}</strong>
                  </p>
                )}
                {res && res.netProfit < 0 && (
                  <div className="span-2 checks">
                    <Check label="All my investment in this business is at risk" hint="Usually yes. If not, Form 6198 is required and the loss may be limited." checked={b.allAtRisk} onChange={(v) => biz.patch(b.id, { allAtRisk: v })} />
                  </div>
                )}
              </>
            )
          }} />
      </Section>

      <Section title="Retirement distributions" intro="Form 1099-R: pensions, annuities, IRA and 401(k) withdrawals."
        aside={result.f1040['4b'] + result.f1040['5b'] > 0 ? <span className="pill">Taxable {usd(result.f1040['4b'] + result.f1040['5b'])}</span> : undefined}>
        <DocList items={ret.retirement} addLabel="Add a 1099-R" emptyText="No retirement distributions."
          title={(x, i) => x.payer.trim() || `1099-R ${i + 1}`}
          onAdd={() => ret1099r.add(empty1099R())} onRemove={ret1099r.remove}
          render={(x) => (
            <>
              <div className="span-2"><TextField label="Payer" value={x.payer} onChange={(v) => ret1099r.patch(x.id, { payer: v })} /></div>
              <div className="span-2"><OwnerPicker ret={ret} value={x.owner} onChange={(v) => ret1099r.patch(x.id, { owner: v })} /></div>
              <MoneyField label="Gross distribution" box="Box 1" value={x.grossDistribution} onChange={(n) => ret1099r.patch(x.id, { grossDistribution: n })} />
              <MoneyField label="Taxable amount" box="Box 2a" hint="If blank on your form, usually the same as box 1" value={x.taxableAmount} onChange={(n) => ret1099r.patch(x.id, { taxableAmount: n })} />
              <MoneyField label="Federal tax withheld" box="Box 4" value={x.federalWithholding} onChange={(n) => ret1099r.patch(x.id, { federalWithholding: n })} />
              <TextField label="Distribution code (box 7)" placeholder="7" hint="7 = normal, 1 = early, G = rollover" value={x.code} onChange={(v) => ret1099r.patch(x.id, { code: v.toUpperCase().slice(0, 2) })} />
              <div className="span-2"><Check label="The IRA/SEP/SIMPLE box is checked" checked={x.ira} onChange={(v) => ret1099r.patch(x.id, { ira: v })} /></div>
            </>
          )} />
      </Section>

      <Section title="Social Security" intro="Form SSA-1099. Up to 85% of benefits can be taxable, depending on your other income."
        aside={result.f1040['6a'] > 0 ? <span className="pill">Taxable {usd(result.f1040['6b'])}</span> : undefined}>
        <DocList items={ret.socialSecurity} addLabel="Add an SSA-1099" emptyText="No Social Security benefits."
          title={(x, i) => `SSA-1099 ${i + 1}${ret.filingStatus === 'mfj' ? ` · ${x.owner === 'spouse' ? ret.spouse.firstName || 'Spouse' : ret.taxpayer.firstName || 'You'}` : ''}`}
          onAdd={() => ssa.add(emptySocialSecurity())} onRemove={ssa.remove}
          render={(x) => (
            <>
              <div className="span-2"><OwnerPicker ret={ret} value={x.owner} onChange={(v) => ssa.patch(x.id, { owner: v })} /></div>
              <MoneyField label="Net benefits" box="Box 5" value={x.netBenefits} onChange={(n) => ssa.patch(x.id, { netBenefits: n })} />
              <MoneyField label="Federal tax withheld" box="Box 6" value={x.federalWithholding} onChange={(n) => ssa.patch(x.id, { federalWithholding: n })} />
            </>
          )} />
      </Section>

      <Section title="Other income">
        <div className="grid">
          <MoneyField label="Unemployment compensation" box="1099-G" value={ret.unemployment} onChange={(n) => set((r) => ({ ...r, unemployment: n }))} />
          <MoneyField label="Other taxable income" hint="Prizes, jury duty, and similar (Schedule 1, line 8)" value={ret.otherIncome} onChange={(n) => set((r) => ({ ...r, otherIncome: n }))} />
        </div>
      </Section>
    </>
  )
}

// ── Deductions ──────────────────────────────────────────────────────────────
export function DeductionsStep({ ret, set, result }: StepProps): ReactElement {
  const adj = (k: keyof TaxReturnInput['adjustments'], n: number): void => set((r) => ({ ...r, adjustments: { ...r.adjustments, [k]: n } }))
  const s1a = (k: keyof TaxReturnInput['schedule1A'], n: number): void => set((r) => ({ ...r, schedule1A: { ...r.schedule1A, [k]: n } }))
  const itm = (k: keyof TaxReturnInput['itemized'], n: number): void => set((r) => ({ ...r, itemized: { ...r.itemized, [k]: n } }))
  const d = result.deduction
  return (
    <>
      <Section title="Adjustments to income" intro="These lower your adjusted gross income (Schedule 1, Part II).">
        <div className="grid">
          <MoneyField label="Student loan interest" box="1098-E" hint="Up to $2,500" value={ret.adjustments.studentLoanInterest} onChange={(n) => adj('studentLoanInterest', n)} />
          <MoneyField label="Deductible IRA contributions" value={ret.adjustments.iraDeduction} onChange={(n) => adj('iraDeduction', n)} />
          <MoneyField label="HSA deduction" hint="From Form 8889; not employer contributions" value={ret.adjustments.hsaDeduction} onChange={(n) => adj('hsaDeduction', n)} />
          <MoneyField label="Educator expenses" hint="K–12 teachers, up to $300 each" value={ret.adjustments.educatorExpenses} onChange={(n) => adj('educatorExpenses', n)} />
          {ret.businesses.length > 0 && (
            <MoneyField label="Self-employed health insurance" value={ret.adjustments.selfEmployedHealthInsurance} onChange={(n) => adj('selfEmployedHealthInsurance', n)} />
          )}
        </div>
        {result.schedule1.adjustments.deductibleHalfOfSeTax > 0 && (
          <p className="note">Half of your self-employment tax, {usd(result.schedule1.adjustments.deductibleHalfOfSeTax)}, is deducted automatically.</p>
        )}
      </Section>

      <Section title="New deductions for 2025" intro="Schedule 1-A. You can take these whether or not you itemize."
        aside={result.schedule1A.total > 0 ? <span className="pill">{usd(result.schedule1A.total)}</span> : undefined}>
        <div className="grid">
          <MoneyField label="Qualified tips" hint="Up to $25,000; reported on your W-2 or 1099" value={ret.schedule1A.qualifiedTips} onChange={(n) => s1a('qualifiedTips', n)} />
          <MoneyField label="Qualified overtime premium" hint="Only the extra “half” of time-and-a-half" value={ret.schedule1A.qualifiedOvertime} onChange={(n) => s1a('qualifiedOvertime', n)} />
          <MoneyField label="Car loan interest" hint="New U.S.-assembled vehicle, up to $10,000" value={ret.schedule1A.carLoanInterest} onChange={(n) => s1a('carLoanInterest', n)} />
          {ret.schedule1A.carLoanInterest > 0 && (
            <TextField label="Vehicle identification number (VIN)" hint="17 characters, required on Schedule 1-A"
              value={ret.schedule1A.vehicleVin} onChange={(v) => set((r) => ({ ...r, schedule1A: { ...r.schedule1A, vehicleVin: v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17) } }))} />
          )}
        </div>
        {result.schedule1A.senior > 0 && <p className="note">Senior deduction for age 65 and older: {usd(result.schedule1A.senior)}, applied automatically.</p>}
      </Section>

      <Section title="Standard or itemized" intro="Most people take the standard deduction. Enter itemized amounts only if you think they add up to more.">
        <div className="compare">
          <div className={d.used === 'standard' ? 'is-used' : ''}><span>Standard deduction</span><strong>{usd(d.standard)}</strong></div>
          <div className={d.used === 'itemized' ? 'is-used' : ''}><span>Itemized total</span><strong>{usd(d.itemized)}</strong></div>
        </div>
        <Choice legend="Which to use" value={ret.deductionChoice} onChange={(v) => set((r) => ({ ...r, deductionChoice: v }))}
          options={[
            { value: 'auto', label: 'Whichever is larger' },
            { value: 'standard', label: 'Standard' },
            { value: 'itemized', label: 'Itemize' }
          ]} />
        <details className="more" open={d.itemized > 0}>
          <summary>Itemized deductions (Schedule A)</summary>
          <div className="grid">
            <MoneyField label="Medical and dental expenses" hint={`Only the part above 7.5% of AGI counts: ${usd(result.scheduleA.medical)}`} value={ret.itemized.medical} onChange={(n) => itm('medical', n)} />
            <MoneyField label="State and local income or sales tax" value={ret.itemized.stateLocalIncomeOrSalesTax} onChange={(n) => itm('stateLocalIncomeOrSalesTax', n)} />
            <MoneyField label="Real estate taxes" value={ret.itemized.realEstateTax} onChange={(n) => itm('realEstateTax', n)} />
            <MoneyField label="Personal property taxes" hint={`State and local taxes are capped at ${usd(result.scheduleA.saltCap)}`} value={ret.itemized.personalPropertyTax} onChange={(n) => itm('personalPropertyTax', n)} />
            <MoneyField label="Home mortgage interest" box="1098" value={ret.itemized.mortgageInterest} onChange={(n) => itm('mortgageInterest', n)} />
            <MoneyField label="Gifts to charity by cash or check" value={ret.itemized.charityCash} onChange={(n) => itm('charityCash', n)} />
            <MoneyField label="Gifts to charity other than cash" value={ret.itemized.charityNonCash} onChange={(n) => itm('charityNonCash', n)} />
            <MoneyField label="Other itemized deductions" value={ret.itemized.other} onChange={(n) => itm('other', n)} />
          </div>
        </details>
      </Section>
    </>
  )
}

// ── Credits & payments ──────────────────────────────────────────────────────
export function PaymentsStep({ ret, set, result }: StepProps): ReactElement {
  const c = result.schedule8812
  const e = result.eic
  const stu = listOps(set, 'students')
  const care = (k: 'expenses' | 'employerBenefits', n: number): void => set((r) => ({ ...r, dependentCare: { ...r.dependentCare, [k]: n } }))
  type Providers = TaxReturnInput['dependentCare']['providers']
  const setProviders = (fn: (ps: Providers) => Providers): void => set((r) => ({ ...r, dependentCare: { ...r.dependentCare, providers: fn(r.dependentCare.providers) } }))
  const patchProvider = (id: string, p: Partial<Providers[number]>): void => setProviders((ps) => ps.map((x) => (x.id === id ? { ...x, ...p } : x)))
  return (
    <>
      <Section title="Earned Income Credit" intro="A refundable credit for working people with low to moderate income."
        aside={<span className="pill">{usd(e.credit)}</span>}>
        <dl className="facts">
          <div><dt>Earned income</dt><dd>{usd(e.earnedIncome)}</dd></div>
          <div><dt>Qualifying children</dt><dd>{e.qualifyingChildren}</dd></div>
          <div><dt>Investment income</dt><dd>{usd(e.investmentIncome)}</dd></div>
          <div><dt>Credit</dt><dd>{usd(e.credit)}</dd></div>
        </dl>
        {e.credit === 0 && e.notEligibleBecause.length > 0 && <p className="why">Not available: {e.notEligibleBecause.join('; ')}.</p>}
        {e.credit === 0 && e.notEligibleBecause.length === 0 && e.earnedIncome > 0 && <p className="why">Your income is above the limit for this credit.</p>}
      </Section>

      <Section title="Child Tax Credit" intro={ret.dependents.length ? 'Figured from the dependents you entered.' : 'Add dependents in “About you” to claim this credit.'}
        aside={c.nonrefundable + c.refundable > 0 ? <span className="pill">{usd(c.nonrefundable + c.refundable)}</span> : undefined}>
        <dl className="facts">
          <div><dt>Children under 17</dt><dd>{c.qualifyingChildren}</dd></div>
          <div><dt>Other dependents</dt><dd>{c.otherDependents}</dd></div>
          <div><dt>Credit before income limit</dt><dd>{usd(c.creditBeforePhaseout)}</dd></div>
          {c.phaseoutReduction > 0 && <div><dt>Reduced for income</dt><dd>−{usd(c.phaseoutReduction)}</dd></div>}
          <div><dt>Applied against your tax</dt><dd>{usd(c.nonrefundable)}</dd></div>
          <div><dt>Refundable part</dt><dd>{usd(c.refundable)}</dd></div>
        </dl>
      </Section>

      <Section title="Child and dependent care" intro="Daycare, after-school care or a caregiver so you (and your spouse) could work. For children under 13 or a disabled dependent."
        aside={result.form2441.credit > 0 ? <span className="pill">{usd(result.schedule3.dependentCare)}</span> : undefined}>
        <div className="grid">
          <MoneyField label="Care expenses you paid in 2025" hint="For the children or dependents who qualify" value={ret.dependentCare.expenses} onChange={(n) => care('expenses', n)} />
          <MoneyField label="Dependent care benefits from your employer" box="W-2 box 10" value={ret.dependentCare.employerBenefits} onChange={(n) => care('employerBenefits', n)} />
        </div>
        {(ret.dependentCare.expenses > 0 || ret.dependentCare.providers.length > 0) && (
          <div style={{ marginTop: 18 }}>
            <DocList items={ret.dependentCare.providers} addLabel="Add a care provider" emptyText="Form 2441 needs each provider’s name, address and SSN or EIN."
              title={(x, i) => x.name.trim() || `Care provider ${i + 1}`}
              onAdd={() => setProviders((ps) => [...ps, emptyProvider()])}
              onRemove={(id) => setProviders((ps) => ps.filter((p) => p.id !== id))}
              render={(x) => (
                <>
                  <TextField label="Provider name" placeholder="Daycare, school, or person" value={x.name} onChange={(v) => patchProvider(x.id, { name: v })} />
                  <DigitsField label="SSN or EIN" length={9} value={x.tin} onChange={(v) => patchProvider(x.id, { tin: v })} hint="From the provider or your receipt" />
                  <div className="span-2"><TextField label="Address" placeholder="Street, city, state, ZIP" value={x.address} onChange={(v) => patchProvider(x.id, { address: v })} /></div>
                  <MoneyField label="Amount paid in 2025" value={x.amountPaid} onChange={(n) => patchProvider(x.id, { amountPaid: n })} />
                  <div className="span-2"><Check label="This provider is my household employee (for example, a nanny)" checked={x.householdEmployee} onChange={(v) => patchProvider(x.id, { householdEmployee: v })} /></div>
                </>
              )} />
          </div>
        )}
        {result.form2441.credit > 0 && (
          <p className="note">
            {usd(result.form2441.expensesUsed)} of expenses at {Math.round(result.form2441.rate * 100)}% gives a {usd(result.form2441.credit)} credit (Form 2441).
            {result.form2441.partIII && result.form2441.partIII.line28 > 0 && ` The ${usd(result.form2441.partIII.line28)} your employer paid tax-free reduces the expenses that count toward the credit.`}
            {result.schedule3.dependentCare < result.form2441.credit && ` This credit can only reduce your income tax, so ${usd(result.schedule3.dependentCare)} of it is used; the rest is not refundable.`}
          </p>
        )}
      </Section>

      <Section title="Education" intro="Form 1098-T. Enter tuition and required fees you paid, minus tax-free scholarships."
        aside={result.form8863.aotc + result.form8863.llc > 0 ? <span className="pill">{usd(result.form8863.aotcRefundable + result.form8863.nonrefundableAllowed)}</span> : undefined}>
        <DocList items={ret.students} addLabel="Add a student" emptyText="No education expenses."
          title={(x, i) => x.name.trim() || `Student ${i + 1}`}
          onAdd={() => stu.add(emptyStudent())} onRemove={stu.remove}
          render={(x) => (
            <>
              <TextField label="Student name" value={x.name} onChange={(v) => stu.patch(x.id, { name: v })} />
              <DigitsField label="Student’s SSN" length={9} groups={[3, 2, 4]} value={x.ssn} onChange={(v) => stu.patch(x.id, { ssn: v })} />
              <TextField label="School" value={x.institution} onChange={(v) => stu.patch(x.id, { institution: v })} />
              <DigitsField label="School’s EIN" length={9} groups={[2, 7]} hint="On Form 1098-T; required for the AOTC" value={x.institutionEin} onChange={(v) => stu.patch(x.id, { institutionEin: v })} />
              <div className="span-2"><TextField label="School address" placeholder="Street, city, state, ZIP" value={x.institutionAddress} onChange={(v) => stu.patch(x.id, { institutionAddress: v })} /></div>
              <MoneyField label="Qualified expenses" value={x.qualifiedExpenses} onChange={(n) => stu.patch(x.id, { qualifiedExpenses: n })} />
              <div><Check label="Received Form 1098-T from this school for 2025" checked={x.received1098T} onChange={(v) => stu.patch(x.id, { received1098T: v })} /></div>
              <div className="span-2">
                <Check label="In the first four years of college, at least half-time"
                  hint="American Opportunity Credit, up to $2,500 (40% refundable). Otherwise the Lifetime Learning Credit applies, 20% of up to $10,000."
                  checked={x.aotcEligible} onChange={(v) => stu.patch(x.id, { aotcEligible: v })} />
              </div>
            </>
          )} />
        {result.form8863.aotc + result.form8863.llc > 0 && (() => {
          const f = result.form8863
          const tentativeNonref = f.aotc - f.aotcRefundable + f.llc
          return (
            <p className="note">
              {f.aotc > 0 && `American Opportunity Credit ${usd(f.aotc)}, of which ${usd(f.aotcRefundable)} is refundable. `}
              {f.llc > 0 && `Lifetime Learning Credit ${usd(f.llc)}. `}
              {f.nonrefundableAllowed < tentativeNonref && `The nonrefundable part is limited by your income tax: ${usd(f.nonrefundableAllowed)} of ${usd(tentativeNonref)} is used.`}
            </p>
          )
        })()}
      </Section>

      <Section title="Retirement savings" intro="The Saver’s Credit pays back 10% to 50% of up to $2,000 you put into an IRA or workplace plan, if your income is modest."
        aside={result.form8880.credit > 0 ? <span className="pill">{usd(result.form8880.credit)}</span> : undefined}>
        {(ret.filingStatus === 'mfj' ? (['taxpayer', 'spouse'] as const) : (['taxpayer'] as const)).map((who) => {
          const sv = ret.savings[who]
          const setSv = (p: Partial<typeof sv>): void => set((r) => ({ ...r, savings: { ...r.savings, [who]: { ...r.savings[who], ...p } } }))
          const name = who === 'spouse' ? (ret.spouse.firstName || 'Your spouse') : (ret.taxpayer.firstName || 'You')
          return (
            <div key={who} className="doc" style={{ marginBottom: 12 }}>
              <header><h3>{name}</h3></header>
              <div className="grid">
                <MoneyField label="IRA contributions for 2025" hint="Traditional and Roth" value={sv.iraContributions} onChange={(n) => setSv({ iraContributions: n })} />
                <MoneyField label="401(k), 403(b), 457 or TSP deferrals" box="W-2 box 12" hint="Codes D, E, G, H, S, AA, BB, EE" value={sv.electiveDeferrals} onChange={(n) => setSv({ electiveDeferrals: n })} />
                <MoneyField label="Retirement distributions 2023–2025" hint="Withdrawals reduce the credit; rollovers don’t count" value={sv.distributions} onChange={(n) => setSv({ distributions: n })} />
              </div>
            </div>
          )
        })}
        {result.form8880.line7 > 0 && (
          <p className="note">
            {result.form8880.rate > 0
              ? `${usd(result.form8880.line7)} of contributions at ${Math.round(result.form8880.rate * 100)}% gives ${usd(result.form8880.tentative)}.${result.form8880.credit < result.form8880.tentative ? ` It can only reduce your income tax, so ${usd(result.form8880.credit)} is used.` : ''}`
              : 'Your income is above the limit for the Saver’s Credit.'}
          </p>
        )}
      </Section>

      {result.summary.refund > 0 && (
        <Section title="Direct deposit" intro={`Get your ${usd(result.summary.refund)} refund faster by direct deposit. Leave blank to get a paper check.`}>
          <div className="grid">
            <DigitsField label="Routing number" length={9} value={ret.refundDeposit.routingNumber} onChange={(v) => set((r) => ({ ...r, refundDeposit: { ...r.refundDeposit, routingNumber: v } }))} />
            <DigitsField label="Account number" length={17} validLengths={[4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]} value={ret.refundDeposit.accountNumber} onChange={(v) => set((r) => ({ ...r, refundDeposit: { ...r.refundDeposit, accountNumber: v } }))} />
          </div>
          <Choice legend="Account type" value={ret.refundDeposit.accountType} onChange={(v) => set((r) => ({ ...r, refundDeposit: { ...r.refundDeposit, accountType: v } }))}
            options={[{ value: 'checking', label: 'Checking' }, { value: 'savings', label: 'Savings' }]} />
        </Section>
      )}

      <Section title="Tax you already paid">
        <dl className="facts">
          <div><dt>Withheld on W-2s</dt><dd>{usd(result.f1040['25a'])}</dd></div>
          <div><dt>Withheld on 1099s and SSA-1099</dt><dd>{usd(result.f1040['25b'] - ret.payments.otherWithholding)}</dd></div>
          {result.f1040['25c'] > 0 && <div><dt>Additional Medicare tax withheld</dt><dd>{usd(result.f1040['25c'])}</dd></div>}
          {result.f1040['31'] > 0 && <div><dt>Excess Social Security withheld</dt><dd>{usd(result.f1040['31'])}</dd></div>}
        </dl>
        <div className="grid">
          <MoneyField label="Other federal withholding" hint="1099-G, 1099-NEC, 1099-MISC and similar" value={ret.payments.otherWithholding} onChange={(n) => set((r) => ({ ...r, payments: { ...r.payments, otherWithholding: n } }))} />
        </div>
        <h3 className="subhead">2025 estimated tax payments</h3>
        <p className="why" style={{ marginTop: 0 }}>Enter each payment under the deadline it was paid by. Include any 2024 overpayment applied to 2025 in the first one.</p>
        <div className="grid">
          {(['April 15, 2025', 'June 16, 2025', 'September 15, 2025', 'January 15, 2026'] as const).map((label, i) => (
            <MoneyField key={label} label={`Paid by ${label}`} value={ret.payments.estimatedByQuarter[i]}
              onChange={(n) => set((r) => {
                const q = [...r.payments.estimatedByQuarter] as [number, number, number, number]
                q[i] = n
                return { ...r, payments: { ...r.payments, estimatedByQuarter: q, estimatedTaxPayments: q.reduce((a, b) => a + b, 0) } }
              })} />
          ))}
        </div>

        <h3 className="subhead">Your 2024 return</h3>
        <p className="why" style={{ marginTop: 0 }}>Used only to check the estimated tax penalty. If you paid at least last year’s tax (110% if your AGI was over $150,000), there is no penalty.</p>
        <div className="grid">
          <MoneyField label="2024 total tax" hint="2024 Form 1040 line 24 minus lines 27–30" value={ret.priorYear.tax ?? 0} onChange={(n) => set((r) => ({ ...r, priorYear: { ...r.priorYear, tax: n } }))} />
          <MoneyField label="2024 adjusted gross income" hint="2024 Form 1040 line 11" value={ret.priorYear.agi} onChange={(n) => set((r) => ({ ...r, priorYear: { ...r.priorYear, agi: n } }))} />
        </div>
        <div className="checks">
          <Check label="I had no tax liability for 2024 (and was a U.S. citizen or resident all year)" checked={ret.priorYear.noLiability} onChange={(v) => set((r) => ({ ...r, priorYear: { ...r.priorYear, noLiability: v } }))} />
        </div>
        {result.form2210.penalty > 0
          ? <p className="note is-warn">Estimated tax penalty: <strong>{usd(result.form2210.penalty)}</strong> (Form 1040 line 38), figured quarter by quarter at 7% a year. It is included in your amount owed.</p>
          : result.form2210.reason && result.form2210.line7 >= 1000 ? <p className="note">No estimated tax penalty: {result.form2210.reason.charAt(0).toLowerCase() + result.form2210.reason.slice(1)}</p> : null}
      </Section>
    </>
  )
}
