/**
 * The Delaware part of the State step: Form PIT-RES with PIT-RSS, PIT-RSA and PIT-CRS for full-year residents.
 */
import { ReactElement, useMemo, useState } from 'react'
import type { DeInput, Owner, Person } from '../engine/model.ts'
import { computeDelaware } from '../engine/de2025.ts'
import { buildDePacket, DE_FUNDS, deEitcChildren } from '../pdf/de2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { Check, Choice, MoneyField, NumberField, Section, TextField, usd } from './fields'
import { StatementRows } from './statements'
import type { StepProps } from './steps'

const LINES: [line: string, label: string][] = [
  ['1', 'Federal adjusted gross income'], ['4', 'With additions'], ['6', 'Pension exclusion'], ['8a', 'Social Security, railroad and higher-education exclusions'],
  ['8b', '529 / ABLE contributions'], ['9', 'Total subtractions'], ['11', 'Exclusion for people 60+ or disabled'], ['12', 'Delaware adjusted gross income'],
  ['22', 'Deductions'], ['23', 'Taxable income'], ['24', 'Tax'], ['27a', 'Personal credits'], ['27b', '60-or-over credits'], ['28', 'Tax paid to another state'],
  ['29', 'Volunteer firefighter credit'], ['30', 'Other nonrefundable credits (PIT-CRS)'], ['31', 'Child care credit'], ['32', 'Total nonrefundable credits'],
  ['33', 'Tax after credits'], ['34', 'Earned income tax credit'], ['35', 'Delaware tax withheld'], ['36', 'Estimated payments'], ['37', 'S corporation payments'],
  ['38', 'Refundable business credits'], ['39', 'Real estate tax payments (REW-EST)'], ['40', 'Total payments'], ['41', 'Balance due'], ['42', 'Overpayment']
]
const ALWAYS = new Set(['1', '12', '22', '23', '24', '33', '40'])
const STATUS_NAME = { 1: '1 — single', 2: '2 — joint', 3: '3 — married filing separate forms', 4: '4 — married filing combined separate', 5: '5 — head of household' } as const
const CRS: [string, string][] = [
  ['1', 'Neighborhood assistance: carryover'], ['2', 'Neighborhood assistance: 2025 approved'], ['4', 'Economic development: carryover'], ['5', 'Economic development: 2025 approved'],
  ['7', 'Green industries / brownfield: carryover'], ['8', 'Green industries / brownfield: 2025 approved'], ['10', 'Research and development carryover (before 2018)'],
  ['11', 'Land and historic resources: carryover'], ['12', 'Land and historic resources: 2025 approved'], ['14', 'Historic preservation: carryover'], ['15', 'Historic preservation: 2025 approved'],
  ['22', 'Credits from Form SCT-SSR / PRT-PSI']
]
const CRS_REFUNDABLE: [string, string][] = [['25', 'Business finder’s fee'], ['26', 'New Economy Jobs Program'], ['27', 'Organ and bone marrow donation'], ['28', 'Hiring individuals with disabilities'], ['29', 'Research and development']]
const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback
const date = (s: string): string => (/^\d{8}$/.test(s.trim()) ? `${s.slice(0, 2)}/${s.slice(2, 4)}/${s.slice(4)}` : s)

