"""Генерирует иконки и соц-превью Maximize Musik (Pillow + numpy)."""

from __future__ import annotations

import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
WEB = os.path.join(ROOT, "apps", "web", "public")
DESKTOP = os.path.join(ROOT, "apps", "desktop", "build")
SIZE = 1024

VIOLET = (139, 92, 246)
FUCHSIA = (232, 121, 249)
CYAN = (34, 211, 238)
DARK = (8, 8, 14)


def base_gradient(size: int, glow: float = 1.0) -> Image.Image:
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    nx = xx / size
    ny = yy / size

    image = np.zeros((size, size, 3), dtype=np.float32)
    image[:] = DARK

    def add(cx: float, cy: float, radius: float, color: tuple[int, int, int], power: float):
        dist = np.sqrt((nx - cx) ** 2 + (ny - cy) ** 2)
        falloff = np.clip(1.0 - dist / radius, 0.0, 1.0) ** power
        for channel in range(3):
            image[:, :, channel] += color[channel] * falloff * glow

    add(0.2, 0.08, 0.85, VIOLET, 2.1)
    add(0.95, 0.95, 0.8, CYAN, 2.6)
    add(0.8, 0.05, 0.7, FUCHSIA, 3.2)

    # Виньетка
    vignette = np.clip(1.25 - 1.1 * np.sqrt((nx - 0.5) ** 2 + (ny - 0.5) ** 2), 0.25, 1.0)
    image *= vignette[:, :, None]

    return Image.fromarray(np.clip(image, 0, 255).astype(np.uint8), "RGB")


def gradient_layer(size: int) -> Image.Image:
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    t = np.clip((xx / size) * 0.55 + (yy / size) * 0.45, 0, 1)

    stops = [
        (0.0, VIOLET),
        (0.5, FUCHSIA),
        (1.0, CYAN),
    ]
    out = np.zeros((size, size, 3), dtype=np.float32)
    for index in range(len(stops) - 1):
        p0, c0 = stops[index]
        p1, c1 = stops[index + 1]
        mask = (t >= p0) & (t <= p1)
        local = (t - p0) / max(p1 - p0, 1e-6)
        for channel in range(3):
            out[:, :, channel] = np.where(
                mask,
                c0[channel] + (c1[channel] - c0[channel]) * local,
                out[:, :, channel],
            )
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")


def draw_m(draw: ImageDraw.ImageDraw, size: int, scale: float = 1.0, width: int | None = None):
    center = size / 2
    span = size * 0.44 * scale
    top = center - span * 0.52
    bottom = center + span * 0.46
    left = center - span * 0.7
    right = center + span * 0.7
    mid_x = center
    mid_y = top + span * 0.52
    stroke = width or int(size * 0.082 * (0.9 + scale * 0.1))

    points = [
        (left, bottom),
        (left, top),
        (mid_x, mid_y),
        (right, top),
        (right, bottom),
    ]
    draw.line(points, fill=255, width=stroke, joint="curve")
    radius = stroke / 2
    for point in (points[0], points[-1]):
        draw.ellipse(
            [point[0] - radius, point[1] - radius, point[0] + radius, point[1] + radius],
            fill=255,
        )


