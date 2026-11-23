/**
 * The Mississippi part of the State step: Form 80-105 with Forms 80-107 and 80-108 for full-year residents.
 */
import { ReactElement, useMemo, useState } from 'react'
import type { MsCredit401, MsInput, MsOtherState, Owner, Person } from '../engine/model.ts'
import { computeMississippi } from '../engine/ms2025.ts'
import { buildMsPacket, MS_FUNDS } from '../pdf/ms2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { MoneyField, Section, TextField, usd } from './fields'
import { StatementRows } from './statements'
import type { StepProps } from './steps'

const PAIRS: [line: string, label: string][] = [
  ['49', 'Total income'], ['65', 'Total adjustments'], ['13', 'Mississippi adjusted gross income'], ['14', 'Standard or itemized deduction'], ['15', 'Exemptions'], ['16', 'Mississippi taxable income']
]
const LINES: [line: string, label: string][] = [
  ['17', 'Income tax (0% / 4.4%)'], ['18', 'Credit for tax paid to another state'], ['19', 'Other credits'], ['21', 'Use tax'], ['23', 'Total tax due'],
  ['24', 'Mississippi tax withheld'], ['25', 'Estimated and extension payments'], ['28', 'Total payments'], ['32', 'Applied to 2026'], ['33', 'Check-off contributions'],
  ['34', 'Refund'], ['37', 'Amount you owe']
]
const ALWAYS = new Set(['17', '23', '28'])
const KEY = new Set(['23', '34', '37'])
const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback

