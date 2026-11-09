import { ChangeEvent, ReactElement, useRef, useState } from 'react'
import type { StepProps } from './steps'
import type { Issue } from '../engine/compute.ts'
import { normalizeReturn, emptyReturn } from '../engine/model.ts'
import { buildPacket2025 } from '../pdf/irs2025.ts'
import { FILING_STATUS_LABELS } from '../engine/rules2025.ts'
import { Check, DigitsField, Section, TextField, usd } from './fields'
import { STATUS_LABELS, preparerReady } from './store.ts'
import type { PreparerProfile, ReturnStatus } from './store.ts'

const LINES: [line: string, label: string][] = [
  ['1a', 'Wages from W-2s'],
  ['1e', 'Taxable dependent care benefits (Form 2441)'],
  ['1z', 'Total wages'],
  ['2a', 'Tax-exempt interest'],
  ['2b', 'Taxable interest'],
  ['3a', 'Qualified dividends'],
  ['3b', 'Ordinary dividends'],
  ['4a', 'IRA distributions'],
  ['4b', 'IRA distributions, taxable'],
  ['5a', 'Pensions and annuities'],
  ['5b', 'Pensions and annuities, taxable'],
  ['6a', 'Social Security benefits'],
  ['6b', 'Social Security benefits, taxable'],
  ['7a', 'Capital gain or (loss)'],
  ['8', 'Additional income (Schedule 1)'],
  ['9', 'Total income'],
  ['10', 'Adjustments to income'],
  ['11a', 'Adjusted gross income'],
  ['12e', 'Standard or itemized deduction'],
  ['13a', 'Qualified business income deduction'],
  ['13b', 'Additional deductions (Schedule 1-A)'],
  ['14', 'Total deductions'],
  ['15', 'Taxable income'],
  ['16', 'Tax'],
  ['18', 'Tax before credits'],
  ['19', 'Child tax credit / credit for other dependents'],
  ['20', 'Other credits (Schedule 3)'],
  ['22', 'Tax after credits'],
  ['23', 'Other taxes (Schedule 2)'],
  ['24', 'Total tax'],
  ['25d', 'Federal income tax withheld'],
  ['26', 'Estimated tax payments'],
  ['27a', 'Earned income credit'],
  ['28', 'Additional child tax credit'],
  ['29', 'American opportunity credit, refundable'],
  ['31', 'Excess Social Security withheld (Schedule 3)'],
  ['33', 'Total payments'],
  ['34', 'Overpaid'],
  ['37', 'Amount you owe'],
  ['38', 'Estimated tax penalty (included above)']
]
const KEY_LINES = new Set(['9', '11a', '15', '24', '33', '34', '37'])
const ALWAYS = new Set(['1z', '9', '11a', '12e', '15', '16', '24', '33'])

const STEP_LABEL: Record<Issue['step'], string> = { about: 'About you', income: 'Income', deductions: 'Deductions', credits: 'Credits & payments', review: 'Review' }

export function IssueList({ issues, onGo }: { issues: Issue[]; onGo?: (step: Issue['step']) => void }): ReactElement | null {
  if (!issues.length) return null
  const order: Issue['level'][] = ['error', 'warning', 'info']
  const sorted = [...issues].sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level))
  return (
    <ul className="issues">
      {sorted.map((i, n) => (
        <li key={n} className={`issue is-${i.level}`}>
          <span className="issue-kind">{i.level === 'error' ? 'Fix' : i.level === 'warning' ? 'Check' : 'Note'}</span>
          <span>{i.message}</span>
          {onGo && i.step !== 'review' && <button type="button" className="link-button" onClick={() => onGo(i.step)}>Go to {STEP_LABEL[i.step]}</button>}
        </li>
      ))}
    </ul>
  )
}

