/**
 * The Maryland part of the State step: Form 502 for full-year residents, built on the federal return.
 * Only what Maryland needs beyond the federal return is asked here.
 */
import { ReactElement, useMemo, useState } from 'react'
import type { MarylandInput, MdCodedEntry, Owner, Person } from '../engine/model.ts'
import { emptyMdEntry } from '../engine/model.ts'
import { MD_ADDITION_CODES, MD_COUNTIES, MD_SUBTRACTION_CODES, computeMaryland, mdCounty } from '../engine/md2025.ts'
import type { MdResult } from '../engine/md2025.ts'
import { buildMarylandPacket } from '../pdf/md2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { Check, DocList, MoneyField, Section, TextField, usd } from './fields'
import { SelectField } from './steps'
import type { StepProps } from './steps'

const LINES: [line: string, label: string][] = [
  ['1', 'Federal adjusted gross income'],
  ['6', 'Maryland additions'],
  ['8', 'State tax refund'],
  ['9', 'Child and dependent care expenses'],
  ['10a', 'Pension exclusion'],
  ['11', 'Taxable Social Security'],
  ['13', 'Other subtractions (Form 502SU)'],
  ['14', 'Two-income subtraction'],
  ['16', 'Maryland adjusted gross income'],
  ['17', 'Deduction'],
  ['19', 'Exemptions'],
  ['20', 'Taxable net income'],
  ['21', 'Maryland tax'],
  ['21b', 'Additional 2% on capital gains'],
  ['22', 'Earned income credit'],
  ['23', 'Poverty level credit'],
  ['24', 'Other credits (Form 502CR)'],
  ['27', 'Maryland tax after credits'],
  ['28', 'Local tax'],
  ['32', 'Local credits'],
  ['33', 'Local tax after credits'],
  ['34', 'Total Maryland and local tax'],
  ['40', 'With contributions'],
  ['41', 'Tax withheld'],
  ['43', 'Estimated and extension payments'],
  ['44', 'Refundable earned income credit'],
  ['45', 'Refundable credits'],
  ['47', 'Balance due'],
  ['49', 'Applied to 2026'],
  ['50', 'Refund']
]
const ALWAYS = new Set(['1', '16', '20', '21', '34'])
const KEY = new Set(['16', '20', '34', '47', '50'])
const CONTRIBUTIONS = ['Chesapeake Bay and Endangered Species Fund', 'Developmental Disabilities Services and Support Fund', 'Maryland Cancer Fund', 'Fair Campaign Financing Fund', 'Maryland Veterans Trust Fund']

const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback
const codeOptions = (table: Record<string, string>): { value: string; label: string }[] =>
  [{ value: '', label: 'Choose a code' }, ...Object.entries(table).map(([code, label]) => ({ value: code, label: `${code} · ${label}` }))]

function Coded({ title, entries, table, addLabel, emptyText, onChange }: {
  title: string; entries: MdCodedEntry[]; table: Record<string, string>; addLabel: string; emptyText: string; onChange: (e: MdCodedEntry[]) => void
}): ReactElement {
  const patch = (id: string, p: Partial<MdCodedEntry>): void => onChange(entries.map((x) => (x.id === id ? { ...x, ...p } : x)))
  return (
    <div className="va-entries">
      <h3>{title}</h3>
      <DocList items={entries} addLabel={addLabel} emptyText={emptyText}
        title={(x, i) => (x.code ? `${x.code} · ${table[x.code] ?? 'Other code'}` : `Line ${i + 1}`)}
        onAdd={() => onChange([...entries, emptyMdEntry()])}
        onRemove={(id) => onChange(entries.filter((x) => x.id !== id))}
        render={(x) => (
          <>
            <SelectField label="Code" value={x.code in table ? x.code : ''} onChange={(v) => patch(x.id, { code: v })} options={codeOptions(table)} />
            <MoneyField label="Amount" value={x.amount} onChange={(n) => patch(x.id, { amount: n })} />
          </>
        )} />
    </div>
  )
}

