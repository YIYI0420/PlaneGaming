"""Check source assets and Chinese UI coverage; uses fontTools when available."""
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parent.parent
assets = root / "Assets"
catalog = json.loads((assets / "Blackout/Resources/BlackoutCatalog.json").read_text(encoding="utf-8-sig"))
assert len(catalog["chapters"]) == 3
assert {g["id"] for g in catalog["guns"]} == {"m4", "ak", "awm", "pistol"}
assert len(catalog["melee"]) == 5
guids = {}
for meta in assets.rglob("*.meta"):
    match = re.search(r"^guid: ([a-f0-9]{32})$", meta.read_text(encoding="utf-8-sig"), re.M)
    assert match, f"Missing GUID: {meta}"
    assert match[1] not in guids, f"Duplicate GUID: {meta} / {guids.get(match[1])}"
    guids[match[1]] = meta
for name in ("Boot", "Chapter01", "Chapter02", "Chapter03"):
    assert (assets / f"Blackout/Scenes/{name}.unity").is_file(), f"Generate scenes first: {name}"
for chapter in catalog["chapters"]:
    bounds = chapter["bounds"]
    for key in ("spawn", "bossSpawn", "box", "exit"):
        point = chapter[key]
        assert bounds["x1"] < point["x"] < bounds["x2"]
        assert bounds["z1"] < point["z"] < bounds["z2"]
    assert (assets / f'Blackout/Generated/Navigation/{chapter["id"]}.asset').is_file()
    assert len(chapter["waves"]) == 3
assert (assets / "Blackout/Resources/UI/OFL.txt").is_file()
try:
    from fontTools.ttLib import TTFont
except ImportError:
    print("SKIP: Chinese font coverage requires fontTools (pip install fonttools).")
else:
    texts = [json.dumps(catalog, ensure_ascii=False)]
    for source in (assets / "Blackout/Runtime").glob("*.cs"):
        texts.extend(re.findall(r'"(?:[^"\\]|\\.)*"', source.read_text(encoding="utf-8-sig")))
    required = {ord(c) for c in "".join(texts) if "\u3400" <= c <= "\u9fff"}
    with TTFont(assets / "Blackout/Resources/UI/AfterBlackoutUI.otf") as font:
        available = {code for table in font["cmap"].tables for code in table.cmap}
    missing = required - available
    assert not missing, "Missing Chinese UI glyphs: " + "".join(chr(c) for c in sorted(missing))
    print(f"PASS: font contains all {len(required)} Chinese UI/catalog characters.")
print(f"PASS: 3 scenes, 3 navigation assets, equipment catalog, license and {len(guids)} unique asset GUIDs.")
