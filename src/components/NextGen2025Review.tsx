import { ReactElement, useState } from 'react'
import { Alert } from '@material-ui/lab'
import { Button, Paper, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@material-ui/core'
import NextGen2025WagePreview from './NextGen2025WagePreview'
import { presentRestricted2025Review, ReviewPresentation2025 } from '../nextgen/taxYears/form1040ReviewPresentation2025'

/** Isolated read-only inspection of Stage 64 diagnostic JSON; never modifies a return. */
export default function NextGen2025Review(): ReactElement {
  const [raw, setRaw] = useState('')
  const [review, setReview] = useState<ReviewPresentation2025 | null>(null)
  const [error, setError] = useState('')
  const inspect = () => {
    setReview(null)
    try {
      const parsed: unknown = JSON.parse(raw)
      setReview(presentRestricted2025Review(parsed))
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid JSON')
    }
  }
  return (
    <section aria-label="2025 Form 1040 diagnostic review">
      <Typography variant="h5" gutterBottom>2025 Form 1040 — diagnostic review</Typography>
      <Alert severity="warning">NOT FILING READY. This is a read-only development tool. It cannot prepare, authorize, export or submit a tax return.</Alert>
      <Typography paragraph style={{ marginTop: 16 }}>
        Paste a restricted Stage 64 reconciliation JSON object to inspect provisional lines and unresolved blockers. Missing values remain “Not reviewed”; they are never treated as zero. No data is stored or submitted.
      </Typography>
      <NextGen2025WagePreview />
      <Typography variant="h6" style={{ marginTop: 24 }}>Advanced: inspect reconciliation JSON</Typography>
      <TextField label="Restricted reconciliation JSON" variant="outlined" multiline rows={6} fullWidth
        value={raw} onChange={e => { setRaw(e.target.value); setReview(null); setError('') }}
        inputProps={{ 'aria-label': 'Restricted reconciliation JSON' }} />
      <Button variant="contained" color="primary" style={{ marginTop: 12, marginBottom: 12 }} onClick={inspect} disabled={!raw.trim()}>Inspect diagnostic data</Button>
      {error ? <Alert severity="error" role="alert">{error}</Alert> : null}
      {review ? <Paper style={{ padding: 12, marginTop: 12 }}>
        <Alert severity="warning">{review.status} — amounts are candidates only, not official Form 1040 entries.</Alert>
        <Table size="small" aria-label="Provisional 2025 Form 1040 amounts">
          <TableHead><TableRow><TableCell>Form 1040 line</TableCell><TableCell align="right">Diagnostic amount</TableCell></TableRow></TableHead>
          <TableBody>{review.rows.map(row => <TableRow key={row.line}><TableCell>{row.line}</TableCell><TableCell align="right">{row.display}</TableCell></TableRow>)}</TableBody>
        </Table>
        <Typography variant="h6" style={{ marginTop: 16 }}>Unresolved blockers ({review.blockers.length})</Typography>
        {review.blockers.length ? <ul>{review.blockers.map((blocker, i) => <li key={i}>{blocker}</li>)}</ul> :
          <Typography>None reported in this JSON. This does not establish filing readiness.</Typography>}
      </Paper> : null}
    </section>
  )
}
