# Stage 108 — Live wage preview input safety

- Extracted the 2025 wage illustration text boundary into `parseWageInput2025`, with Jest tests for valid inputs, invalid formats, extreme amounts, and unexpected runtime types.
- Changing wages or filing status now resets both IRS line-16 method confirmations. Previously a user could confirm the method for one input, then change the data while retaining the confirmations.
- The UI still shows a non-filing-ready illustration; no tax return is posted, stored, transmitted or authorized.
- This stage does **not** establish that the full 2025 Form 1040 calculation is correct or complete.
