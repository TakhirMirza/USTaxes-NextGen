# Stage 29 — document withholding bridge (2025)

Added `withholdingBridge2025.ts` to connect W-2 box 2 and 1099-INT federal withholding to Form 1040 lines 25a–25d, with explicit additional 1099 and other withholding inputs. All arithmetic uses integer cents. It refuses duplicate document IDs, malformed money, and conflicts with preexisting Form 1040 inputs. The helper intentionally does not infer zero for undocumented sources. Four Jest test cases added.

**Limitations:** This is a narrow source-data mapping, not IRS verification, complete 1099 coverage, tax eligibility, or filing. Full 2025 IRS tax table and other schedules remain incomplete. `filingReady` is always false.
