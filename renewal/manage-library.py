"""Register a story and retain only the three most recently registered stories.

Run before committing a new story: python renewal/manage-library.py --add slug
Only directories explicitly listed in library.json are eligible for deletion.
"""
import argparse
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent / 'assets' / 'story'

def directory(root, slug):
    if not isinstance(slug, str) or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', slug):
        raise ValueError('Invalid story id')
    target = root / slug
    if target.is_symlink() or target.resolve().parent != root.resolve():
        raise ValueError('Story must be a direct directory inside assets/story')
    return target

def register(root, slug):
    root = root.resolve()
    folder = directory(root, slug)
    project = json.loads((folder / 'project.json').read_text(encoding='utf-8'))
    if not project.get('title') or not project.get('photos') or not project.get('scenes'):
        raise ValueError('Story needs title, photos and scenes')
    for photo in project['photos']:
        src = photo['src']
        prefix = f'assets/story/{slug}/'
        if not src.startswith(prefix):
            raise ValueError('Image must belong to its story directory')
        image = folder / src[len(prefix):]
        if not image.resolve().is_relative_to(folder.resolve()) or not image.is_file():
            raise ValueError('Missing or unsafe image path')
    manifest = root / 'library.json'
    old = json.loads(manifest.read_text(encoding='utf-8'))['items'] if manifest.exists() else []
    if len({entry['id'] for entry in old}) != len(old):
        raise ValueError('Duplicate story ids')
    for entry in old:
        directory(root, entry['id'])
    entry = {'id': slug, 'title': project['title'], 'cover': project['photos'][0]['src'].split(f'assets/story/{slug}/', 1)[1]}
    ordered = [entry] + [item for item in old if item['id'] != slug]
    stale = [directory(root, item['id']) for item in ordered[3:]]
    # Validate every absolute target before any recursive deletion.
    for target in stale:
        if target.resolve().parent != root or target == folder:
            raise ValueError('Unsafe deletion target')
    for target in stale:
        if target.exists():
            shutil.rmtree(target)
    manifest.write_text(json.dumps({'version': 1, 'items': ordered[:3]}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return [target.name for target in stale]

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--add', required=True, help='New story directory name')
    args = parser.parse_args()
    removed = register(ROOT, args.add)
    print('Registered:', args.add, '| Removed:', ', '.join(removed) or 'none')
