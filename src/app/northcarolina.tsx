/**
 * The North Carolina part of the State step: Form D-400 for full-year residents, built on the federal return.
 */
import { ReactElement, useMemo, useState } from 'react'
import type { NcInput, Owner, Person } from '../engine/model.ts'
import { computeNorthCarolina } from '../engine/nc2025.ts'
import { buildNcPacket } from '../pdf/nc2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { Check, MoneyField, Section, TextField, usd } from './fields'
import type { StepProps } from './steps'

const LINES: [line: string, label: string][] = [
  ['6', 'Federal adjusted gross income'], ['7', 'Additions (Schedule S)'], ['9', 'Deductions (Schedule S)'], ['10b', 'Child deduction'],
  ['11', 'NC standard or itemized deduction'], ['14', 'NC taxable income'], ['15', 'Tax (4.25%)'], ['16', 'Tax credits (D-400TC)'],
  ['18', 'Consumer use tax'], ['19', 'Total tax'], ['20a', 'NC tax withheld (you)'], ['20b', 'NC tax withheld (spouse)'],
  ['21a', 'Estimated payments'], ['21c', 'Paid with extension'], ['25', 'Total payments'], ['29', 'Applied to 2026'], ['30', 'Wildlife Fund'],
  ['27', 'Amount due'], ['34', 'Refund']
]
const ALWAYS = new Set(['6', '14', '15', '19', '25'])
const KEY = new Set(['14', '19', '27', '34'])
const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback

export function NorthCarolinaStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const d = ret.nc
  const nc = useMemo(() => computeNorthCarolina(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<NcInput>): void => set((r) => ({ ...r, nc: { ...r.nc, ...p } }))
  const joint = ret.filingStatus === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const packet = buildNcPacket(ret, result, nc, preparer)
  const L = nc.lines
  const owes = L['27'] > 0
  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadNorthCarolinaForms }) => downloadNorthCarolinaForms(ret, result, nc, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }
  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'North Carolina: you owe' : 'North Carolina refund'}</p>
          <p className="va-result-amount">{usd(owes ? L['27'] : L['34'])}</p>
        </div>
        <dl>
          <div><dt>Federal AGI</dt><dd>{usd(L['6'])}</dd></div>
          <div><dt>NC taxable income</dt><dd>{usd(L['14'])}</dd></div>
          <div><dt>Total tax</dt><dd>{usd(L['19'])}</dd></div>
        </dl>
      </div>

      <Section title="North Carolina return" intro={`North Carolina taxes income at a flat 4.25% after its own standard deduction (${usd(nc.deduction.standard)}) or itemized deductions, and a child deduction of ${usd(nc.childDeduction.perChild)} per child at your income.`}>
        <div className="grid">
          <TextField label="County" value={d.county} onChange={(s) => put({ county: s })} />
          {owners.map((o) => (
            <MoneyField key={o} label={`NC tax withheld: ${names[o]}`} hint="W-2 box 17 (state NC)" value={d.withholding[o]} onChange={(n) => put({ withholding: { ...d.withholding, [o]: n } })} />
          ))}
          <MoneyField label="2025 estimated payments" value={d.estimatedPayments} onChange={(n) => put({ estimatedPayments: n })} />
          <MoneyField label="Paid with extension (D-410)" value={d.extensionPayment} onChange={(n) => put({ extensionPayment: n })} />
        </div>
        {ret.filingStatus === 'mfs' && (
          <div className="checks"><Check label="My spouse itemizes on their NC return" hint="Then your NC standard deduction is $0" checked={d.spouseItemizes} onChange={(on) => put({ spouseItemizes: on })} /></div>
        )}
      </Section>

      <Section title="Income North Carolina treats differently" intro="Social Security is subtracted automatically. Most private pensions and IRAs are taxed.">
        <div className="grid">
          <MoneyField label="State or local tax refund in federal income" value={d.stateRefundInFagi} onChange={(n) => put({ stateRefundInFagi: n })} />
          <MoneyField label="Interest on U.S. obligations" value={d.usObligationInterest} onChange={(n) => put({ usObligationInterest: n })} />
          <MoneyField label="Other states’ municipal bond interest" hint="Taxed in NC" value={d.otherStateBondInterest} onChange={(n) => put({ otherStateBondInterest: n })} />
          <MoneyField label="Bailey retirement benefits" hint="NC, local or federal government, vested by Aug 12, 1989" value={d.baileyRetirement} onChange={(n) => put({ baileyRetirement: n })} />
          <MoneyField label="Uniformed services retirement" hint="Schedule S line 21" value={d.militaryRetirement} onChange={(n) => put({ militaryRetirement: n })} />
          <MoneyField label="Other additions (Schedule S)" value={d.otherAdditions} onChange={(n) => put({ otherAdditions: n })} />
          <MoneyField label="Other deductions (Schedule S)" value={d.otherDeductions} onChange={(n) => put({ otherDeductions: n })} />
        </div>
        <p className="why">{nc.deduction.method === 'itemized' ? `Using NC itemized deductions: ${usd(nc.deduction.itemized)} (mortgage interest and property tax capped at $20,000).` : `Using the NC standard deduction: ${usd(nc.deduction.standard)}.`}</p>
      </Section>

      <Section title="Credits, use tax and refund">
        <div className="grid">
          <MoneyField label="Tax credits (Form D-400TC)" value={d.taxCredits} onChange={(n) => put({ taxCredits: n })} />
          <MoneyField label="Consumer use tax" hint="On untaxed out-of-state purchases" value={d.useTax} onChange={(n) => put({ useTax: n })} />
          {L['28'] > 0 && <MoneyField label="Apply to 2026 estimated tax" value={d.creditForward} onChange={(n) => put({ creditForward: n })} />}
          {L['28'] > 0 && <MoneyField label="NC Nongame and Endangered Wildlife Fund" value={d.contributions} onChange={(n) => put({ contributions: n })} />}
        </div>
        {d.useTax === 0 && (
          <div className="checks"><Check label="I certify that no consumer use tax is due" checked={d.noUseTaxDue} onChange={(on) => put({ noUseTaxDue: on })} /></div>
        )}
      </Section>

      {nc.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">{nc.issues.map((t) => <li key={t} className="issue is-warning"><span className="issue-kind">Check</span><span>{t}</span></li>)}</ul>
        </Section>
      )}

      <Section title="Form D-400" intro="Whole dollars.">
        <table className="lines"><tbody>
          {LINES.filter(([k]) => ALWAYS.has(k) || (L[k] ?? 0) !== 0).map(([k, label]) => (
            <tr key={k} className={KEY.has(k) ? 'is-key' : ''}><th scope="row"><span className="line-no">{k}</span>{label}</th><td>{usd(L[k] ?? 0)}</td></tr>
          ))}
        </tbody></table>
      </Section>

      <Section title="North Carolina forms" intro="Filled in on this device from the official NCDOR PDFs.">
        <ul className="form-list">{packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Finish or attach these yourself.</strong><ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul></div>
        )}
        <div className="actions"><button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download North Carolina forms (PDF)'}</button></div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <p className="why">Sign page 2 and staple W-2s showing NC withholding where marked. Returns are due April 15, 2026. NCDOR offers free e-filing options at ncdor.gov.</p>
      </Section>
    </div>
  )
}
