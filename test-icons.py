from pathlib import Path
import json
from PIL import Image

root = Path(__file__).parent
for name, size in [
    ("apple-touch-icon.png", 180),
    ("favicon-32.png", 32),
    ("icon-192.png", 192),
    ("icon-512.png", 512),
]:
    with Image.open(root / name) as icon:
        assert icon.size == (size, size), name
        assert icon.mode == "RGBA", name
        assert icon.getpixel((0, 0))[3] == 0, name
        assert icon.getchannel("A").getextrema() == (0, 255), name
    with Image.open(root / name) as icon:
        icon.verify()

manifest = json.loads((root / "site.webmanifest").read_text())
assert manifest["scope"] == manifest["start_url"] == "./"
assert manifest["id"] == "./"
for icon in manifest["icons"]:
    assert icon["src"].endswith("?v=2")
    assert (root / icon["src"].removeprefix("./").split("?")[0]).exists()
html = (root / "index.html").read_text()
assert "apple-touch-icon.png?v=2" in html
assert "site.webmanifest?v=2" in html
assert "home-club-visual" not in html
assert "logo-pagny-header.png" in html
assert all(icon["purpose"] == "any" for icon in manifest["icons"])
print("OK : quatre PNG transparents valides, tailles, manifeste versionné et accueil inchangé.")
