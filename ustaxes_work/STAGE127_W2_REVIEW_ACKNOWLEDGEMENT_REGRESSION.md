# Stage 127 — W-2 review acknowledgement regression

- Filing status changes now explicitly clear the UI acknowledgement state. This prevents an old acknowledgement from reappearing if the user switches status back.
- Adds parameterized regression checks for every W-2 input field, including unflagged documents, plus adding/removing documents, changed duplicate groups, and filing status.
- An unresolved possible duplicate still blocks restricted Form 1040 totals until explicitly acknowledged. A resolved duplicate does not require acknowledgement.
- This is an educational preview only: filingReady=false; postingAuthorized=false. No tax return submission is enabled.

## Validation

GitHub Actions must verify React build, Jest and Stage 83 gate after pushing. Local source packaging alone does not establish CI success.
