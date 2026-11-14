/**
 * The Virginia step: Form 760 for full-year residents, built on the federal return.
 * Only what Virginia needs beyond the federal return is asked here.
 */
import { ReactElement, useMemo, useState } from 'react'
import type { Owner, Person, VaAdjEntry, VirginiaInput } from '../engine/model.ts'
import { emptyVaEntry, emptyVaSavers } from '../engine/model.ts'
import { VA_ADDITION_CODES, VA_DEDUCTION_CODES, VA_SUBTRACTION_CODES, computeVirginia } from '../engine/va2025.ts'
import type { VaResult } from '../engine/va2025.ts'
import { VA_LOCALITIES } from '../engine/vaLocalities.ts'
import { buildVirginiaPacket } from '../pdf/va2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { Check, DocList, MoneyField, Section, TextField, usd } from './fields'
import { SelectField } from './steps'
import type { StepProps } from './steps'

const LINES: [line: string, label: string][] = [
  ['1', 'Federal adjusted gross income'],
  ['2', 'Additions (Schedule ADJ)'],
  ['4', 'Age deduction'],
  ['5', 'Taxable Social Security'],
  ['6', 'State income tax refund'],
  ['7', 'Subtractions (Schedule ADJ)'],
  ['9', 'Virginia adjusted gross income'],
  ['10', 'Itemized deductions'],
  ['11', 'Standard deduction'],
  ['12', 'Exemptions'],
  ['13', 'Deductions (Schedule ADJ)'],
  ['15', 'Virginia taxable income'],
  ['16', 'Tax'],
  ['17', 'Spouse tax adjustment'],
  ['18', 'Net tax'],
  ['19a', 'Your Virginia withholding'],
  ['19b', 'Spouse’s Virginia withholding'],
  ['20', 'Estimated payments'],
  ['21', '2024 overpayment applied'],
  ['22', 'Extension payment'],
  ['23', 'Low-income or earned income credit'],
  ['24', 'Credit for tax paid to another state'],
  ['25', 'Schedule CR credits'],
  ['26', 'Total payments and credits'],
  ['29', 'Credited to 2026'],
  ['30', 'Commonwealth Savers contributions (VAC)'],
  ['31', 'Other contributions (VAC)'],
  ['32', 'Addition to tax, penalty, interest'],
  ['33', 'Consumer’s use tax'],
  ['35', 'Amount you owe'],
  ['36', 'Refund']
]
const SCH_A: [line: string, label: string, always?: boolean][] = [
  ['4', 'Medical and dental over 10% of AGI'],
  ['7', 'Taxes: income or sales, property'],
  ['10', 'Mortgage interest'],
  ['14', 'Gifts to charity'],
  ['16c', 'Other itemized deductions'],
  ['17', 'Total itemized deductions', true],
  ['18', 'Less state and local income tax', true],
  ['19', 'Virginia itemized deductions', true]
]
const PERIODS = ['By May 1, 2025', 'By June 15, 2025', 'By Sept. 15, 2025', 'By Jan. 15, 2026']
const ALWAYS = new Set(['1', '9', '15', '16', '18', '26'])
const KEY = new Set(['9', '15', '18', '35', '36'])

const codeOptions = (table: Record<string, string>): { value: string; label: string }[] =>
  [{ value: '', label: 'Choose a code' }, ...Object.entries(table).map(([code, label]) => ({ value: code, label: `${code} · ${label}` }))]

const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback

