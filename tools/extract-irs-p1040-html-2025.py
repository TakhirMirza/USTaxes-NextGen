#!/usr/bin/env python3
"""Extract tax table rows from a locally saved official IRS Publication 1040 HTML page.

Usage: python3 tools/extract-irs-p1040-html-2025.py irs-p1040-2025.html output.csv
No network access is needed. Extraction is not independent verification.
"""
import csv
import hashlib
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

class Tables(HTMLParser):
    def __init__(self):
        super().__init__(); self.tables=[]; self.table=None; self.row=None; self.cell=None; self.depth=0
    def handle_starttag(self, tag, attrs):
        if tag=='table':
            if self.depth==0: self.table=[]
            self.depth+=1
        elif self.depth and tag=='tr': self.row=[]
        elif self.depth and tag in ('td','th'): self.cell=[]
    def handle_data(self, data):
        if self.cell is not None: self.cell.append(data)
    def handle_endtag(self, tag):
        if self.depth and tag in ('td','th') and self.cell is not None:
            if self.row is not None: self.row.append(' '.join(''.join(self.cell).split()))
            self.cell=None
        elif self.depth and tag=='tr' and self.row is not None:
            self.table.append(self.row); self.row=None
        elif tag=='table' and self.depth:
            self.depth-=1
            if self.depth==0: self.tables.append(self.table); self.table=None

def expected_bands():
    return [(0,5),(5,15),(15,25)] + [(x,x+25) for x in range(25,3000,25)] + [(x,x+50) for x in range(3000,100000,50)]

def number(text):
    text=text.strip().replace(',','').replace('$','').replace('\u00a0','')
    return int(text) if re.fullmatch(r'\d+',text) else None

def extract(html):
    parser=Tables(); parser.feed(html)
    found={}; conflicts=[]
    for table in parser.tables:
        for cells in table:
            # IRS pages may render multiple side-by-side blocks; scan all consecutive 6-cell windows.
            for i in range(max(0,len(cells)-5)):
                values=[number(v) for v in cells[i:i+6]]
                if None in values: continue
                lo,hi,*tax=values
                if (lo,hi) not in EXPECTED: continue
                if any(t<0 or t>100000 for t in tax): continue
                old=found.get((lo,hi))
                if old is not None and old!=tax: conflicts.append((lo,hi,old,tax))
                found[(lo,hi)]=tax
    if conflicts: raise ValueError('Conflicting duplicate rows: '+str(conflicts[:3]))
    return found

EXPECTED=set(expected_bands())
def main():
    if len(sys.argv)!=3: raise SystemExit('Usage: extractor saved-irs.html output.csv')
    source=Path(sys.argv[1]); output=Path(sys.argv[2]); raw=source.read_bytes()
    if b'irs.gov' not in raw.lower():
        raise SystemExit('Input lacks an IRS identifier. Provide an unmodified IRS Publication 1040 HTML download.')
    rows=extract(raw.decode('utf-8-sig',errors='replace'))
    missing=EXPECTED-set(rows)
    print('Source SHA-256:',hashlib.sha256(raw).hexdigest())
    print('Extracted rows:',len(rows),'of',len(EXPECTED))
    print('Missing:',len(missing),'example:',sorted(missing)[:5])
    if missing: raise SystemExit('Incomplete extraction; no output generated. Inspect HTML layout or download official PDF.')
    if rows[(25300,25350)][1]!=2562:
        raise SystemExit('Official IRS worked example mismatch for MFJ 25300–25350.')
    output.parent.mkdir(parents=True,exist_ok=True)
    with output.open('w',newline='') as f:
        writer=csv.writer(f);writer.writerow(['lower','upper','single','marriedJoint','marriedSeparate','headOfHousehold'])
        for band in expected_bands(): writer.writerow([*band,*rows[band]])
    print('Wrote candidate:',output,'(NOT certified; independently audit against IRS PDF).')
if __name__=='__main__': main()