function Lines({ md }: { md: MdResult }): ReactElement {
  const L = md.lines
  return (
    <table className="lines">
      <tbody>
        {LINES.filter(([k]) => ALWAYS.has(k) || (L[k] ?? 0) !== 0).map(([k, label]) => (
          <tr key={k} className={KEY.has(k) ? 'is-key' : ''}>
            <th scope="row"><span className="line-no">{k}</span>{label}</th>
            <td>{usd(L[k] ?? 0)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function MarylandStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const m = ret.maryland
  const md = useMemo(() => computeMaryland(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<MarylandInput>): void => set((r) => ({ ...r, maryland: { ...r.maryland, ...p } }))
  const joint = ret.filingStatus === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const packet = buildMarylandPacket(ret, result, md, preparer)
  const owes = md.lines['47'] > 0
  const county = mdCounty(m.subdivisionCode)
  const L = md.lines

  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadMarylandForms }) => downloadMarylandForms(ret, result, md, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }

  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'Maryland: you owe' : 'Maryland refund'}</p>
          <p className="va-result-amount">{usd(owes ? L['47'] : L['50'])}</p>
        </div>
        <dl>
          <div><dt>Maryland AGI</dt><dd>{usd(L['16'])}</dd></div>
          <div><dt>Maryland tax</dt><dd>{usd(L['27'])}</dd></div>
          <div><dt>Local tax{county ? `, ${county.name}` : ''}</dt><dd>{usd(L['33'])}</dd></div>
        </dl>
      </div>

      <Section title="Where you lived on December 31, 2025" intro={`Filing status ${md.status} from your federal return. Your county sets the local income tax, figured on the same return.`}>
        <div className="grid">
          <SelectField label="County or Baltimore City" value={county?.code ?? ''}
            onChange={(code) => put({ subdivisionCode: code, subdivisionName: '' })}
            options={[{ value: '', label: 'Choose your county' }, ...MD_COUNTIES.map((c) => ({ value: c.code, label: `${c.name} (${c.code})` }))]} />
          <TextField label="Incorporated city or town (optional)" hint="Only if you live inside its limits, for example City of Rockville" value={m.subdivisionName} onChange={(s) => put({ subdivisionName: s })} />
          <TextField label="Political subdivision code" hint="4 digits from Instruction 6; the county code if not in a town" value={m.subdivisionCode} onChange={(s) => put({ subdivisionCode: s.replace(/\D/g, '').slice(0, 4) })} />
        </div>
      </Section>

      <Section title="Maryland tax withheld and paid" intro="Add the Maryland and local tax shown in W-2 box 17 and the state boxes of 1099 forms.">
        <div className="grid">
          <MoneyField label="Maryland and local tax withheld" value={m.withholding} onChange={(n) => put({ withholding: n })} />
          <MoneyField label="Estimated and extension payments" hint="Include a 2024 overpayment applied to 2025" value={m.estimatedPayments} onChange={(n) => put({ estimatedPayments: n })} />
        </div>
      </Section>

      <Section title="Income Maryland treats differently" intro="Social Security, child care expenses, the pension exclusion and the two-income subtraction are figured from your federal return.">
        <div className="grid">
          <MoneyField label="State tax refund in federal income" value={m.stateRefundInFagi} onChange={(n) => put({ stateRefundInFagi: n })} />
          <MoneyField label="Interest on U.S. obligations" hint="Treasury bills, notes, bonds, savings bonds (502SU line ab)" value={m.usObligationInterest} onChange={(n) => put({ usObligationInterest: n })} />
          <MoneyField label="Other states’ municipal bond interest" hint="Line 2: tax-exempt federally, taxed by Maryland" value={m.otherStateBondInterest} onChange={(n) => put({ otherStateBondInterest: n })} />
          <MoneyField label="State retirement pickup" hint="Line 3: W-2 box 14" value={m.statePickup} onChange={(n) => put({ statePickup: n })} />
        </div>
        <div className="checks">
          {owners.map((o) => (
            <Check key={o} label={`${names[o]} is totally disabled`} hint="Qualifies for the pension exclusion under 65; attach a physician’s certification"
              checked={m.totallyDisabled[o]} onChange={(on) => put({ totallyDisabled: { ...m.totallyDisabled, [o]: on } })} />
          ))}
        </div>
        {(L['10a'] > 0 || L['14'] > 0 || L['9'] > 0) && (
          <ul className="va-auto">
            {L['9'] > 0 && <li><span>Child and dependent care expenses (line 9)</span><strong>{usd(L['9'])}</strong></li>}
            {owners.filter((o) => md.pension[o] > 0).map((o) => <li key={o}><span>{names[o]}’s pension exclusion (line 10a)</span><strong>{usd(md.pension[o])}</strong></li>)}
            {L['14'] > 0 && <li><span>Two-income subtraction (line 14)</span><strong>{usd(L['14'])}</strong></li>}
          </ul>
        )}
        <Coded title="Other subtractions (Form 502SU)" entries={m.subtractions} table={MD_SUBTRACTION_CODES} addLabel="Add a subtraction"
          emptyText="None. Common ones: Maryland 529 contributions (xb), military retirement (u), union dues (yc)." onChange={(e) => put({ subtractions: e })} />
        <Coded title="Other additions" entries={m.additions} table={MD_ADDITION_CODES} addLabel="Add an addition" emptyText="None." onChange={(e) => put({ additions: e })} />
      </Section>

      <Section title="Deduction and exemptions" intro={md.deduction.federalItemized > 0
        ? `Standard ${usd(md.deduction.standard)} or itemized ${usd(md.deduction.itemized)} (federal itemized less state income tax${md.deduction.phaseout ? ' and the phaseout' : ''}).`
        : `You took the federal standard deduction, so Maryland allows its standard deduction of ${usd(md.deduction.standard)}.`}>
        {md.deduction.federalItemized > 0 && (
          <div className="grid">
            <SelectField label="Deduction method" value={m.deductionMethod} onChange={(v) => put({ deductionMethod: v as MarylandInput['deductionMethod'] })}
              options={[{ value: 'auto', label: 'Whichever is larger' }, { value: 'standard', label: 'Standard deduction' }, { value: 'itemized', label: 'Itemize' }]} />
          </div>
        )}
        <p className="why">Exemptions: {md.exemptions.d} × ({usd(md.exemptions.each)} each{md.exemptions.b ? `, plus ${usd(1000)} for each 65 or older or blind` : ''}) = {usd(md.exemptions.dAmount)}. The {usd(3200)} exemption shrinks once federal AGI passes {joint || ret.filingStatus === 'hoh' || ret.filingStatus === 'qss' ? usd(150000) : usd(100000)}.</p>
        {ret.dependents.length > 0 && (
          <div className="grid">
            {ret.dependents.map((d) => (
              <TextField key={d.id} label={`${d.name || 'Dependent'}’s date of birth`} placeholder="MM/DD/YYYY" hint="Required on Form 502B"
                value={m.dependentBirthDates[d.id] ?? ''} onChange={(s) => put({ dependentBirthDates: { ...m.dependentBirthDates, [d.id]: /^\d{8}$/.test(s) ? `${s.slice(0, 2)}/${s.slice(2, 4)}/${s.slice(4)}` : s } })} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Credits">
        <dl className="facts">
          <div><dt>Earned income credit</dt><dd>{usd(L['22'])}{L['44'] ? ` + ${usd(L['44'])} refundable` : ''}</dd></div>
          <div><dt>Poverty level credit</dt><dd>{usd(L['23'])}</dd></div>
          <div><dt>Senior tax credit</dt><dd>{usd(md.credits.senior)}</dd></div>
          <div><dt>Maryland child tax credit</dt><dd>{usd(md.credits.childTaxCredit)}</dd></div>
          <div><dt>Local earned income and poverty credits</dt><dd>{usd(L['29'] + L['30'])}</dd></div>
        </dl>
        <div className="grid">
          <MoneyField label="Other credits (Form 502CR)" hint="For example, child care, tax paid to another state, long-term care insurance" value={m.otherCredits} onChange={(n) => put({ otherCredits: n })} />
          <MoneyField label="Local credits (502CR Part BB)" value={m.localCredits} onChange={(n) => put({ localCredits: n })} />
          <MoneyField label="Other refundable credits (502CR Part CC)" hint="For example, student loan debt relief" value={m.refundableCredits} onChange={(n) => put({ refundableCredits: n })} />
        </div>
        {(L['20a'] > 0 || result.f1040['11a'] > 350000) && (
          <details className="explain" open={!!md.cg}>
            <summary>{md.cg ? `Form 502CG: ${usd(md.cg['9'])} of capital gain subject to the 2% tax (line 20a)` : 'Form 502CG (2% tax on capital gain when federal AGI is over $350,000)'}</summary>
            <div className="grid">
              <MoneyField label="Net capital gain from Maryland Schedules K-1" hint="Line 1a (part of line 1)" value={m.cg['k1']} onChange={(n) => put({ cg: { ...m.cg, 'k1': n } })} />
              <MoneyField label="Gain on your primary residence (sale under $1.5 million)" hint="Line 2" value={m.cg['2']} onChange={(n) => put({ cg: { ...m.cg, '2': n } })} />
              <MoneyField label="Gain on assets in a retirement plan (401(k), IRA…)" hint="Line 3" value={m.cg['3']} onChange={(n) => put({ cg: { ...m.cg, '3': n } })} />
              <MoneyField label="Gain on cattle, horses or breeding livestock" hint="Line 4" value={m.cg['4']} onChange={(n) => put({ cg: { ...m.cg, '4': n } })} />
              <MoneyField label="Gain on land under a conservation or preservation easement" hint="Line 5" value={m.cg['5']} onChange={(n) => put({ cg: { ...m.cg, '5': n } })} />
              <MoneyField label="Gain on section 179 business property" hint="Line 6" value={m.cg['6']} onChange={(n) => put({ cg: { ...m.cg, '6': n } })} />
              <MoneyField label="Gain on affordable housing owned by a nonprofit" hint="Line 7" value={m.cg['7']} onChange={(n) => put({ cg: { ...m.cg, '7': n } })} />
              {m.capitalGainExclusions > 0 && <MoneyField label="Excluded gains (total, used when lines 2–7 are empty)" value={m.capitalGainExclusions} onChange={(n) => put({ capitalGainExclusions: n })} />}
            </div>
          </details>
        )}
      </Section>

      <Section title="Refund and contributions">
        <div className="grid">
          {L['48'] > 0 && <MoneyField label="Apply to 2026 estimated tax" value={m.creditForward} onChange={(n) => put({ creditForward: n })} />}
          {CONTRIBUTIONS.map((label, i) => (
            <MoneyField key={label} label={label} value={m.contributions[i]} onChange={(n) => {
              const c = [...m.contributions] as MarylandInput['contributions']
              c[i] = n
              put({ contributions: c })
            }} />
          ))}
        </div>
      </Section>

      {md.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">
            {md.issues.map((t) => <li key={t} className="issue is-warning"><span className="issue-kind">Check</span><span>{t}</span></li>)}
          </ul>
        </Section>
      )}

      <Section title="Form 502" intro="Whole dollars, as Maryland requires.">
        <Lines md={md} />
      </Section>

      <Section title="Maryland forms" intro="Filled in on this device from the official Comptroller of Maryland PDFs.">
        <ul className="form-list">{packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Attach these yourself.</strong>
            <ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul>
          </div>
        )}
        <div className="actions">
          <button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download Maryland forms (PDF)'}</button>
        </div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <div className="why">
          <p>Sign page 4 and attach W-2s and 1099s that show Maryland tax withheld. Maryland returns are due April 15, 2026.</p>
          <p>Mail without a payment to Comptroller of Maryland, Revenue Administration Division, 110 Carroll Street, Annapolis, MD 21411-0001. With a payment, put Form PV and your check on top and mail to Comptroller of Maryland, Payment Processing, PO Box 8888, Annapolis, MD 21401-8888.</p>
        </div>
      </Section>
    </div>
  )
}