export function ReviewStep({ ret, set, result, onGo, preparer, status, onStatus }: StepProps & {
  onGo: (step: Issue['step']) => void; preparer: PreparerProfile; status: ReturnStatus; onStatus: (s: ReturnStatus) => void
}): ReactElement {
  const fileInput = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  const [pdfState, setPdfState] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const usePrep = ret.usePaidPreparer && preparerReady(preparer)
  const packet = buildPacket2025(ret, result, usePrep ? preparer : null)
  const blocking = result.issues.filter((i) => i.level === 'error' || (i.level === 'warning' && i.step === 'about'))
  const makePdf = (): void => {
    setPdfState({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadIrsForms }) => downloadIrsForms(ret, result, usePrep ? preparer : null))
      .then(({ pages, problems }) => setPdfState({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdfState({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }
  const f = result.f1040

  const download = (): void => {
    const blob = new Blob([JSON.stringify(ret, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ustaxes-2025-${(ret.taxpayer.lastName || 'return').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setMessage('Saved a copy of your return to your downloads.')
  }
  const importFile = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    if (!file) return
    file.text().then((text) => {
      set(() => normalizeReturn(JSON.parse(text)))
      setMessage(`Loaded ${file.name}.`)
    }).catch(() => setMessage('That file is not a USTaxes return. Choose a .json file saved from this app.'))
    e.target.value = ''
  }
  const reset = (): void => {
    if (window.confirm('Clear every entry in this return? Download a copy first if you want to keep it.')) {
      set(() => emptyReturn())
      setMessage('Started a new return.')
    }
  }

  const s2 = result.schedule2
  return (
    <>
      <Section title="Things to look at" intro={result.issues.length ? undefined : 'Nothing needs your attention.'}>
        <IssueList issues={result.issues} onGo={onGo} />
      </Section>

      <Section title="Signing and preparer" intro="Details printed on page 2 of Form 1040.">
        <div className="checks" style={{ marginTop: 0 }}>
          <Check label="Print the paid preparer section" checked={ret.usePaidPreparer}
            hint={preparerReady(preparer) ? `${preparer.name}, PTIN ${preparer.ptin.toUpperCase()}${preparer.firmName ? `, ${preparer.firmName}` : ''}` : 'Set up your name and PTIN in Settings first.'}
            onChange={(v) => set((r) => ({ ...r, usePaidPreparer: v }))} />
          <Check label="Allow another person to discuss this return with the IRS (third party designee)" checked={ret.designee.enabled}
            onChange={(v) => set((r) => ({ ...r, designee: { ...r.designee, enabled: v, name: v && !r.designee.name && preparerReady(preparer) ? preparer.name : r.designee.name, phone: v && !r.designee.phone ? preparer.phone : r.designee.phone } }))} />
        </div>
        {ret.usePaidPreparer && !preparerReady(preparer) && <p className="note is-warn">The preparer section will be left blank until your name and PTIN are saved in <a href="#/settings">Settings</a>.</p>}
        {ret.designee.enabled && (
          <div className="grid" style={{ marginTop: 14 }}>
            <TextField label="Designee’s name" value={ret.designee.name} onChange={(v) => set((r) => ({ ...r, designee: { ...r.designee, name: v } }))} />
            <TextField label="Designee’s phone" value={ret.designee.phone} onChange={(v) => set((r) => ({ ...r, designee: { ...r.designee, phone: v } }))} />
            <DigitsField label="Designee’s PIN" length={5} hint="Any 5 digits the designee chooses" value={ret.designee.pin} onChange={(v) => set((r) => ({ ...r, designee: { ...r.designee, pin: v } }))} />
          </div>
        )}
        <div className="grid" style={{ marginTop: 14 }}>
          <DigitsField label="Your Identity Protection PIN" length={6} hint="Only if the IRS sent you one (CP01A letter or online account)" value={ret.taxpayer.ipPin} onChange={(v) => set((r) => ({ ...r, taxpayer: { ...r.taxpayer, ipPin: v } }))} />
          {ret.filingStatus === 'mfj' && <DigitsField label="Spouse’s Identity Protection PIN" length={6} value={ret.spouse.ipPin} onChange={(v) => set((r) => ({ ...r, spouse: { ...r.spouse, ipPin: v } }))} />}
        </div>
      </Section>

      <Section title="IRS forms" intro="Your return on the official 2025 IRS forms, filled in and ready to print, sign and mail. The PDF is made on this device.">
        <ul className="form-list">
          {packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}
        </ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn">
            <strong>Attach these yourself.</strong> The app does not print them yet; get them at irs.gov/forms and copy the amounts from this review:
            <ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul>
          </div>
        )}
        {blocking.length > 0 && <p className="note is-warn">Some details are missing ({blocking.length}). You can still download, but finish them under “Things to look at” before you file.</p>}
        <div className="actions">
          <button type="button" className="button" onClick={makePdf} disabled={pdfState.busy}>{pdfState.busy ? 'Preparing PDF…' : 'Download IRS forms (PDF)'}</button>
          <a className="button is-quiet" href="#/letter">Letter with filing instructions</a>
        </div>
        {pdfState.note && <p className="note" role="status">{pdfState.note}</p>}
        <p className="why">Before mailing: sign and date page 2 of Form 1040, attach Copy B of your W-2s (and any 1099-R with tax withheld), and send to the IRS address for your state listed in the Form 1040 instructions.</p>
      </Section>

      <Section title="Form 1040" intro={`${FILING_STATUS_LABELS[ret.filingStatus]} · tax year 2025`}>
        <table className="lines">
          <tbody>
            {LINES.filter(([line]) => ALWAYS.has(line) || f[line] !== 0).map(([line, label]) => (
              <tr key={line} className={KEY_LINES.has(line) ? 'is-key' : ''}>
                <th scope="row"><span className="line-no">{line}</span>{label}</th>
                <td>{usd(f[line])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Schedules">
        <div className="schedules">
          {result.schedule1.additionalIncome !== 0 || result.schedule1.totalAdjustments > 0 ? (
            <details><summary>Schedule 1 <span>Additional income and adjustments</span></summary>
              <dl className="facts">
                {result.schedule1.businessIncome !== 0 && <div><dt>Business income</dt><dd>{usd(result.schedule1.businessIncome)}</dd></div>}
                {result.schedule1.unemployment > 0 && <div><dt>Unemployment</dt><dd>{usd(result.schedule1.unemployment)}</dd></div>}
                {result.schedule1.otherIncome > 0 && <div><dt>Other income</dt><dd>{usd(result.schedule1.otherIncome)}</dd></div>}
                {Object.entries(result.schedule1.adjustments).filter(([, v]) => v > 0).map(([k, v]) => (
                  <div key={k}><dt>{k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}</dt><dd>−{usd(v)}</dd></div>
                ))}
              </dl>
            </details>
          ) : null}
          {result.schedule1A.total > 0 && (
            <details><summary>Schedule 1-A <span>Tips, overtime, car loan, seniors</span></summary>
              <dl className="facts">
                {result.schedule1A.tips > 0 && <div><dt>Tips</dt><dd>{usd(result.schedule1A.tips)}</dd></div>}
                {result.schedule1A.overtime > 0 && <div><dt>Overtime</dt><dd>{usd(result.schedule1A.overtime)}</dd></div>}
                {result.schedule1A.carLoanInterest > 0 && <div><dt>Car loan interest</dt><dd>{usd(result.schedule1A.carLoanInterest)}</dd></div>}
                {result.schedule1A.senior > 0 && <div><dt>Seniors</dt><dd>{usd(result.schedule1A.senior)}</dd></div>}
              </dl>
            </details>
          )}
          {result.deduction.used === 'itemized' && (
            <details><summary>Schedule A <span>Itemized deductions</span></summary>
              <dl className="facts">
                <div><dt>Medical (above 7.5% of AGI)</dt><dd>{usd(result.scheduleA.medical)}</dd></div>
                <div><dt>Taxes (cap {usd(result.scheduleA.saltCap)})</dt><dd>{usd(result.scheduleA.taxes)}</dd></div>
                <div><dt>Mortgage interest</dt><dd>{usd(result.scheduleA.interest)}</dd></div>
                <div><dt>Charity</dt><dd>{usd(result.scheduleA.charity)}</dd></div>
                {result.scheduleA.other > 0 && <div><dt>Other</dt><dd>{usd(result.scheduleA.other)}</dd></div>}
              </dl>
            </details>
          )}
          {result.scheduleB.required && (
            <details><summary>Schedule B <span>Interest and dividends over $1,500</span></summary>
              <dl className="facts">
                {ret.interest.map((i) => <div key={i.id}><dt>{i.payer || 'Interest'}</dt><dd>{usd(i.interest)}</dd></div>)}
                {ret.dividends.map((d) => <div key={d.id}><dt>{d.payer || 'Dividends'}</dt><dd>{usd(d.ordinaryDividends)}</dd></div>)}
              </dl>
            </details>
          )}
          {result.scheduleC.map((c) => (
            <details key={c.id}><summary>Schedule C <span>{c.name}</span></summary>
              <dl className="facts">
                <div><dt>Gross income</dt><dd>{usd(c.grossIncome)}</dd></div>
                <div><dt>Expenses</dt><dd>−{usd(c.totalExpenses)}</dd></div>
                <div><dt>Net profit or loss</dt><dd>{usd(c.netProfit)}</dd></div>
              </dl>
            </details>
          ))}
          {ret.capitalTransactions.length + ret.dividends.filter((d) => d.capitalGainDistributions > 0).length > 0 && (
            <details><summary>Schedule D <span>Capital gains and losses</span></summary>
              <dl className="facts">
                <div><dt>Net short-term</dt><dd>{usd(result.scheduleD.shortTerm)}</dd></div>
                <div><dt>Net long-term</dt><dd>{usd(result.scheduleD.longTerm)}</dd></div>
                <div><dt>On Form 1040 line 7a</dt><dd>{usd(f['7a'])}</dd></div>
                {result.scheduleD.carryoverShort + result.scheduleD.carryoverLong > 0 && <div><dt>Carryover to 2026</dt><dd>{usd(result.scheduleD.carryoverShort + result.scheduleD.carryoverLong)}</dd></div>}
              </dl>
            </details>
          )}
          {result.scheduleSE.map((s) => (
            <details key={s.owner}><summary>Schedule SE <span>{s.owner === 'spouse' ? ret.spouse.firstName || 'Spouse' : ret.taxpayer.firstName || 'You'}</span></summary>
              <dl className="facts">
                <div><dt>Net earnings (92.35%)</dt><dd>{usd(s.netEarnings)}</dd></div>
                <div><dt>Social Security part</dt><dd>{usd(s.socialSecurityTax)}</dd></div>
                <div><dt>Medicare part</dt><dd>{usd(s.medicareTax)}</dd></div>
                <div><dt>Self-employment tax</dt><dd>{usd(s.total)}</dd></div>
              </dl>
            </details>
          ))}
          {s2.total > 0 && (
            <details><summary>Schedule 2 <span>Other taxes</span></summary>
              <dl className="facts">
                {s2.selfEmploymentTax > 0 && <div><dt>Self-employment tax</dt><dd>{usd(s2.selfEmploymentTax)}</dd></div>}
                {s2.additionalMedicareTax > 0 && <div><dt>Additional Medicare tax (Form 8959)</dt><dd>{usd(s2.additionalMedicareTax)}</dd></div>}
                {s2.netInvestmentIncomeTax > 0 && <div><dt>Net investment income tax (Form 8960)</dt><dd>{usd(s2.netInvestmentIncomeTax)}</dd></div>}
                {s2.earlyDistributionTax > 0 && <div><dt>Additional tax on early distributions (Form 5329)</dt><dd>{usd(s2.earlyDistributionTax)}</dd></div>}
              </dl>
            </details>
          )}
          {result.schedule3.dependentCare + result.schedule3.education + result.schedule3.saversCredit + result.schedule3.excessSocialSecurity > 0 && (
            <details><summary>Schedule 3 <span>Additional credits and payments</span></summary>
              <dl className="facts">
                {result.schedule3.dependentCare > 0 && <div><dt>Child and dependent care credit</dt><dd>{usd(result.schedule3.dependentCare)}</dd></div>}
                {result.schedule3.education > 0 && <div><dt>Education credits (nonrefundable)</dt><dd>{usd(result.schedule3.education)}</dd></div>}
                {result.schedule3.saversCredit > 0 && <div><dt>Saver’s credit (Form 8880)</dt><dd>{usd(result.schedule3.saversCredit)}</dd></div>}
                {result.schedule3.excessSocialSecurity > 0 && <div><dt>Excess Social Security withheld</dt><dd>{usd(result.schedule3.excessSocialSecurity)}</dd></div>}
              </dl>
            </details>
          )}
          {result.form2441.credit > 0 && (
            <details><summary>Form 2441 <span>Child and dependent care</span></summary>
              <dl className="facts">
                <div><dt>Qualifying persons</dt><dd>{result.form2441.qualifyingPersons}</dd></div>
                <div><dt>Expenses used</dt><dd>{usd(result.form2441.expensesUsed)}</dd></div>
                <div><dt>Credit rate</dt><dd>{Math.round(result.form2441.rate * 100)}%</dd></div>
                <div><dt>Credit</dt><dd>{usd(result.form2441.credit)}</dd></div>
              </dl>
            </details>
          )}
          {result.form8863.aotc + result.form8863.llc > 0 && (
            <details><summary>Form 8863 <span>Education credits</span></summary>
              <dl className="facts">
                {result.form8863.aotc > 0 && <div><dt>American opportunity credit</dt><dd>{usd(result.form8863.aotc)}</dd></div>}
                {result.form8863.aotcRefundable > 0 && <div><dt>Refundable part (line 29)</dt><dd>{usd(result.form8863.aotcRefundable)}</dd></div>}
                {result.form8863.llc > 0 && <div><dt>Lifetime learning credit</dt><dd>{usd(result.form8863.llc)}</dd></div>}
              </dl>
            </details>
          )}
          {result.eic.credit > 0 && (
            <details><summary>Schedule EIC <span>Earned income credit</span></summary>
              <dl className="facts">
                <div><dt>Qualifying children</dt><dd>{result.eic.qualifyingChildren}</dd></div>
                <div><dt>Earned income</dt><dd>{usd(result.eic.earnedIncome)}</dd></div>
                <div><dt>Credit</dt><dd>{usd(result.eic.credit)}</dd></div>
              </dl>
            </details>
          )}
          {result.qbi.deduction > 0 && (
            <details><summary>Form 8995 <span>Qualified business income deduction</span></summary>
              <dl className="facts">
                <div><dt>Qualified business income</dt><dd>{usd(result.qbi.qualifiedBusinessIncome)}</dd></div>
                <div><dt>Deduction</dt><dd>{usd(result.qbi.deduction)}</dd></div>
              </dl>
            </details>
          )}
        </div>
      </Section>

      <Section title="Return status" intro="Track where this return stands. The list of all returns shows it too.">
        <div className="status-choices" role="radiogroup" aria-label="Return status">
          {(Object.keys(STATUS_LABELS) as ReturnStatus[]).map((st) => (
            <button key={st} type="button" role="radio" aria-checked={status === st} className={`status-pill is-${st} ${status === st ? 'is-selected' : ''}`} onClick={() => onStatus(st)}>{STATUS_LABELS[st]}</button>
          ))}
        </div>
      </Section>

      <Section title="Save your work" intro="This return is saved in this browser as you type. Nothing is sent anywhere. Download it to move it to another device, or back up every return from Settings.">
        <div className="actions">
          <button type="button" className="button" onClick={download}>Download return file</button>
          <button type="button" className="button is-quiet" onClick={() => fileInput.current?.click()}>Open a return file</button>
          <button type="button" className="button is-quiet" onClick={() => window.print()}>Print summary</button>
          <button type="button" className="button is-danger" onClick={reset}>Clear this return</button>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={importFile} />
        </div>
        {message && <p className="note" role="status">{message}</p>}
      </Section>
    </>
  )
}
