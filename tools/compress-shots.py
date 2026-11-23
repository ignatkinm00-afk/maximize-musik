from PIL import Image
import os

os.makedirs("docs/screenshots", exist_ok=True)

pairs = [
    ("screenshots/01-home.png", "docs/screenshots/home.jpg", 1400),
    ("screenshots/04-full-player.png", "docs/screenshots/player.jpg", 1400),
    ("screenshots/09-admin-dashboard.png", "docs/screenshots/admin.jpg", 1400),
    ("screenshots/12-admin-broadcast.png", "docs/screenshots/broadcast.jpg", 1400),
    ("screenshots/13-mobile-home.png", "docs/screenshots/mobile-home.jpg", 520),
    ("screenshots/15-mobile-player.png", "docs/screenshots/mobile-player.jpg", 520),
]

for src, dst, width in pairs:
    if not os.path.exists(src):
        print("skip", src)
        continue
    image = Image.open(src).convert("RGB")
    ratio = width / image.width
    image = image.resize((width, int(image.height * ratio)), Image.LANCZOS)
    image.save(dst, "JPEG", quality=84, optimize=True, progressive=True)
    print(dst, os.path.getsize(dst) // 1024, "KB")
