import { ReactElement, useState } from 'react'
import { Alert } from '@material-ui/lab'
import { Paper, TextField, Typography, MenuItem, Table, TableBody, TableRow, TableCell, FormControlLabel, Checkbox } from '@material-ui/core'
import { filingStatuses2025, FilingStatus2025 } from '../nextgen/taxYears/preview2025'
import { calculateLivePreviewScenario2025, LivePreviewScenario2025, updateLivePreviewScenario2025 } from '../nextgen/taxYears/livePreviewScenario2025'
import NextGen2025CreditsAndOvertime from './NextGen2025CreditsAndOvertime'
import { getWageInputFeedback2025 } from '../nextgen/taxYears/wageInput2025'

/** Live, deliberately limited illustration: not an input to the Form 1040 reconciliation. */
export default function NextGen2025WagePreview(): ReactElement {
  const [scenario, setScenario] = useState<LivePreviewScenario2025>({
    wages: '', status: 'single', ordinaryConfirmed: false, specialRuledOut: false,
  })
  const { wages, status, ordinaryConfirmed, specialRuledOut } = scenario
  const { result, line16 } = calculateLivePreviewScenario2025(scenario)
  const wageFeedback = getWageInputFeedback2025(wages)
  const update = (change: Parameters<typeof updateLivePreviewScenario2025>[1]): void => {
    setScenario(previous => updateLivePreviewScenario2025(previous, change))
  }
  const usd = (value: number) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  return <Paper style={{ padding: 16, marginTop: 20 }}>
    <Typography variant="h6" gutterBottom>2025 wages-only illustration — live calculator</Typography>
    <Alert severity="warning">NOT FILING READY. Illustrative bracket calculation only. The bracket illustration is not IRS Tax Table line 16; a separate restricted IRS table diagnostic appears below. Neither is a Form 1040 return or refund estimate. No values are saved or sent.</Alert>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 16 }}>
      <TextField label="Annual W-2 wages (USD)" variant="outlined" value={wages} onChange={e => { update({ kind: 'wages', value: e.target.value }) }} inputProps={{ 'aria-label': 'Annual W-2 wages' }} helperText={wageFeedback.message} error={wageFeedback.kind === 'invalid'} />
      <TextField select label="Filing status" variant="outlined" value={status} onChange={e => { update({ kind: 'status', value: e.target.value as FilingStatus2025 }) }} style={{ minWidth: 230 }}>
        {filingStatuses2025.map(s => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
      </TextField>
    </div>
    {wageFeedback.kind === 'invalid' ? <Alert severity="error" style={{ marginTop: 12 }} role="alert">The wage amount is invalid. Calculations and IRS line 16 candidates are withheld until the input is corrected.</Alert> : null}
    {result ? <Table size="small" aria-label="Illustrative 2025 wage calculation" style={{ marginTop: 16 }}><TableBody>
      <TableRow><TableCell>Gross wages</TableCell><TableCell align="right">{usd(result.grossWages)}</TableCell></TableRow>
      <TableRow><TableCell>Base standard deduction (illustrative)</TableCell><TableCell align="right">{usd(result.standardDeduction)}</TableCell></TableRow>
      <TableRow><TableCell>Illustrative taxable ordinary income</TableCell><TableCell align="right">{usd(result.taxableOrdinaryIncome)}</TableCell></TableRow>
      <TableRow><TableCell>Illustrative bracket tax (NOT line 16)</TableCell><TableCell align="right">{usd(result.illustrativeBracketTax)}</TableCell></TableRow>
    </TableBody></Table> : <Typography style={{ marginTop: 12 }}>{wageFeedback.kind === 'invalid' ? 'Correct the wages amount to continue.' : 'Enter wages to see an illustrative calculation.'}</Typography>}
    <Typography variant="h6" style={{ marginTop: 20 }}>IRS 2025 line 16 — restricted tax-table diagnostic</Typography>
    <Alert severity="info">For wages-only examples, explicitly confirm both conditions before looking up the imported IRS Tax Table. Confirmations reset whenever wages or filing status changes. Confirmation does not establish eligibility or filing readiness.</Alert>
    <FormControlLabel control={<Checkbox disabled={!result} checked={ordinaryConfirmed} onChange={e => update({ kind: 'ordinaryConfirmed', value: e.target.checked })} />} label="I verified that the ordinary-income tax method applies" />
    <FormControlLabel control={<Checkbox disabled={!result} checked={specialRuledOut} onChange={e => update({ kind: 'specialRuledOut', value: e.target.checked })} />} label="I ruled out special tax worksheets (qualified dividends, capital gains, Form 8615, etc.)" />
    {line16 && line16.kind === 'blocked' ? <Alert severity="warning">Line 16 blocked: {line16.reason}</Alert> : null}
    {line16 && line16.kind !== 'blocked' ? <Paper variant="outlined" style={{ padding: 12, marginTop: 8 }}><Typography>Provisional IRS line 16 candidate: <strong>{usd(line16.tax)}</strong></Typography><Typography variant="body2">Method: {line16.kind}. Source: {line16.source}. NOT FILING READY.</Typography></Paper> : null}
    <Typography variant="body2" style={{ marginTop: 12 }}>Does not include age-related deductions, Schedule 1-A, credits, withholding, capital gains, alternative tax calculations, or other IRS requirements.</Typography>
    <NextGen2025CreditsAndOvertime status={status} wages={result ? result.grossWages : null} line16Tax={line16 && line16.kind !== 'blocked' ? line16.tax : null} />
  </Paper>
}
