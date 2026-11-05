import importlib.util
import tempfile
import unittest
from pathlib import Path

SCRIPT=Path(__file__).with_name('verify-irs-2025-pdf-source.py')
spec=importlib.util.spec_from_file_location('verify_irs_source',SCRIPT)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
ROOT=SCRIPT.parent.parent
PDF=Path('/mnt/data/i1040gi.pdf')
CSV=ROOT/'src/nextgen/taxYears/irsOfficialPdfTaxTable2025.csv'

class VerifySourceTests(unittest.TestCase):
    def test_expected_bands(self):
        bands=m.expected_bands()
        self.assertEqual(len(bands),2062)
        self.assertEqual(bands[-1],(99950,100000))
    def test_actual_uploaded_source(self):
        if not PDF.exists(): self.skipTest('Original PDF not bundled in source ZIP')
        report=m.verify(PDF,CSV)
        self.assertFalse(report['independent_all_values_verified'])
        self.assertFalse(report['filing_ready'])
        self.assertEqual(report['tax_values'],8248)
    def test_bad_pdf_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'fake.pdf';p.write_bytes(b'%PDF-1.4\nfake')
            with self.assertRaisesRegex(ValueError,'checksum'):
                m.verify(p,CSV)
    def test_bad_csv_rejected(self):
        if not PDF.exists(): self.skipTest('Original PDF not bundled in source ZIP')
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'wrong.csv';p.write_text('lower,upper,single\n0,5,0\n')
            with self.assertRaisesRegex(ValueError,'columns'):
                m.verify(PDF,p)

if __name__=='__main__':unittest.main()
