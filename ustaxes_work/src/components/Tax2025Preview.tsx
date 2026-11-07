import { ReactElement, useState } from 'react'
import { Box, Button, FormControl, InputLabel, MenuItem, Paper, Select, TextField, Typography } from '@material-ui/core'
import { FilingStatus2025, filingStatuses2025 } from '../nextgen/taxYears/preview2025'
import { Interest1099Entry2025, W2Entry2025, preview2025Income } from '../nextgen/taxYears/income2025'
import { create2025Form1040Worksheet, Form1040Worksheet2025 } from '../nextgen/taxYears/form1040Worksheet2025'
import { makeRestricted2025Draft } from '../nextgen/taxYears/form1040Draft2025'
import { reconstruct2025TaxTableBand } from '../nextgen/taxYears/irsTaxTable2025'
import { build2025Form1040Review, Form1040PipelineResult2025 } from '../nextgen/taxYears/form1040Pipeline2025'
import { get2025ReviewChecklist } from '../nextgen/taxYears/form1040ReviewChecklist2025'

const money = (value: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)

interface DraftEntry {
  id: string
  name: string
  amount: string
  withholding: string
}

let nextId = 1
const newEntry = (): DraftEntry => ({ id: `preview-${nextId++}`, name: '', amount: '0', withholding: '0' })
const parseAmount = (raw: string): number => raw.trim() === '' ? NaN : Number(raw)

