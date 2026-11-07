#!/usr/bin/env python3
"""Extract 2025 IRS tax table candidates from a locally saved official PDF.

Usage: python3 tools/extract-irs-2025-pdf.py i1040gi.pdf output.csv
Requires PyMuPDF (`pip install pymupdf`). NEVER treats a mathematical model as an IRS source.
The PDF's authenticity and all extracted values still require independent verification.
"""
import csv
import hashlib
import importlib.util
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('irs_html_extractor', HERE/'extract-irs-p1040-html-2025.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
BANDS = module.expected_bands()
EXPECTED = set(BANDS)


def parse_pdf_lines(lines):
    """Only accept six-number rows matching known IRS income boundaries.

    This deliberately rejects ambiguous text and refuses to produce partial data.
    """
    rows = {}
    conflicts = []
    for line in lines:
        cells = re.findall(r'(?<![\w.])\$?\d{1,3}(?:,\d{3})+|(?<![\w.])\$?\d+(?![\w.])', line)
        vals = [module.number(c) for c in cells]
        for i in range(len(vals)-5):
            lo,hi,*tax = vals[i:i+6]
            band=(lo,hi)
            if band not in EXPECTED or any(v is None or v>100000 for v in tax):
                continue
            if band in rows and rows[band] != tax:
                conflicts.append((band,rows[band],tax))
            rows[band]=tax
    if conflicts:
        raise ValueError('Conflicting PDF values: '+repr(conflicts[:5]))
    return rows


def extract_pdf(path):
    import fitz
    doc=fitz.open(str(path))
    if doc.page_count < 10:
        raise ValueError('Unexpectedly short PDF; verify original IRS instructions')
    lines=[]
    for page in doc:
        lines.extend(page.get_text('text',sort=True).splitlines())
    return parse_pdf_lines(lines)


def write_complete(rows, output):
    missing=EXPECTED-set(rows)
    if missing:
        raise ValueError(f'Only {len(rows)}/{len(BANDS)} bands found; missing examples: {sorted(missing)[:8]}')
    if rows[(25300,25350)][1] != 2562:
        raise ValueError('IRS worked example does not match (MFJ 25300-25350 = 2562)')
    with output.open('w',newline='') as file:
        writer=csv.writer(file)
        writer.writerow(['lower','upper','single','marriedJoint','marriedSeparate','headOfHousehold'])
        writer.writerows([*band,*rows[band]] for band in BANDS)


def main():
    if len(sys.argv)!=3:
        raise SystemExit('Usage: extract-irs-2025-pdf.py original-irs.pdf output.csv')
    source=Path(sys.argv[1]); dest=Path(sys.argv[2]); data=source.read_bytes()
    if not data.startswith(b'%PDF-'):
        raise SystemExit('Input is not a PDF')
    print('PDF SHA-256:',hashlib.sha256(data).hexdigest())
    rows=extract_pdf(source)
    print(f'Extracted {len(rows)} of {len(BANDS)} expected intervals')
    dest.parent.mkdir(parents=True,exist_ok=True)
    write_complete(rows,dest)
    print('Wrote candidate only; verify against IRS publication and an independent extraction.')

if __name__=='__main__':main()
