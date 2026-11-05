import { ReactElement, useState } from 'react'
import { Alert } from '@material-ui/lab'
import { Checkbox, FormControlLabel, Paper, TextField, Typography } from '@material-ui/core'
import { FilingStatus2025 } from '../nextgen/taxYears/preview2025'
import { calculate2025OvertimeDeductionCandidate } from '../nextgen/taxYears/schedule1AOvertime2025'
import { calculate2025QualifiedTipsCandidate } from '../nextgen/taxYears/schedule1ATips2025'
import { calculate2025VehicleInterestCandidate } from '../nextgen/taxYears/schedule1AVehicleInterest2025'
import { calculate2025SeniorDeduction } from '../nextgen/taxYears/schedule1ASeniorDeduction2025'
import { review2025ChildAndDependentCredits, DependentCreditEvidence2025 } from '../nextgen/taxYears/childDependentCreditReview2025'
import { reviewCombined2025Schedule1A } from '../nextgen/taxYears/schedule1ACombined2025'
import { stage2025Schedule1ACandidates } from '../nextgen/taxYears/schedule1AWorksheet2025'

/** Stage 68: isolated, opt-in candidate worksheets; never posts to Form 1040. */
export default function NextGen2025CreditsAndOvertime({ status, wages, line16Tax }: {
  status: FilingStatus2025
  wages: number | null
  line16Tax: number | null
}): ReactElement {
  const [employeeTips, setEmployeeTips] = useState('')
  const [businessTips, setBusinessTips] = useState('')
  const [tipsOccupation, setTipsOccupation] = useState(false)
  const [tipsRecords, setTipsRecords] = useState(false)
  const [tipsBusinessLimit, setTipsBusinessLimit] = useState(false)
  const [vehicleVin, setVehicleVin] = useState('')
  const [vehicleInterest, setVehicleInterest] = useState('')
  const [vehicleElsewhere, setVehicleElsewhere] = useState('0')
  const [vehicleEvidence, setVehicleEvidence] = useState(false)
  const [seniorTaxpayer, setSeniorTaxpayer] = useState(false)
  const [seniorSpouse, setSeniorSpouse] = useState(false)
  const [seniorEvidence, setSeniorEvidence] = useState(false)
  const [premium, setPremium] = useState('')
  const [magi, setMagi] = useState('')
  const [flsaVerified, setFlsaVerified] = useState(false)
  const [ssnVerified, setSsnVerified] = useState(false)
  const [dependents, setDependents] = useState('')
  const [dependencyVerified, setDependencyVerified] = useState(false)
  const [childSsnVerified, setChildSsnVerified] = useState(false)
  const [creditOrderingReviewed, setCreditOrderingReviewed] = useState(false)
  const [noOtherIncome, setNoOtherIncome] = useState(false)
  const money = (s: string) => /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(s.trim()) && Number(s) <= 1e12
  const validCount = /^(?:0|[1-9]\d?)$/.test(dependents.trim())
  const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  const eligibleMagi = money(magi) && noOtherIncome
  const overtime = eligibleMagi && money(premium) ? calculate2025OvertimeDeductionCandidate({
    filingStatus: status, married: status === 'marriedJoint' || status === 'marriedSeparate',
    qualifiedFlsaOvertimePremium: Number(premium), modifiedAdjustedGrossIncome: Number(magi),
    flsaPremiumVerified: flsaVerified, eligibleEarnersHaveValidSsn: ssnVerified,
  }) : null
  const married = status === 'marriedJoint' || status === 'marriedSeparate'
  const tips = eligibleMagi && money(employeeTips) && money(businessTips) ? calculate2025QualifiedTipsCandidate({
    filingStatus: status, married, verifiedEmployeeTips: Number(employeeTips),
    verifiedBusinessTipsAfterNetIncomeLimit: Number(businessTips),
    modifiedAdjustedGrossIncome: Number(magi), eligibleOccupationVerified: tipsOccupation,
    voluntaryTipsAndRecordsVerified: tipsRecords, eligibleEarnersHaveValidSsn: ssnVerified,
    businessNetIncomeLimitsVerified: tipsBusinessLimit,
  }) : null
  const vehicle = eligibleMagi && money(vehicleInterest) && money(vehicleElsewhere) ? calculate2025VehicleInterestCandidate({
    filingStatus: status, modifiedAdjustedGrossIncome: Number(magi), loans: [{
      vin: vehicleVin, interestPaid2025: Number(vehicleInterest), interestDeductedElsewhere: Number(vehicleElsewhere),
      originatedAfter2024: vehicleEvidence, loanOriginatedByTaxpayer: vehicleEvidence,
      loanUsedToPurchaseVehicleNotLease: vehicleEvidence, securedByFirstLien: vehicleEvidence,
      originalUseBeganWithTaxpayer: vehicleEvidence, eligibleVehicleTypeAndWeight: vehicleEvidence,
      finalAssemblyInUnitedStatesVerified: vehicleEvidence, predominantlyPersonalUse: vehicleEvidence,
      qualifiedLoanAndRefinancingReviewed: vehicleEvidence,
    }],
  }) : null
  const senior = eligibleMagi ? calculate2025SeniorDeduction({
    filingStatus: status, modifiedAdjustedGrossIncome: Number(magi), married,
    taxpayerAge65ByYearEnd: seniorTaxpayer, spouseAge65ByYearEnd: status === 'marriedJoint' && seniorSpouse,
    taxpayerEligible: seniorTaxpayer && seniorEvidence,
    spouseEligible: status === 'marriedJoint' && seniorSpouse && seniorEvidence,
  }) : null
  const children: DependentCreditEvidence2025[] = validCount ? Array.from({ length: Number(dependents) }, (_, i) => ({
    identifier: `child-${i + 1}`, qualifyingChildUnder17: true, otherDependent: false,
    relationshipResidenceSupportAndDependencyVerified: dependencyVerified,
    taxpayerIdValidForCredit: childSsnVerified, childSSNValidForEmployment: childSsnVerified,
    claimedOnReturn: true,
  })) : []
  const credit = eligibleMagi && validCount ? review2025ChildAndDependentCredits({
    filingStatus: status, modifiedAdjustedGrossIncome: Number(magi), dependents: children,
    taxpayerSSNValidForEmployment: ssnVerified,
    spouseSSNValidForEmployment: status === 'marriedJoint' ? ssnVerified : undefined,
    federalIncomeTaxAvailableBeforeCredits: line16Tax,
    otherNonrefundableCreditsAndLimitationsReviewed: creditOrderingReviewed,
  }) : null
  // A missing worksheet is NOT equivalent to an explicit zero-dollar result.
  // Reconcile independently calculated candidates against the staged evidence inventory.
  const schedule1AAmounts = [tips?.calculatedCandidate, overtime?.calculatedCandidate,
    vehicle?.calculatedCandidate, senior?.calculatedCandidate]
  const completeAmounts = schedule1AAmounts.every(value => value !== null && value !== undefined)
  const staged = completeAmounts ? stage2025Schedule1ACandidates([
    { category: 'qualifiedTips', amount: schedule1AAmounts[0] as number },
    { category: 'qualifiedOvertimePremium', amount: schedule1AAmounts[1] as number },
    { category: 'qualifiedPassengerVehicleLoanInterest', amount: schedule1AAmounts[2] as number },
    { category: 'seniorDeductionCandidate', amount: schedule1AAmounts[3] as number },
  ]) : null
  const combined = reviewCombined2025Schedule1A({ tips, overtime, vehicleInterest: vehicle, senior, staged })
  return <Paper style={{ padding: 16, marginTop: 20 }}>
    <Typography variant="h6">2025 Schedule 1-A and dependent-credit candidates</Typography>
    <Alert severity="warning">NOT FILING READY. Separate diagnostic worksheets only. These values do not modify taxable income, Form 1040 lines 13b/19/28, tax owed, or refund. No information is saved.</Alert>
    <Typography variant="body2" style={{ marginTop: 12 }}>The wage preview above supplies context only. Enter MAGI separately; wages alone are not necessarily MAGI.</Typography>
    <TextField label="2025 MAGI (USD)" value={magi} onChange={e => setMagi(e.target.value)} error={!!magi && !money(magi)} helperText="Do not substitute W-2 wages for MAGI unless independently reviewed." style={{ margin: 8 }} />
    <FormControlLabel control={<Checkbox checked={noOtherIncome} onChange={e => setNoOtherIncome(e.target.checked)} />} label="I independently reviewed MAGI and adjustments for this illustration" />
    <Paper variant="outlined" style={{ padding: 12, marginTop: 16 }}>
      <Typography variant="h6">Schedule 1-A — four-category reconciliation</Typography>
      <Typography variant="body2">Amounts below are candidates only, not an authorized Form 1040 deduction.</Typography>
      {([
        ['Qualified tips', combined.candidateAmounts.qualifiedTips],
        ['Qualified overtime premium', combined.candidateAmounts.qualifiedOvertimePremium],
        ['Qualified vehicle loan interest', combined.candidateAmounts.qualifiedPassengerVehicleLoanInterest],
        ['Enhanced senior deduction', combined.candidateAmounts.seniorDeductionCandidate],
      ] as Array<[string, number | null]>).map(([label, amount]) =>
        <Typography variant="body2" key={label}>{label}: {amount === null ? 'Not established' : usd(amount)}</Typography>
      )}
      <Typography variant="subtitle1">Preliminary candidate total: {combined.preliminaryTotal === null ? 'Unavailable' : usd(combined.preliminaryTotal)}</Typography>
      <Alert severity={combined.reviewComplete ? 'info' : 'warning'}>
        {combined.reviewComplete ? 'Candidate worksheets reconciled; statutory eligibility and Form 1040 posting remain unapproved.' :
          `Reconciliation blocked: ${combined.blockers.length} unresolved condition(s).`}
        {' '}Form 1040 line 13b: NOT POPULATED. Filing ready: NO.
      </Alert>
      {combined.blockers.length > 0 && <ul>{combined.blockers.map((reason, index) => <li key={index}>{reason}</li>)}</ul>}
    </Paper>
    <Typography variant="subtitle1" style={{ marginTop: 16 }}>Qualified overtime premium — Schedule 1-A Part III</Typography>
    <TextField label="FLSA-required overtime premium only (USD)" value={premium} onChange={e => setPremium(e.target.value)} error={!!premium && !money(premium)} helperText="Not total overtime compensation" style={{ margin: 8 }} />
    <FormControlLabel control={<Checkbox checked={flsaVerified} onChange={e => setFlsaVerified(e.target.checked)} />} label="FLSA premium and source evidence reviewed" />
    <FormControlLabel control={<Checkbox checked={ssnVerified} onChange={e => setSsnVerified(e.target.checked)} />} label="Relevant SSN eligibility verified (do not enter SSN here)" />
    {overtime ? <Alert severity={overtime.blockers.length ? 'warning' : 'info'}>Overtime candidate: {overtime.calculatedCandidate === null ? 'blocked' : usd(overtime.calculatedCandidate)}. {overtime.blockers.join(' ') || 'Preliminary only; Schedule 1-A line 13b remains blocked.'}</Alert> : <Typography variant="body2">Enter validated MAGI and overtime premium to review this candidate.</Typography>}
    <Typography variant="subtitle1" style={{ marginTop: 20 }}>Qualified tips — Schedule 1-A Part II</Typography>
    <TextField label="Verified employee tips (USD)" value={employeeTips} onChange={e => setEmployeeTips(e.target.value)} error={!!employeeTips && !money(employeeTips)} style={{ margin: 8 }} />
    <TextField label="Self-employment tips after net-income limit (USD)" value={businessTips} onChange={e => setBusinessTips(e.target.value)} error={!!businessTips && !money(businessTips)} style={{ margin: 8 }} />
    <FormControlLabel control={<Checkbox checked={tipsOccupation} onChange={e => setTipsOccupation(e.target.checked)} />} label="Eligible tipped occupation independently reviewed" />
    <FormControlLabel control={<Checkbox checked={tipsRecords} onChange={e => setTipsRecords(e.target.checked)} />} label="Voluntary tips and source records verified" />
    <FormControlLabel control={<Checkbox checked={tipsBusinessLimit} onChange={e => setTipsBusinessLimit(e.target.checked)} />} label="Self-employment net-income limitation reviewed" />
    {tips ? <Alert severity={tips.blockers.length ? 'warning' : 'info'}>Tips candidate: {tips.calculatedCandidate === null ? 'blocked' : usd(tips.calculatedCandidate)}. {tips.blockers.join(' ') || 'Diagnostic only; not transferred to Form 1040.'}</Alert> : <Typography variant="body2">Enter MAGI and both tip amounts (enter 0 if none) to review.</Typography>}
    <Typography variant="subtitle1" style={{ marginTop: 20 }}>Vehicle loan interest — Schedule 1-A Part IV</Typography>
    <TextField label="Vehicle VIN (17 characters)" value={vehicleVin} onChange={e => setVehicleVin(e.target.value.toUpperCase())} inputProps={{ maxLength: 17 }} style={{ margin: 8 }} helperText="One loan only; VIN stays in this browser session" />
    <TextField label="Interest paid in 2025 (USD)" value={vehicleInterest} onChange={e => setVehicleInterest(e.target.value)} error={!!vehicleInterest && !money(vehicleInterest)} style={{ margin: 8 }} />
    <TextField label="Interest already deducted elsewhere (USD)" value={vehicleElsewhere} onChange={e => setVehicleElsewhere(e.target.value)} error={!money(vehicleElsewhere)} style={{ margin: 8 }} />
    <FormControlLabel control={<Checkbox checked={vehicleEvidence} onChange={e => setVehicleEvidence(e.target.checked)} />} label="I independently verified ALL vehicle, origination, first-lien, assembly, personal-use and refinancing requirements" />
    {vehicle ? <Alert severity={vehicle.blockers.length ? 'warning' : 'info'}>Vehicle interest candidate: {vehicle.calculatedCandidate === null ? 'blocked' : usd(vehicle.calculatedCandidate)}. {vehicle.blockers.join(' ') || 'Diagnostic only; not transferred to Form 1040.'}</Alert> : <Typography variant="body2">Enter MAGI and loan interest to review; this worksheet supports only one loan.</Typography>}
    <Typography variant="subtitle1" style={{ marginTop: 20 }}>Enhanced senior deduction — Schedule 1-A Part V</Typography>
    <FormControlLabel control={<Checkbox checked={seniorTaxpayer} onChange={e => setSeniorTaxpayer(e.target.checked)} />} label="Taxpayer was 65 or older by December 31, 2025" />
    {status === 'marriedJoint' && <FormControlLabel control={<Checkbox checked={seniorSpouse} onChange={e => setSeniorSpouse(e.target.checked)} />} label="Spouse was 65 or older by December 31, 2025" />}
    <FormControlLabel control={<Checkbox checked={seniorEvidence} onChange={e => setSeniorEvidence(e.target.checked)} />} label="Age, SSN and other senior eligibility requirements independently reviewed" />
    {senior ? <Alert severity={senior.blockers.length ? 'warning' : 'info'}>Senior deduction candidate: {senior.calculatedCandidate === null ? 'blocked' : usd(senior.calculatedCandidate)}. {senior.blockers.join(' ') || 'Diagnostic only; not transferred to Form 1040.'}</Alert> : <Typography variant="body2">Enter and review MAGI to see the senior deduction candidate.</Typography>}
    <Typography variant="subtitle1" style={{ marginTop: 20 }}>Child Tax Credit — Schedule 8812 review</Typography>
    <TextField label="Number of qualifying children under 17" value={dependents} onChange={e => setDependents(e.target.value)} error={!!dependents && !validCount} helperText="0–99; simplified count, not an eligibility determination" style={{ margin: 8 }} />
    <FormControlLabel control={<Checkbox checked={dependencyVerified} onChange={e => setDependencyVerified(e.target.checked)} />} label="Dependency, residence, relationship and support rules reviewed for every child" />
    <FormControlLabel control={<Checkbox checked={childSsnVerified} onChange={e => setChildSsnVerified(e.target.checked)} />} label="Qualifying child SSN rules reviewed (do not enter SSNs here)" />
    <FormControlLabel control={<Checkbox checked={creditOrderingReviewed} onChange={e => setCreditOrderingReviewed(e.target.checked)} />} label="Other nonrefundable credits and ordering reviewed" />
    {credit ? <Alert severity="warning">Combined CTC/ODC candidate before tax limit: {usd(credit.preliminaryCombinedCredit)}. {credit.tentativeTaxLimitedCredit === null ? 'Line 16 unavailable: tax-limited estimate blocked.' : `Tentative tax-limited amount: ${usd(credit.tentativeTaxLimitedCredit)}.`} Schedule 8812 and refundable ACTC remain unverified. {credit.blockers.join(' ')}</Alert> : <Typography variant="body2">Enter validated MAGI and child count to review this candidate.</Typography>}
    <Typography variant="caption" style={{ display: 'block', marginTop: 12 }}>W-2 wages context: {wages === null ? 'unavailable' : usd(wages)}. No dependent names, SSNs or documents are collected.</Typography>
  </Paper>
}
