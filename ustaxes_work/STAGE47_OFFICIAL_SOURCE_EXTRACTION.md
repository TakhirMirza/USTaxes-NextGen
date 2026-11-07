# Stage 47: Extract from official IRS publication (candidate only)

Official source: https://www.irs.gov/publications/p1040 (Publication 1040, 2025).
Save the original HTML to a local file and run:

`python3 tools/extract-irs-p1040-html-2025.py irs-p1040-2025.html research/2025-tax-table-IRS-HTML-CANDIDATE.csv`

The extractor scans the actual HTML table cells, rejects conflicting duplicates, enforces all 2,062 income bands, and checks the IRS published MFJ $25,300 example ($2,562). It reports the source SHA-256. It deliberately does **not** fall back to mathematically reconstructed values. It rejects incomplete output rather than inventing missing cells.

**Not yet done:** the IRS HTML was not downloaded into this environment, so no independently sourced 8,248-value table has been produced or certified. HTML extraction is not independent verification. Audit against the IRS PDF and validate the candidate before generating a runtime table. Filing remains blocked.
