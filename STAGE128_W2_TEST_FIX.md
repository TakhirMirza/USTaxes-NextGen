# Stage 128 — W-2 duplicate-review Jest regression fix

GitHub Actions Stage 127 failed on the newly added parameterized Jest test `duplicate wages formatting invalidates confirmation` because the test changed `123.45` to `123.450`. The preview input parser deliberately rejects fractional cents (more than two decimal places), so the potential-duplicate signature becomes `null`; the test's `not.toBeNull()` assertion was incorrect.

- Use `123.45 ` (trailing whitespace) as the valid formatting-only change, preserving a detectable duplicate while changing the raw acknowledgement snapshot.
- Add a separate regression asserting that `123.450` is rejected by duplicate detection; invalid monetary input remains subject to the existing W-2 input validation gate.
- No production tax calculation or filing authorization changes.
- Non-filing educational preview only (`filingReady=false`, `postingAuthorized=false`).

Run GitHub Actions for full Jest, React build and Stage 83 completion gate after pushing.
