import json
import tempfile
import unittest
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location('library', Path(__file__).with_name('manage-library.py'))
library = importlib.util.module_from_spec(spec)
spec.loader.exec_module(library)

class RetentionTest(unittest.TestCase):
    def test_latest_twenty_and_safe_deletion(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent / '.test-output', prefix='library-test-') as tmp:
            root = Path(tmp)
            untouched = root / 'unregistered'
            untouched.mkdir()
            for number in range(1, 22):
                slug = f'story-{number}'
                folder = root / slug
                folder.mkdir()
                (folder / '01.png').write_bytes(b'image fixture')
                (folder / 'project.json').write_text(json.dumps({'title': slug, 'photos': [{'src': f'assets/story/{slug}/01.png'}], 'scenes': [{}]}))
                library.register(root, slug)
                if number == 20:
                    self.assertTrue((root / 'story-1').exists())
                    self.assertEqual(len(json.loads((root / 'library.json').read_text())['items']), 20)
            self.assertFalse((root / 'story-1').exists())
            self.assertTrue(untouched.exists())
            data = json.loads((root / 'library.json').read_text())
            self.assertEqual([s['id'] for s in data['items']], [f'story-{i}' for i in range(21, 1, -1)])
            library.register(root, 'story-3')
            updated = json.loads((root / 'library.json').read_text())['items']
            self.assertEqual(len(updated), 20)
            self.assertEqual(updated[0]['id'], 'story-3')
            with self.assertRaises(ValueError):
                library.register(root, '../outside')
            self.assertTrue((root / 'story-2').exists())

if __name__ == '__main__':
    unittest.main()
