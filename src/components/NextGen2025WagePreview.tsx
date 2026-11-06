import { ReactElement, useState } from 'react'
import { Alert } from '@material-ui/lab'
import { Paper, TextField, Typography, MenuItem, Table, TableBody, TableRow, TableCell, FormControlLabel, Checkbox } from '@material-ui/core'
import { filingStatuses2025, FilingStatus2025, preview2025OrdinaryWages } from '../nextgen/taxYears/preview2025'
import { decide2025Line16 } from '../nextgen/taxYears/irsLine16Decision2025'
import NextGen2025CreditsAndOvertime from './NextGen2025CreditsAndOvertime'
import { parseWageInput2025 } from '../nextgen/taxYears/wageInput2025'

/** Live, deliberately limited illustration: not an input to the Form 1040 reconciliation. */
export default function NextGen2025WagePreview(): ReactElement {
  const [wages, setWages] = useState('')
  const [ordinaryConfirmed, setOrdinaryConfirmed] = useState(false)
  const [specialRuledOut, setSpecialRuledOut] = useState(false)
  const [status, setStatus] = useState<FilingStatus2025>('single')
  const parsedWages = parseWageInput2025(wages)
  const valid = parsedWages !== null
  const result = parsedWages !== null ? preview2025OrdinaryWages(parsedWages, status) : null
  const resetMethodConfirmation = (): void => {
    setOrdinaryConfirmed(false)
    setSpecialRuledOut(false)
  }
  const line16 = result ? decide2025Line16({ taxableIncome: result.taxableOrdinaryIncome, status, ordinaryIncomeMethodApplicable: ordinaryConfirmed, specialTaxWorksheetRequired: specialRuledOut ? false : undefined }) : null
  const usd = (value: number) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  return <Paper style={{ padding: 16, marginTop: 20 }}>
    <Typography variant="h6" gutterBottom>2025 wages-only illustration — live calculator</Typography>
    <Alert severity="warning">NOT FILING READY. Illustrative bracket calculation only. The bracket illustration is not IRS Tax Table line 16; a separate restricted IRS table diagnostic appears below. Neither is a Form 1040 return or refund estimate. No values are saved or sent.</Alert>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 16 }}>
      <TextField label="Annual W-2 wages (USD)" variant="outlined" value={wages} onChange={e => { setWages(e.target.value); resetMethodConfirmation() }} inputProps={{ 'aria-label': 'Annual W-2 wages' }} helperText={wages && !valid ? 'Enter a nonnegative amount with at most two decimals.' : 'Illustration assumes no other income or adjustments.'} error={!!wages && !valid} />
      <TextField select label="Filing status" variant="outlined" value={status} onChange={e => { setStatus(e.target.value as FilingStatus2025); resetMethodConfirmation() }} style={{ minWidth: 230 }}>
        {filingStatuses2025.map(s => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
      </TextField>
    </div>
    {result ? <Table size="small" aria-label="Illustrative 2025 wage calculation" style={{ marginTop: 16 }}><TableBody>
      <TableRow><TableCell>Gross wages</TableCell><TableCell align="right">{usd(result.grossWages)}</TableCell></TableRow>
      <TableRow><TableCell>Base standard deduction (illustrative)</TableCell><TableCell align="right">{usd(result.standardDeduction)}</TableCell></TableRow>
      <TableRow><TableCell>Illustrative taxable ordinary income</TableCell><TableCell align="right">{usd(result.taxableOrdinaryIncome)}</TableCell></TableRow>
      <TableRow><TableCell>Illustrative bracket tax (NOT line 16)</TableCell><TableCell align="right">{usd(result.illustrativeBracketTax)}</TableCell></TableRow>
    </TableBody></Table> : <Typography style={{ marginTop: 12 }}>Enter wages to see an illustrative calculation.</Typography>}
    <Typography variant="h6" style={{ marginTop: 20 }}>IRS 2025 line 16 — restricted tax-table diagnostic</Typography>
    <Alert severity="info">For wages-only examples, explicitly confirm both conditions before looking up the imported IRS Tax Table. Confirmations reset whenever wages or filing status changes. Confirmation does not establish eligibility or filing readiness.</Alert>
    <FormControlLabel control={<Checkbox checked={ordinaryConfirmed} onChange={e => setOrdinaryConfirmed(e.target.checked)} />} label="I verified that the ordinary-income tax method applies" />
    <FormControlLabel control={<Checkbox checked={specialRuledOut} onChange={e => setSpecialRuledOut(e.target.checked)} />} label="I ruled out special tax worksheets (qualified dividends, capital gains, Form 8615, etc.)" />
    {line16 && line16.kind === 'blocked' ? <Alert severity="warning">Line 16 blocked: {line16.reason}</Alert> : null}
    {line16 && line16.kind !== 'blocked' ? <Paper variant="outlined" style={{ padding: 12, marginTop: 8 }}><Typography>Provisional IRS line 16 candidate: <strong>{usd(line16.tax)}</strong></Typography><Typography variant="body2">Method: {line16.kind}. Source: {line16.source}. NOT FILING READY.</Typography></Paper> : null}
    <Typography variant="body2" style={{ marginTop: 12 }}>Does not include age-related deductions, Schedule 1-A, credits, withholding, capital gains, alternative tax calculations, or other IRS requirements.</Typography>
    <NextGen2025CreditsAndOvertime status={status} wages={result ? result.grossWages : null} line16Tax={line16 && line16.kind !== 'blocked' ? line16.tax : null} />
  </Paper>
}
