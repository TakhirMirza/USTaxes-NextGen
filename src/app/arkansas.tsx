/**
 * The Arkansas part of the State step: Form AR1000F for full-year residents, with AR1000ADJ, AR3, AR1000D, AR2441 and AR1000TC.
 */
import { ReactElement, useMemo, useState } from 'react'
import type { ArAdjInput, ArCreditsInput, ArInput, ArItemizedInput, ArRetirementKind, Owner, Person } from '../engine/model.ts'
import { computeArkansas } from '../engine/ar2025.ts'
import { buildArPacket } from '../pdf/ar2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { Choice, MoneyField, NumberField, Section, TextField, usd } from './fields'
import { StatementRows } from './statements'
import type { StepProps } from './steps'

const ADJ: [keyof ArAdjInput, string, string][] = [
  ['borderCity', 'Texarkana border city exemption', 'Line 1'], ['tuitionSavings', 'Tuition savings program contributions', 'Line 2'],
  ['msa', 'Payments to an Archer MSA', 'Line 4'], ['trust', 'Contributions to an intergenerational trust', 'Line 7'],
  ['moving', 'Moving expenses', 'Line 8; Form AR3903'], ['keogh', 'Keogh, SEP and SIMPLE plan contributions', 'Line 10'],
  ['forfeitedInterest', 'Penalty on early withdrawal of savings', 'Line 11'], ['alimony', 'Alimony or separate maintenance paid', 'Line 12'],
  ['disability', 'Support for individuals with permanent disabilities', 'Line 13; Form AR1000DC'], ['organDonor', 'Organ donor deduction', 'Line 14; Form AR1000OD'],
  ['militaryReserve', 'Military reserve expenses', 'Line 15'], ['reforestation', 'Reforestation deduction', 'Line 16'],
  ['teacher', 'Teachers’ classroom investment expense', 'Line 17; Form AR1000CE'], ['able', 'ABLE account contributions', 'Line 18']
]
const AR3: [keyof ArItemizedInput, string, string][] = [
  ['otherTaxes', 'Other deductible taxes (city income, foreign)', 'Line 6, with personal property tax'], ['individualMortgage', 'Mortgage interest paid to an individual', 'Line 9'],
  ['points', 'Deductible points not on a 1098', 'Line 10'], ['investmentInterest', 'Investment interest', 'Line 11; Form 4952'],
  ['artContributions', 'Art and literary contributions', 'Line 14'], ['charityCarryover', 'Contribution carryover from prior years', 'Line 16'],
  ['casualty', 'Casualty and theft losses', 'Line 18; Form AR4684'], ['tuition', 'Post-secondary tuition deduction', 'Line 19; Form AR1075'],
  ['employeeExpenses', 'Unreimbursed employee business expenses', 'Line 20; Form AR2106'], ['otherExpenses', 'Other 2% expenses', 'Line 21'],
  ['firefighter', 'Volunteer firefighter expenses', 'Line 26; up to $1,000 each'], ['gambling', 'Gambling losses', 'Line 27; up to winnings']
]
const LINES: [line: string, label: string][] = [
  ['8', 'Wages'], ['10', 'Interest'], ['11', 'Dividends'], ['13', 'Business income'], ['14', 'Capital gains (50% of net gain exempt)'], ['15', 'Other gains'],
  ['16', 'Nonqualified and early distributions'], ['18A', 'Your pension / IRA after the $6,000 exemption'], ['18B', 'Spouse’s pension / IRA after the $6,000 exemption'],
  ['19', 'Rents, partnerships, trusts'], ['21', 'Unemployment'], ['22', 'Other income'], ['23', 'Total income'], ['24', 'Adjustments'], ['25', 'Adjusted gross income'],
  ['27', 'Standard or itemized deduction'], ['28', 'Net taxable income'], ['29', 'Tax'], ['32', 'Additional tax on early distributions'], ['34', 'Personal tax credits'],
  ['35', 'Child care credit (20% of federal)'], ['36', 'Other credits'], ['38', 'Net tax'], ['39A', 'Withheld on W-2s'], ['39B', 'Withheld on 1099s'],
  ['40', 'Estimated tax'], ['41', 'Paid with extension'], ['44', 'Total payments'], ['48', 'Applied to 2026'], ['49', 'Check-off contributions'], ['50', 'Refund'], ['51', 'Amount due']
]
const ALWAYS = new Set(['23', '25', '28', '29', '38', '44'])
const KEY = new Set(['38', '50', '51'])
const KINDS: [ArRetirementKind, string][] = [['standard', 'Employer pension or qualified IRA'], ['military', 'U.S. military retirement (exempt)'], ['nonqualified', 'Nonqualified plan or annuity']]
const TABLE = { low: 'low income tax table', standard: 'standard deduction and regular tax table', itemized: 'itemized deductions and regular tax table' }
const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback

