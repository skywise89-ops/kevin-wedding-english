# -*- coding: utf-8 -*-
"""Legacy enrichment entry point. Canonical v3 content lives in data/*.json.
Never regenerate IDs from edited English or erase curated search metadata.
"""
import json
from pathlib import Path
root = Path(__file__).resolve().parent.parent
phrases = json.loads((root / 'data/phrases.json').read_text())
lessons = json.loads((root / 'data/lessons.json').read_text())
by_en = {p['en']: p for p in phrases['phrases']}
for lesson in lessons:
    for expression in lesson['expressions']:
        p = by_en.get(expression['en'])
        if p:
            expression['ko'] = p['ko']
            expression['cat'] = p['cat']
            expression['nuance'] = p.get('note', p.get('nuance', ''))
(root / 'data/lessons.json').write_text(json.dumps(lessons, ensure_ascii=False, indent=2) + '\n')
print('Synced existing expressions. IDs and field metadata preserved.')
