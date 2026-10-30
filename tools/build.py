#!/usr/bin/env python3
"""Costruisce index.html unendo src/index.template.html, src/app.jsx, src/importa.js e i libri di catalogo/*.json."""
import json, pathlib

radice = pathlib.Path(__file__).resolve().parent.parent
ordine = ['scopri-A', 'scopri-B', 'scopri-C', 'scopri-D', 'contaci-N2', 'contaci-G2', 'contaci-N3', 'contaci-G3']
libri = []
for nome in ordine:
    libri.append(json.loads((radice / 'catalogo' / f'{nome}.json').read_text(encoding='utf-8')))
for f in sorted((radice / 'catalogo').glob('*.json')):
    if f.stem not in ordine:
        libri.append(json.loads(f.read_text(encoding='utf-8')))
catalogo = json.dumps(libri, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
importa = (radice / 'src' / 'importa.js').read_text(encoding='utf-8')
app = (radice / 'src' / 'app.jsx').read_text(encoding='utf-8').replace('/*__IMPORTA__*/', importa).replace('/*__CATALOGO__*/[]', catalogo)
html = (radice / 'src' / 'index.template.html').read_text(encoding='utf-8').replace('/*__APP__*/', app)
(radice / 'index.html').write_text(html, encoding='utf-8')
print(f'index.html: {len(html) // 1024} KB, {len(libri)} libri')
