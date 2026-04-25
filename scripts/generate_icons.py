"""
One-shot script to regenerate the favicon + Apple touch icon from the
master Strategos logo. Re-run any time the master changes.

Outputs (Next.js App Router conventions):
  - src/app/favicon.ico       — multi-size ICO (16, 32, 48, 64)
  - src/app/icon.png          — 512×512 PNG (used for OG / PWA / general)
  - src/app/apple-icon.png    — 180×180 PNG (iOS home-screen icon)

Source image is white-background-friendly: we paste it onto a transparent
canvas so the rounded corners on iOS look clean.

Usage:
    python scripts/generate_icons.py path/to/master.png
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image


HERE = Path(__file__).resolve().parent.parent
APP_DIR = HERE / "src" / "app"


def _load_square(src: Path, size: int) -> Image.Image:
    """Open the master, paste it centered onto a transparent square."""
    master = Image.open(src).convert("RGBA")

    # Trim transparent borders so the icon scales tight to the artwork
    bbox = master.getbbox()
    if bbox:
        master = master.crop(bbox)

    # Fit inside `size`×`size` preserving aspect, centered
    w, h = master.size
    scale = min(size / w, size / h) * 0.92  # 8% padding inside the canvas
    new_size = (max(1, int(w * scale)), max(1, int(h * scale)))
    master = master.resize(new_size, Image.LANCZOS)

    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    offset = ((size - new_size[0]) // 2, (size - new_size[1]) // 2)
    canvas.paste(master, offset, master)
    return canvas


def main() -> None:
    if len(sys.argv) < 2:
        print("usage: python scripts/generate_icons.py <master.png>")
        sys.exit(1)
    src = Path(sys.argv[1]).expanduser().resolve()
    if not src.exists():
        print(f"source not found: {src}")
        sys.exit(1)

    print(f"source: {src}")

    # 1. favicon.ico (multi-size). PIL writes all sizes into one .ico file.
    ico_sizes = [16, 32, 48, 64]
    ico_imgs = [_load_square(src, s) for s in ico_sizes]
    favicon_path = APP_DIR / "favicon.ico"
    ico_imgs[0].save(
        favicon_path,
        format="ICO",
        sizes=[(s, s) for s in ico_sizes],
        append_images=ico_imgs[1:],
    )
    print(f"  + {favicon_path.relative_to(HERE)} ({', '.join(f'{s}x{s}' for s in ico_sizes)})")

    # 2. icon.png — large, used for OG previews + general fallback
    icon_png_path = APP_DIR / "icon.png"
    _load_square(src, 512).save(icon_png_path, format="PNG", optimize=True)
    print(f"  + {icon_png_path.relative_to(HERE)} (512x512)")

    # 3. apple-icon.png — 180×180 is Apple's recommended size since iOS 8
    apple_path = APP_DIR / "apple-icon.png"
    _load_square(src, 180).save(apple_path, format="PNG", optimize=True)
    print(f"  + {apple_path.relative_to(HERE)} (180x180)")


if __name__ == "__main__":
    main()