function Entries({ title, entries, table, owners, names, addLabel, emptyText, onChange, autoNote }: {
  title: string; entries: VaAdjEntry[]; table: Record<string, string>; owners: Owner[]; names: Record<Owner, string>
  addLabel: string; emptyText: string; onChange: (e: VaAdjEntry[]) => void; autoNote?: string
}): ReactElement {
  const patch = (id: string, p: Partial<VaAdjEntry>): void => onChange(entries.map((x) => (x.id === id ? { ...x, ...p } : x)))
  return (
    <div className="va-entries">
      <h3>{title}</h3>
      {autoNote && <p className="why">{autoNote}</p>}
      <DocList items={entries} addLabel={addLabel} emptyText={emptyText}
        title={(x, i) => (x.code ? `${x.code} · ${table[x.code] ?? 'Other code'}` : `Line ${i + 1}`)}
        onAdd={() => onChange([...entries, emptyVaEntry()])}
        onRemove={(id) => onChange(entries.filter((x) => x.id !== id))}
        render={(x) => (
          <>
            <SelectField label="Code" value={x.code in table ? x.code : ''} onChange={(v) => patch(x.id, { code: v })} options={codeOptions(table)} />
            <MoneyField label="Amount" value={x.amount} onChange={(n) => patch(x.id, { amount: n })} />
            {owners.length > 1 && (
              <SelectField label="Whose" value={x.owner} onChange={(v) => patch(x.id, { owner: v as Owner })}
                options={owners.map((o) => ({ value: o, label: names[o] }))} />
            )}
          </>
        )} />
    </div>
  )
}

