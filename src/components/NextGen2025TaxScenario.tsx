import { ReactElement, useMemo } from 'react'
import { compareFederalScenarios2025 } from '../nextgen/taxYears/federalTaxScenario2025'
import './NextGen2025TaxScenario.css'
interface Props { year:string;filingStatus:string;incomeCents:number|null;deductionCents:number|null;sourceValidated:boolean;deductionValidated:boolean;specialTaxMethodsExcluded:boolean }
const usd=(c:number):string=>(c/100).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2})
export default function NextGen2025TaxScenario(props:Props):ReactElement {
  const result=useMemo(()=>compareFederalScenarios2025(props),[props.year,props.filingStatus,props.incomeCents,props.deductionCents,props.sourceValidated,props.deductionValidated,props.specialTaxMethodsExcluded])
  return <section className="v2-card ng-tax-scenarios" aria-label="2025 tax scenario comparison">
    <span className="v2-eyebrow">PHASE 11 / 2025 / ORDINARY TAX MODEL</span>
    <h2>Federal tax scenario comparison</h2>
    <p>Explore the effect of a $10,000 change in adjusted gross income using 2025 ordinary-income brackets. The calculation holds the deduction constant and excludes credits, additional taxes and payments.</p>
    {result.status==='blocked'?<><strong>Calculation blocked — missing prerequisites</strong><ul className="v2-blockers">{result.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul></>:<div className="ng-scenario-scroll"><table><thead><tr><th>Scenario</th><th>AGI</th><th>Deduction</th><th>Taxable income</th><th>Illustrative bracket tax</th><th>Marginal rate</th></tr></thead><tbody>{result.scenarios.map(s=><tr key={s.label}><th>{s.label}</th><td>{usd(s.incomeCents)}</td><td>{usd(s.deductionCents)}</td><td>{usd(s.taxableCents)}</td><td>{usd(s.estimatedOrdinaryTaxCents)}</td><td>{s.marginalRate}%</td></tr>)}</tbody></table></div>}
    <div className="v2-note"><strong>Not a Form 1040 tax calculation.</strong> For taxable income below $100,000, IRS Tax Table amounts can differ from this bracket model. Other tax methods, additional deductions, credits, withholding and refund are excluded. Filing and real taxpayer data remain disabled.</div>
  </section>
}
