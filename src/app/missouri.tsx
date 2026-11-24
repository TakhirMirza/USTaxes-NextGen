/**
 * The Missouri part of the State step: Form MO-1040 with MO-A, MO-PTS / MO-CRP, MO-CR and MO-WFTC.
 */
import { ReactElement, useMemo, useState } from 'react'
import type { MoInput, MoTcCredit, Owner, Person } from '../engine/model.ts'
import { computeMissouri } from '../engine/mo2025.ts'
import { buildMoPacket, MO_COUNTIES, MO_TRUST_FUNDS } from '../pdf/mo2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { Check, Choice, MoneyField, Section, TextField, usd } from './fields'
import { StatementRows } from './statements'
import type { StepProps } from './steps'

const LINES: [line: string, label: string, perSpouse: boolean][] = [
  ['1', 'Federal adjusted gross income', true], ['2', 'Additions (MO-A)', true], ['4', 'Subtractions (MO-A)', true], ['5', 'Missouri adjusted gross income', true],
  ['6', 'Total Missouri adjusted gross income', false], ['7', 'Income percentage', true], ['8', 'Pension and Social Security exemption', false],
  ['13', 'Federal income tax deduction', false], ['14', 'Standard or itemized deduction', false], ['15', 'Head of household / widow(er) exemption', false],
  ['16', 'Long-term care insurance', false], ['17', 'Health care sharing ministry', false], ['18', 'Active duty military income', false], ['19', 'Inactive duty military income', false],
  ['21', 'Beginning farmer deduction', false], ['24', 'Foster parent deduction', false], ['25', 'Total deductions', false], ['26', 'Subtotal', false],
  ['29', 'Taxable income', true], ['30', 'Tax', true], ['31', 'Resident credit (MO-CR)', true], ['34', 'Other taxes', true], ['36', 'Total tax', false],
  ['37', 'Missouri tax withheld', false], ['38', 'Estimated payments', false], ['41', 'Extension payment', false], ['42', 'Miscellaneous credits (MO-TC)', false],
  ['43', 'Property tax credit (MO-PTS)', false], ['44', 'Working Family Tax Credit', false], ['45', 'Total payments and credits', false],
  ['50', 'Applied to 2026', false], ['51', 'Trust fund donations', false], ['52', 'MOST 529 deposit', false], ['53', 'Refund', false], ['56', 'Amount due', false]
]
const ALWAYS = new Set(['1', '5', '6', '26', '29', '30', '36', '45'])
const KEY = new Set(['36', '53', '56'])
const QUALIFICATIONS: { value: MoInput['pts']['qualification']; label: string }[] = [
  { value: 'A', label: 'A. 65 or older' }, { value: 'B', label: 'B. 100% disabled veteran (military service)' },
  { value: 'C', label: 'C. 100% disabled' }, { value: 'D', label: 'D. 60 or older with surviving spouse benefits' }
]
const RENT_TYPES: { value: string; label: string }[] = [
  { value: '100', label: 'Apartment, house, mobile home, duplex, lot or low-income housing (100%)' }, { value: '50', label: 'Boarding home, residential care, hotel with meals, or rent shared with 1 other (50%)' },
  { value: '45', label: 'Skilled or intermediate care nursing home (45%)' }, { value: '33', label: 'Rent shared with 2 others (33%)' }, { value: '25', label: 'Rent shared with 3 others (25%)' }
]
const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback
const date = (s: string): string => (/^\d{8}$/.test(s.trim()) ? `${s.slice(0, 2)}/${s.slice(2, 4)}/${s.slice(4)}` : s)