function Lines({ va }: { va: VaResult }): ReactElement {
  const L = va.lines
  return (
    <table className="lines">
      <tbody>
        {LINES.filter(([k]) => ALWAYS.has(k) || L[k] !== 0).map(([k, label]) => (
          <tr key={k} className={KEY.has(k) ? 'is-key' : ''}>
            <th scope="row"><span className="line-no">{k}</span>{label}</th>
            <td>{usd(L[k])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function VirginiaStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const v = ret.virginia
  const va = useMemo(() => computeVirginia(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<VirginiaInput>): void => set((r) => ({ ...r, virginia: { ...r.virginia, ...p } }))
  const per = <K extends 'birthDate' | 'withholding' | 'disability'>(key: K, o: Owner, value: VirginiaInput[K][Owner]): void =>
    set((r) => ({ ...r, virginia: { ...r.virginia, [key]: { ...r.virginia[key], [o]: value } } }))
  const joint = ret.filingStatus === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const locality = VA_LOCALITIES.find(([code]) => code === v.localityCode)
  const packet = v.enabled ? buildVirginiaPacket(ret, result, va, preparer) : null

  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadVirginiaForms }) => downloadVirginiaForms(ret, result, va, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }

  if (!v.enabled) {
    return (
      <Section title="Virginia return" intro="Form 760, for people who lived in Virginia all of 2025. It starts from your federal return, so finish the federal steps first.">
        <Check label="Prepare my Virginia resident return (Form 760)" checked={false} onChange={(on) => put({ enabled: on })}
          hint="Part-year residents and nonresidents file Form 760PY or 763, which this app does not prepare yet." />
      </Section>
    )
  }

  const owes = va.lines['35'] > 0
  const savers = v.savers
  const setSavers = (s: VirginiaInput['savers']): void => put({ savers: s })
  const autoSubs = va.adj.subtractions.filter((s) => s.auto)
  const autoDed = va.adj.deductions.filter((s) => s.auto)

  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'Virginia: you owe' : 'Virginia refund'}</p>
          <p className="va-result-amount">{usd(owes ? va.lines['35'] : va.lines['36'])}</p>
        </div>
        <dl>
          <div><dt>Virginia AGI</dt><dd>{usd(va.lines['9'])}</dd></div>
          <div><dt>Taxable income</dt><dd>{usd(va.lines['15'])}</dd></div>
          <div><dt>Tax after adjustment</dt><dd>{usd(va.lines['18'])}</dd></div>
        </dl>
      </div>

      <Section title="Virginia return" aside={<button type="button" className="link-button is-danger" onClick={() => put({ enabled: false })}>Don’t prepare</button>}
        intro={`Filing status ${va.status} (${va.status === 1 ? 'single' : va.status === 2 ? 'married filing jointly' : 'married filing separately'})${va.hoh ? ', federal head of household' : ''}, taken from your federal return.`}>
        <div className="grid">
          <SelectField label="City or county on January 1, 2026" value={v.localityCode}
            onChange={(code) => put({ localityCode: code })}
            options={[{ value: '', label: 'Choose your locality' }, ...VA_LOCALITIES.map(([code, name]) => ({ value: code, label: `${name} (${code})` }))]} />
          {owners.map((o) => (
            <TextField key={o} label={o === 'taxpayer' ? `${names.taxpayer}’s birth date` : `${names.spouse}’s birth date`} placeholder="MM/DD/YYYY" autoComplete="off"
              hint={o === 'taxpayer' ? 'Printed on Form 760; sets the age deduction' : undefined}
              value={v.birthDate[o]} onChange={(s) => per('birthDate', o, /^\d{8}$/.test(s.trim()) ? `${s.trim().slice(0, 2)}/${s.trim().slice(2, 4)}/${s.trim().slice(4)}` : s)} />
          ))}
        </div>
      </Section>

      <Section title="Virginia tax withheld and paid" intro="Virginia tax shows in W-2 box 17 (state VA), 1099-R box 14, 1099-G box 11 and on Form VK-1.">
        <div className="grid">
          {owners.map((o) => (
            <MoneyField key={o} label={owners.length > 1 ? `${names[o]}’s Virginia withholding` : 'Virginia income tax withheld'} value={v.withholding[o]} onChange={(n) => per('withholding', o, n)} />
          ))}
          <MoneyField label="2024 overpayment applied to 2025" value={v.priorOverpayment} onChange={(n) => put({ priorOverpayment: n })} />
          <MoneyField label="Paid with an extension" hint="Form 760IP" value={v.extensionPayments} onChange={(n) => put({ extensionPayments: n })} />
        </div>
        <h3 className="va-sub">2025 estimated payments (Form 760ES)</h3>
        <p className="why">By date paid: a payment made late belongs to the next date. The dates decide whether an addition to tax is due (Form 760C).</p>
        <div className="grid is-four">
          {PERIODS.map((label, i) => (
            <MoneyField key={label} label={label} value={v.estimatedByPeriod[i]}
              onChange={(n) => set((r) => {
                const q = [...r.virginia.estimatedByPeriod] as VirginiaInput['estimatedByPeriod']
                q[i] = n
                return { ...r, virginia: { ...r.virginia, estimatedByPeriod: q, estimatedPayments: q.reduce((a, b) => a + b, 0) } }
              })} />
          ))}
        </div>
      </Section>

      <Section title="Income Virginia treats differently" intro="Additions and subtractions on Schedule ADJ. Leave anything that does not apply blank.">
        <div className="grid">
          <MoneyField label="State income tax refund in your federal income" hint="Form 760 line 6 (Schedule 1 line 1)" value={v.stateRefundInFagi} onChange={(n) => put({ stateRefundInFagi: n })} />
          <MoneyField label="Interest on U.S. obligations" hint="Treasury bills, notes, bonds, savings bonds (1099-INT box 3)" value={v.usObligationInterest} onChange={(n) => put({ usObligationInterest: n })} />
          <MoneyField label="Other states’ municipal bond interest" hint="Tax-exempt federally, taxable in Virginia" value={v.otherStateBondInterest} onChange={(n) => put({ otherStateBondInterest: n })} />
          {owners.map((o) => (
            <MoneyField key={o} label={owners.length > 1 ? `${names[o]}’s disability income subtraction` : 'Disability income subtraction'}
              hint="Up to $20,000; takes the place of the age deduction" value={v.disability[o]} onChange={(n) => per('disability', o, n)} />
          ))}
          <MoneyField label="Other conformity additions" hint="Bonus depreciation on 2025 assets is added automatically" value={v.otherConformityAddition} onChange={(n) => put({ otherConformityAddition: n })} />
          <MoneyField label="Conformity subtractions" hint="Extra Virginia depreciation on assets that got bonus in earlier years" value={v.conformitySubtraction} onChange={(n) => put({ conformitySubtraction: n })} />
        </div>
        {(va.adj.bonusAddition > 0 || autoSubs.length > 0) && (
          <ul className="va-auto">
            {va.adj.bonusAddition > 0 && <li><span>Bonus depreciation added back (line 2a)</span><strong>{usd(va.adj.bonusAddition)}</strong></li>}
            {autoSubs.map((s) => <li key={s.code}><span>{s.code} · {s.label}, from your federal return</span><strong>{usd(s.amount)}</strong></li>)}
          </ul>
        )}
        <Entries title="Other additions" entries={v.additions} table={VA_ADDITION_CODES} owners={owners} names={names}
          addLabel="Add an addition" emptyText="None." onChange={(e) => put({ additions: e })} />
        <Entries title="Other subtractions" entries={v.subtractions} table={VA_SUBTRACTION_CODES} owners={owners} names={names}
          addLabel="Add a subtraction" emptyText="None. Common ones: military benefits (60), military basic pay (38), Virginia lottery prizes (24)." onChange={(e) => put({ subtractions: e })}
          autoNote={autoSubs.length ? 'Unemployment compensation is subtracted automatically.' : undefined} />
      </Section>

      <Section title="Deductions" intro={va.itemized.used ? 'You itemized on your federal return, so Virginia requires you to itemize too.' : `You took the federal standard deduction, so Virginia allows ${usd(va.lines['11'])}.`}>
        {va.itemized.used && (
          <>
            {!va.itemized.override && (
              <table className="lines va-sch-a">
                <tbody>
                  {SCH_A.filter(([k, , always]) => always || (va.itemized.lines[k] ?? 0) !== 0).map(([k, label]) => (
                    <tr key={k} className={k === '19' ? 'is-key' : ''}>
                      <th scope="row"><span className="line-no">{k}</span>{label}</th>
                      <td>{k === '18' ? `−${usd(va.itemized.lines[k])}` : usd(va.itemized.lines[k])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {va.itemized.limited && va.itemized.worksheet && (
              <p className="why">Reduced by {usd(va.itemized.worksheet['9'])}: 3% of income over {usd(va.itemized.worksheet['6'])}, at most 80% of the deductions that count. The income tax removed on line 18 is reduced in the same proportion ({(va.itemized.worksheet['11'] * 100).toFixed(1)}%).</p>
            )}
            {!va.itemized.override && (
              <Check label="The state and local tax on my Schedule A is sales tax, not income tax" checked={v.salesTaxElected}
                hint="Virginia removes state income tax (line 18) but allows sales tax, up to the SALT cap" onChange={(on) => put({ salesTaxElected: on })} />
            )}
            <Check label="Use my own Virginia Schedule A line 19 instead" checked={v.itemizedOverride !== null}
              hint="Only if your Schedule A has items this app does not track: investment interest, gambling or casualty losses, foreign tax, charity carryovers"
              onChange={(on) => put({ itemizedOverride: on ? va.itemized.amount : null })} />
            {v.itemizedOverride !== null && (
              <div className="grid" style={{ marginTop: 12 }}>
                <MoneyField label="Virginia Schedule A, line 19" value={v.itemizedOverride} onChange={(n) => put({ itemizedOverride: n })} />
              </div>
            )}
          </>
        )}
        <h3 className="va-sub">Commonwealth Savers (Virginia529) contributions</h3>
        <p className="why">Up to $4,000 per account each year; the rest carries forward. Owners 70 or older deduct everything they put in.</p>
        <DocList items={savers} addLabel="Add an account" emptyText="No contributions in 2025."
          title={(x, i) => x.account.trim() || `Account ${i + 1}`}
          onAdd={() => setSavers([...savers, emptyVaSavers()])}
          onRemove={(id) => setSavers(savers.filter((x) => x.id !== id))}
          render={(x) => {
            const patch = (p: Partial<typeof x>): void => setSavers(savers.map((s) => (s.id === x.id ? { ...s, ...p } : s)))
            return (
              <>
                <TextField label="Account (beneficiary or plan)" value={x.account} onChange={(s) => patch({ account: s })} />
                <MoneyField label="Contributed in 2025" value={x.contributed} onChange={(n) => patch({ contributed: n })} />
                <MoneyField label="Not yet deducted from earlier years" value={x.carryforward} onChange={(n) => patch({ carryforward: n })} />
                {owners.length > 1 && <SelectField label="Account owner" value={x.owner} onChange={(o) => patch({ owner: o as Owner })} options={owners.map((o) => ({ value: o, label: names[o] }))} />}
              </>
            )
          }} />
        {autoDed.length > 0 && (
          <ul className="va-auto">
            {autoDed.map((s) => <li key={s.code}><span>{s.code} · {s.label}</span><strong>{usd(s.amount)}</strong></li>)}
          </ul>
        )}
        <Entries title="Other Virginia deductions" entries={v.deductions.filter((e) => e.code !== '104')} table={VA_DEDUCTION_CODES} owners={owners} names={names}
          addLabel="Add a deduction" emptyText="None. Common ones: long-term care premiums (106), foster care (102), ABLEnow (115)."
          onChange={(e) => put({ deductions: e })}
          autoNote={autoDed.some((d) => d.code === '101') ? 'Child care expenses from your federal Form 2441 are deducted automatically (code 101).' : undefined} />
      </Section>

      <Section title="Credits">
        <dl className="facts">
          <div><dt>Age deduction</dt><dd>{usd(va.age.total)}</dd></div>
          <div><dt>Spouse tax adjustment</dt><dd>{usd(va.lines['17'])}</dd></div>
          <div><dt>Low-income / earned income credit</dt><dd>{usd(va.lines['23'])}</dd></div>
          <div><dt>Family VAGI vs poverty line</dt><dd>{usd(va.lowIncome.familyVagi)} / {usd(va.lowIncome.poverty)}</dd></div>
        </dl>
        <p className="why">
          {va.path === 'age' && va.age.total > 0 ? 'The age deduction is used; it rules out the low-income and Virginia earned income credits.' : null}
          {va.lowIncome.option === 'refundable' ? ' The refundable Virginia earned income credit (20% of your federal EIC) is used.' : null}
          {va.lowIncome.option === 'nonrefundable' ? ' The credit for low-income individuals ($300 per exemption, up to your tax) is used.' : null}
          {va.age.total > 0 && va.age.kind.taxpayer === 'income' ? ` Income-tested: adjusted federal AGI ${usd(va.age.afagi)} against the ${usd(va.age.limit)} limit.` : null}
        </p>
        <div className="grid">
          {ret.dependents.length > 0 && <MoneyField label="Dependents’ Virginia AGI" hint="Only if your dependents had income (low-income credit test)" value={v.dependentsVagi} onChange={(n) => put({ dependentsVagi: n })} />}
          {ret.filingStatus === 'mfs' && <MoneyField label="Your spouse’s federal AGI" hint="Married filing separately: the age deduction uses combined income" value={v.spouseFagiIfSeparate} onChange={(n) => put({ spouseFagiIfSeparate: n })} />}
          <MoneyField label="Credit for tax paid to another state" hint="Schedule OSC line 21" value={v.otherStateCredit} onChange={(n) => put({ otherStateCredit: n })} />
          <MoneyField label="Other credits from Schedule CR" hint="Section 5, Part 1, line 1A" value={v.scheduleCrCredits} onChange={(n) => put({ scheduleCrCredits: n })} />
        </div>
        {joint && va.sta && (
          <div style={{ marginTop: 14 }}>
            <Check label={`Enter ${names.spouse}’s share of Virginia AGI myself`} checked={v.spouseVagiOverride !== null}
              hint={v.spouseVagiOverride === null ? `Split automatically: ${names.taxpayer} ${usd(va.sta.vagi.taxpayer)}, ${names.spouse} ${usd(va.sta.vagi.spouse)}. Joint income is split in half.` : undefined}
              onChange={(on) => put({ spouseVagiOverride: on ? va.sta?.vagi.spouse ?? 0 : null })} />
            {v.spouseVagiOverride !== null && (
              <div className="grid" style={{ marginTop: 12 }}>
                <MoneyField label={`${names.spouse}’s Virginia AGI`} value={v.spouseVagiOverride} onChange={(n) => put({ spouseVagiOverride: n })} />
              </div>
            )}
          </div>
        )}
      </Section>

      <Section title="Refund, contributions and other amounts">
        <div className="grid">
          {va.lines['28'] > 0 && <MoneyField label="Apply to 2026 estimated tax" value={v.creditForward} onChange={(n) => put({ creditForward: n })} />}
          <MoneyField label="Commonwealth Savers / ABLE contributions" hint="Schedule VAC Section I" value={v.vacSavers} onChange={(n) => put({ vacSavers: n })} />
          <MoneyField label="Other voluntary contributions" hint="Schedule VAC Section II" value={v.vacOther} onChange={(n) => put({ vacOther: n })} />
          <MoneyField label="Consumer’s use tax" hint="Untaxed online and out-of-state purchases" value={v.useTax} onChange={(n) => put({ useTax: n })} />
        </div>
      </Section>

      <Section title="Underpaid estimated tax (Form 760C)" aside={<span className="pill">{usd(va.lines['32'])}</span>}
        intro="Virginia charges 9% a year on each quarter’s shortfall from its due date until it is paid. Withholding counts as paid evenly through the year.">
        <div className="grid">
          <MoneyField label="Your 2024 Virginia tax" hint="Form 760 line 18 for 2024, less credits. Keeping pace with it voids the addition."
            value={v.priorYearTax ?? 0} onChange={(n) => put({ priorYearTax: n || (v.priorYearTax === 0 ? 0 : null) })} />
        </div>
        <div className="checks">
          <Check label="I owed no Virginia tax for 2024" checked={v.priorYearTax === 0} onChange={(on) => put({ priorYearTax: on ? 0 : null })} />
          <Check label="Enter the addition to tax myself" hint="Farmers, fishermen and merchant seamen (Form 760F), or Form 760C exceptions 2–4 (annualized income)"
            checked={v.additionToTaxManual} onChange={(on) => put({ additionToTaxManual: on, additionToTax: on ? va.lines['32'] : 0 })} />
        </div>
        {v.additionToTaxManual ? (
          <div className="grid" style={{ marginTop: 12 }}>
            <MoneyField label="Addition to tax" hint="Schedule ADJ line 18" value={v.additionToTax} onChange={(n) => put({ additionToTax: n })} />
          </div>
        ) : (
          <>
            <p className="why">{va.underpayment.safe ? `No addition to tax: ${va.underpayment.reason.charAt(0).toLowerCase()}${va.underpayment.reason.slice(1)}` : `Required each quarter: ${usd(va.form760c.columns[0].required)} (the smaller of 90% of your 2025 tax and 100% of your 2024 tax, divided by four).`}</p>
            {!va.underpayment.safe && (
              <table className="lines va-760c">
                <thead>
                  <tr><th scope="col">Due</th><th scope="col">Required</th><th scope="col">Paid on time</th><th scope="col">Short</th><th scope="col">Addition</th></tr>
                </thead>
                <tbody>
                  {va.form760c.columns.map((c, i) => (
                    <tr key={c.due}>
                      <th scope="row">{PERIODS[i]}</th>
                      <td>{usd(c.required)}</td>
                      <td>{usd(c.line13)}</td>
                      <td>{c.exceptionMet ? 'Exception 1' : usd(c.underpayment)}</td>
                      <td>{usd(c.addition, { cents: true })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </Section>

      {va.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">
            {va.issues.map((m) => <li key={m} className="issue is-warning"><span className="issue-kind">Check</span><span>{m}</span></li>)}
          </ul>
        </Section>
      )}

      <Section title="Form 760" intro="Whole dollars, as Virginia requires.">
        <Lines va={va} />
        {va.belowThreshold && <p className="why">Your Virginia AGI is under the filing threshold, so your tax is $0; file to get back what was withheld.</p>}
      </Section>

      <Section title="Virginia forms" intro="Filled in on this device from the official Virginia Tax PDFs.">
        <ul className="form-list">{packet?.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet && packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Attach these yourself.</strong>
            <ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul>
          </div>
        )}
        <div className="actions">
          <button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download Virginia forms (PDF)'}</button>
        </div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <div className="why">
          <p>Sign page 2 and attach copies of W-2s and 1099s that show Virginia withholding. Virginia returns are due May 1, 2026.</p>
          <p>Mail to the Virginia Department of Taxation: refund or no payment, P.O. Box 1498, Richmond, VA 23218-1498; with a payment, P.O. Box 760, Richmond, VA 23218-0760.
            {locality && locality[2].length && !locality[2][0].startsWith('Refund') ? ` Or to your Commissioner of the Revenue (${locality[1]}): ${locality[2].join(' ')}.` : ''}</p>
        </div>
      </Section>
    </div>
  )
}
