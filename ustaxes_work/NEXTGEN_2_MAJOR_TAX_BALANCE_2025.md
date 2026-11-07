# NextGen 2.0 — 2025 Form 1040 tax, credits and payments reconciliation

## Scope
Adds a separate guided 10-component entry panel for IRS Form 1040 lines 16, 17, 19, 20, 23, 26, 27a, 28, 29 and 31. No component is silently defaulted to zero. Missing, negative, invalid and unsafe values block output.

The panel calls the existing independent integer-cent reconciliation engine for Form 1040 lines 16–37, after the restricted W-2/1099-INT source mapping passes and the user explicitly acknowledges independent verification of every fictional value. Any input edit invalidates acknowledgment. The existing restricted 2025 IRS worksheet result can be copied into line 16 but must be independently reviewed.

## Explicit limitations
No automatic eligibility determination, no IRS filing, no PDF, no persistent storage, no real personal data, and no authoritative tax/refund estimate. Calculated balance is an arithmetic illustration based on fictional independently reviewed inputs only.
