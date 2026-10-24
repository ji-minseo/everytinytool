"""SEO invariants, plus mutations proving that regressions are detected."""
import importlib.util
from pathlib import Path
import shutil
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('seo_audit', ROOT / 'scripts/seo_audit.py')
seo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(seo)


class SeoRegressionTest(unittest.TestCase):
    def test_repository_signals(self):
        result = seo.local_audit()
        self.assertEqual(result['errors'], [])
        self.assertEqual(result['reachable_count'], result['page_count'])

    def mutate(self, transform):
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp)
            for p in ROOT.rglob('*'):
                if p.is_file() and not any(x in ('.git', 'work', '__pycache__') for x in p.relative_to(ROOT).parts):
                    dest = target / p.relative_to(ROOT)
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(p, dest)
            transform(target)
            return [e['issue'] for e in seo.local_audit(target)['errors']]

    def test_detects_missing_sitemap_tool(self):
        def change(root):
            p = root / 'sitemap.xml'
            p.write_text(p.read_text().replace('  <url><loc>https://everytinytool.com/metadata-cleaner/</loc></url>\n', ''))
        self.assertIn('self-canonical page missing from sitemap', self.mutate(change))

    def test_detects_conflicting_schema_identity(self):
        def change(root):
            p = root / 'pdf-compressor/index.html'
            p.write_text(p.read_text().replace('"url":"https://image.everytinytool.com/', '"url":"https://everytinytool.com/'))
        self.assertIn('JSON-LD identity differs from canonical', self.mutate(change))

    def test_detects_accidental_noindex_and_duplicate_canonical(self):
        def change(root):
            p = root / 'index.html'
            p.write_text(p.read_text().replace('</head>', '<meta name="robots" content="noindex"><link rel="canonical" href="https://everytinytool.com/"></head>'))
        issues = self.mutate(change)
        self.assertIn('restrictive robots meta', issues)
        self.assertIn('expected exactly one canonical', issues)

    def test_detects_robots_block(self):
        def change(root):
            (root / 'robots.txt').write_text('User-agent: *\nDisallow: /\n')
        self.assertIn('robots.txt blocks Googlebot', self.mutate(change))


if __name__ == '__main__': unittest.main()