export function MississippiStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const d = ret.ms
  const ms = useMemo(() => computeMississippi(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<MsInput>): void => set((r) => ({ ...r, ms: { ...r.ms, ...p } }))
  const married = ret.filingStatus === 'mfj'
  const owners: Owner[] = married ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const packet = buildMsPacket(ret, result, ms, preparer)
  const L = ms.lines
  const owes = L['37'] > 0
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadMississippiForms }) => downloadMississippiForms(ret, result, ms, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }
  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'Mississippi: you owe' : 'Mississippi refund'}</p>
          <p className="va-result-amount">{usd(owes ? L['37'] : L['34'])}</p>
        </div>
        <dl>
          <div><dt>Taxable income</dt><dd>{usd(L['16A'] + L['16B'])}</dd></div>
          <div><dt>Income tax</dt><dd>{usd(L['17'])}</dd></div>
          <div><dt>Exemptions</dt><dd>{usd(L['12'])}</dd></div>
        </dl>
      </div>

      <Section title="Mississippi return" intro={`Mississippi taxes income above $10,000 at 4.4%${married ? ', separately for each spouse' : ''}. Social Security and retirement income are not taxed. The standard deduction and exemptions${married ? ' are divided between you to use both $10,000 bands' : ' come off first'}.`}>
        <div className="grid">
          <TextField label="County code" hint="Two digits, from the county code list in the instructions" autoComplete="off" value={d.countyCode} onChange={(s) => put({ countyCode: s })} />
        </div>
      </Section>

      <Section title="Mississippi withholding and payments" intro="From the state section of each W-2 (boxes 15–17). They go on Form 80-107, which is filed with every return.">
        {w2s.length > 0
          ? <StatementRows kind="w2" state="Mississippi" items={w2s.map((w) => ({ id: w.id, title: `${w.employer.trim() || 'W-2'} (${names[w.owner]})`, federal: w.wages }))} value={d.w2} onChange={(w2) => put({ w2 })} />
          : <p className="why">No W-2s entered.</p>}
        <div className="grid">
          <MoneyField label="Mississippi tax withheld on 1099s" value={d.withholding1099} onChange={(n) => put({ withholding1099: n })} />
          <MoneyField label="Estimated and extension payments" hint="Line 25" value={d.estimatedPayments} onChange={(n) => put({ estimatedPayments: n })} />
          {L['31'] > 0 && <MoneyField label="Apply to 2026 estimated tax" value={d.creditForward} onChange={(n) => put({ creditForward: n })} />}
        </div>
      </Section>

      <Section title="Adjustments and credits">
        <div className="grid">
          <MoneyField label="Interest on U.S. government obligations" hint="Not taxed (80-108 Part II)" value={d.usObligationInterest} onChange={(n) => put({ usObligationInterest: n })} />
          <MoneyField label="Interest on other states’ municipal bonds" hint="Taxed in Mississippi" value={d.otherStateBondInterest} onChange={(n) => put({ otherStateBondInterest: n })} />
          {owners.map((o) => (
            <MoneyField key={o} label={`${names[o]}: National Guard or Reserve pay`} hint="Line 55; up to $15,000" value={d.guardPay[o]} onChange={(n) => put({ guardPay: { ...d.guardPay, [o]: n } })} />
          ))}
          <MoneyField label="MPACT contributions" hint="Line 56" value={d.mpact} onChange={(n) => put({ mpact: n })} />
          <MoneyField label="MACS college savings contributions" hint="Line 57" value={d.macs} onChange={(n) => put({ macs: n })} />
          <MoneyField label="Mississippi ABLE contributions" hint="Line 64" value={d.able} onChange={(n) => put({ able: n })} />
          <MoneyField label="Consumer use tax" hint="Line 21" value={d.useTax} onChange={(n) => put({ useTax: n })} />
        </div>
              <details open={d.otherStates.length > 0}>
          <summary>Credit for tax paid to other states (Form 80-160){ms.f160 ? ` — ${usd(L['18'])}` : ''}</summary>
          <p className="why">For income earned in another state and taxed there. Enter, from each state’s return, the income earned there, the deduction and exemption claimed there, and the tax due there (not the amount withheld). The credit is limited to Mississippi’s 4.4% rate on that taxable income above $10,000.</p>
          {d.otherStates.map((o, i) => {
            const set1 = (p: Partial<MsOtherState>): void => put({ otherStates: d.otherStates.map((y, j) => (j === i ? { ...y, ...p } : y)) })
            return (
              <fieldset key={i} className="statement">
                <legend>{o.state.trim().toUpperCase() || `State ${i + 1}`}</legend>
                <div className="grid">
                  <TextField label="State (two letters)" autoComplete="off" value={o.state} onChange={(s) => set1({ state: s.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() })} />
                  <MoneyField label="Income earned in that state" hint="Line 1" value={o.income} onChange={(n) => set1({ income: n })} />
                  <MoneyField label="Deduction claimed there" hint="Line 2" value={o.deduction} onChange={(n) => set1({ deduction: n })} />
                  <MoneyField label="Exemption claimed there" hint="Line 3" value={o.exemption} onChange={(n) => set1({ exemption: n })} />
                  <MoneyField label="Income tax due to that state" hint="Line 9" value={o.tax} onChange={(n) => set1({ tax: n })} />
                </div>
                <div className="actions"><button type="button" className="button" onClick={() => put({ otherStates: d.otherStates.filter((_, j) => j !== i) })}>Remove this state</button></div>
              </fieldset>
            )
          })}
          {d.otherStates.length < 3 && <div className="actions"><button type="button" className="button" onClick={() => put({ otherStates: [...d.otherStates, { state: '', income: 0, deduction: 0, exemption: 0, tax: 0 }] })}>Add a state</button></div>}
        </details>
        <details open={d.credits401.length > 0}>
          <summary>Other tax credits (Form 80-401){L['19'] > 0 ? ` — ${usd(L['19'])}` : ''}</summary>
          <p className="why">Use the two-digit credit code printed on Form 80-401 (for example 25 child adoption, 34 qualifying charitable contribution, 44 dependent care). Credits are used in order up to your tax; codes marked * on the form cannot be carried over.</p>
          {d.credits401.map((c, i) => {
            const set1 = (p: Partial<MsCredit401>): void => put({ credits401: d.credits401.map((y, j) => (j === i ? { ...y, ...p } : y)) })
            const row = c.code.trim() ? ms.f401[d.credits401.slice(0, i).filter((y) => y.code.trim()).length] : undefined
            return (
              <fieldset key={i} className="statement">
                <legend>Credit{c.code.trim() ? ` code ${c.code.trim()}` : ''}</legend>
                <div className="grid">
                  <TextField label="Credit code" autoComplete="off" value={c.code} onChange={(s) => set1({ code: s.replace(/\D/g, '').slice(0, 2) })} />
                  <MoneyField label="Earned this year" hint="Column B" value={c.earned} onChange={(n) => set1({ earned: n })} />
                  <MoneyField label="Received from a pass-through entity" hint="Column C" value={c.passThrough} onChange={(n) => set1({ passThrough: n })} />
                  <MoneyField label="Carryover from prior years" hint="Column D" value={c.carryover} onChange={(n) => set1({ carryover: n })} />
                  <MoneyField label="Expired or allocated this year" hint="Column F" value={c.expired} onChange={(n) => set1({ expired: n })} />
                </div>
                {row && <p className="why">Used this year: {usd(row.E)}; carryover for next year: {usd(row.G)}.</p>}
                <div className="actions"><button type="button" className="button" onClick={() => put({ credits401: d.credits401.filter((_, j) => j !== i) })}>Remove this credit</button></div>
              </fieldset>
            )
          })}
          <div className="actions"><button type="button" className="button" onClick={() => put({ credits401: [...d.credits401, { code: '', earned: 0, passThrough: 0, carryover: 0, expired: 0 }] })}>Add a credit</button></div>
          {d.credits401.some((c) => c.code.trim() === '25') && <TextField label="Adoptee SSN(s)" hint="Code 25; separate two with a comma" autoComplete="off" value={d.adopteeSsns} onChange={(s) => put({ adopteeSsns: s })} />}
          {d.credits401.some((c) => ['34', '35', '36', '39', '42', '43', '45'].includes(c.code.trim())) && <TextField label="Charitable organization(s)" hint="Codes 34–45; separate two with a semicolon" autoComplete="off" value={d.charities} onChange={(s) => put({ charities: s })} />}
        </details>
      </Section>

      {L['31'] > 0 && (
        <Section title="Check-off contributions" intro="Form 80-108 Part III. They come out of your refund.">
          <div className="grid">
            {MS_FUNDS.map(([k, label]) => <MoneyField key={k} label={label} value={d.contributions[k] ?? 0} onChange={(n) => put({ contributions: { ...d.contributions, [k]: n } })} />)}
          </div>
        </Section>
      )}

      {ms.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">{ms.issues.map((t) => <li key={t} className="issue is-warning"><span className="issue-kind">Check</span><span>{t}</span></li>)}</ul>
        </Section>
      )}

      <Section title="Form 80-105" intro={married ? 'Whole dollars. Column A is you, column B your spouse.' : 'Whole dollars.'}>
        <table className="lines"><tbody>
          {PAIRS.map(([k, label]) => (
            <tr key={k}><th scope="row"><span className="line-no">{k}</span>{label}</th><td>{married ? `${usd(L[`${k}A`])} / ${usd(L[`${k}B`])}` : usd(L[`${k}A`])}</td></tr>
          ))}
          {LINES.filter(([k]) => ALWAYS.has(k) || (L[k] ?? 0) !== 0).map(([k, label]) => (
            <tr key={k} className={KEY.has(k) ? 'is-key' : ''}><th scope="row"><span className="line-no">{k}</span>{label}</th><td>{usd(L[k] ?? 0)}</td></tr>
          ))}
        </tbody></table>
      </Section>

      <Section title="Mississippi forms" intro="Filled in on this device from the official Mississippi DOR Forms 80-105, 80-107 and 80-108.">
        <ul className="form-list">{packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Finish or attach these yourself.</strong><ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul></div>
        )}
        <div className="actions"><button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download Mississippi forms (PDF)'}</button></div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <p className="why">Sign page 3. Refunds: Department of Revenue, PO Box 23058, Jackson MS 39225-3058; all others: PO Box 23050, Jackson MS 39225-3050. Print single-sided. Due April 15, 2026.</p>
      </Section>
    </div>
  )
}