export function DelawareStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const d = ret.de
  const de = useMemo(() => computeDelaware(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<DeInput>): void => set((r) => ({ ...r, de: { ...r.de, ...p } }))
  const putOwner = <K extends 'militaryPension' | 'disabled'>(k: K, o: Owner, v: boolean): void => put({ [k]: { ...d[k], [o]: v } } as Partial<DeInput>)
  const putAmount = <K extends 'railroadRetirement' | 'higherEducation' | 'tuition529' | 'able' | 'unionDues'>(k: K, o: Owner, n: number): void => put({ [k]: { ...d[k], [o]: n } } as Partial<DeInput>)
  const married = ret.filingStatus === 'mfj'
  const owners: Owner[] = married ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const packet = buildDePacket(ret, result, de, preparer)
  const two = de.status === 4
  const total = (k: string): number => (de.A[k] ?? 0) + (de.B[k] ?? 0)
  const owes = de.lines['46'] > 0
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  const r1099 = ret.retirement.filter((x) => owners.includes(x.owner))
  const kids = deEitcChildren(ret)
  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadDelawareForms }) => downloadDelawareForms(ret, result, de, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }
  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'Delaware: you owe' : 'Delaware refund'}</p>
          <p className="va-result-amount">{usd(owes ? de.lines['46'] : de.lines['47'])}</p>
        </div>
        <dl>
          <div><dt>Filing status</dt><dd>{STATUS_NAME[de.status]}</dd></div>
          <div><dt>Delaware taxable income</dt><dd>{usd(total('23'))}</dd></div>
          <div><dt>Tax after credits</dt><dd>{usd(total('33'))}</dd></div>
        </dl>
      </div>

      <Section title="Delaware return" intro="Delaware taxes every filing status on the same brackets (up to 6.6% over $60,000), with a $3,250 standard deduction per person and $110 personal credits.">
        {married && (
          <>
            <Choice legend="How to file as a married couple" value={d.status} onChange={(status) => put({ status })} options={[
              { value: 'auto', label: 'Whichever costs less', hint: de.alternative ? `Status ${de.status} is ${usd(Math.abs(de.alternative.net - (de.lines['46'] - de.lines['47'])))} better than status ${de.alternative.status}` : undefined },
              { value: 'combined', label: 'Status 4: combined separate', hint: 'Each spouse in their own column on one form' },
              { value: 'joint', label: 'Status 2: joint' }
            ]} />
            {two && (
              <div className="grid">
                <MoneyField label={`${names.spouse}’s share of federal AGI`} hint={`Column A, line 1. Worked out: ${usd(de.A['1'])}; shared income is split evenly`} value={d.spouseAgi ?? de.A['1']}
                  onChange={(n) => put({ spouseAgi: n })} />
                {d.spouseAgi !== null && <div className="actions"><button type="button" className="button is-quiet" onClick={() => put({ spouseAgi: null })}>Work it out again</button></div>}
              </div>
            )}
          </>
        )}
        <Choice legend="Deduction" value={d.deduction} onChange={(deduction) => put({ deduction })} options={[
          { value: 'auto', label: 'Whichever is larger', hint: de.itemize ? 'Itemizing (PIT-RSA)' : 'Standard deduction' },
          { value: 'standard', label: 'Standard deduction' }, { value: 'itemized', label: 'Itemize (PIT-RSA)' }
        ]} />
      </Section>

      <Section title="Delaware withholding and payments" intro="From the state section of each W-2 (boxes 15–17) and 1099-R (boxes 14–16). Don’t include city wage tax.">
        {w2s.length > 0
          ? <StatementRows kind="w2" state="Delaware" items={w2s.map((w) => ({ id: w.id, title: `${w.employer.trim() || 'W-2'} (${names[w.owner]})`, federal: w.wages }))} value={d.w2} onChange={(w2) => put({ w2 })} />
          : <p className="why">No W-2s entered.</p>}
        {r1099.length > 0 && <StatementRows kind="1099r" state="Delaware" items={r1099.map((x) => ({ id: x.id, title: `${x.payer.trim() || '1099-R'} (${names[x.owner]})`, federal: x.taxableAmount }))} value={d.r1099} onChange={(r) => put({ r1099: r })} />}
        <div className="grid">
          <MoneyField label="2025 estimated tax and extension payments" hint="Line 36, with any 2024 overpayment applied" value={d.estimatedPayments} onChange={(n) => put({ estimatedPayments: n })} />
          <MoneyField label="Real estate capital gains tax payments" hint="Line 39; Form REW-EST" value={d.realEstatePayments} onChange={(n) => put({ realEstatePayments: n })} />
          {de.lines['47'] + de.lines['44'] > 0 && <MoneyField label="Apply to 2026 estimated tax" hint="Line 44" value={d.creditForward} onChange={(n) => put({ creditForward: n })} />}
          <TextField label="Delaware driver’s license or state ID" hint="Optional; page 3" autoComplete="off" value={d.dmvId} onChange={(s) => put({ dmvId: s })} />
        </div>
        <fieldset className="statement">
          <legend>S corporation payments (Schedule V)</legend>
          {d.sCorp.map((x, i) => {
            const upd = (p: Partial<DeInput['sCorp'][number]>): void => put({ sCorp: d.sCorp.map((y, j) => (j === i ? { ...y, ...p } : y)) })
            return (
              <div className="grid" key={i}>
                <TextField label="S corporation name" autoComplete="off" value={x.name} onChange={(s) => upd({ name: s })} />
                <TextField label="FEIN" autoComplete="off" value={x.fein} onChange={(s) => upd({ fein: s })} />
                {married && <Choice legend="Paid for" value={x.owner} onChange={(o) => upd({ owner: o })} options={owners.map((o) => ({ value: o, label: names[o] }))} />}
                <MoneyField label="Delaware estimated tax paid for you" hint="Form SCT-SSR" value={x.amount} onChange={(n) => upd({ amount: n })} />
                <div className="actions"><button type="button" className="button is-quiet" onClick={() => put({ sCorp: d.sCorp.filter((_, j) => j !== i) })}>Remove</button></div>
              </div>
            )
          })}
          <div className="actions"><button type="button" className="button is-quiet" onClick={() => put({ sCorp: [...d.sCorp, { fein: '', name: '', owner: 'taxpayer', amount: 0 }] })}>Add an S corporation payment</button></div>
        </fieldset>
      </Section>

      <Section title="Additions and subtractions" intro="Social Security is subtracted automatically. Pensions are excluded up to $2,000 under 60 ($12,500 military) and, from 60, together with interest, dividends, gains and rents up to $12,500 per person.">
        <div className="grid">
          <MoneyField label="Interest on other states’ municipal bonds" hint="Line 2" value={d.otherStateBondInterest} onChange={(n) => put({ otherStateBondInterest: n })} />
          <MoneyField label="Fiduciary additions, oil depletion" hint="Line 3" value={d.fiduciaryAdditions} onChange={(n) => put({ fiduciaryAdditions: n })} />
          <MoneyField label="Interest on U.S. government obligations" hint="Line 5" value={d.usObligationInterest} onChange={(n) => put({ usObligationInterest: n })} />
          <MoneyField label="Delaware refund in federal income, fiduciary subtractions, WOTC wages, Delaware NOL" hint="Line 7" value={d.otherSubtractions} onChange={(n) => put({ otherSubtractions: n })} />
        </div>
        {owners.map((o) => (
          <fieldset key={o} className="statement">
            <legend>{names[o]}</legend>
            <div className="grid">
              <Check label="The pension is a U.S. military pension" hint="Line 6" checked={d.militaryPension[o]} onChange={(v) => putOwner('militaryPension', o, v)} />
              <Check label="Totally and permanently disabled" hint="Line 11" checked={d.disabled[o]} onChange={(v) => putOwner('disabled', o, v)} />
              <MoneyField label="Tier II railroad retirement in federal income" hint="Line 8a" value={d.railroadRetirement[o]} onChange={(n) => putAmount('railroadRetirement', o, n)} />
              <MoneyField label="Retirement distributions used for college costs" hint="Line 8a; dependents under 26" value={d.higherEducation[o]} onChange={(n) => putAmount('higherEducation', o, n)} />
              <MoneyField label="Deposits to a Delaware 529 plan" hint="Line 8b; up to $1,000 ($2,000 joint), income limits" value={d.tuition529[o]} onChange={(n) => putAmount('tuition529', o, n)} />
              <MoneyField label="Deposits to an ABLE account" hint="Line 8b; up to $5,000 ($10,000 joint)" value={d.able[o]} onChange={(n) => putAmount('able', o, n)} />
              <TextField label="Volunteer fire company number" hint="Line 29; $1,000 credit for active members" autoComplete="off" value={d.firefighter[o]} onChange={(s) => put({ firefighter: { ...d.firefighter, [o]: s } })} />
              <MoneyField label="Labor union dues" hint="Line 16; up to $500, when itemizing" value={d.unionDues[o]} onChange={(n) => putAmount('unionDues', o, n)} />
            </div>
          </fieldset>
        ))}
      </Section>

      <Section title="Itemized deductions (PIT-RSA)" intro={`Your federal Schedule A amounts, without Delaware income tax. Itemized ${usd(de.rsa['17a'])} before the lines below.`}>
        <div className="grid">
          <Check label="The state and local tax I deducted federally is sales tax" hint="PIT-RSA line 5b" checked={d.salesTax} onChange={(v) => put({ salesTax: v })} />
          <MoneyField label="Foreign taxes paid (if you took the foreign tax credit)" hint="Line 14" value={d.foreignTaxes} onChange={(n) => put({ foreignTaxes: n })} />
          <NumberField label="Miles driven for charity" hint="Line 15; 26¢ a mile" max={100000} value={d.charityMiles} onChange={(n) => put({ charityMiles: n })} />
          <MoneyField label="Land gift deducted federally and claimed on PIT-CRS" hint="Line 18" value={d.landAdjustment} onChange={(n) => put({ landAdjustment: n })} />
        </div>
      </Section>

      <Section title="Credits" intro="Personal credits, the child care credit (50% of the federal credit) and the earned income tax credit are worked out from your return.">
        <div className="grid">
          <TextField label="Other state you paid tax to" hint="Two letters; Schedule I" autoComplete="off" value={d.otherState.state} onChange={(s) => put({ otherState: { ...d.otherState, state: s.toUpperCase().slice(0, 2) } })} />
          <MoneyField label="Income taxed by that state" hint="Its adjusted gross income on your return there" value={d.otherState.income} onChange={(n) => put({ otherState: { ...d.otherState, income: n } })} />
          <MoneyField label="Tax paid to that state (after its credits)" value={d.otherState.tax} onChange={(n) => put({ otherState: { ...d.otherState, tax: n } })} />
          {two && <Choice legend="Whose income was taxed there" value={d.otherState.owner} onChange={(o) => put({ otherState: { ...d.otherState, owner: o } })} options={owners.map((o) => ({ value: o, label: names[o] }))} />}
        </div>
        {kids.length > 0 && (result.f1040['27a'] ?? 0) > 0 && (
          <div className="grid">
            {kids.map((k) => <TextField key={k.id} label={`${k.name || 'Child'}: date of birth`} hint="Schedule II" placeholder="mm/dd/yyyy" autoComplete="off" value={d.dependentBirthDates[k.id] ?? ''} onChange={(s) => put({ dependentBirthDates: { ...d.dependentBirthDates, [k.id]: date(s) } })} />)}
          </div>
        )}
        <details>
          <summary>Business and approved credits (PIT-CRS)</summary>
          <div className="grid">
            {CRS.map(([k, label]) => <MoneyField key={k} label={label} hint={`PIT-CRS line ${k}`} value={d.crs[k] ?? 0} onChange={(n) => put({ crs: { ...d.crs, [k]: n } })} />)}
            <NumberField label="Defibrillators placed in service" hint="PIT-CRS line 17; $100 each" max={1000} value={d.crs['17'] ?? 0} onChange={(n) => put({ crs: { ...d.crs, '17': n } })} />
            {CRS_REFUNDABLE.map(([k, label]) => <MoneyField key={k} label={`${label} (refundable)`} hint={`PIT-CRS line ${k}`} value={d.crs[k] ?? 0} onChange={(n) => put({ crs: { ...d.crs, [k]: n } })} />)}
          </div>
        </details>
      </Section>

      <Section title="Contributions to special funds (Schedule III)" intro="Each amount ($1 minimum) is taken from your refund or added to what you owe.">
        <div className="grid">
          {DE_FUNDS.map(([letter, , label]) => (
            <MoneyField key={letter} label={label} hint={`Line 18${letter}`} value={d.contributions[letter] ?? 0} onChange={(n) => put({ contributions: { ...d.contributions, [letter]: n } })} />
          ))}
        </div>
      </Section>

      <Section title="Underpayment of estimated tax (Form PIT-UND)" intro="If your withholding and estimated payments fell short, Delaware charges a penalty. The short method on Form PIT-UND applies when you made no estimated payments or paid four equal amounts on time.">
        <Check label="Figure the underpayment penalty" checked={d.und.priorTax !== null} onChange={(on) => put({ und: { ...d.und, priorTax: on ? 0 : null } })} />
        {d.und.priorTax !== null && (
          <>
            <div className="grid">
              <MoneyField label="2024 Delaware tax balance" hint="2024 PIT-RES line 33 minus line 34 (0 if none)" value={d.und.priorTax} onChange={(n) => put({ und: { ...d.und, priorTax: n } })} />
              <NumberField label="Days before April 30, 2026 the shortfall was paid" hint="Line K; 0 if paid with the return" max={120} value={d.und.earlyDays} onChange={(n) => put({ und: { ...d.und, earlyDays: n } })} />
            </div>
            <Check label="My 2024 Delaware AGI was over $150,000 ($75,000 if married filing separately)" hint="Line B uses 110% of the 2024 balance" checked={d.und.priorAgiHigh} onChange={(on) => put({ und: { ...d.und, priorAgiHigh: on } })} />
            <Check label="I made no estimated payments, or four equal payments on time" hint="Needed for the short method" checked={d.und.equalOnTime} onChange={(on) => put({ und: { ...d.und, equalOnTime: on } })} />
            <Check label="I am a farmer or fisherman (2/3 of gross income)" hint="No penalty if the tax was paid in time" checked={d.und.farmer} onChange={(on) => put({ und: { ...d.und, farmer: on } })} />
            {!d.und.equalOnTime && (
              <>
                <p className="why">Parts 3–5 figure each quarter separately. Withholding is spread evenly over the year; leave the income fields at 0 if your income came in evenly.</p>
                <div className="grid">
                  <TextField label="Date the rest of the tax was paid" hint="MM/DD/YYYY; blank means April 30, 2026" autoComplete="off" value={d.und.paidDate} onChange={(s) => put({ und: { ...d.und, paidDate: s } })} />
                  {(['Jan 1–Apr 30', 'May 1–Jun 15', 'Jun 16–Sep 15', 'Sep 16–Jan 15'] as const).map((label, i) => (
                    <MoneyField key={label} label={`Estimated payments made ${label}`} hint="Line 29" value={d.und.quarterly?.[i] ?? 0} onChange={(n) => { const q = [...(d.und.quarterly ?? [0, 0, 0, 0])] as [number, number, number, number]; q[i] = n; put({ und: { ...d.und, quarterly: q } }) }} />
                  ))}
                </div>
                <Check label="My income came in unevenly (annualize it)" hint="Enter Delaware AGI earned through each date" checked={d.und.periodAgi !== null} onChange={(on) => put({ und: { ...d.und, periodAgi: on ? [0, 0, 0, de.B['12'] + (de.A['12'] ?? 0)] : null, periodItemized: null } })} />
                {d.und.periodAgi && (
                  <div className="grid">
                    {(['Jan 1–Mar 31', 'Jan 1–May 31', 'Jan 1–Aug 31', 'Whole year'] as const).map((label, i) => (
                      <MoneyField key={label} label={`Delaware AGI ${label}`} hint="Part 3 line 2" value={d.und.periodAgi![i]} onChange={(n) => { const q = [...d.und.periodAgi!] as [number, number, number, number]; q[i] = n; put({ und: { ...d.und, periodAgi: q } }) }} />
                    ))}
                    {de.itemize && (['Jan 1–Mar 31', 'Jan 1–May 31', 'Jan 1–Aug 31', 'Whole year'] as const).map((label, i) => (
                      <MoneyField key={`i${label}`} label={`Itemized deductions ${label}`} hint="Part 3 line 5" value={d.und.periodItemized?.[i] ?? 0} onChange={(n) => { const q = [...(d.und.periodItemized ?? [0, 0, 0, 0])] as [number, number, number, number]; q[i] = n; put({ und: { ...d.und, periodItemized: q } }) }} />
                    ))}
                  </div>
                )}
              </>
            )}
            {de.und && <p className="why">{de.lines['45'] > 0 ? `Required annual payment ${usd(de.und['C'])}; penalty (line 45): ${usd(de.lines['45'])}${de.und['part3'] ? ' by Parts 3–5' : ''}.` : 'No underpayment penalty (see Things to look at).'}</p>}
          </>
        )}
      </Section>

      {de.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">{de.issues.map((t) => <li key={t} className="issue is-warning"><span className="issue-kind">Check</span><span>{t}</span></li>)}</ul>
        </Section>
      )}

      <Section title="Form PIT-RES" intro={two ? 'Column A is the spouse, column B is you. Whole dollars.' : 'Whole dollars.'}>
        <table className="lines">
          {two && <thead><tr><th scope="col">Line</th><th scope="col">{names.spouse}</th><th scope="col">{names.taxpayer}</th></tr></thead>}
          <tbody>
            {LINES.filter(([k]) => ALWAYS.has(k) || total(k) !== 0).map(([k, label]) => (
              <tr key={k} className={k === '33' ? 'is-key' : ''}>
                <th scope="row"><span className="line-no">{k}</span>{label}</th>
                {two && <td>{usd(de.A[k] ?? 0)}</td>}
                <td>{usd(de.B[k] ?? 0)}</td>
              </tr>
            ))}
            {de.lines['43'] > 0 && <tr><th scope="row"><span className="line-no">43</span>Special funds</th>{two && <td />}<td>{usd(de.lines['43'])}</td></tr>}
            {de.lines['44'] > 0 && <tr><th scope="row"><span className="line-no">44</span>Applied to 2026</th>{two && <td />}<td>{usd(de.lines['44'])}</td></tr>}
            <tr className="is-key"><th scope="row"><span className="line-no">{owes ? '46' : '47'}</span>{owes ? 'Net balance due' : 'Net refund'}</th>{two && <td />}<td>{usd(owes ? de.lines['46'] : de.lines['47'])}</td></tr>
          </tbody>
        </table>
      </Section>

      <Section title="Delaware forms" intro="Filled in on this device from the official Delaware Division of Revenue forms.">
        <ul className="form-list">{packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Include these yourself.</strong><ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul></div>
        )}
        <div className="actions"><button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download Delaware forms (PDF)'}</button></div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <p className="why">Sign page 3{married ? ' (both spouses)' : ''}. With a payment, mail to Delaware Division of Revenue, PO Box 508, Wilmington DE 19899-0508; with a refund, PO Box 8710, Wilmington DE 19899-8710; otherwise PO Box 8711, Wilmington DE 19899-8711. Due April 30, 2026.</p>
      </Section>
    </div>
  )
}
