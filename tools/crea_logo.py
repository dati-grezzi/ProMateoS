#!/usr/bin/env python3
"""Genera i loghi di ProMateoS in stile "famiglia datigrezzi": vettori piatti, testo in Zilla Slab Bold
convertito in tracciati (i file non dipendono da nessun carattere installato).

Uso:  python3 tools/crea_logo.py          -> scrive logo/*.svg
Richiede: fonttools, brotli
"""
import pathlib
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

radice = pathlib.Path(__file__).resolve().parent.parent
font = TTFont(radice / 'caratteri' / 'ZillaSlab-Bold.woff2')
glifi = font.getGlyphSet()
cmap = font.getBestCmap()
upem = font['head'].unitsPerEm

INCHIOSTRO = '#1B1450'   # viola notte
VIOLA = '#6A4CFF'
CIANO = '#2FD3EE'
AVORIO = '#F4F0E6'


def testo_in_tracciati(testo, x, linea_base, corpo):
    """Restituisce (tracciato SVG, larghezza) per `testo` in Zilla Slab Bold, corpo in unità SVG."""
    scala = corpo / upem
    pen = SVGPathPen(glifi)
    cursore = x
    for ch in testo:
        nome = cmap[ord(ch)]
        glifo = glifi[nome]
        glifo.draw(TransformPen(pen, (scala, 0, 0, -scala, cursore, linea_base)))
        cursore += glifo.width * scala
    return pen.getCommands(), cursore - x


def emblema(x=0, y=0, s=1.0, bordo=INCHIOSTRO, palla=VIOLA, luce=CIANO, segno=AVORIO, punto=CIANO):
    """Sfera di cristallo piatta su un sostegno: due forme, un tratto di luce e il percorso verso il futuro."""
    return f'''<g transform="translate({x:.1f},{y:.1f}) scale({s:.4f})">
    <path d="M38 82 H82 L92 106 H28 Z" fill="{bordo}"/>
    <circle cx="60" cy="50" r="36" fill="{palla}" stroke="{bordo}" stroke-width="5"/>
    <path d="M33 44 A29 29 0 0 1 56 22" fill="none" stroke="{luce}" stroke-width="5" stroke-linecap="round"/>
    <path d="M36 64 Q56 30 83 40" fill="none" stroke="{segno}" stroke-width="5.5" stroke-linecap="round"/>
    <circle cx="36" cy="64" r="4.5" fill="{segno}"/>
    <circle cx="83" cy="40" r="6.5" fill="{punto}"/>
  </g>'''


def svg(viewbox, corpo, etichetta='ProMateoS'):
    w, h = viewbox
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.1f} {h:.1f}" width="{round(w)}" height="{round(h)}" '
            f'role="img" aria-label="{etichetta}">\n  {corpo}\n</svg>\n')


def marchio_disteso(chiaro_su_scuro=False):
    corpo_testo = 70
    base_y = 82
    x0 = 118
    c1 = AVORIO if chiaro_su_scuro else INCHIOSTRO
    c2 = CIANO if chiaro_su_scuro else VIOLA
    p1, w1 = testo_in_tracciati('ProMate', x0, base_y, corpo_testo)
    p2, w2 = testo_in_tracciati('oS', x0 + w1, base_y, corpo_testo)
    larghezza = x0 + w1 + w2 + 6
    bordo = AVORIO if chiaro_su_scuro else INCHIOSTRO
    emb = emblema(0, 4, 1.0, bordo=bordo, palla=VIOLA, luce=CIANO, segno=AVORIO, punto=CIANO)
    riga = f'<rect x="{x0 + 2:.1f}" y="{base_y + 14}" width="{w1 + w2 - 4:.1f}" height="5" rx="2.5" fill="{CIANO if not chiaro_su_scuro else VIOLA}"/>'
    corpo = f'{emb}\n  <path d="{p1}" fill="{c1}"/>\n  <path d="{p2}" fill="{c2}"/>\n  {riga}'
    return svg((larghezza, 120), corpo)


def icona(fondo_scuro=False):
    bordo = AVORIO if fondo_scuro else INCHIOSTRO
    return svg((120, 120), emblema(0, 0, 1.0, bordo=bordo), 'ProMateoS')


if __name__ == '__main__':
    cartella = radice / 'logo'
    cartella.mkdir(exist_ok=True)
    (cartella / 'promateos.svg').write_text(marchio_disteso(False), encoding='utf-8')
    (cartella / 'promateos-fondo-scuro.svg').write_text(marchio_disteso(True), encoding='utf-8')
    (cartella / 'promateos-icona.svg').write_text(icona(False), encoding='utf-8')
    (cartella / 'promateos-icona-fondo-scuro.svg').write_text(icona(True), encoding='utf-8')
    (cartella / 'favicon.svg').write_text(icona(False), encoding='utf-8')
    print('logo/: 5 file')
