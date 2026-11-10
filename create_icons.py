from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).parent
source_path = root / "logo.PNG"
if not source_path.exists():
    source_path = root / "icons/source-original.png"
source = Image.open(source_path).convert("RGBA")
alpha = source.getchannel("A")
bbox = alpha.point(lambda value: 255 if value > 100 else 0).getbbox()
if not bbox:
    raise ValueError("Logo vide")
crest = source.crop(bbox)

def icon(size, fraction):
    image = Image.new("RGB", (size, size), "white")
    logo = crest.copy()
    logo.thumbnail((round(size*fraction), round(size*fraction)), Image.Resampling.LANCZOS)
    image.paste(logo, ((size-logo.width)//2, (size-logo.height)//2), logo)
    return image

for filename, size, fraction in [
    ("apple-touch-icon.png",180,0.88),
    ("favicon-32.png",32,0.92),
    ("icon-192.png",192,0.88),
    ("icon-512.png",512,0.88),
    ("icon-maskable-512.png",512,0.55),
]:
    icon(size, fraction).save(root / filename, optimize=True)

# Preview only: iOS-like rounded corners, not part of the app icons.
preview = Image.new("RGB",(720,420),"#e2e8f0")
draw = ImageDraw.Draw(preview)
tile = icon(256,0.88)
mask = Image.new("L",(256,256),0)
ImageDraw.Draw(mask).rounded_rectangle((0,0,255,255),radius=57,fill=255)
preview.paste(tile,(232,56),mask)
draw.text((288,336),"AS Pagny",fill="#0f172a",font_size=28)
out = Path("attached_assets/apercu-icone-as-pagny.png")
out.parent.mkdir(exist_ok=True)
preview.save(out)
print("Icônes créées ; source recadrée :",crest.size)
