# Stage 106 — Form 1040 reconciliation money-input regression coverage

- Add parameterized Jest regression cases for all 12 required reconciliation money inputs: NaN, +/-Infinity, negative, fractional-cent and above-limit amounts must throw RangeError.
- Cover invalid withholding breakdown components and explicit refund / carryforward elections.
- Assert missing required amounts remain missing (never zero), with null result lines and `filingReady: false`.
- No production calculation changes; Stage 103 lint non-regression gate and non-filing controls are preserved.
- Full Jest/React CI verification is required on GitHub Actions after push.
