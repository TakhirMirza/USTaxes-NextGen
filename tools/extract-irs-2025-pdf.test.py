import importlib.util
from pathlib import Path
p=Path(__file__).with_name('extract-irs-2025-pdf.py')
s=importlib.util.spec_from_file_location('pdf_extract',p)
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
assert len(m.BANDS)==2062
assert m.parse_pdf_lines(['25,300 25,350 3,000 2,562 3,000 2,800'])[(25300,25350)] == [3000,2562,3000,2800]
assert m.parse_pdf_lines(['text only', '25,300 25,350 3,000 2,562'])=={}
try:
 m.parse_pdf_lines(['25,300 25,350 3,000 2,562 3,000 2,800','25,300 25,350 3,000 2,563 3,000 2,800'])
 raise AssertionError('Conflict not detected')
except ValueError:pass
try:
 m.write_complete({(25300,25350):[3000,2562,3000,2800]},Path('/tmp/never-write-tax.csv'))
 raise AssertionError('Incomplete table not rejected')
except ValueError:pass
print('5 PDF extraction checks passed')
