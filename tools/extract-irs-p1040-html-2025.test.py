import importlib.util
from pathlib import Path
p=Path(__file__).with_name('extract-irs-p1040-html-2025.py')
s=importlib.util.spec_from_file_location('extractor',p)
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
assert len(m.expected_bands())==2062
assert m.expected_bands()[-1]==(99950,100000)
assert m.extract('<table><tr><td>25,300</td><td>25,350</td><td>3,000</td><td>2,562</td><td>3,000</td><td>2,800</td></tr></table>')[(25300,25350)][1]==2562
assert m.extract('<table><tr><td>random</td><td>text</td></tr></table>')=={}
try:
 m.extract('<table><tr><td>25,300</td><td>25,350</td><td>3,000</td><td>2,562</td><td>3,000</td><td>2,800</td></tr><tr><td>25,300</td><td>25,350</td><td>3,000</td><td>2,563</td><td>3,000</td><td>2,800</td></tr></table>')
 raise AssertionError('duplicate conflict not caught')
except ValueError: pass
print('4 extractor checks passed')
