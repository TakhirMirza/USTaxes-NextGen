import { ReactElement } from 'react'
import { Box, Chip, Link, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@material-ui/core'
import manifest from '../nextgen/year-manifest.json'
import { isTaxYearReady } from '../nextgen/taxYears/registry'
import Tax2025Preview from './Tax2025Preview'

/** Read-only development dashboard. It never changes the active filing year. */
export default function TaxYearManager(): ReactElement {
  return (
    <>
    <Paper variant="outlined" style={{ padding: 20, marginBottom: 20 }}>
      <Typography variant="h6" component="h2" gutterBottom>
        USTaxes NextGen — Tax Year Roadmap
      </Typography>
      <Typography variant="body2" paragraph>
        This is a development preview, not a tax filing service. The editor below is legacy software
        for 2020–2021 and has not been verified for current tax filing. Do not enter real taxpayer
        information or Social Security numbers in this public preview.
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        Years 2025–2028 are tracked here for development only. They cannot be selected for filing.
        A year becomes available only after tax rules, Form 1040, schedules, PDF output and
        regression testing are verified.
      </Typography>
      <Box style={{ overflowX: 'auto' }}>
        <Table size="small" aria-label="Tax year development and filing readiness">
          <TableHead>
            <TableRow>
              <TableCell>Tax year</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Forms</TableCell>
              <TableCell>What's missing / next steps</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {manifest.years.map((year) => {
              const ready = year.filingReady && isTaxYearReady(year.year)
              const label = ready
                ? 'Verified ready'
                : year.status === 'legacy'
                ? 'Legacy / unverified'
                : year.status === 'reference'
                ? 'Reference only'
                : 'Not ready'
              return (
                <TableRow key={year.year}>
                  <TableCell component="th" scope="row">{year.year}</TableCell>
                  <TableCell><Chip size="small" variant="outlined" label={label} /></TableCell>
                  <TableCell>{year.formsStatus}</TableCell>
                  <TableCell>
                    <Typography variant="body2">{year.reason}</Typography>
                    {year.capabilities.length > 0 && (
                      <Typography variant="caption" color="textSecondary" component="div">
                        Reference capabilities: {year.capabilities.join(', ')}
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Box>
      <Typography variant="body2" color="textSecondary" style={{ marginTop: 16 }}>
        Official references: <Link href="https://www.irs.gov/forms-instructions" target="_blank" rel="noopener noreferrer">IRS forms and instructions</Link> ·{' '}
        <Link href="https://www.irs.gov/prior-year-forms-and-instructions" target="_blank" rel="noopener noreferrer">prior-year forms</Link>.
        Downloading a form does not mean its calculations are implemented or verified here.
      </Typography>
    </Paper>
    <Tax2025Preview />
    </>
  )
}
