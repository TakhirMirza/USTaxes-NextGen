#!/usr/bin/env python3
"""Extract tax-table rows from 2025 IRS i1040gi.pdf using pdftotext -layout.
Requires poppler's pdftotext. Does not certify authenticity or filing readiness.
Usage: python3 tools/extract-irs-2025-layout.py i1040gi.pdf output.csv
"""
import collections,csv,hashlib,re,subprocess,sys
from pathlib import Path

def extract(pdf):
    text=subprocess.check_output(['pdftotext','-f','68','-l','80','-layout',str(pdf),'-'],text=True)
    number=re.compile(r'(?<!\S)\d[\d,]*(?!\S)')
    expected=[(0,5),(5,15),(15,25)]+[(n,n+25) for n in range(25,3000,25)]+[(n,n+50) for n in range(3000,100000,50)]
    valid=set(expected); rows=collections.defaultdict(set)
    for line in text.splitlines():
        values=[int(v.replace(',','')) for v in number.findall(line)]
        for i in range(len(values)-5):
            band=tuple(values[i:i+2]); tax=tuple(values[i+2:i+6])
            if band in valid and all(0<=v<=100000 for v in tax): rows[band].add(tax)
    # The first three rows are displayed vertically in the source PDF; two
    # cannot be recognized as six-number horizontal rows by pdftotext.
    for band,tax in [((0,5),(0,0,0,0)),((5,15),(1,1,1,1)),((15,25),(2,2,2,2))]:
        if band in rows and rows[band]!={tax}: raise ValueError(f'First-panel conflict: {band}')
        rows[band]={tax}
    missing=valid-rows.keys(); conflicts={k:v for k,v in rows.items() if len(v)!=1}
    if missing or conflicts: raise ValueError(f'Missing {len(missing)} rows; conflicts {len(conflicts)}')
    result=[(*band,*next(iter(rows[band]))) for band in expected]
    if result[expected.index((25300,25350))] != (25300,25350,2801,2562,2801,2699):
        raise ValueError('IRS worked example failed')
    return result

if __name__=='__main__':
    if len(sys.argv)!=3: raise SystemExit(__doc__)
    source=Path(sys.argv[1]); output=Path(sys.argv[2]); data=source.read_bytes()
    if not data.startswith(b'%PDF-'): raise ValueError('Not a PDF')
    rows=extract(source);output.parent.mkdir(parents=True,exist_ok=True)
    with output.open('w',newline='') as f:
        w=csv.writer(f);w.writerow(['lower','upper','single','marriedJoint','marriedSeparate','headOfHousehold']);w.writerows(rows)
    print(f'PDF SHA256 {hashlib.sha256(data).hexdigest()}; extracted {len(rows)} bands, {len(rows)*4} tax values')
