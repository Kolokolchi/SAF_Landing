"""Offline regressions for failed downloads and exact resource replacement."""
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
import importlib.util
import io
import json
import unittest

spec = importlib.util.spec_from_file_location('mirror', Path(__file__).with_name('mirror.py'))
mirror = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mirror)


class MirrorTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.root_patch = patch.object(mirror, 'ROOT', self.root)
        self.root_patch.start()
        self.addCleanup(self.root_patch.stop)
        self.map_patch = patch.object(mirror, 'manifest', {})
        self.map_patch.start()
        self.addCleanup(self.map_patch.stop)
        mirror.errors.clear()

    def test_unmapped_url_is_not_rewritten_by_host_or_filename_prefix(self):
        base = 'https://static.tildacdn.pro'
        mapped = base + '/image.png'
        f = self.root / 'assets/image.png'
        f.parent.mkdir()
        f.write_bytes(b'image')
        mirror.manifest.update({base: '/assets/index', mapped: '/assets/image.png'})
        original = mapped + '?version=2'
        self.assertEqual(mirror.rewrite(original), original)
        self.assertEqual(mirror.rewrite(base + '/missing.png'), base + '/missing.png')
        self.assertEqual(mirror.rewrite(mapped), '/assets/image.png')

    def test_encoded_attribute_urls_are_replaced_without_decoding_markup(self):
        url = 'https://static.tildacdn.pro/image.png?a=1&b=2'
        f = self.root / 'assets/image.png'
        f.parent.mkdir()
        f.write_bytes(b'image')
        mirror.manifest[url] = '/assets/image.png'
        raw = '<div data-value="{&quot;img&quot;:&quot;' + url.replace('&', '&amp;') + '&quot;}"></div>'
        self.assertEqual(mirror.rewrite(raw), '<div data-value="{&quot;img&quot;:&quot;/assets/image.png&quot;}"></div>')

    def test_missing_mapped_file_is_an_error(self):
        url = 'https://static.tildacdn.pro/missing.png'
        mirror.manifest[url] = '/assets/missing.png'
        with self.assertRaises(ValueError):
            mirror.rewrite(url)

    def test_download_failure_preserves_published_pages_and_reports_failure(self):
        raw = '<html><head></head><body><img src="https://static.tildacdn.pro/new.png"></body></html>'
        (self.root / 'source.html').write_text(raw, encoding='utf-8')
        for name in ('index', 'avenue', 'avenuekz', 'privacy', 'privacykz'):
            (self.root / (name + '.html')).write_text('previous good page', encoding='utf-8')
        with patch.object(mirror, 'urlopen', side_effect=lambda *a, **kw: io.BytesIO(b'<html></html>')), \
             patch.object(mirror, 'fetch', side_effect=TimeoutError('download failed')):
            with self.assertRaisesRegex(RuntimeError, 'Mirror incomplete'):
                mirror.main()
        for name in ('index', 'avenue', 'avenuekz', 'privacy', 'privacykz'):
            self.assertEqual((self.root / (name + '.html')).read_text(), 'previous good page')
        self.assertEqual(len(json.loads((self.root / 'mirror-errors.json').read_text())), 1)

    def test_corrupt_response_is_not_cached_as_an_asset(self):
        class Response(io.BytesIO):
            headers = {'Content-Type': 'text/javascript'}
        with patch.object(mirror, 'urlopen', return_value=Response(b'\xff')):
            with self.assertRaises(UnicodeDecodeError):
                mirror.fetch('https://static.tildacdn.pro/bad.js')
        self.assertFalse((self.root / 'assets/static.tildacdn.pro/bad.js').exists())

    def test_refresh_preserves_local_animation_and_button_styles_without_duplicates(self):
        (self.root / 'source.html').write_text('<html><head></head><body></body></html>', encoding='utf-8')
        marker = '/* LOCAL APPEARANCE OVERRIDES */'
        local = marker + '\n.avenue-reveal { transition-duration: .8s; }\n.avenue-back-to-top { color: tan; }'
        (self.root / 'custom.css').write_text('old remote CSS\n' + local, encoding='utf-8')
        def response(url, **kwargs):
            return io.BytesIO(b'.remote { color: black; }' if url.endswith('/custom.css') else b'<html></html>')
        with patch.object(mirror, 'urlopen', side_effect=response):
            mirror.main()
            mirror.main()
        result = (self.root / 'custom.css').read_text(encoding='utf-8')
        self.assertIn('.remote { color: black; }', result)
        self.assertIn(local, result)
        self.assertEqual(result.count(marker), 1)
        self.assertNotIn('old remote CSS', result)


if __name__ == '__main__':
    unittest.main()
