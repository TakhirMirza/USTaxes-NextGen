import { ReactElement, useState } from 'react'
import { Alert } from '@material-ui/lab'
import { Button, Paper, TextField, Typography, Table, TableBody, TableRow, TableCell, MenuItem } from '@material-ui/core'
import { filingStatuses2025, FilingStatus2025 } from '../nextgen/taxYears/preview2025'
import { bridgeMultipleW2ToRestricted1040_2025, W2DocumentInput2025 } from '../nextgen/taxYears/multipleW2Form1040Bridge2025'
import { reviewW2PreviewInputs2025 } from '../nextgen/taxYears/livePreviewScenario2025'
import { reconcileMultipleW2_2025 } from '../nextgen/taxYears/multipleW2Reconciliation2025'
import { findPotentialRepeatedW2_2025 } from '../nextgen/taxYears/multipleW2DuplicateReview2025'

const newDocument = (id: number): W2DocumentInput2025 => ({ id: `manual-w2-${id}`, employer: '', box1Wages: '', box2FederalWithholding: '' })
const usd = (value: number): string => value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

/** Educational, ephemeral inputs. This component does not import, persist or submit tax records. */
export default function NextGen2025MultipleW2Preview(): ReactElement {
  const [documents, setDocuments] = useState<W2DocumentInput2025[]>([newDocument(1)])
  const [nextId, setNextId] = useState(2)
  const [status, setStatus] = useState<FilingStatus2025>('single')
  const bridge = bridgeMultipleW2ToRestricted1040_2025(documents, status)
  const reconciliation = reconcileMultipleW2_2025(documents, bridge)
  const potentialRepeatedGroups = findPotentialRepeatedW2_2025(documents)
  const potentialRepeatedIndexes = new Set<number>()
  potentialRepeatedGroups.forEach(group => group.forEach(index => potentialRepeatedIndexes.add(index)))
  const documentIds = documents.map(document => document.id.trim())
  const duplicateIds = new Set(documentIds.filter((id, index) => id !== '' && documentIds.indexOf(id) !== index))
  const duplicateIndexes = new Set<number>()
  documentIds.forEach((id, index) => {
    if (duplicateIds.has(id)) documentIds.forEach((candidate, candidateIndex) => { if (candidate === id) duplicateIndexes.add(candidateIndex) })
  })
  const reviews = documents.map(document => reviewW2PreviewInputs2025(document.box1Wages, document.box2FederalWithholding))
  const entrySummary = (index: number): string | null => {
    const review = reviews[index]
    return review.kind === 'valid' && review.withholding !== null ? `Validated entry: Box 1 ${usd(review.wages)} · Box 2 ${usd(review.withholding)}` : null
  }
  const allAmountsValid = reviews.every(review => review.kind === 'valid' && review.withholding !== null)
  const previewWagesCents = allAmountsValid ? reviews.reduce((sum, review) => sum + (review.kind === 'valid' ? Math.round(review.wages * 100) : 0), 0) : null
  const previewWithholdingCents = allAmountsValid ? reviews.reduce((sum, review) => sum + (review.kind === 'valid' && review.withholding !== null ? Math.round(review.withholding * 100) : 0), 0) : null
  const edit = (index: number, field: keyof W2DocumentInput2025, value: string): void => {
    setDocuments(previous => previous.map((document, i) => i === index ? { ...document, [field]: value } : document))
  }
  const add = (): void => {
    if (documents.length >= 100) return
    setDocuments(previous => [...previous, newDocument(nextId)])
    setNextId(previous => previous + 1)
  }
  const remove = (index: number): void => setDocuments(previous => previous.filter((_, i) => i !== index))
  return <Paper style={{ padding: 16, marginTop: 20 }}>
    <Typography variant="h6" gutterBottom>Multiple W-2 documents — restricted 2025 Form 1040 preview</Typography>
    <Alert severity="warning">NOT FILING READY. Enter fictional data only. No documents are uploaded, stored or submitted. This preview does not calculate a refund, amount due or complete tax return. Corrected W-2 forms must be reconciled manually; do not count both original and corrected copies.</Alert>
    <TextField select label="Filing status for restricted preview" variant="outlined" value={status} onChange={event => setStatus(event.target.value as FilingStatus2025)} style={{ minWidth: 260, marginTop: 16 }}>
      {filingStatuses2025.map(option => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
    </TextField>
    {documents.map((document, index) => <Paper variant="outlined" key={`${document.id}-${index}`} style={{ padding: 12, marginTop: 12 }}>
      <Typography variant="subtitle1">W-2 document {index + 1}</Typography>
      {potentialRepeatedIndexes.has(index) && <Alert severity="warning" role="alert">Possible repeated W-2: another entry has the same employer and Box 1/Box 2 amounts. Check for an original and corrected copy before using totals. This is a warning, not proof of duplication.</Alert>}
      {duplicateIndexes.has(index) && <Alert severity="error" role="alert">Duplicate document ID. Check whether this W-2 was entered twice; do not count an original and its correction together.</Alert>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
        <TextField variant="outlined" label="Document ID" error={duplicateIndexes.has(index)} value={document.id} onChange={event => edit(index, 'id', event.target.value)} inputProps={{ 'aria-label': `W-2 ${index + 1} document ID` }} helperText="Unique identifier for this illustration" />
        <TextField variant="outlined" label="Employer label" value={document.employer} onChange={event => edit(index, 'employer', event.target.value)} inputProps={{ 'aria-label': `W-2 ${index + 1} employer` }} />
        <TextField variant="outlined" label="Box 1 wages (USD)" value={document.box1Wages} onChange={event => edit(index, 'box1Wages', event.target.value)} inputProps={{ 'aria-label': `W-2 ${index + 1} Box 1 wages` }} />
        <TextField variant="outlined" label="Box 2 federal withholding (USD)" value={document.box2FederalWithholding} onChange={event => edit(index, 'box2FederalWithholding', event.target.value)} inputProps={{ 'aria-label': `W-2 ${index + 1} Box 2 withholding` }} helperText="Enter 0 explicitly if none" />
      </div>
      {entrySummary(index) !== null && <Typography variant="body2" style={{ marginTop: 8 }}>{entrySummary(index)}</Typography>}
      <Button style={{ marginTop: 8 }} onClick={() => remove(index)} disabled={documents.length === 1} aria-label={`Remove W-2 document ${index + 1}`}>Remove W-2</Button>
    </Paper>)}
    <Button variant="outlined" onClick={add} disabled={documents.length >= 100} style={{ marginTop: 12 }}>Add another W-2</Button>
    <Typography variant="body2" style={{ marginTop: 8 }}>Documents: {documents.length} / 100. Each document needs a unique ID; employer names may repeat.</Typography>
    <Typography variant="h6" style={{ marginTop: 16 }}>W-2 input reconciliation</Typography>
    {previewWagesCents !== null && previewWithholdingCents !== null && Number.isSafeInteger(previewWagesCents) && Number.isSafeInteger(previewWithholdingCents) ? <Typography variant="body2">Sum of validated inputs: Box 1 {usd(previewWagesCents / 100)} · Box 2 {usd(previewWithholdingCents / 100)}. These amounts are provisional until all document IDs and employer labels pass review.</Typography> : <Alert severity="info">Enter valid Box 1 and Box 2 amounts for every W-2 to see combined input totals. Missing or invalid amounts are never treated as zero.</Alert>}
    {potentialRepeatedGroups.length > 0 && <Alert severity="warning" style={{ marginTop: 12 }}>Review {potentialRepeatedGroups.length} potential repeated W-2 group(s) before relying on the preview. Identical amounts can be legitimate; verify against source documents. No automatic deduplication is performed.</Alert>}
    {reconciliation.kind === 'mismatch' && <Alert severity="error" role="alert" style={{ marginTop: 12 }}>Independent W-2 reconciliation failed: {reconciliation.reason}. Do not rely on mapped totals.</Alert>}
    {bridge.kind === 'blocked' ? <Alert severity="info" style={{ marginTop: 12 }} role="status">Mapping blocked{bridge.documentIndex === undefined ? '' : ` at W-2 ${bridge.documentIndex + 1}`}: {bridge.reason}. Correct the inputs to display totals.</Alert> : reconciliation.kind !== 'matched' ? <Alert severity="error">Form 1040 mapping is withheld until independent W-2 reconciliation passes.</Alert> : <>
      <Typography variant="h6" style={{ marginTop: 16 }}>Restricted Form 1040 mapping — read only</Typography>
      <Table size="small" aria-label="Multiple W-2 Form 1040 totals"><TableBody>
        <TableRow><TableCell>Form 1040 line 1a — combined Box 1 wages</TableCell><TableCell align="right">{usd(bridge.draft.lines['1a'])}</TableCell></TableRow>
        <TableRow><TableCell>Form 1040 line 25a — combined Box 2 withholding</TableCell><TableCell align="right">{usd(bridge.draft.lines['25a'])}</TableCell></TableRow>
        <TableRow><TableCell>Restricted line 25d — known W-2 withholding only</TableCell><TableCell align="right">{usd(bridge.draft.lines['25d'])}</TableCell></TableRow>
      </TableBody></Table>
      <Alert severity="success" style={{ marginTop: 12 }}>Independent cent-level reconciliation passed: Form 1040 lines 1a, 25a and restricted 25d match the validated W-2 totals.</Alert>
      <Alert severity="info" style={{ marginTop: 12 }}>Mapped {bridge.documentCount} unverified W-2 document(s). This is not a determination of eligibility, tax, withholding completeness, refund or filing readiness.</Alert>
    </>}
  </Paper>
}
