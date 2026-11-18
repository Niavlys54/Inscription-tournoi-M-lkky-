from pathlib import Path
from PIL import Image, ImageDraw, ImageOps

root = Path(__file__).parent
source_path = root / "icons/source-app-crest.png"
source = ImageOps.exif_transpose(Image.open(source_path)).convert("RGBA")
alpha = source.getchannel("A")
bbox = alpha.point(lambda value: 255 if value > 100 else 0).getbbox()
if not bbox:
    raise ValueError("Logo vide")
crest = source.crop(bbox)

def icon(size, fraction):
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    logo = crest.copy()
    logo.thumbnail((round(size*fraction), round(size*fraction)), Image.Resampling.LANCZOS)
    image.alpha_composite(logo, ((size-logo.width)//2, (size-logo.height)//2))
    return image

for filename, size, fraction in [
    ("apple-touch-icon.png",180,0.88),
    ("favicon-32.png",32,0.92),
    ("icon-192.png",192,0.88),
    ("icon-512.png",512,0.88),
]:
    icon(size, fraction).save(root / filename, optimize=True)

# Preview only: neutral backdrop is not part of the transparent app icons.
preview = Image.new("RGB",(720,420),"#e2e8f0")
draw = ImageDraw.Draw(preview)
tile = icon(256,0.88)
preview.paste(tile,(232,56),tile)
draw.text((288,336),"AS Pagny",fill="#0f172a",font_size=28)
out = Path("attached_assets/apercu-nouvelle-icone-pagny.png")
out.parent.mkdir(exist_ok=True)
preview.save(out)
print("Icônes créées ; source recadrée :",crest.size)