export function MissouriStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const d = ret.mo
  const mo = useMemo(() => computeMissouri(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<MoInput>): void => set((r) => ({ ...r, mo: { ...r.mo, ...p } }))
  const putP = (p: Partial<MoInput['pts']>): void => put({ pts: { ...d.pts, ...p } })
  type OwnerNumbers = 'muniInterest' | 'otherAdditions' | 'usInterest' | 'stateRefund' | 'militaryRetirement' | 'railroad' | 'otherSubtractions' | 'tuition529' | 'healthPremiums' | 'able' | 'publicPension'
  const putO = (k: OwnerNumbers, o: Owner, n: number): void => put({ [k]: { ...d[k], [o]: n } } as Partial<MoInput>)
  const married = ret.filingStatus === 'mfj'
  const owners: Owner[] = married ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const packet = buildMoPacket(ret, result, mo, preparer)
  const L = mo.lines
  const owes = L['56'] > 0
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  const r1099 = ret.retirement.filter((x) => owners.includes(x.owner))
  const value = (k: string, c: 'Y' | 'S'): number => (c === 'Y' ? mo.Y[k] : mo.S[k]) ?? 0
  const show = (k: string, perSpouse: boolean): boolean => ALWAYS.has(k) || (perSpouse ? value(k, 'Y') !== 0 || (mo.two && value(k, 'S') !== 0) : (L[k] ?? 0) !== 0)
  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadMissouriForms }) => downloadMissouriForms(ret, result, mo, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }
  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'Missouri: you owe' : 'Missouri refund'}</p>
          <p className="va-result-amount">{usd(owes ? L['56'] : L['53'])}</p>
        </div>
        <dl>
          <div><dt>Missouri adjusted gross income</dt><dd>{usd(L['6'])}</dd></div>
          <div><dt>Total tax</dt><dd>{usd(L['36'])}</dd></div>
          <div><dt>Payments and credits</dt><dd>{usd(L['45'])}</dd></div>
        </dl>
      </div>

      <Section title="Missouri return" intro="Missouri taxes each spouse’s share separately on the same chart (2% to 4.7% above $9,191), after a deduction for part of your federal tax, the standard deduction, and a full exemption of capital gains and of Social Security at 62.">
        <Choice legend="County of residence" value={d.county} onChange={(county) => put({ county })} columns={4} options={MO_COUNTIES.map((c) => ({ value: c, label: c.replace(/\b([A-Z])([A-Z]+)/g, (_, a: string, b: string) => a + b.toLowerCase()) }))} />
        <div className="grid">
          {married && (
            <>
              <MoneyField label={`${names.spouse}’s share of federal AGI`} hint={`Line 1S. Worked out: ${usd(mo.S['1'] ?? 0)}; joint income split evenly`} value={d.spouseAgi ?? (mo.S['1'] ?? 0)} onChange={(n) => put({ spouseAgi: n })} />
              {d.spouseAgi !== null && <div className="actions"><button type="button" className="button is-quiet" onClick={() => put({ spouseAgi: null })}>Work it out again</button></div>}
            </>
          )}
          {owners.map((o) => (
            <TextField key={o} label={`${names[o]}: date of birth`} hint="Used on MO-PTS" placeholder="mm/dd/yyyy" autoComplete="off" value={d.birthDates[o]} onChange={(s) => put({ birthDates: { ...d.birthDates, [o]: date(s) } })} />
          ))}
          {owners.map((o) => (
            <Check key={`d${o}`} label={`${names[o]} is 100% disabled`} hint="Page 1 box" checked={d.disabled[o]} onChange={(v) => put({ disabled: { ...d.disabled, [o]: v } })} />
          ))}
        </div>
      </Section>

      <Section title="Missouri withholding and payments" intro="From the state section of each W-2 (boxes 15–17) and 1099-R (boxes 14–16). Don’t include Kansas City or St. Louis earnings tax.">
        {w2s.length > 0
          ? <StatementRows kind="w2" state="Missouri" items={w2s.map((w) => ({ id: w.id, title: `${w.employer.trim() || 'W-2'} (${names[w.owner]})`, federal: w.wages }))} value={d.w2} onChange={(w2) => put({ w2 })} />
          : <p className="why">No W-2s entered.</p>}
        {r1099.length > 0 && <StatementRows kind="1099r" state="Missouri" items={r1099.map((x) => ({ id: x.id, title: `${x.payer.trim() || '1099-R'} (${names[x.owner]})`, federal: x.taxableAmount }))} value={d.r1099} onChange={(r) => put({ r1099: r })} />}
        <div className="grid">
          <MoneyField label="2025 estimated payments" hint="Line 38, with any 2024 overpayment applied" value={d.estimatedPayments} onChange={(n) => put({ estimatedPayments: n })} />
          <MoneyField label="Paid with an extension (Form MO-60)" hint="Line 41" value={d.extensionPayment} onChange={(n) => put({ extensionPayment: n })} />
          {L['49'] > 0 && <MoneyField label="Apply to 2026 estimated tax" hint="Line 50" value={d.creditForward} onChange={(n) => put({ creditForward: n })} />}
          {L['49'] > 0 && <MoneyField label="Deposit into a MOST 529 account" hint="Line 52; Form 5632" value={d.mostDeposit} onChange={(n) => put({ mostDeposit: n })} />}
        </div>
      </Section>

      <Section title="Additions and subtractions (MO-A Part 1)" intro="Capital gains (100%) and 20% of Schedule C business income are subtracted automatically.">
        {owners.map((o) => (
          <fieldset key={o} className="statement">
            <legend>{names[o]}</legend>
            <div className="grid">
              <MoneyField label="Other states’ municipal bond interest" hint="Line 1" value={d.muniInterest[o]} onChange={(n) => putO('muniInterest', o, n)} />
              <MoneyField label="Partnership, fiduciary, S corporation and other additions" hint="Line 2" value={d.otherAdditions[o]} onChange={(n) => putO('otherAdditions', o, n)} />
              <MoneyField label="Interest on U.S. obligations" hint="Line 8; name the securities" value={d.usInterest[o]} onChange={(n) => putO('usInterest', o, n)} />
              <MoneyField label="State income tax refund in federal income" hint="Line 9" value={d.stateRefund[o]} onChange={(n) => putO('stateRefund', o, n)} />
              <MoneyField label="Military retirement benefits" hint="Line 10" value={d.militaryRetirement[o]} onChange={(n) => putO('militaryRetirement', o, n)} />
              <MoneyField label="Railroad Retirement Board benefits in federal income" hint="Line 11" value={d.railroad[o]} onChange={(n) => putO('railroad', o, n)} />
              <MoneyField label="Other subtractions (partnership, S corporation, combat pay, …)" hint="Line 11" value={d.otherSubtractions[o]} onChange={(n) => putO('otherSubtractions', o, n)} />
              <MoneyField label="529 plan contributions" hint="Line 12; up to $8,000 ($16,000 combined)" value={d.tuition529[o]} onChange={(n) => putO('tuition529', o, n)} />
              <MoneyField label="Qualified health insurance premiums" hint="Line 13; Form 5695" value={d.healthPremiums[o]} onChange={(n) => putO('healthPremiums', o, n)} />
              <MoneyField label="ABLE account contributions" hint="Line 15" value={d.able[o]} onChange={(n) => putO('able', o, n)} />
              <MoneyField label="Taxable public (government) pension" hint="MO-A Part 3 Section A; up to $47,633" value={d.publicPension[o]} onChange={(n) => putO('publicPension', o, n)} />
              <Check label="Taxable Social Security is disability (SSDI)" hint="Exempt at any age" checked={d.ssDisability[o]} onChange={(v) => put({ ssDisability: { ...d.ssDisability, [o]: v } })} />
            </div>
          </fieldset>
        ))}
      </Section>

      <Section title="Deductions" intro={`Federal income tax deduction ${usd(L['13'])} (${L['12']}% of federal tax). ${mo.itemize ? 'Itemizing on MO-A Part 2.' : 'Standard deduction.'}`}>
        <div className="grid">
          {mo.part2 && <MoneyField label="Kansas City / St. Louis earnings tax in your itemized state taxes" hint="MO-A Part 2 line 10" value={d.earningsTax} onChange={(n) => put({ earningsTax: n })} />}
          <MoneyField label="Qualified long-term care insurance premiums" hint="Line 16" value={d.ltcInsurance} onChange={(n) => put({ ltcInsurance: n })} />
          <MoneyField label="Health care sharing ministry contributions" hint="Line 17" value={d.healthShare} onChange={(n) => put({ healthShare: n })} />
          <MoneyField label="Active duty military income" hint="Line 18" value={d.activeDuty} onChange={(n) => put({ activeDuty: n })} />
          <MoneyField label="Inactive duty (Guard / Reserve) military income" hint="Line 19" value={d.inactiveDuty} onChange={(n) => put({ inactiveDuty: n })} />
          <MoneyField label="Beginning farmer deduction" hint="Line 21; Form 5955" value={d.farmland} onChange={(n) => put({ farmland: n })} />
          <MoneyField label="Foster parent deduction" hint="Line 24; Form 5870" value={d.foster} onChange={(n) => put({ foster: n })} />
        </div>
      </Section>

      <Section title="Credits and other taxes" intro="The Working Family Tax Credit (20% of the federal EIC) is worked out automatically.">
        <div className="grid">
          <TextField label="Other state you paid income tax to" hint="Two letters; MO-CR" autoComplete="off" value={d.otherState.state} onChange={(s) => put({ otherState: { ...d.otherState, state: s.toUpperCase().slice(0, 2) } })} />
          <MoneyField label="Income taxed by that state" hint="MO-CR line 3" value={d.otherState.income} onChange={(n) => put({ otherState: { ...d.otherState, income: n } })} />
          <MoneyField label="Tax owed to that state" hint="MO-CR line 10; not withholding" value={d.otherState.tax} onChange={(n) => put({ otherState: { ...d.otherState, tax: n } })} />
          {married && <Choice legend="Whose income was taxed there" value={d.otherState.owner} onChange={(o) => put({ otherState: { ...d.otherState, owner: o } })} options={owners.map((o) => ({ value: o, label: names[o] }))} />}
          <MoneyField label="Lump-sum distribution tax or low-income housing recapture" hint="Line 34; 10% of federal Form 4972 tax" value={d.otherTaxes} onChange={(n) => put({ otherTaxes: n })} />
        </div>
        <details open={d.moTc.length > 0}>
          <summary>Miscellaneous tax credits (Form MO-TC){mo.moTc.line13 > 0 ? ` — ${usd(mo.moTc.line13)}` : ''}</summary>
          <p className="why">For credits such as adoption (ATC), Champion for Children (CFC), food pantry (FPT), neighborhood assistance (NAC) and others listed on page 2 of Form MO-TC. They apply in the order entered and cannot be more than the tax they are claimed against, unless the credit is refundable.</p>
          {d.moTc.map((c, i) => {
            const set1 = (p: Partial<MoTcCredit>): void => put({ moTc: d.moTc.map((y, j) => (j === i ? { ...y, ...p } : y)) })
            return (
              <fieldset key={i} className="statement">
                <legend>{c.name.trim() || c.code.trim().toUpperCase() || `Credit ${i + 1}`}</legend>
                <div className="grid">
                  <TextField label="Alpha code" hint="3 letters, from page 2 of MO-TC" autoComplete="off" value={c.code} onChange={(s) => set1({ code: s.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() })} />
                  <TextField label="Credit name" autoComplete="off" value={c.name} onChange={(s) => set1({ name: s })} />
                  <TextField label="Benefit number" hint="Last 6 digits on the certificate, if any" autoComplete="off" value={c.benefit} onChange={(s) => set1({ benefit: s })} />
                  <MoneyField label="Amount" value={c.amount} onChange={(n) => set1({ amount: n })} />
                  {mo.two && <Choice legend="Whose credit" value={c.owner} onChange={(o) => set1({ owner: o })} options={owners.map((o) => ({ value: o, label: names[o] }))} />}
                  <Check label="Refundable credit" hint="Only if the credit itself is refundable" checked={c.refundable} onChange={(on) => set1({ refundable: on })} />
                </div>
                <div className="actions"><button type="button" className="button" onClick={() => put({ moTc: d.moTc.filter((_, j) => j !== i) })}>Remove this credit</button></div>
              </fieldset>
            )
          })}
          {d.moTc.length < 10 && <div className="actions"><button type="button" className="button" onClick={() => put({ moTc: [...d.moTc, { owner: 'taxpayer', benefit: '', code: '', name: '', amount: 0, refundable: false }] })}>Add an MO-TC credit</button></div>}
        </details>
      </Section>

      <Section title="Property tax credit (MO-PTS)" intro="For people 65 or older, 100% disabled, or 60 or older receiving surviving spouse benefits, with net household income up to $27,200 (renters) or $30,000 (owners).">
        <div className="grid">
          <Check label="Claim the property tax credit" checked={d.pts.claim} onChange={(v) => putP({ claim: v })} />
          {d.pts.claim && <Check label="You owned and lived in your home all year" hint="Otherwise you rented" checked={d.pts.owner} onChange={(v) => putP({ owner: v })} />}
        </div>
        {d.pts.claim && (
          <>
            <Choice legend="Qualification" value={d.pts.qualification} onChange={(qualification) => putP({ qualification })} options={QUALIFICATIONS} />
            <div className="grid">
              {d.pts.owner
                ? <MoneyField label="2025 real estate tax paid on your home" hint="Line 11; without special assessments, up to $1,100" value={d.pts.propertyTax} onChange={(n) => putP({ propertyTax: n })} />
                : <MoneyField label="Gross rent paid in 2025" hint="MO-CRP line 6; Form 5674" value={d.pts.rent} onChange={(n) => putP({ rent: n })} />}
              <MoneyField label="Other nontaxable pensions, rents, interest" hint="Line 3, beyond what’s worked out" value={d.pts.otherIncome} onChange={(n) => putP({ otherIncome: n })} />
              <MoneyField label="Social Security equivalent railroad benefits" hint="Line 2; RRB-1099 Tier I" value={d.pts.nontaxableRrb} onChange={(n) => putP({ nontaxableRrb: n })} />
              <MoneyField label="Veterans payments and benefits" hint="Line 5" value={d.pts.veteransBenefits} onChange={(n) => putP({ veteransBenefits: n })} />
              <MoneyField label="Public assistance, SSI, child support, TANF" hint="Line 6" value={d.pts.publicAssistance} onChange={(n) => putP({ publicAssistance: n })} />
            </div>
            {!d.pts.owner && (
              <>
                <Choice legend="Type of rental (MO-CRP line 7)" value={String(d.pts.rentPercent)} onChange={(v) => putP({ rentPercent: Number(v) })} options={RENT_TYPES} />
                <div className="grid">
                  <TextField label="Rental address" autoComplete="off" value={d.pts.rentalAddress} onChange={(s) => putP({ rentalAddress: s })} />
                  <TextField label="Apartment" autoComplete="off" value={d.pts.rentalApt} onChange={(s) => putP({ rentalApt: s })} />
                  <TextField label="City" autoComplete="off" value={d.pts.rentalCity} onChange={(s) => putP({ rentalCity: s })} />
                  <TextField label="ZIP code" autoComplete="off" value={d.pts.rentalZip} onChange={(s) => putP({ rentalZip: s })} />
                  <TextField label="Landlord’s name" autoComplete="off" value={d.pts.landlordName} onChange={(s) => putP({ landlordName: s })} />
                  <TextField label="Landlord’s street address" autoComplete="off" value={d.pts.landlordAddress} onChange={(s) => putP({ landlordAddress: s })} />
                  <TextField label="Landlord’s city" autoComplete="off" value={d.pts.landlordCity} onChange={(s) => putP({ landlordCity: s })} />
                  <TextField label="Landlord’s state" autoComplete="off" value={d.pts.landlordState} onChange={(s) => putP({ landlordState: s.toUpperCase().slice(0, 2) })} />
                  <TextField label="Landlord’s ZIP code" autoComplete="off" value={d.pts.landlordZip} onChange={(s) => putP({ landlordZip: s })} />
                  <TextField label="Landlord’s phone" autoComplete="off" value={d.pts.landlordPhone} onChange={(s) => putP({ landlordPhone: s })} />
                </div>
              </>
            )}
            {mo.pts && <p className="why">Net household income {usd(mo.pts['10'])}; credit {usd(mo.pts['14'])}.</p>}
          </>
        )}
      </Section>

      <Section title="Trust fund donations" intro="Line 51: taken from your refund.">
        <div className="grid">
          {MO_TRUST_FUNDS.map(([k, label]) => <MoneyField key={k} label={label} hint={`Line 51${k}`} value={d.trustFunds[k] ?? 0} onChange={(n) => put({ trustFunds: { ...d.trustFunds, [k]: n } })} />)}
        </div>
      </Section>

      <Section title="Underpayment of estimated tax (Form MO-2210)" intro="If your withholding and estimated payments fell short, Missouri charges a penalty. The short method applies when withholding and estimated payments were made equally through the year.">
        <Check label="Figure the underpayment penalty" checked={d.mo2210.priorTax !== null} onChange={(on) => put({ mo2210: { ...d.mo2210, priorTax: on ? 0 : null } })} />
        {d.mo2210.priorTax !== null && (
          <>
            <div className="grid">
              <MoneyField label="Tax shown on your 2024 Missouri return" hint="Line 5; 0 if you did not file one" value={d.mo2210.priorTax} onChange={(n) => put({ mo2210: { ...d.mo2210, priorTax: n } })} />
              <MoneyField label="Days before April 15, 2026 the shortfall was paid" hint="Line 12; 0 if paid with the return" value={d.mo2210.earlyDays} onChange={(n) => put({ mo2210: { ...d.mo2210, earlyDays: n } })} />
            </div>
            <Check label="Withholding and estimated payments were made equally through the year" hint="Short method (Part II); otherwise the regular method (Part III)" checked={d.mo2210.equalOnTime} onChange={(on) => put({ mo2210: { ...d.mo2210, equalOnTime: on } })} />
            <Check label="I am a qualified farmer" hint="66⅔% instead of 90% on line 2" checked={d.mo2210.farmer} onChange={(on) => put({ mo2210: { ...d.mo2210, farmer: on } })} />
            {!d.mo2210.equalOnTime && (
              <div className="grid">
                <TextField label="Date the rest of the tax was paid" hint="MM/DD/YYYY; blank means April 15, 2026 (line 26)" autoComplete="off" value={d.mo2210.paidDate} onChange={(s) => put({ mo2210: { ...d.mo2210, paidDate: s } })} />
                {(['By April 15, 2025', 'By June 15, 2025', 'By Sept. 15, 2025', 'By Jan. 15, 2026'] as const).map((label, i) => (
                  <MoneyField key={label} label={`Estimated tax paid ${label.toLowerCase()}`} hint="Line 16; withholding is spread evenly" value={d.mo2210.quarterly?.[i] ?? 0} onChange={(n) => { const q = [...(d.mo2210.quarterly ?? [0, 0, 0, 0])] as [number, number, number, number]; q[i] = n; put({ mo2210: { ...d.mo2210, quarterly: q } }) }} />
                ))}
              </div>
            )}
            {mo.m2210 && <p className="why">{(mo.m2210['regular'] ? mo.m2210['29'] : mo.m2210['13'])
              ? `Required annual payment ${usd(mo.m2210['6'])}; penalty (line 55): ${usd(mo.m2210['regular'] ? mo.m2210['29'] : mo.m2210['13'])}${mo.m2210['regular'] ? ' by the regular method (Part III)' : ''}.`
              : 'No underpayment penalty (see Things to look at).'}</p>}
          </>
        )}
      </Section>

      {mo.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">{mo.issues.map((t) => <li key={t} className="issue is-warning"><span className="issue-kind">Check</span><span>{t}</span></li>)}</ul>
        </Section>
      )}

      <Section title="Form MO-1040" intro={mo.two ? 'Combined return: column Y is you, column S your spouse. Whole dollars.' : 'Whole dollars.'}>
        <table className="lines">
          {mo.two && <thead><tr><th scope="col">Line</th><th scope="col">{names.taxpayer}</th><th scope="col">{names.spouse}</th></tr></thead>}
          <tbody>
            {LINES.filter(([k, , per]) => show(k, per)).map(([k, label, per]) => (
              <tr key={k} className={KEY.has(k) ? 'is-key' : ''}>
                <th scope="row"><span className="line-no">{k}</span>{label}</th>
                {per
                  ? <>{k === '7' ? <td>{value(k, 'Y')}%</td> : <td>{usd(value(k, 'Y'))}</td>}{mo.two && (k === '7' ? <td>{value(k, 'S')}%</td> : <td>{usd(value(k, 'S'))}</td>)}</>
                  : <><td>{usd(L[k] ?? 0)}</td>{mo.two && <td />}</>}
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Missouri forms" intro="Filled in on this device from the official Missouri Department of Revenue forms.">
        <ul className="form-list">{packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Include these yourself.</strong><ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul></div>
        )}
        <div className="actions"><button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download Missouri forms (PDF)'}</button></div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <p className="why">Sign page 5{married ? ' (both spouses)' : ''}. With a payment, mail to Missouri Department of Revenue, PO Box 3370, Jefferson City MO 65105-3370; with a refund or nothing due, PO Box 3222, Jefferson City MO 65105-3222{mo.pts ? '; with a property tax credit, PO Box 2800, Jefferson City MO 65105-2800' : ''}. Due April 15, 2026.</p>
      </Section>
    </div>
  )
}
