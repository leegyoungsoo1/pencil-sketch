from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parent
ICONS = ROOT / "icons"
SOURCE = ICONS / "woong-rabbit-icon-master.png"


def save_square(source: Image.Image, size: int, name: str) -> None:
    image = source.resize((size, size), Image.Resampling.LANCZOS).convert("RGBA")
    scale = 4
    mask = Image.new("L", (size * scale, size * scale), 0)
    radius = round(size * 0.24 * scale)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size * scale - 1, size * scale - 1), radius=radius, fill=255)
    image.putalpha(mask.resize((size, size), Image.Resampling.LANCZOS))
    image.save(ICONS / name, optimize=True)


source = Image.open(SOURCE).convert("RGB")
save_square(source, 32, "woong-rabbit-rounded-32.png")
save_square(source, 180, "woong-rabbit-rounded-180.png")
save_square(source, 192, "woong-rabbit-rounded-192.png")
save_square(source, 512, "woong-rabbit-rounded-512.png")

# Maskable icons need extra breathing room because launchers may crop them to a circle.
safe_size = 394
safe_icon = source.resize((safe_size, safe_size), Image.Resampling.LANCZOS)
maskable = Image.new("RGB", (512, 512), "#fbf8f0")
maskable.paste(safe_icon, ((512 - safe_size) // 2, (512 - safe_size) // 2))
maskable.save(ICONS / "woong-rabbit-maskable-v2-512.png", optimize=True)

print("웅토끼 사이트 아이콘 5개를 만들었습니다.")
