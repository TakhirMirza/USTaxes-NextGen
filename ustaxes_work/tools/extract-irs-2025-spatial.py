#!/usr/bin/env python3
"""Independent coordinate-aware extraction from user-supplied IRS 2025 i1040gi.pdf.
Only reads PDF pages 68-79; six cells must occupy their expected columns.
Fails closed on missing, duplicate, or conflicting rows. Requires pymupdf.
"""
import csv, hashlib, json, re, sys
from pathlib import Path

BANDS = [(0,5),(5,15),(15,25)] + [(n,n+25) for n in range(25,3000,25)] + [(n,n+50) for n in range(3000,100000,50)]
EXPECTED = set(BANDS)
# Left edges of the six numeric columns in each of the three page panels.
PANELS = [(52,80,114,144,173,203),(229,257,292,321,351,380),(407,434,469,499,528,557)]
NUM = re.compile(r'^\d{1,3}(?:,\d{3})*$|^\d+$')

def extract(path):
    import fitz
    pdf=fitz.open(str(path))
    if len(pdf)<80: raise ValueError('Not the expected 2025 IRS instruction PDF')
    found={}; provenance={}
    for page_index in range(67,79):
        page=pdf[page_index]
        groups={}
        for x,y,x1,y1,token,*_ in page.get_text('words'):
            if not NUM.fullmatch(token): continue
            # Do not parse headers, the explanatory worked example or footnotes.
            if y < (259 if page_index==67 else 151) or y>740: continue
            panel=next((i for i,starts in enumerate(PANELS) if starts[0]-5 <= x <= starts[-1]+18),None)
            if panel is None:continue
            starts=(63,88,121,150,180,209) if page_index==67 and y<285 and panel==0 else PANELS[panel]
            col=min(range(6),key=lambda j:abs(x-starts[j]))
            if abs(x-starts[col])>9:continue
            key=(panel,round(y/7.3))
            groups.setdefault(key,[]).append((col,int(token.replace(',','')),round(x,1),round(y,1)))
        for (panel,row),cells in groups.items():
            columns={}
            for col,val,x,y in cells: columns.setdefault(col,[]).append((val,x,y))
            if any(len(columns.get(c,[]))!=1 for c in range(6)):continue
            values=tuple(columns[c][0][0] for c in range(6))
            band=values[:2]
            if band not in EXPECTED:continue
            if band in found:raise ValueError(f'Duplicate official band {band} on PDF page {page_index+1}')
            found[band]=values[2:]
            provenance[band]={'pdf_page':page_index+1,'panel':panel+1,'y':columns[0][0][2]}
    missing=EXPECTED-found.keys()
    if missing:raise ValueError(f'Missing {len(missing)} official bands, first: {sorted(missing)[:12]}')
    if found[(25300,25350)]!=(2801,2562,2801,2699):raise ValueError('Official worked example mismatch')
    return found,provenance

def main():
    if len(sys.argv)!=4:raise SystemExit('Usage: python extract-irs-2025-spatial.py i1040gi.pdf output.csv provenance.json')
    source,out,report=map(Path,sys.argv[1:])
    rows,locations=extract(source)
    out.parent.mkdir(parents=True,exist_ok=True);report.parent.mkdir(parents=True,exist_ok=True)
    with out.open('w',newline='') as f:
        w=csv.writer(f);w.writerow(['lower','upper','single','marriedJoint','marriedSeparate','headOfHousehold'])
        w.writerows([*band,*rows[band]] for band in BANDS)
    report.write_text(json.dumps({'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'rows':len(rows),'values':len(rows)*4,'provenance':[{'lower':b[0],'upper':b[1],**locations[b]} for b in BANDS]},indent=2)+'\n')
    print('Extracted',len(rows),'rows and',len(rows)*4,'values from page-localized PDF cells')
if __name__=='__main__':main()