def render_icon(size: int, maskable: bool = False, rounded: bool = True) -> Image.Image:
    canvas_size = SIZE
    background = base_gradient(canvas_size, glow=0.9 if maskable else 1.0)

    # Винтажные круги
    overlay = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    for radius in (0.34, 0.46, 0.58):
        if maskable:
            continue
        overlay_draw.ellipse(
            [
                canvas_size / 2 - canvas_size * radius,
                canvas_size / 2 - canvas_size * radius,
                canvas_size / 2 + canvas_size * radius,
                canvas_size / 2 + canvas_size * radius,
            ],
            outline=(255, 255, 255, 14),
            width=2,
        )
    background = Image.alpha_composite(background.convert("RGBA"), overlay)

    mask = Image.new("L", (canvas_size, canvas_size), 0)
    scale = 0.78 if maskable else 1.0
    draw_m(ImageDraw.Draw(mask), canvas_size, scale=scale)

    glow_mask = mask.filter(ImageFilter.GaussianBlur(canvas_size * 0.035))
    glow = Image.new("RGBA", (canvas_size, canvas_size), (139, 92, 246, 0))
    glow.putalpha(glow_mask.point(lambda value: int(value * (0.5 if maskable else 0.65))))

    gradient = gradient_layer(canvas_size).convert("RGBA")
    gradient.putalpha(mask)

    composed = Image.alpha_composite(background, glow)
    composed = Image.alpha_composite(composed, gradient)

    if rounded and not maskable:
        radius = int(canvas_size * 0.235)
        rounded_mask = Image.new("L", (canvas_size, canvas_size), 0)
        ImageDraw.Draw(rounded_mask).rounded_rectangle(
            [0, 0, canvas_size, canvas_size], radius=radius, fill=255
        )
        composed.putalpha(rounded_mask)
    else:
        composed.putalpha(255)

    return composed.resize((size, size), Image.LANCZOS)


def make_og(path: str):
    width, height = 1200, 630
    image = base_gradient(max(width, height), glow=1.0).resize((width, height), Image.LANCZOS)
    draw = ImageDraw.Draw(image, "RGBA")

    # диски
    for radius, alpha in ((330, 26), (250, 20), (170, 16)):
        draw.ellipse(
            [width - 210 - radius, height / 2 - radius, width - 210 + radius, height / 2 + radius],
            outline=(255, 255, 255, alpha),
            width=2,
        )
    draw.ellipse(
        [width - 300, height / 2 - 90, width - 120, height / 2 + 90],
        fill=(10, 10, 18, 220),
    )
    draw.ellipse(
        [width - 245, height / 2 - 35, width - 175, height / 2 + 35],
        fill=(139, 92, 246, 235),
    )

    def font(name: str, size: int):
        for candidate in (
            f"C:/Windows/Fonts/{name}.ttf",
            f"/usr/share/fonts/truetype/dejavu/{name}.ttf",
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        ):
            if os.path.exists(candidate):
                try:
                    return ImageFont.truetype(candidate, size)
                except OSError:
                    continue
        return ImageFont.load_default()

    display = font("arialbd", 76)
    sub = font("arial", 30)
    small = font("arialbd", 20)

    draw.text((84, 150), "MAXIMIZE", font=display, fill=(245, 244, 251))
    draw.text((84, 238), "MUSIK", font=display, fill=(196, 181, 253))
    draw.text(
        (88, 356),
        "Музыка без подписки",
        font=sub,
        fill=(200, 198, 215),
    )
    draw.text(
        (88, 404),
        "Телефон · Windows · Telegram",
        font=sub,
        fill=(140, 138, 160),
    )

    badge_font = small
    draw.rounded_rectangle([88, 486, 322, 534], radius=24, fill=(139, 92, 246, 60))
    draw.text((108, 498), "бесплатно · легально", font=badge_font, fill=(224, 214, 255))

    image.convert("RGB").save(path, quality=92)


def main():
    os.makedirs(os.path.join(WEB, "icons"), exist_ok=True)
    os.makedirs(DESKTOP, exist_ok=True)

    icon_512 = render_icon(512)
    icon_512.save(os.path.join(WEB, "icons", "icon-512.png"))
    render_icon(192).save(os.path.join(WEB, "icons", "icon-192.png"))
    render_icon(180).save(os.path.join(WEB, "icons", "apple-touch-icon.png"))
    render_icon(512, maskable=True).save(os.path.join(WEB, "icons", "maskable-512.png"))
    render_icon(32).save(os.path.join(WEB, "icons", "favicon-32.png"))

    icon_512.save(os.path.join(DESKTOP, "icon.png"))
    icon_512.save(
        os.path.join(DESKTOP, "icon.ico"),
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )

    make_og(os.path.join(WEB, "og-image.png"))
    make_og(os.path.join(ROOT, "docs", "og-image.png"))

    print("assets ready")


if __name__ == "__main__":
    main()
