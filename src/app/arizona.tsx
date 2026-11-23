/**
 * The Arizona part of the State step: Form 140 for full-year residents, built on the federal return.
 */
import { ReactElement, useMemo, useState } from 'react'
import type { AzInput, Owner, Person } from '../engine/model.ts'
import { AZ_DONATION_LINES, computeArizona } from '../engine/az2025.ts'
import { buildAzPacket } from '../pdf/az2025.ts'
import type { PreparerInfo } from '../pdf/irs2025.ts'
import { Check, MoneyField, NumberField, Section, TextField, usd } from './fields'
import { StatementRows } from './statements'
import type { StepProps } from './steps'

const LINES: [line: string, label: string][] = [
  ['12', 'Federal adjusted gross income'], ['15', 'Other states’ bond interest'], ['18', 'Other additions'], ['19', 'Subtotal'],
  ['24', '25% of long-term gain on assets bought after 2011'], ['28', 'Interest on U.S. obligations'], ['29a', 'Government pensions (up to $2,500 each)'],
  ['29b', 'Military retirement'], ['30', 'Taxable Social Security'], ['32', 'Active military pay'], ['34c', '529 and ABLE contributions'],
  ['36', 'Other subtractions'], ['37', 'Income after subtractions'], ['38', 'Age 65 or over ($2,100 each)'], ['39', 'Blind ($1,500 each)'],
  ['40', 'Other exemptions ($2,300 each)'], ['41', 'Qualifying parents and grandparents ($10,000 each)'], ['42', 'Arizona adjusted gross income'],
  ['43', 'Deduction'], ['44', 'Charitable increase to the standard deduction'], ['45', 'Arizona taxable income'], ['46', 'Tax (2.5%)'],
  ['49', 'Dependent Tax Credit'], ['50', 'Family Income Tax Credit'], ['51', 'Form 301 credits'], ['52', 'Tax after credits'],
  ['53', 'Arizona tax withheld'], ['54c', 'Estimated payments'], ['55', 'Extension payment'], ['56', 'Increased Excise Tax Credit'],
  ['58', 'Other refundable credits'], ['59', 'Total payments and refundable credits'], ['62', 'Applied to 2026'], ['78', 'Voluntary gifts'],
  ['79', 'Refund'], ['80', 'Amount you owe']
]
const ALWAYS = new Set(['12', '42', '43', '45', '46', '52', '59'])
const KEY = new Set(['45', '52', '79', '80'])
const DONATIONS: Record<string, string> = {
  '64': 'Solutions Teams Assigned to Schools', '65': 'Arizona Wildlife', '66': 'Child Abuse Prevention', '67': 'Domestic Violence Services',
  '68': 'Political Gift', '69': 'Neighbors Helping Neighbors', '70': 'Special Olympics', '71': 'Veterans’ Donations Fund',
  '72': 'I Didn’t Pay Enough Fund', '73': 'Sustainable State Parks and Roads', '74': 'Spay/Neuter of Animals'
}
const firstName = (p: Person, fallback: string): string => p.firstName.trim().split(/\s+/)[0] || fallback

