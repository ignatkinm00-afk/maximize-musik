from PIL import Image
import os

src = "apps/web/public/icons/icon-512.png"
base = "apps/mobile/android/app/src/main/res"
densities = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

image = Image.open(src).convert("RGBA")
for folder, size in densities.items():
    target = os.path.join(base, folder)
    os.makedirs(target, exist_ok=True)
    resized = image.resize((size, size), Image.LANCZOS)
    resized.save(os.path.join(target, "ic_launcher.png"))
    # Круглая иконка для лончеров, которые её запрашивают.
    resized.save(os.path.join(target, "ic_launcher_round.png"))
    print(folder, size)
