"""PIPS!'s app icons, favicons and push icons from HMIF's official logo (P0-C).

Every image is the official public/logo/hmif.png, whole and unaltered (only scaled, keeping its 800 x 533 shape),
centred on an ink field (#1B1508, HMIF's ink) with clear space around it, as SPEC "Design tokens and theming" and
the prototype's notes page ("Ikon aplikasi", "Layar pembuka") show it. The owner's rule: never redraw, crop,
recolour, stretch or cover the logo (memory/hmif-logo-unaltered.md). HMIF signs these off (OPEN-QUESTIONS).

Run from apps/web:  python3 scripts/icons/build-icons.py
Needs Pillow. Writes into public/.
"""
from pathlib import Path

from PIL import Image

INK = (0x1B, 0x15, 0x08, 255)
ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "public"
LOGO = Image.open(PUBLIC / "logo" / "hmif.png").convert("RGBA")

# (file, size in px, the logo's width as a share of the side)
# - "any" icons and the Apple touch icon: the prototype's app icon puts a 54 px logo on a 78 px tile (0.69).
# - maskable icons: the logo stays inside the 80 % safe circle (its corners at 0.60 x width from the centre).
# - favicons and the push badge are tiny: the logo takes nearly the whole width so it stays recognisable.
ICONS = [
    ("android-chrome-192x192.png", 192, 0.70),
    ("android-chrome-384x384.png", 384, 0.70),
    ("android-chrome-512x512.png", 512, 0.70),
    ("android-chrome-maskable-192x192.png", 192, 0.56),
    ("android-chrome-maskable-512x512.png", 512, 0.56),
    ("apple-touch-icon.png", 180, 0.70),
    ("mstile-150x150.png", 270, 0.70),
    ("push-icon-192x192.png", 192, 0.70),
    ("push-badge-96x96.png", 96, 0.86),
    ("favicon-32x32.png", 32, 0.90),
    ("favicon-16x16.png", 16, 0.90),
]
ICO_SIZES = [16, 32, 48]


def on_ink(size: int, share: float) -> Image.Image:
    """The whole logo, scaled to `share` of the side (shape kept), centred on an ink square."""
    width = max(1, round(size * share))
    height = max(1, round(width * LOGO.height / LOGO.width))
    logo = LOGO.resize((width, height), Image.LANCZOS)
    tile = Image.new("RGBA", (size, size), INK)
    tile.alpha_composite(logo, ((size - width) // 2, (size - height) // 2))
    return tile


def main() -> None:
    for name, size, share in ICONS:
        on_ink(size, share).save(PUBLIC / name, optimize=True)
        print(f"public/{name}  {size}x{size}")
    ico = [on_ink(s, 0.90) for s in ICO_SIZES]
    ico[-1].save(PUBLIC / "favicon.ico", sizes=[(s, s) for s in ICO_SIZES], append_images=ico[:-1])
    print("public/favicon.ico  16, 32, 48")


if __name__ == "__main__":
    main()
