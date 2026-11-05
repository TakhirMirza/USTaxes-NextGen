import csv, importlib.util, pathlib, unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('spatial',ROOT/'tools/extract-irs-2025-spatial.py')
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
class SpatialTests(unittest.TestCase):
    def test_band_count(self): self.assertEqual(len(mod.BANDS),2062)
    def test_no_overlapping_bands(self):
        self.assertEqual(mod.BANDS[0],(0,5));self.assertEqual(mod.BANDS[-1],(99950,100000))
        self.assertTrue(all(a[1]==b[0] for a,b in zip(mod.BANDS,mod.BANDS[1:])))
    def test_published_csv_has_all_rows(self):
        with (ROOT/'src/nextgen/taxYears/irsOfficialPdfTaxTable2025.csv').open() as f:rows=list(csv.DictReader(f))
        self.assertEqual(len(rows),2062)
        self.assertEqual([(int(r['lower']),int(r['upper'])) for r in rows],mod.BANDS)
        self.assertEqual(next(r['marriedJoint'] for r in rows if r['lower']=='25300'),'2562')
if __name__=='__main__':unittest.main()
