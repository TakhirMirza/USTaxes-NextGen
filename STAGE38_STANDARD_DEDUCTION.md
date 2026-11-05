# Stage 38 — IRS 2025 standard deduction calculation

Added a guarded calculator for the 2025 base standard deduction plus age/blindness increments. Uses IRS Publication 501 (2025): $15,750 single/MFS; $31,500 MFJ/QSS; $23,625 HOH; age/blindness +$2,000 per box for single/HOH, +$1,600 per box for married/QSS. Does not confuse this with the separate Schedule 1-A enhanced senior deduction.

The calculator refuses dependent, itemized, nonresident, or unsupported spouse cases rather than inventing an amount. The pipeline exposes the calculated amount separately and blocks line 16 when the restricted draft does not reflect it. It does NOT silently overwrite the draft's tax base. Remaining work includes official tax table, credits, full tax-base integration, and end-to-end tests.

Source: https://www.irs.gov/publications/p501