export function ArizonaStep({ ret, set, result, preparer }: StepProps & { preparer: PreparerInfo | null }): ReactElement {
  const d = ret.az
  const az = useMemo(() => computeArizona(ret, result), [ret, result])
  const [pdf, setPdf] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' })
  const put = (p: Partial<AzInput>): void => set((r) => ({ ...r, az: { ...r.az, ...p } }))
  const putPtc = (p: Partial<AzInput['ptc']>): void => put({ ptc: { ...d.ptc, ...p } })
  const joint = az.status === 'mfj'
  const owners: Owner[] = joint ? ['taxpayer', 'spouse'] : ['taxpayer']
  const names: Record<Owner, string> = { taxpayer: firstName(ret.taxpayer, 'You'), spouse: firstName(ret.spouse, 'Spouse') }
  const packet = buildAzPacket(ret, result, az, preparer)
  const L = az.lines
  const owes = L['80'] > 0
  const w2s = ret.w2s.filter((w) => owners.includes(w.owner))
  const makePdf = (): void => {
    setPdf({ busy: true, note: '' })
    import('../pdf/download.ts')
      .then(({ downloadArizonaForms }) => downloadArizonaForms(ret, result, az, preparer))
      .then(({ pages, problems }) => setPdf({ busy: false, note: `Downloaded ${pages} pages.${problems ? ` ${problems} field(s) could not be filled; check the PDF before filing.` : ''}` }))
      .catch((e: unknown) => setPdf({ busy: false, note: `The PDF could not be created: ${e instanceof Error ? e.message : String(e)}` }))
  }
  return (
    <div className="virginia">
      <div className={`va-result ${owes ? 'is-owed' : 'is-refund'}`} aria-live="polite">
        <div>
          <p className="va-result-label">{owes ? 'Arizona: you owe' : 'Arizona refund'}</p>
          <p className="va-result-amount">{usd(owes ? L['80'] : L['79'])}</p>
        </div>
        <dl>
          <div><dt>Arizona AGI</dt><dd>{usd(L['42'])}</dd></div>
          <div><dt>Taxable income</dt><dd>{usd(L['45'])}</dd></div>
          <div><dt>Tax after credits</dt><dd>{usd(L['52'])}</dd></div>
        </dl>
      </div>

      <Section title="Arizona return" intro={`Arizona taxes income at a flat 2.5% after a ${usd(az.deduction.standard)} standard deduction (or itemized deductions). Social Security and interest on U.S. bonds are not taxed.`}>
        <div className="grid">
          <NumberField label="Qualifying parents and grandparents" hint="Lived with you and you paid over half their care; $10,000 each (box 11a)" max={9} value={d.qualifyingParents} onChange={(n) => put({ qualifyingParents: n })} />
          <NumberField label="Other exemptions" hint="People 65+ you support who aren’t your dependents, or a stillborn child; $2,300 each (box 40E)" max={9} value={d.otherExemptions} onChange={(n) => put({ otherExemptions: n })} />
        </div>
        {ret.filingStatus === 'mfs' && (
          <div className="checks"><Check label="My spouse itemizes on their Arizona return" hint="Then you must itemize too" checked={d.spouseItemizes} onChange={(on) => put({ spouseItemizes: on })} /></div>
        )}
        <p className="why">{az.counts.under17 + az.counts.over17 > 0
          ? `Dependent Tax Credit: ${az.counts.under17} under 17 ($100 each) and ${az.counts.over17} age 17 or older ($25 each).`
          : 'No dependents for the Dependent Tax Credit.'}{ret.filingStatus === 'qss' ? ' A qualifying surviving spouse files as head of household in Arizona.' : ''}</p>
      </Section>

      <Section title="Arizona withholding and payments" intro="From the state section of each W-2 (boxes 15–17).">
        {w2s.length > 0
          ? <StatementRows kind="w2" state="Arizona" items={w2s.map((w) => ({ id: w.id, title: `${w.employer.trim() || 'W-2'} (${names[w.owner]})`, federal: w.wages }))} value={d.w2} onChange={(w2) => put({ w2 })} />
          : <p className="why">No W-2s entered.</p>}
        <div className="grid">
          <MoneyField label="Arizona tax withheld on 1099s" value={d.withholding1099} onChange={(n) => put({ withholding1099: n })} />
          <MoneyField label="2025 estimated payments" hint="Including your 2024 refund applied to 2025" value={d.estimatedPayments} onChange={(n) => put({ estimatedPayments: n })} />
          <MoneyField label="Extension payment (Form 204)" value={d.extensionPayment} onChange={(n) => put({ extensionPayment: n })} />
        </div>
      </Section>

      <Section title="Income Arizona treats differently">
        <div className="grid">
          {owners.map((o) => (
            <MoneyField key={`g${o}`} label={`${names[o]}: U.S., Arizona state or local government pension`} hint="Up to $2,500 is not taxed" value={d.governmentPension[o]} onChange={(n) => put({ governmentPension: { ...d.governmentPension, [o]: n } })} />
          ))}
          {owners.map((o) => (
            <MoneyField key={`m${o}`} label={`${names[o]}: military retired or retainer pay`} hint="Fully subtracted" value={d.militaryRetirement[o]} onChange={(n) => put({ militaryRetirement: { ...d.militaryRetirement, [o]: n } })} />
          ))}
          <MoneyField label="Active-duty, reserve or National Guard pay" value={d.activeMilitaryPay} onChange={(n) => put({ activeMilitaryPay: n })} />
          <MoneyField label="Interest on U.S. obligations" hint="Savings bonds, Treasury bills and notes" value={d.usObligationInterest} onChange={(n) => put({ usObligationInterest: n })} />
          <MoneyField label="Interest on other states’ municipal bonds" hint="Taxed in Arizona" value={d.otherStateBondInterest} onChange={(n) => put({ otherStateBondInterest: n })} />
          {L['22'] > 0 && <MoneyField label="Net long-term gain on assets bought after 2011" hint="25% of it is subtracted; leave out assets with unknown purchase dates" value={d.ltcgAfter2011 ?? 0} onChange={(n) => put({ ltcgAfter2011: n })} />}
          <MoneyField label="529 college savings contributions" hint="Up to $2,000 per beneficiary ($4,000 joint)" value={d.contributions529} onChange={(n) => put({ contributions529: n })} />
          <MoneyField label="ABLE account contributions" value={d.contributionsAble} onChange={(n) => put({ contributionsAble: n })} />
          {d.contributions529 + d.contributionsAble > 0 && <NumberField label="Beneficiaries of those contributions" max={20} value={d.beneficiaries} onChange={(n) => put({ beneficiaries: n })} />}
          <MoneyField label="Other additions (page 5)" value={d.otherAdditions} onChange={(n) => put({ otherAdditions: n })} />
          <MoneyField label="Other subtractions (page 6)" hint="For example long-term care premiums or adoption expenses" value={d.otherSubtractions} onChange={(n) => put({ otherSubtractions: n })} />
        </div>
      </Section>

      <Section title="Deduction" intro="Arizona uses the larger of your itemized deductions or the standard deduction plus 34% of your charitable gifts.">
        <div className="grid">
          {az.deduction.itemized > 0 && <MoneyField label="Itemized deduction adjustments" hint="Arizona Schedule A: amounts that lower your federal itemized deductions" value={d.itemizedAdjustment} onChange={(n) => put({ itemizedAdjustment: n })} />}
          <MoneyField label="Gifts claimed for an Arizona tax credit" hint="Gifts to qualifying charities or school tuition organizations used for a credit (worksheet line 5C)" value={d.charityCreditGifts} onChange={(n) => put({ charityCreditGifts: n })} />
          <MoneyField label="Charitable carryover from prior years" value={d.charityCarryover} onChange={(n) => put({ charityCarryover: n })} />
        </div>
        <p className="why">{az.deduction.method === 'itemized'
          ? `Itemizing: ${usd(L['43'])} (standard would be ${usd(az.deduction.standard)} plus ${usd(az.charity['7C'])} for gifts).`
          : `Standard deduction ${usd(L['43'])}${L['44'] > 0 ? ` plus ${usd(L['44'])} (34% of your charitable gifts, page 3)` : ''}. Charitable gifts are taken from your federal itemized deductions entries.`}</p>
      </Section>

      <Section title="Credits and refund">
        <div className="grid">
          <MoneyField label="Nonrefundable credits from Form 301" hint="School tuition, charitable, public school and other credits" value={d.nonrefundableCredits} onChange={(n) => put({ nonrefundableCredits: n })} />
          <MoneyField label="Other refundable credits" hint="Forms 308-I, 334 or 349" value={d.refundableCredits} onChange={(n) => put({ refundableCredits: n })} />
          {L['61'] > 0 && <MoneyField label="Apply to 2026 estimated tax" value={d.creditForward} onChange={(n) => put({ creditForward: n })} />}
        </div>
        <p className="why">
          {L['50'] > 0 ? `Family Income Tax Credit: ${usd(L['50'])}. ` : ''}
          {L['56'] > 0 ? `Increased Excise Tax Credit: ${usd(L['56'])}. ` : ''}
          {L['49'] > 0 ? `Dependent Tax Credit: ${usd(L['49'])}.` : ''}
        </p>
        <details className="more">
          <summary>Voluntary gifts (lines 64–74)</summary>
          <div className="grid">
            {AZ_DONATION_LINES.map((k) => (
              <MoneyField key={k} label={DONATIONS[k]} value={d.donations[k] ?? 0} onChange={(n) => put({ donations: { ...d.donations, [k]: n } })} />
            ))}
            {(d.donations['68'] ?? 0) > 0 && (
              <div className="field">
                <label htmlFor="az-party"><span>Political party for the gift</span></label>
                <select id="az-party" className="select" value={d.politicalParty} onChange={(e) => put({ politicalParty: e.target.value as AzInput['politicalParty'] })}>
                  <option value="">Choose</option><option value="Democratic">Democratic</option><option value="Libertarian">Libertarian</option><option value="Republican">Republican</option>
                </select>
              </div>
            )}
          </div>
        </details>
      </Section>

      <Section title="Property tax refund (Form 140PTC)" intro="A separate claim for residents 65 or older or receiving Title 16 SSI, with very low household income (up to $3,750 living alone, $5,500 with others). It also figures the increased excise tax credit, so line 56 of Form 140 is left blank when you file it.">
        <Check label="File Form 140PTC" checked={d.ptc.claim} onChange={(on) => putPtc({ claim: on })} />
        {d.ptc.claim && (
          <>
            <div className="grid">
              <TextField label="Your date of birth" hint="Box 79" placeholder="MM/DD/YYYY" autoComplete="off" value={d.ptc.birthDate} onChange={(s) => putPtc({ birthDate: s.replace(/[^\d/]/g, '').slice(0, 10) })} />
              <MoneyField label="Property taxes you paid in 2025" hint="Line 12, if you owned your home" value={d.ptc.propertyTax} onChange={(n) => putPtc({ propertyTax: n })} />
              <MoneyField label="Property tax paid by your landlord on your rent" hint="Line 13, from Form 201" value={d.ptc.landlordTax} onChange={(n) => putPtc({ landlordTax: n })} />
              <MoneyField label="Income of other people in your household" hint="Part 1, column 3" value={d.ptc.otherPersonsIncome} onChange={(n) => putPtc({ otherPersonsIncome: n })} />
              <TextField label="Who claims you as a dependent" hint="Line 16; leave blank if no one" autoComplete="off" value={d.ptc.claimedByName} onChange={(s) => putPtc({ claimedByName: s })} />
              {d.ptc.claimedByName.trim() && <TextField label="Their SSN" autoComplete="off" value={d.ptc.claimedBySsn} onChange={(s) => putPtc({ claimedBySsn: s.replace(/[^\d-]/g, '').slice(0, 11) })} />}
              {d.ptc.claimedByName.trim() && <TextField label="Their address" autoComplete="off" value={d.ptc.claimedByAddress} onChange={(s) => putPtc({ claimedByAddress: s })} />}
            </div>
            <div className="checks">
              <Check label="I owned my home on December 31, 2025 (not renting)" checked={d.ptc.own} onChange={(on) => putPtc({ own: on })} />
              <Check label="I lived alone" checked={d.ptc.livedAlone} onChange={(on) => putPtc({ livedAlone: on })} />
              <Check label="I received Title 16 SSI payments in 2025" checked={d.ptc.ssi} onChange={(on) => putPtc({ ssi: on })} />
            </div>
            {az.ptc && <p className="why">Household income {usd(az.ptc.J)}: credit {usd(az.ptc.lines['15'])} plus excise tax credit {usd(az.ptc.lines['17'])} = {usd(az.ptc.lines['19'])} (line 19).</p>}
          </>
        )}
      </Section>

      {az.issues.length > 0 && (
        <Section title="Things to look at">
          <ul className="issues">{az.issues.map((t) => <li key={t} className="issue is-warning"><span className="issue-kind">Check</span><span>{t}</span></li>)}</ul>
        </Section>
      )}

      <Section title="Form 140" intro="Whole dollars.">
        <table className="lines"><tbody>
          {LINES.filter(([k]) => ALWAYS.has(k) || (L[k] ?? 0) !== 0).map(([k, label]) => (
            <tr key={k} className={KEY.has(k) ? 'is-key' : ''}><th scope="row"><span className="line-no">{k}</span>{label}</th><td>{usd(L[k] ?? 0)}</td></tr>
          ))}
        </tbody></table>
      </Section>

      <Section title="Arizona forms" intro="Filled in on this device from the official Arizona Department of Revenue PDF.">
        <ul className="form-list">{packet.forms.map((f) => <li key={f.id}>{f.title}</li>)}</ul>
        {packet.notIncluded.length > 0 && (
          <div className="note is-warn"><strong>Finish or attach these yourself.</strong><ul>{packet.notIncluded.map((n) => <li key={n}>{n}</li>)}</ul></div>
        )}
        <div className="actions"><button type="button" className="button" onClick={makePdf} disabled={pdf.busy}>{pdf.busy ? 'Preparing PDF…' : 'Download Arizona forms (PDF)'}</button></div>
        {pdf.note && <p className="note" role="status">{pdf.note}</p>}
        <p className="why">Sign page 2 and mail without staples: with a payment to PO Box 52016, otherwise to PO Box 52138, Phoenix AZ. Due April 15, 2026.</p>
      </Section>
    </div>
  )
}
