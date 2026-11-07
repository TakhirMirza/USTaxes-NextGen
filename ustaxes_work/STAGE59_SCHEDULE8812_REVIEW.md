# Stage 59 — Schedule 8812 review (2025)

Adds `schedule8812Review2025.ts`, a **non-postable** preliminary worksheet for the 2025 Child Tax Credit and Additional Child Tax Credit (ACTC). The 2025 ACTC cap is $1,700 per qualifying child, with an illustrative earned-income limit of 15% of earned income over $2,500. It also considers the unused preliminary nonrefundable credit.

**Deliberate limitations:** special calculation for three or more qualifying children, Schedule 8812 Credit Limit Worksheet B, credit ordering, SSN/residency details, MAGI and dependency rules, and the official form line-by-line instructions remain unverified or incomplete. The existing Stage 58 credit review also remains preliminary. Accordingly both Form 1040 line 19 and line 28 are always `null`; `filingReady` is always `false`.

Tests: `schedule8812Review2025.test.ts` (eight scenarios). Run with the project's Jest environment when dependencies are installed. An isolated TypeScript compile and executable smoke tests are performed separately for this stage.
