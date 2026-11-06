import { ReactElement, useState } from 'react'
import { Alert } from '@material-ui/lab'
import { Button, Paper, TextField, Typography, Table, TableBody, TableRow, TableCell, MenuItem } from '@material-ui/core'
import { filingStatuses2025, FilingStatus2025 } from '../nextgen/taxYears/preview2025'
import { bridgeMultipleW2ToRestricted1040_2025, W2DocumentInput2025 } from '../nextgen/taxYears/multipleW2Form1040Bridge2025'

const newDocument = (id: number): W2DocumentInput2025 => ({ id: `manual-w2-${id}`, employer: '', box1Wages: '', box2FederalWithholding: '' })
const usd = (value: number): string => value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

/** Educational, ephemeral inputs. This component does not import, persist or submit tax records. */
export default function NextGen2025MultipleW2Preview(): ReactElement {
  const [documents, setDocuments] = useState<W2DocumentInput2025[]>([newDocument(1)])
  const [nextId, setNextId] = useState(2)
  const [status, setStatus] = useState<FilingStatus2025>('single')
  const bridge = bridgeMultipleW2ToRestricted1040_2025(documents, status)
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
    {documents.map((document, index) => <Paper variant="outlined" key={document.id + '-' + index} style={{ padding: 12, marginTop: 12 }}>
      <Typography variant="subtitle1">W-2 document {index + 1}</Typography>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
        <TextField variant="outlined" label="Document ID" value={document.id} onChange={event => edit(index, 'id', event.target.value)} inputProps={{ 'aria-label': `W-2 ${index + 1} document ID` }} helperText="Unique identifier for this illustration" />
        <TextField variant="outlined" label="Employer label" value={document.employer} onChange={event => edit(index, 'employer', event.target.value)} inputProps={{ 'aria-label': `W-2 ${index + 1} employer` }} />
        <TextField variant="outlined" label="Box 1 wages (USD)" value={document.box1Wages} onChange={event => edit(index, 'box1Wages', event.target.value)} inputProps={{ 'aria-label': `W-2 ${index + 1} Box 1 wages` }} />
        <TextField variant="outlined" label="Box 2 federal withholding (USD)" value={document.box2FederalWithholding} onChange={event => edit(index, 'box2FederalWithholding', event.target.value)} inputProps={{ 'aria-label': `W-2 ${index + 1} Box 2 withholding` }} helperText="Enter 0 explicitly if none" />
      </div>
      <Button style={{ marginTop: 8 }} onClick={() => remove(index)} disabled={documents.length === 1} aria-label={`Remove W-2 document ${index + 1}`}>Remove W-2</Button>
    </Paper>)}
    <Button variant="outlined" onClick={add} disabled={documents.length >= 100} style={{ marginTop: 12 }}>Add another W-2</Button>
    <Typography variant="body2" style={{ marginTop: 8 }}>Documents: {documents.length} / 100. Each document needs a unique ID; employer names may repeat.</Typography>
    {bridge.kind === 'blocked' ? <Alert severity="info" style={{ marginTop: 12 }} role="status">Mapping blocked{bridge.documentIndex === undefined ? '' : ` at W-2 ${bridge.documentIndex + 1}`}: {bridge.reason}. Correct the inputs to display totals.</Alert> : <>
      <Typography variant="h6" style={{ marginTop: 16 }}>Restricted Form 1040 mapping — read only</Typography>
      <Table size="small" aria-label="Multiple W-2 Form 1040 totals"><TableBody>
        <TableRow><TableCell>Form 1040 line 1a — combined Box 1 wages</TableCell><TableCell align="right">{usd(bridge.draft.lines['1a'])}</TableCell></TableRow>
        <TableRow><TableCell>Form 1040 line 25a — combined Box 2 withholding</TableCell><TableCell align="right">{usd(bridge.draft.lines['25a'])}</TableCell></TableRow>
        <TableRow><TableCell>Restricted line 25d — known W-2 withholding only</TableCell><TableCell align="right">{usd(bridge.draft.lines['25d'])}</TableCell></TableRow>
      </TableBody></Table>
      <Alert severity="info" style={{ marginTop: 12 }}>Mapped {bridge.documentCount} unverified W-2 document(s). This is not a determination of eligibility, tax, withholding completeness, refund or filing readiness.</Alert>
    </>}
  </Paper>
}
