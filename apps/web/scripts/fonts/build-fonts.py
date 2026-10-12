"""Builds PIPS!'s two self-hosted fonts (SPEC "Typography") into apps/web/public/fonts/.

- Geist, variable, weights 400-600, Latin and Latin Extended: from the `geist` package (SIL OFL 1.1).
- Archivo Expanded 700: one static instance (wdth 125, wght 700), Latin only, from `@fontsource-variable/archivo`
  (SIL OFL 1.1).

It also prints the metric overrides for the fallback faces in src/styles/garis/fonts.css, so the swap from the
fallback to the real font doesn't move the layout.

Run from apps/web after `pnpm install` (needs Python 3 with fontTools and brotli):
    python3 scripts/fonts/build-fonts.py
The output files are committed; CI and builds don't run this. tests/garis-fonts.test.mjs checks the budgets.
"""
import io
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(APP, 'public', 'fonts')
GEIST_SRC = os.path.join(APP, 'node_modules', 'geist', 'dist', 'fonts', 'geist-sans', 'Geist-Variable.woff2')
ARCHIVO_SRC = os.path.join(APP, 'node_modules', '@fontsource-variable', 'archivo', 'files', 'archivo-latin-wdth-normal.woff2')

# Google Fonts' "latin" and "latin-ext" ranges, plus the arrows and the command key the app shows.
LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2190-2193,U+2212,U+2215,U+2318,U+FEFF,U+FFFD'
LATIN_EXT = 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1E00-1E9F,U+1EF2-1EFF,U+20A0-20AB,U+20AD-20C0,U+2113'
FEATURES = ['kern', 'liga', 'calt', 'ccmp', 'locl', 'mark', 'mkmk', 'tnum', 'case']


def unicodes(spec):
    out = []
    for part in spec.split(','):
        part = part.strip().replace('U+', '')
        if '-' in part:
            a, b = part.split('-')
            out.extend(range(int(a, 16), int(b, 16) + 1))
        else:
            out.append(int(part, 16))
    return out


def subset_font(font, codepoints, axes):
    """Subsets first, then pins or limits the variation axes (fontTools' instancer trips on unsubset gvar data)."""
    opts = subset.Options()
    opts.layout_features = FEATURES
    opts.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]  # keep the copyright and licence records
    opts.notdef_outline = True
    opts.hinting = False
    opts.desubroutinize = True
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=codepoints)
    sub.subset(font)
    font = instancer.instantiateVariableFont(font, axes)
    buf = io.BytesIO()
    font.flavor = 'woff2'
    font.save(buf)
    return buf.getvalue()


def fallback_metrics(font_bytes, label, sample='Halo, Nadia. Jadwal UTS Ganjil 2026/2027 sudah keluar 0123456789'):
    """size-adjust and ascent/descent overrides that make Arial take the font's space."""
    f = TTFont(io.BytesIO(font_bytes))
    upm = f['head'].unitsPerEm
    cmap = f.getBestCmap()
    hmtx = f['hmtx']
    width = sum(hmtx[cmap[ord(c)]][0] for c in sample if ord(c) in cmap) / upm
    # Arial's Latin widths; macOS ships them in Arial Unicode when Arial.ttf itself isn't installed.
    paths = ['/System/Library/Fonts/Supplementary/Arial.ttf', '/Library/Fonts/Arial.ttf', '/Library/Fonts/Arial Unicode.ttf',
             '/usr/share/fonts/truetype/msttcorefonts/Arial.ttf']
    arial_path = next((p for p in paths if os.path.exists(p)), None)
    if not arial_path:
        return None
    a = TTFont(arial_path)
    acmap = a.getBestCmap()
    aw = sum(a['hmtx'][acmap[ord(c)]][0] for c in sample) / a['head'].unitsPerEm
    size_adjust = width / aw
    hhea = f['hhea']
    return {
        'face': label,
        'size-adjust': f'{size_adjust * 100:.2f}%',
        'ascent-override': f'{hhea.ascent / upm / size_adjust * 100:.2f}%',
        'descent-override': f'{-hhea.descent / upm / size_adjust * 100:.2f}%',
        'line-gap-override': f'{hhea.lineGap / upm / size_adjust * 100:.2f}%',
    }


def main():
    os.makedirs(OUT, exist_ok=True)
    geist = TTFont(GEIST_SRC)
    geist_bytes = subset_font(geist, unicodes(LATIN) + unicodes(LATIN_EXT), {'wght': (400, 600)})
    with open(os.path.join(OUT, 'geist-latin-400-600.woff2'), 'wb') as fh:
        fh.write(geist_bytes)

    archivo = TTFont(ARCHIVO_SRC)
    archivo_bytes = subset_font(archivo, unicodes(LATIN), {'wght': 700, 'wdth': 125})
    with open(os.path.join(OUT, 'archivo-expanded-700-latin.woff2'), 'wb') as fh:
        fh.write(archivo_bytes)

    print(f'geist-latin-400-600.woff2: {len(geist_bytes) / 1024:.1f} KiB')
    print(f'archivo-expanded-700-latin.woff2: {len(archivo_bytes) / 1024:.1f} KiB')
    for m in (fallback_metrics(geist_bytes, 'Geist'), fallback_metrics(archivo_bytes, 'Archivo Expanded')):
        print(m)


if __name__ == '__main__':
    sys.exit(main())