/** Educational-only preview; never enter real taxpayer names, SSNs, or other personal data. */
export default function Tax2025Preview(): ReactElement {
  const [status, setStatus] = useState<FilingStatus2025>('single')
  const [ordinaryConfirmed, setOrdinaryConfirmed] = useState(false)
  const [specialExcluded, setSpecialExcluded] = useState(false)
  const [w2s, setW2s] = useState<DraftEntry[]>([{ id: 'w2-0', name: '', amount: '75000', withholding: '9000' }])
  const [interests, setInterests] = useState<DraftEntry[]>([])
  const [schedule1Reviewed, setSchedule1Reviewed] = useState(false)
  const [schedule1AReviewed, setSchedule1AReviewed] = useState(false)
  const [other1099Reviewed, setOther1099Reviewed] = useState(false)
  const [otherWithholdingReviewed, setOtherWithholdingReviewed] = useState(false)
  const [other1099Amount, setOther1099Amount] = useState('0')
  const [otherWithholdingAmount, setOtherWithholdingAmount] = useState('0')

  const update = (entries: DraftEntry[], setter: (value: DraftEntry[]) => void, id: string, key: keyof DraftEntry, value: string) =>
    setter(entries.map((entry) => entry.id === id ? { ...entry, [key]: value } : entry))

  const amounts = [...w2s, ...interests].flatMap((entry) => [parseAmount(entry.amount), parseAmount(entry.withholding)])
  const valid = amounts.every((value) => Number.isFinite(value) && value >= 0 && value <= 1e10 &&
    Math.abs(value * 100 - Math.round(value * 100)) < 1e-6) &&
    w2s.length <= 100 && interests.length <= 100 &&
    amounts.reduce((sum, value) => sum + value, 0) <= 1e12

  let result: ReturnType<typeof preview2025Income> | null = null
  let worksheet: Form1040Worksheet2025 | null = null
  let restrictedDraft: ReturnType<typeof makeRestricted2025Draft> | null = null
  let integratedReview: Form1040PipelineResult2025 | null = null
  let integrationError: string | null = null
  const extraAmountsValid = [other1099Amount, otherWithholdingAmount].every(raw => {
    const amount = parseAmount(raw)
    return Number.isFinite(amount) && amount >= 0 && amount <= 1e10 &&
      Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-6
  })
  if (valid) {
    const wageEntries: W2Entry2025[] = w2s.map((entry) => ({
      id: entry.id, employer: entry.name, box1Wages: parseAmount(entry.amount),
      box2FederalWithholding: parseAmount(entry.withholding),
    }))
    const interestEntries: Interest1099Entry2025[] = interests.map((entry) => ({
      id: entry.id, payer: entry.name, box1TaxableInterest: parseAmount(entry.amount),
      federalWithholding: parseAmount(entry.withholding),
    }))
    result = preview2025Income(wageEntries, interestEntries, status)
    worksheet = create2025Form1040Worksheet(wageEntries, interestEntries, status)
    restrictedDraft = makeRestricted2025Draft(wageEntries, interestEntries, status, ordinaryConfirmed, specialExcluded)
    if (extraAmountsValid) {
      try {
        integratedReview = build2025Form1040Review({
          w2: wageEntries, interest1099: interestEntries, filingStatus: status,
          ordinaryMethodConfirmed: ordinaryConfirmed, specialMethodNotRequiredConfirmed: specialExcluded,
          schedule1: schedule1Reviewed ? [] : undefined,
          schedule1A: schedule1AReviewed ? [] : undefined,
          other1099Withholding: other1099Reviewed ? parseAmount(other1099Amount) : undefined,
          otherWithholding: otherWithholdingReviewed ? parseAmount(otherWithholdingAmount) : undefined,
        })
      } catch (error) { integrationError = error instanceof Error ? error.message : String(error) }
    }
  }

  const section = (heading: string, entries: DraftEntry[], setter: (value: DraftEntry[]) => void,
    amountLabel: string): ReactElement => (
    <Box style={{ marginTop: 18 }}>
      <Typography variant="subtitle1">{heading}</Typography>
      {entries.map((entry, index) => (
        <Box key={entry.id} display="flex" flexWrap="wrap" alignItems="center" style={{ gap: 8, marginBottom: 10 }}>
          <TextField label={`Source ${index + 1} (fictional label)`} variant="outlined" size="small"
            value={entry.name} onChange={(event) => update(entries, setter, entry.id, 'name', event.target.value)} />
          <TextField label={amountLabel} variant="outlined" size="small" type="number"
            value={entry.amount} onChange={(event) => update(entries, setter, entry.id, 'amount', event.target.value)}
            inputProps={{ min: 0, step: '0.01' }} />
          <TextField label="Federal withholding ($)" variant="outlined" size="small" type="number"
            value={entry.withholding} onChange={(event) => update(entries, setter, entry.id, 'withholding', event.target.value)}
            inputProps={{ min: 0, step: '0.01' }} />
          <Button size="small" onClick={() => setter(entries.filter((item) => item.id !== entry.id))}>Remove</Button>
        </Box>
      ))}
      <Button size="small" variant="outlined" disabled={entries.length >= 100}
        onClick={() => setter([...entries, newEntry()])}>Add {heading}</Button>
    </Box>
  )

  return (
    <Paper variant="outlined" style={{ padding: 20, marginBottom: 20 }}>
      <Typography variant="h6" component="h2" gutterBottom>2025 W-2 + 1099-INT — Educational Income Preview</Typography>
      <Typography variant="body2" paragraph>
        Enter fictional amounts only. This illustrative calculation combines W-2 box 1 wages and
        taxable 1099-INT box 1 interest, subtracts the basic standard deduction, and applies
        ordinary tax brackets. It excludes IRS tax tables, adjustments, credits, capital gains,
        additional taxes, schedules, and special rules. It is NOT Form 1040, a tax liability,
        or a refund estimate. No data is submitted by this preview.
      </Typography>
      <FormControl variant="outlined" style={{ minWidth: 245 }}>
        <InputLabel id="nextgen-status-label">Filing status</InputLabel>
        <Select labelId="nextgen-status-label" label="Filing status" value={status}
          onChange={(event) => setStatus(event.target.value as FilingStatus2025)}>
          {filingStatuses2025.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
        </Select>
      </FormControl>
      {section('W-2', w2s, setW2s, 'Box 1 wages ($)')}
      {section('1099-INT', interests, setInterests, 'Box 1 taxable interest ($)')}
      {!valid && <Typography color="error">Enter nonnegative dollar amounts with at most two decimal places (maximum $10 billion per field).</Typography>}
      <Box style={{ marginTop: 20, padding: 14, border: '1px solid #bbb' }}>
        <Typography variant="h6">Integrated 2025 review — experimental</Typography>
        <Typography variant="body2" paragraph>
          This panel connects the W-2 and 1099-INT inputs to the Form 1040 review pipeline.
          Check a category only after confirming it is absent in this fictional example.
          Schedule 1 entries cannot be entered here; marking it reviewed means there are none.
          Do not enter personal information or rely on these figures for filing.
        </Typography>
        <label style={{ display: 'block', marginBottom: 8 }}>
          <input type="checkbox" checked={schedule1Reviewed} onChange={event => setSchedule1Reviewed(event.target.checked)} />
          {' '}Fictional example has no Schedule 1 income or adjustments
        </label>
        <label style={{ display: 'block', marginBottom: 8 }}>
          <input type="checkbox" checked={schedule1AReviewed} onChange={event => setSchedule1AReviewed(event.target.checked)} />
          {' '}Fictional example has no Schedule 1-A deduction candidates (tips, overtime, auto loan interest, senior deduction)
        </label>
        <label style={{ display: 'block', marginBottom: 8 }}>
          <input type="checkbox" checked={other1099Reviewed} onChange={event => setOther1099Reviewed(event.target.checked)} />
          {' '}Other Form 1099 withholding has been reviewed
        </label>
        <TextField label="Other 1099 withholding ($)" size="small" variant="outlined" type="number"
          disabled={!other1099Reviewed} value={other1099Amount} onChange={event => setOther1099Amount(event.target.value)}
          inputProps={{ min: 0, step: '0.01' }} />
        <label style={{ display: 'block', marginTop: 12, marginBottom: 8 }}>
          <input type="checkbox" checked={otherWithholdingReviewed} onChange={event => setOtherWithholdingReviewed(event.target.checked)} />
          {' '}Other withholding has been reviewed
        </label>
        <TextField label="Other withholding ($)" size="small" variant="outlined" type="number"
          disabled={!otherWithholdingReviewed} value={otherWithholdingAmount}
          onChange={event => setOtherWithholdingAmount(event.target.value)} inputProps={{ min: 0, step: '0.01' }} />
        {!extraAmountsValid && <Typography color="error">Additional withholding must be valid nonnegative dollar amounts.</Typography>}
        {integrationError && <Typography color="error">Review error: {integrationError}</Typography>}
        {integratedReview && <Box style={{ marginTop: 14 }} aria-live="polite">
          <Typography variant="subtitle1">Review status: NOT READY FOR FILING</Typography>
          {integratedReview.withholding && <Typography variant="body2">
            Document withholding, line 25d: {money(integratedReview.withholding.line25dWithholding)}
          </Typography>}
          <Box style={{ marginTop: 12 }}>
            <Typography variant="subtitle2">2025 Form 1040 review checklist</Typography>
            <ul aria-label="Form 1040 review checklist">
              {get2025ReviewChecklist(integratedReview).map(check => (
                <li key={check.id}>
                  <Typography variant="body2" color={check.status === 'blocked' ? 'error' : 'initial'}>
                    <strong>{check.status === 'blocked' ? 'Blocked' : 'Reviewed'}:</strong> {check.label}
                    {' — '}{check.explanation}
                  </Typography>
                </li>
              ))}
            </ul>
          </Box>
          <Typography variant="body2">Open issues ({integratedReview.blockers.length}):</Typography>
          <ul>{integratedReview.blockers.map((issue, index) => <li key={index}><Typography variant="body2">{issue}</Typography></li>)}</ul>
        </Box>}
      </Box>
      {result && (
        <Box aria-live="polite" style={{ marginTop: 18 }}>
          <Typography variant="body2">Total W-2 wages: <strong>{money(result.wages)}</strong></Typography>
          <Typography variant="body2">Total 1099-INT taxable interest: <strong>{money(result.taxableInterest)}</strong></Typography>
          <Typography variant="body2">Combined illustrative ordinary income: <strong>{money(result.totalOrdinaryIncome)}</strong></Typography>
          <Typography variant="body2">Basic standard deduction: <strong>{money(result.standardDeduction)}</strong></Typography>
          <Typography variant="body2">Illustrative taxable income: <strong>{money(result.illustrativeTaxableIncome)}</strong></Typography>
          <Typography variant="body2">Federal tax withheld (input total): <strong>{money(result.federalWithholding)}</strong></Typography>
          <Typography variant="subtitle1">Illustrative bracket tax: {money(result.illustrativeBracketTax)}</Typography>
          <Typography variant="body2">Withholding minus illustrative bracket tax: {money(result.illustrativeWithholdingMinusBracketTax)}</Typography>
          <Typography variant="caption" color="error" component="div">
            This difference is NOT a refund or amount due. Filing is disabled for 2025.
          </Typography>
          {worksheet && (
            <Box style={{ marginTop: 20, paddingTop: 12, borderTop: '1px solid #ddd' }}>
              <Typography variant="h6" component="h3">2025 Form 1040 — Educational Line Worksheet</Typography>
              <Typography variant="body2" paragraph>
                This is a line-inspired learning aid, not a completed IRS Form 1040. Assumes zero
                income adjustments and only the basic standard deduction. It excludes the IRS tax
                table, special deductions, credits, schedules and other tax rules. Do not file it.
              </Typography>
              {([
                ['1a · W-2 wages', worksheet.line1aW2Wages],
                ['2b · Taxable interest', worksheet.line2bTaxableInterest],
                ['9 · Illustrative total income', worksheet.line9IllustrativeTotalIncome],
                ['11 · Illustrative AGI (zero adjustments assumed)', worksheet.line11IllustrativeAdjustedGrossIncome],
                ['12 · Basic standard deduction only', worksheet.line12BasicStandardDeduction],
                ['15 · Illustrative taxable income', worksheet.line15IllustrativeTaxableIncome],
                ['16 · Illustrative bracket tax (NOT IRS tax-table result)', worksheet.line16IllustrativeBracketTax],
                ['25a · W-2 federal withholding', worksheet.line25aW2Withholding],
                ['25b · 1099-INT federal withholding', worksheet.line25b1099InterestWithholding],
                ['25d · Illustrative total withholding', worksheet.line25dIllustrativeTotalWithholding],
              ] as Array<[string, number]>).map(([label, value]) => (
                <Box key={label} display="flex" justifyContent="space-between" flexWrap="wrap" style={{ gap: 12, marginBottom: 6 }}>
                  <Typography variant="body2">{label}</Typography>
                  <Typography variant="body2"><strong>{money(value)}</strong></Typography>
                </Box>
              ))}
              <Box style={{ marginTop: 12, padding: 12, border: '1px solid #bbb' }}>
                <Typography variant="subtitle1">2025 IRS line 16 — restricted method decision</Typography>
                <Typography variant="body2" paragraph>
                  These checkboxes are for synthetic test cases only. They do not validate a real return.
                  Unless both conditions are independently established, the IRS calculation stays blocked.
                </Typography>
                <label style={{ display: 'block', marginBottom: 8 }}>
                  <input type="checkbox" checked={ordinaryConfirmed}
                    onChange={(event) => setOrdinaryConfirmed(event.target.checked)} />
                  {' '}For this fictional scenario, ordinary-income method applies.
                </label>
                <label style={{ display: 'block', marginBottom: 8 }}>
                  <input type="checkbox" checked={specialExcluded}
                    onChange={(event) => setSpecialExcluded(event.target.checked)} />
                  {' '}For this fictional scenario, no special tax worksheet is required.
                </label>
                {restrictedDraft && (
                  <Typography variant="body2" color={restrictedDraft.line16.kind === 'blocked' ? 'error' : 'initial'}>
                    {restrictedDraft.line16.kind === 'blocked'
                      ? 'Blocked: ' + restrictedDraft.line16.reason
                      : 'IRS method reference, line 16: ' + money(restrictedDraft.line16.tax) +
                        ' (' + restrictedDraft.line16.kind + '). NOT an approved return.'}
                  </Typography>
                )}
                <Typography variant="caption" component="div" color="error">
                  Other Form 1040 lines, credits, additional taxes, refund and filing remain unsupported.
                </Typography>
              </Box>
              {worksheet.line15IllustrativeTaxableIncome < 100000 && (
                <Box style={{ marginTop: 12, padding: 12, border: '1px solid #bbb' }}>
                  <Typography variant="subtitle1">2025 Tax Table — provisional research comparison</Typography>
                  {(() => {
                    const table = reconstruct2025TaxTableBand(worksheet.line15IllustrativeTaxableIncome, status)
                    return <Typography variant="body2">
                      Table income band: {money(table.lowerBound)} to under {money(table.upperBound)}.
                      {' '}Reconstructed midpoint tax: {money(table.provisionalTax)}.
                      {' '}This is NOT an audited IRS table entry and must not be used as Form 1040 line 16.
                    </Typography>
                  })()}
                </Box>
              )}
              <Typography variant="caption" color="error" component="div" style={{ marginTop: 12 }}>
                Educational worksheet only. No PDF export, e-filing, refund estimate, or filing readiness.
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </Paper>
  )
}
