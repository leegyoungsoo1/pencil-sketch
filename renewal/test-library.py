import json
import tempfile
import unittest
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location('library', Path(__file__).with_name('manage-library.py'))
library = importlib.util.module_from_spec(spec)
spec.loader.exec_module(library)

class RetentionTest(unittest.TestCase):
    def test_latest_three_and_safe_deletion(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent / '.test-output', prefix='library-test-') as tmp:
            root = Path(tmp)
            untouched = root / 'unregistered'
            untouched.mkdir()
            for slug in ['one', 'two', 'three', 'four']:
                folder = root / slug
                folder.mkdir()
                (folder / '01.png').write_bytes(b'image fixture')
                (folder / 'project.json').write_text(json.dumps({'title': slug, 'photos': [{'src': f'assets/story/{slug}/01.png'}], 'scenes': [{}]}))
                library.register(root, slug)
            self.assertFalse((root / 'one').exists())
            self.assertTrue(untouched.exists())
            data = json.loads((root / 'library.json').read_text())
            self.assertEqual([s['id'] for s in data['items']], ['four', 'three', 'two'])
            library.register(root, 'three')
            self.assertEqual(len(json.loads((root / 'library.json').read_text())['items']), 3)
            with self.assertRaises(ValueError):
                library.register(root, '../outside')
            self.assertTrue((root / 'two').exists())

if __name__ == '__main__':
    unittest.main()
