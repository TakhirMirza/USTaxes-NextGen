import { ReactElement } from 'react'
import { Box, Chip, Link, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@material-ui/core'
import manifest from '../nextgen/year-manifest.json'

/** Read-only NextGen readiness. This component NEVER enables a tax year for filing. */
export default function TaxYearManager(): ReactElement {
  return (
    <Paper variant="outlined" style={{ padding: 16, marginBottom: 16 }}>
      <Typography variant="h6" component="h2">Tax Year Manager — NextGen</Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        Development status only. Future years are not available for tax filing until IRS rules, tax tables, schedules and PDF forms have passed review.
      </Typography>
      <Box style={{ overflowX: 'auto' }}>
        <Table size="small" aria-label="Tax year readiness">
          <TableHead><TableRow><TableCell>Tax year</TableCell><TableCell>Readiness</TableCell><TableCell>Forms</TableCell></TableRow></TableHead>
          <TableBody>
            {manifest.years.map((year) => (
              <TableRow key={year.year}>
                <TableCell>{year.year}</TableCell>
                <TableCell>
                  <Chip size="small" label={year.filingReady ? 'Ready' : year.status === 'legacy' ? 'Legacy (unverified)' : year.status === 'reference' ? 'Reference only' : 'Not ready'} />
                </TableCell>
                <TableCell>{year.formsStatus}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      <Typography variant="body2" color="textSecondary" style={{ marginTop: 12 }}>
        Official sources: <Link href="https://www.irs.gov/forms-instructions" target="_blank" rel="noopener noreferrer">IRS forms and instructions</Link> ·{' '}
        <Link href="https://www.irs.gov/prior-year-forms-and-instructions" target="_blank" rel="noopener noreferrer">prior-year forms</Link>.
        Downloads are not automatically approved tax rules.
      </Typography>
    </Paper>
  )
}