export function ArkansasStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const d = ret.ar
  const ar = useMemo(() => computeArkansas(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<ArInput>): void => set((r) => ({ ...r, ar: { ...r.ar, ...p } }))
  const putAdj = (p: Partial<ArAdjInput>): void => put({ adj: { ...d.adj, ...p } })
  const putAr3 = (p: Partial<ArItemizedInput>): void => put({ ar3: { ...d.ar3, ...p } })
  const putTc = (p: Partial<ArCreditsInput>): void => put({ tc: { ...d.tc, ...p } })
  const married = ret.filingStatus === 'mfj'
  const owners: Owner[] = married ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const packet = buildArPacket(ret, result, ar, preparer)
  const L = ar.lines
  const owes = L['51'] > 0
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  const r1099 = ret.retirement.filter((x) => owners.includes(x.owner))
  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadArkansasForms }) => downloadArkansasForms(ret, result, ar, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }
  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'Arkansas: you owe' : 'Arkansas refund'}</p>
          <p className="va-result-amount">{usd(owes ? L['51'] : L['50'])}</p>
        </div>
        <dl>
          <div><dt>Net taxable income</dt><dd>{usd(L['28'])}</dd></div>
          <div><dt>Net tax</dt><dd>{usd(L['38'])}</dd></div>
          <div><dt>Personal credits</dt><dd>{usd(L['34'])}</dd></div>
        </dl>
      </div>

      <Section title="Arkansas return" intro={`Arkansas builds income line by line from your federal return. Social Security and U.S. military pay and retirement are exempt, half of a net capital gain is exempt, and each person’s employer pension or IRA gets a $6,000 exemption. This return uses the ${TABLE[ar.table]}.`}>
        <div className="grid">
          {owners.map((o) => (
            <MoneyField key={`m-${o}`} label={`${names[o]}: U.S. military pay in W-2 wages`} hint="Line 9; exempt" value={d.militaryPay[o]} onChange={(n) => put({ militaryPay: { ...d.militaryPay, [o]: n } })} />
          ))}
        </div>
        {owners.map((o) => (
          <label key={`d-${o}`} className="check"><input type="checkbox" checked={d.deaf[o]} onChange={(e) => put({ deaf: { ...d.deaf, [o]: e.target.checked } })} /> {names[o]} was deaf on Dec. 31, 2025 ($29 credit)</label>
        ))}
      </Section>

      <Section title="Arkansas withholding and payments" intro="From the state section of each W-2 (boxes 15–17).">
        {w2s.length > 0
          ? <StatementRows kind="w2" state="Arkansas" items={w2s.map((w) => ({ id: w.id, title: `${w.employer.trim() || 'W-2'} (${names[w.owner]})`, federal: w.wages }))} value={d.w2} onChange={(w2) => put({ w2 })} />
          : <p className="why">No W-2s entered.</p>}
        <div className="grid">
          <MoneyField label="Arkansas tax withheld on 1099s and AR-K1s" hint="Line 39B" value={d.withholding1099} onChange={(n) => put({ withholding1099: n })} />
          <MoneyField label="2025 estimated tax paid" value={d.estimatedPayments} onChange={(n) => put({ estimatedPayments: n })} />
          <MoneyField label="Paid with extension" value={d.extensionPayment} onChange={(n) => put({ extensionPayment: n })} />
          {L['47'] > 0 && <MoneyField label="Apply to 2026 estimated tax" value={d.creditForward} onChange={(n) => put({ creditForward: n })} />}
          {L['47'] > 0 && <MoneyField label="Check-off contributions" hint="Line 49; attach AR1000CO" value={d.checkoff} onChange={(n) => put({ checkoff: n })} />}
        </div>
      </Section>

      {r1099.length > 0 && (
        <Section title="Retirement income (lines 16–18)" intro="Military retirement is exempt. Employer pensions and qualified IRAs (after 59½, or on death or disability) get a $6,000 exemption per person; early distributions do not.">
          <div className="grid">
            {r1099.map((x) => (
              <div key={x.id} className="field">
                <label htmlFor={`ar-kind-${x.id}`}><span>{x.payer.trim() || '1099-R'} ({names[x.owner]}): {usd(x.taxableAmount)}</span></label>
                <select id={`ar-kind-${x.id}`} className="select" value={d.retirementKind[x.id] ?? 'standard'} onChange={(e) => put({ retirementKind: { ...d.retirementKind, [x.id]: e.target.value as ArRetirementKind } })}>
                  {KINDS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Other income">
        <div className="grid">
          <MoneyField label="Interest on U.S. government obligations" hint="Exempt; taken out of line 10" value={d.usObligationInterest} onChange={(n) => put({ usObligationInterest: n })} />
          <MoneyField label="Other income or depreciation differences" hint="Line 22, Form AR-OI" allowNegative value={d.otherIncome} onChange={(n) => put({ otherIncome: n })} />
        </div>
        <details open={ar.d !== null && (d.capitalAdjust.long !== 0 || d.capitalAdjust.shortLoss !== 0 || d.capitalAdjust.shortGain !== 0)}>
          <summary>AR1000D capital gain adjustments{ar.d ? ` — line 12: ${usd(ar.d['12'])}` : ''}</summary>
          <p className="why">Only for depreciation differences (Arkansas did not adopt federal bonus depreciation) and pass-through entity tax gains or losses. Half of the net long-term gain is taxed, and gains over $10,000,000 are exempt.</p>
          <div className="grid">
            <MoneyField label="Long-term adjustment" hint="AR1000D line 2" allowNegative value={d.capitalAdjust.long} onChange={(n) => put({ capitalAdjust: { ...d.capitalAdjust, long: n } })} />
            <MoneyField label="Short-term loss adjustment" hint="Line 5" allowNegative value={d.capitalAdjust.shortLoss} onChange={(n) => put({ capitalAdjust: { ...d.capitalAdjust, shortLoss: n } })} />
            <MoneyField label="Short-term gain adjustment" hint="Line 10" allowNegative value={d.capitalAdjust.shortGain} onChange={(n) => put({ capitalAdjust: { ...d.capitalAdjust, shortGain: n } })} />
          </div>
        </details>
      </Section>

      <Section title="Adjustments (AR1000ADJ)" intro={`IRA, HSA and student loan interest come from your federal return; self-employed health insurance is limited to your net business profit. Arkansas has no deduction for half of self-employment tax or the federal educator expense deduction. Total: ${usd(ar.adj['19'])}.`}>
        <div className="grid">
          {ADJ.map(([k, label, hint]) => <MoneyField key={k} label={label} hint={hint} value={d.adj[k] as number} onChange={(n) => putAdj({ [k]: n })} />)}
          {d.adj.alimony > 0 && <>
            <TextField label="Alimony paid to: name" autoComplete="off" value={d.adj.alimonyName} onChange={(s) => putAdj({ alimonyName: s })} />
            <TextField label="Recipient’s SSN" autoComplete="off" value={d.adj.alimonySsn} onChange={(s) => putAdj({ alimonySsn: s.replace(/[^\d-]/g, '').slice(0, 11) })} />
          </>}
        </div>
      </Section>

      <Section title="Itemized deductions (AR3)" intro={`Arkansas lets you itemize even if you took the federal standard deduction. Medical, real estate and personal property taxes, mortgage interest and gifts come from your federal entries; Arkansas income tax is not deductible, medical expenses count above 10% of AGI, and miscellaneous expenses above 2%. AR3 total: ${usd(ar.ar3['30'])}${ar.table === 'itemized' ? ' — used on line 27.' : ' — the standard deduction is larger.'}`}>
        <div className="grid">
          {AR3.map(([k, label, hint]) => <MoneyField key={k} label={label} hint={hint} value={d.ar3[k] as number} onChange={(n) => putAr3({ [k]: n })} />)}
          {d.ar3.otherTaxes > 0 && <TextField label="Other taxes: type" autoComplete="off" value={d.ar3.otherTaxesType} onChange={(s) => putAr3({ otherTaxesType: s })} />}
          {d.ar3.individualMortgage > 0 && <>
            <TextField label="Mortgage holder’s name" autoComplete="off" value={d.ar3.individualName} onChange={(s) => putAr3({ individualName: s })} />
            <TextField label="Mortgage holder’s address" autoComplete="off" value={d.ar3.individualAddress} onChange={(s) => putAr3({ individualAddress: s })} />
          </>}
          {d.ar3.charityCarryover > 0 && <TextField label="Carryover contributions: type" autoComplete="off" value={d.ar3.charityCarryoverType} onChange={(s) => putAr3({ charityCarryoverType: s })} />}
          {d.ar3.otherExpenses > 0 && <TextField label="Other expenses: type" hint="Line 21, e.g. union dues, tax preparation" autoComplete="off" value={d.ar3.otherExpensesType} onChange={(s) => putAr3({ otherExpensesType: s })} />}
          {ret.itemized.other > 0 && <TextField label="Other miscellaneous deductions: type" hint={`Line 28; ${usd(ret.itemized.other)} from your federal entries`} autoComplete="off" value={d.ar3.otherDeductionsType} onChange={(s) => putAr3({ otherDeductionsType: s })} />}
        </div>
      </Section>

      <Section title="Credits (AR1000TC)" intro={`Child care credit (AR2441): 20% of your federal credit before the tax limit, ${usd(L['35'])}. Additional tax credit for qualified individuals: ${usd(ar.tc['6'])}, worked out. Total AR1000TC credits: ${usd(ar.tc['9'])}.`}>
        <div className="grid">
          <MoneyField label="State political contributions" hint={`Line 1; credit up to $${married ? 100 : 50}; made by April 15, 2026`} value={d.tc.political} onChange={(n) => putTc({ political: n })} />
          <MoneyField label="Other state tax credit" hint="Line 2; attach the other state’s return" value={d.tc.otherState} onChange={(n) => putTc({ otherState: n })} />
          <MoneyField label="Federal adoption credit allowed" hint="Form 8839; line 3 is 20% of it" value={d.tc.adoption} onChange={(n) => putTc({ adoption: n })} />
          <MoneyField label="Phenylketonuria disorder credit" hint="Line 4; from Form AR1113" value={d.tc.pku} onChange={(n) => putTc({ pku: n })} />
          <NumberField label="Stillborn children (Paisley’s Law)" hint="Line 5; $500 each" max={10} value={d.tc.stillborn} onChange={(n) => putTc({ stillborn: n })} />
        </div>
        <fieldset className="statement">
          <legend>Individuals with developmental disabilities (line 7; $500 each, Form AR1000-DD)</legend>
          {d.tc.developmental.map((x, i) => (
            <div key={i} className="grid">
              <TextField label="Name on Form AR1000-DD" autoComplete="off" value={x.name} onChange={(s) => putTc({ developmental: d.tc.developmental.map((y, j) => (j === i ? { ...y, name: s } : y)) })} />
              <TextField label="Social Security number" autoComplete="off" value={x.ssn} onChange={(s) => putTc({ developmental: d.tc.developmental.map((y, j) => (j === i ? { ...y, ssn: s.replace(/[^\d-]/g, '').slice(0, 11) } : y)) })} />
              <div className="actions"><button type="button" className="button is-quiet" onClick={() => putTc({ developmental: d.tc.developmental.filter((_, j) => j !== i) })}>Remove</button></div>
            </div>
          ))}
          {d.tc.developmental.length < 6 && <div className="actions"><button type="button" className="button is-quiet" onClick={() => putTc({ developmental: [...d.tc.developmental, { name: '', ssn: '' }] })}>Add an individual</button></div>}
        </fieldset>
        <fieldset className="statement">
          <legend>Business incentive credits (line 8; attach each certificate)</legend>
          {d.tc.business.map((b, i) => {
            const set1 = (p: Partial<ArCreditsInput['business'][number]>): void => putTc({ business: d.tc.business.map((y, j) => (j === i ? { ...y, ...p } : y)) })
            return (
              <div key={i} className="grid">
                {married && <Choice legend="Whose credit" value={b.owner} onChange={(o) => set1({ owner: o })} options={owners.map((o) => ({ value: o, label: names[o] }))} />}
                <TextField label="Credit type code" hint="4 digits, from the AR1000TC instructions" autoComplete="off" value={b.code} onChange={(s) => set1({ code: s.replace(/\D/g, '').slice(0, 4) })} />
                <TextField label="FEIN on the certificate" hint="Leave blank if issued to you" autoComplete="off" value={b.fein} onChange={(s) => set1({ fein: s.replace(/[^\d-]/g, '').slice(0, 10) })} />
                <MoneyField label="Amount" value={b.amount} onChange={(n) => set1({ amount: n })} />
                <div className="actions"><button type="button" className="button is-quiet" onClick={() => putTc({ business: d.tc.business.filter((_, j) => j !== i) })}>Remove</button></div>
              </div>
            )
          })}
          <div className="actions"><button type="button" className="button is-quiet" onClick={() => putTc({ business: [...d.tc.business, { owner: 'taxpayer', code: '', fein: '', amount: 0 }] })}>Add a business incentive credit</button></div>
        </fieldset>
      </Section>

      {ar.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">{ar.issues.map((t) => <li key={t} className="issue is-warning"><span className="issue-kind">Check</span><span>{t}</span></li>)}</ul>
        </Section>
      )}

      <Section title="Form AR1000F" intro="Whole dollars.">
        <table className="lines"><tbody>
          {LINES.filter(([k]) => ALWAYS.has(k) || (L[k] ?? 0) !== 0).map(([k, label]) => (
            <tr key={k} className={KEY.has(k) ? 'is-key' : ''}><th scope="row"><span className="line-no">{k}</span>{label}</th><td>{usd(L[k] ?? 0)}</td></tr>
          ))}
        </tbody></table>
      </Section>

      <Section title="Arkansas forms" intro="Filled in on this device from the official Arkansas DFA forms.">
        <ul className="form-list">{packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Finish or attach these yourself.</strong><ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul></div>
        )}
        <div className="actions"><button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download Arkansas forms (PDF)'}</button></div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <p className="why">Sign page 3. Refunds: Arkansas State Income Tax, PO Box 1000, Little Rock AR 72203-1000. Tax due or no tax: PO Box 2144, Little Rock AR 72203-2144. Due April 15, 2026.</p>
      </Section>
    </div>
  )
}
