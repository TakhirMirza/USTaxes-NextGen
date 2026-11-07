import { ReactElement, useState } from 'react'
import { Alert } from '@material-ui/lab'
import { Button, Paper, TextField, Typography, Table, TableBody, TableRow, TableCell, MenuItem, FormControlLabel, Checkbox } from '@material-ui/core'
import { filingStatuses2025, FilingStatus2025 } from '../nextgen/taxYears/preview2025'
import { bridgeMultipleW2ToRestricted1040_2025, W2DocumentInput2025 } from '../nextgen/taxYears/multipleW2Form1040Bridge2025'
import { reviewW2PreviewInputs2025 } from '../nextgen/taxYears/livePreviewScenario2025'
import { reconcileMultipleW2_2025 } from '../nextgen/taxYears/multipleW2Reconciliation2025'
import { summarizeW2ByEmployer2025, checkW2EmployerTotals2025, checkW2EmployerMapping2025, findW2EmployerLabelVariations2025 } from '../nextgen/taxYears/w2EmployerSummary2025'
import { findPotentialRepeatedW2_2025, repeatedW2ReviewSignature2025, isRepeatedW2ReviewAcknowledged2025, describePotentialRepeatedW2Groups2025, potentialRepeatedW2ReviewDetails2025, potentialW2WithholdingDifferences2025, potentialW2WageDifferences2025 } from '../nextgen/taxYears/multipleW2DuplicateReview2025'

const newDocument = (id: number): W2DocumentInput2025 => ({ id: `manual-w2-${id}`, employer: '', box1Wages: '', box2FederalWithholding: '' })
const usd = (value: number): string => value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

