import { useState } from 'react'
import { auditFederalRules, FEDERAL_RULE_MANIFESTS, federalRulesCsv } from '../nextgen/taxYears/versionedRules'
import { isSupportedTaxYear, TaxYear } from '../nextgen/taxYears/multiYearRegistry'
import './NextGenFederalRuleCenter.css'
import NextGenOfficialSourceCenter from './NextGenOfficialSourceCenter'

export default function NextGenFederalRuleCenter({ activeYear }: { activeYear: string }) {
  const [year, setYear] = useState<TaxYear>(isSupportedTaxYear(activeYear) ? activeYear : '2025')
  const [expanded, setExpanded] = useState(false)
  const audit = auditFederalRules(year)
  const download = () => {
    const url = URL.createObjectURL(new Blob([federalRulesCsv()], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url; link.download = 'nextgen-versioned-federal-rule-audit.csv'; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
  return <section className="v2-card ng-rule-center" aria-label="Versioned federal rule engine">
    <div className="ng-rule-header"><div><span className="v2-eyebrow">PHASE 41 / VERSIONED FEDERAL RULE ENGINE</span>
      <h2>Annual federal rules and release gates</h2>
      <p>Separate tax-year rule manifests, source verification and readiness. No unverified rule can authorize calculation or filing.</p></div>
      <button type="button" onClick={() => setExpanded(value => !value)}>{expanded ? 'Hide rule matrix' : 'Inspect rule manifests'}</button></div>
    <div className="ng-rule-stats"><div><small>Rule categories per year</small><strong>{audit.total}</strong></div>
      <div><small>Independently verified</small><strong>{audit.verified}</strong></div>
      <div><small>Missing sources</small><strong>{audit.missingSources}</strong></div>
      <div><small>Calculation / filing</small><strong>Disabled</strong></div></div>
    {expanded && <><div className="ng-rule-years" role="group" aria-label="Select federal tax year">
      {(Object.keys(FEDERAL_RULE_MANIFESTS) as TaxYear[]).map(item => <button key={item} type="button" aria-pressed={item === year} onClick={() => setYear(item)}>{item}</button>)}
    </div><p className="ng-rule-note">{year} manifest: {FEDERAL_RULE_MANIFESTS[year].version}. All entries are placeholders awaiting independently reviewed official guidance.</p>
    <div className="ng-rule-table"><div className="ng-rule-table-head"><strong>Rule area</strong><strong>Verification</strong><strong>Official source</strong></div>
      {FEDERAL_RULE_MANIFESTS[year].rules.map(rule => <div key={rule.id}><span>{rule.title}</span><strong>{rule.status}</strong><span>{rule.source ?? 'Not attached'}</span></div>)}</div>
    <h3>Release blockers</h3><ul>{audit.blockers.map(blocker => <li key={blocker}>{blocker}</li>)}</ul>
    <button type="button" onClick={download}>Export four-year rules CSV</button>
    <p className="ng-rule-note">Read-only diagnostics. This module does not compute tax, change Form 1040, save taxpayer information, or enable filing.</p></>}
    <NextGenOfficialSourceCenter activeYear={activeYear} />
  </section>
}
