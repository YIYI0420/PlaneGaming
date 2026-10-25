"""Subset the OFL Noto font after adding Chinese UI copy (full font stays in Downloads)."""
import json
import re
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parent.parent
source = root / 'Tools/Downloads/NotoSansCJKsc-Regular.otf'
texts = [(root / 'Assets/Blackout/Resources/BlackoutCatalog.json').read_text(encoding='utf-8-sig')]
for path in (root / 'Assets/Blackout/Runtime').glob('*.cs'):
    texts.extend(re.findall(r'"(?:[^"\\]|\\.)*"', path.read_text(encoding='utf-8-sig')))
characters = ''.join(sorted(set(''.join(texts) + ''.join(chr(i) for i in range(32,127)))))
font = TTFont(source)
options = subset.Options()
options.name_IDs = ['*']
worker = subset.Subsetter(options=options)
worker.populate(text=characters)
worker.subset(font)
for record in font['name'].names:
    if record.nameID in (1,3,4,6,16):
        record.string = ('AfterBlackoutUI' if record.nameID == 6 else 'AfterBlackout UI').encode(record.getEncoding())
font.save(root / 'Assets/Blackout/Resources/UI/AfterBlackoutUI.otf')
(root / 'Tools/font-coverage.txt').write_text(characters, encoding='utf-8')
print('Updated UI font subset and coverage manifest.')