/** Educational, ephemeral inputs. This component does not import, persist or submit tax records. */
export default function NextGen2025MultipleW2Preview(): ReactElement {
  const [documents, setDocuments] = useState<W2DocumentInput2025[]>([newDocument(1)])
  const [nextId, setNextId] = useState(2)
  const [status, setStatus] = useState<FilingStatus2025>('single')
  const [acknowledgedSignature, setAcknowledgedSignature] = useState<string | null>(null)
  const bridge = bridgeMultipleW2ToRestricted1040_2025(documents, status)
  const reconciliation = reconcileMultipleW2_2025(documents, bridge)
  const potentialRepeatedGroups = findPotentialRepeatedW2_2025(documents)
  const repeatedGroupDescriptions = describePotentialRepeatedW2Groups2025(documents)
  const repeatedGroupDetails = potentialRepeatedW2ReviewDetails2025(documents)
  const withholdingDifferences = potentialW2WithholdingDifferences2025(documents)
  const wageDifferences = potentialW2WageDifferences2025(documents)
  const employerLabelVariations = findW2EmployerLabelVariations2025(documents)
  const employerSummary = summarizeW2ByEmployer2025(documents)
  const employerTotalsCheck = checkW2EmployerTotals2025(documents)
  const employerMappingCheck = checkW2EmployerMapping2025(documents, bridge)
  const repeatedSignature = repeatedW2ReviewSignature2025(documents, status)
  const repeatedReviewCleared = isRepeatedW2ReviewAcknowledged2025(repeatedSignature, acknowledgedSignature)
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
    setAcknowledgedSignature(null)
    setDocuments(previous => previous.map((document, i) => i === index ? { ...document, [field]: value } : document))
  }
  const add = (): void => {
    if (documents.length >= 100) return
    setAcknowledgedSignature(null)
    setDocuments(previous => [...previous, newDocument(nextId)])
    setNextId(previous => previous + 1)
  }
  const remove = (index: number): void => {
    setAcknowledgedSignature(null)
    setDocuments(previous => previous.filter((_, i) => i !== index))
  }
  return <Paper style={{ padding: 16, marginTop: 20 }}>
    <Typography variant="h6" gutterBottom>Multiple W-2 documents — restricted 2025 Form 1040 preview</Typography>
    <Alert severity="warning">NOT FILING READY. Enter fictional data only. No documents are uploaded, stored or submitted. This preview does not calculate a refund, amount due or complete tax return. Corrected W-2 forms must be reconciled manually; do not count both original and corrected copies.</Alert>
    <TextField select label="Filing status for restricted preview" variant="outlined" value={status} onChange={event => { setAcknowledgedSignature(null); setStatus(event.target.value as FilingStatus2025) }} style={{ minWidth: 260, marginTop: 16 }}>
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
    {employerLabelVariations.map((variation, index) => <Alert key={`employer-label-variation-${index}`} severity="info" role="status" style={{ marginTop: 8 }}>Employer label formatting review {index + 1}: W-2 documents {variation.documentPositions.join(', ')} use labels that differ only in internal whitespace ({variation.labels.join(' versus ')}). Check the source documents. No labels are changed, employers are not merged, and this notice does not override duplicate review or mapping safeguards.</Alert>)}
    <Typography variant="h6" style={{ marginTop: 16 }}>Employer source summary — informational</Typography>
    {employerSummary === null ? <Alert severity="info" role="status">Employer summary is withheld until all W-2 entries have distinct document IDs, employer labels, and valid Box 1 / Box 2 amounts (maximum 100 documents). No partial totals are displayed.</Alert> : <>
      <Table size="small" aria-label="W-2 employer source summary"><TableBody>
        <TableRow><TableCell>Employer / source positions</TableCell><TableCell align="right">Box 1 wages</TableCell><TableCell align="right">Box 2 withholding</TableCell></TableRow>
        {employerSummary.map((group, index) => <TableRow key={`employer-summary-${index}`}><TableCell>{group.employerLabel} — W-2 {group.documentPositions.join(', ')}</TableCell><TableCell align="right">{usd(group.box1Wages)}</TableCell><TableCell align="right">{usd(group.box2FederalWithholding)}</TableCell></TableRow>)}
      </TableBody></Table>
      <Alert severity="info" style={{ marginTop: 8 }}>This is a source-document inventory, not independent verification of employer identity. Every entry is included, including potential repeats. Review original and corrected W-2 forms; the summary does not authorize mapping.</Alert>
    </>}
    {employerTotalsCheck.kind === 'matched' ? <Alert severity="success" role="status" style={{ marginTop: 8 }}>Employer inventory cross-check passed: {employerTotalsCheck.documentCount} W-2 entries; Box 1 {usd(employerTotalsCheck.box1Wages)} and Box 2 {usd(employerTotalsCheck.box2FederalWithholding)} match the independent source-entry totals. This does not verify employer identity or authorize filing.</Alert> : <Alert severity="info" role="status" style={{ marginTop: 8 }}>Employer inventory cross-check unavailable: {employerTotalsCheck.reason} Restricted Form 1040 mapping remains withheld until this check passes.</Alert>}
    {potentialRepeatedGroups.length > 0 && <Alert severity="warning" style={{ marginTop: 12 }}>Review {potentialRepeatedGroups.length} potential repeated W-2 group(s) before relying on the preview. Identical amounts can be legitimate; verify against source documents. No automatic deduplication is performed.</Alert>}
    {repeatedGroupDescriptions.map((description, index) => <Alert key={`repeated-group-${index}`} severity="warning" style={{ marginTop: 8 }}>Potential repeat group {index + 1}: {description}. Employer: {repeatedGroupDetails[index].employerLabel}; Box 1: {usd(repeatedGroupDetails[index].box1Wages)}; Box 2: {usd(repeatedGroupDetails[index].box2FederalWithholding)}. Compare employer identity, tax year, corrected-form status and source documents before acknowledging; do not automatically remove either entry.</Alert>)}
    {withholdingDifferences.map((group, index) => <Alert key={`withholding-difference-${index}`} severity="info" style={{ marginTop: 8 }} role="status">Additional source check {index + 1}: W-2 documents {group.documentPositions.join(', ')} share employer {group.employerLabel} and Box 1 {usd(group.box1Wages)}, but Box 2 amounts differ ({group.box2Withholdings.map(usd).join(' versus ')}). Verify each source form and any W-2c before relying on totals. This signal alone does not block mapping, identify a correction or automatically remove entries.</Alert>)}
    {wageDifferences.map((group, index) => <Alert key={`wage-difference-${index}`} severity="info" style={{ marginTop: 8 }} role="status">Additional wage source check {index + 1}: W-2 documents {group.documentPositions.join(', ')} share employer {group.employerLabel} and Box 2 {usd(group.box2FederalWithholding)}, but Box 1 amounts differ ({group.box1Wages.map(usd).join(' versus ')}). Compare original W-2 and any W-2c before relying on totals. This is not proof of duplication and does not change or block mapping.</Alert>)}
    {repeatedSignature !== null && <FormControlLabel style={{ marginTop: 8 }} control={<Checkbox color="primary" checked={repeatedReviewCleared} onChange={event => setAcknowledgedSignature(event.target.checked ? repeatedSignature : null)} inputProps={{ 'aria-label': 'Confirm potential repeated W-2 review' }} />} label="I reviewed the flagged W-2 entries against source documents and verified that all listed entries should be counted. This confirmation resets after any document edit." />}
    {repeatedSignature !== null && !repeatedReviewCleared && <Alert severity="error" role="alert" style={{ marginTop: 8 }}>Restricted Form 1040 totals are hidden until the potential repeated W-2 entries are reviewed and acknowledged. Do not confirm without checking the source documents.</Alert>}
    {reconciliation.kind === 'mismatch' && <Alert severity="error" role="alert" style={{ marginTop: 12 }}>Independent W-2 reconciliation failed: {reconciliation.reason}. Do not rely on mapped totals.</Alert>}
    {bridge.kind === 'blocked' ? <Alert severity="info" style={{ marginTop: 12 }} role="status">Mapping blocked{bridge.documentIndex === undefined ? '' : ` at W-2 ${bridge.documentIndex + 1}`}: {bridge.reason}. Correct the inputs to display totals.</Alert> : !repeatedReviewCleared ? <Alert severity="warning">Restricted Form 1040 mapping is withheld pending review of possible repeated W-2 entries.</Alert> : reconciliation.kind !== 'matched' ? <Alert severity="error">Form 1040 mapping is withheld until independent W-2 reconciliation passes.</Alert> : employerTotalsCheck.kind !== 'matched' ? <Alert severity="error">Form 1040 mapping is withheld until employer inventory totals reconcile.</Alert> : employerMappingCheck.kind !== 'matched' ? <Alert severity="error">Form 1040 mapping is withheld until employer source totals independently match restricted Form 1040 lines 1a, 25a and 25d: {employerMappingCheck.reason}</Alert> : <>
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
