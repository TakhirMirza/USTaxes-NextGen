# Stage 48 — independent PDF extraction route

A separate PDF-based candidate extractor was added, independent of the HTML parser and mathematical reconstruction. It accepts a locally saved 2025 IRS i1040gi.pdf and attempts to parse complete six-value tax table rows. **PDF layout may place values on separate lines, so this tool may refuse an authentic PDF**; failure must be handled by inspecting the layout and improving extraction, not by fabricating missing values.

Commands:

```bash
python3 tools/extract-irs-2025-pdf.test.py
python3 tools/extract-irs-2025-pdf.py i1040gi.pdf irs-pdf-candidate.csv
```

The extractor requires `pymupdf`. Independently compare its CSV against the HTML extraction using the existing audit tool. Neither extractor certifies source authenticity. No IRS PDF is bundled and no complete official table was imported in Stage 48. Tax filing stays blocked.

Source: https://www.irs.gov/pub/irs-pdf/i1040gi.pdf
