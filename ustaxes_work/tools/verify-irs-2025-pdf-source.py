#!/usr/bin/env python3
"""Fail-closed provenance check for the uploaded 2025 IRS instruction PDF.

The current PDF extractor is NOT trusted to certify the table: page 68 has
illustrative examples and multi-column PDF text that it can misinterpret.
This tool validates source identity, CSV structure, and published example,
but intentionally does not claim independent 8,248-cell verification.
"""
import argparse
import csv
import hashlib
import json
from pathlib import Path

EXPECTED_SHA256 = '482e9c487c608f1bbeaceef35bc3c0933e8b35443cfff447e4279d590468364a'
COLUMNS = ['lower','upper','single','marriedJoint','marriedSeparate','headOfHousehold']

def expected_bands():
    return [(0,5),(5,15),(15,25)] + [(n,n+25) for n in range(25,3000,25)] + [(n,n+50) for n in range(3000,100000,50)]

def verify(pdf, csv_path):
    source=Path(pdf).read_bytes()
    sha=hashlib.sha256(source).hexdigest()
    if not source.startswith(b'%PDF-'):
        raise ValueError('Source is not a PDF')
    if sha != EXPECTED_SHA256:
        raise ValueError('PDF checksum differs from the uploaded IRS source; review before use')
    with Path(csv_path).open(newline='') as f:
        reader=csv.DictReader(f)
        if reader.fieldnames != COLUMNS:
            raise ValueError('Unexpected CSV columns')
        rows=list(reader)
    bands=expected_bands()
    if len(rows)!=len(bands):
        raise ValueError(f'Expected {len(bands)} rows; got {len(rows)}')
    previous=None
    for idx,(row,band) in enumerate(zip(rows,bands)):
        try: values=[int(row[col]) for col in COLUMNS]
        except (ValueError,TypeError,KeyError) as e: raise ValueError(f'Noninteger cell at row {idx}') from e
        if tuple(values[:2])!=band:
            raise ValueError(f'Incorrect income band at row {idx}')
        if any(v<0 for v in values[2:]):
            raise ValueError(f'Negative tax at row {idx}')
        if previous and any(v<old for v,old in zip(values[2:],previous)):
            raise ValueError(f'Decreasing tax at row {idx}')
        previous=values[2:]
    sample=rows[bands.index((25300,25350))]
    if int(sample['marriedJoint'])!=2562:
        raise ValueError('Published IRS sample mismatch')
    return {'pdf_sha256':sha,'csv_sha256':hashlib.sha256(Path(csv_path).read_bytes()).hexdigest(),
            'rows':len(rows),'tax_values':len(rows)*4,'structure_valid':True,
            'irs_example_valid':True,'independent_all_values_verified':False,
            'filing_ready':False,
            'warning':'Source PDF is identified, but CSV cell values have NOT been independently verified against the PDF layout.'}

if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('pdf');p.add_argument('csv');p.add_argument('--report')
    a=p.parse_args()
    report=verify(a.pdf,a.csv)
    output=json.dumps(report,indent=2)
    if a.report: Path(a.report).write_text(output+'\n')
    print(output)
