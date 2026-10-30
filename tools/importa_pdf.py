#!/usr/bin/env python3
"""Legge una programmazione in PDF nel formato "Idee per insegnare" (Zanichelli,
Tibone-Tarasco, Scopri perché!) e produce un libro in formato ProMateoS (JSON).

Il PDF ha pagine dispari con la tabella UNITÀ | NUCLEI | PROFILI | TRAGUARDI | INDICATORI
e pagine pari con OBIETTIVI | ATTIVITÀ | VALUTAZIONE. Le righe delle due tabelle
corrispondono (una riga = una unità).

Uso:
  python3 importa_pdf.py volume.pdf --id scopri-A --titolo "Scopri perché! – Volume A" \
      --materia Scienze --editore Zanichelli --prefisso A -o ../catalogo/scopri-A.json
Richiede: pdfplumber
"""
import argparse, json, re, sys
import pdfplumber

NOMI_PROPRI = {'terra': 'Terra', 'luna': 'Luna', 'sole': 'Sole', 'homo': 'Homo', 'italia': 'Italia'}


def norm(t):
    return re.sub(r'\s+', ' ', t or '').strip()


def frasi(riquadro):
    """Righe di un riquadro -> frasi. Una frase termina con il punto; ':' e ';' continuano."""
    parole = riquadro.extract_words(x_tolerance=1.5, y_tolerance=2)
    parole.sort(key=lambda w: (round(w['top']), w['x0']))
    righe = []
    for w in parole:
        if righe and abs(righe[-1][0] - w['top']) <= 2.5:
            righe[-1][1].append(w)
        else:
            righe.append([w['top'], [w]])
    testi = [' '.join(x['text'] for x in sorted(r[1], key=lambda x: x['x0'])) for r in righe]
    out, cur = [], ''
    for t in testi:
        cur = (cur + ' ' + t).strip() if cur else t
        if cur.endswith('.'):
            out.append(cur)
            cur = ''
    if cur:
        out.append(cur)
    return [norm(x) for x in out]


def etichetta(riquadro):
    """Etichetta verticale dell'unità (testo ruotato)."""
    car = [c for c in riquadro.chars if not c['upright']]
    if not car:
        return ''
    colonne = {}
    for c in car:
        colonne.setdefault(round(c['x0'] / 8), []).append(c)
    parti = [''.join(x['text'] for x in sorted(colonne[k], key=lambda x: -x['top'])) for k in sorted(colonne)]
    return norm(' '.join(parti))


def lezioni(testo):
    out = []
    for m in re.finditer(r'(.+?)\s*\(\s*pag\.?\s*([^)]*)\)', norm(testo)):
        titolo = re.sub(r'^[•\-–]\s*', '', norm(m.group(1)))
        out.append({'titolo': titolo, 'pagine': norm(m.group(2))})
    return out


def titolo_pulito(t):
    t = t.lower()
    t = t[:1].upper() + t[1:]
    for k, v in NOMI_PROPRI.items():
        t = re.sub(r'(?<=\s)' + k + r'\b', v, t)
    return t


def codice_e_titolo(lab):
    m = re.match(r'^([A-D])\d?\s*[–-]\s*PER\s+IN[IZ]+ARE\s*[–-]\s*(.*)$', lab)
    if m:
        return m.group(1) + '0', 'Per iniziare – ' + titolo_pulito(m.group(2))
    m = re.match(r'^([A-D]\d{1,2})\s+(.*)$', lab)
    if m:
        return m.group(1), titolo_pulito(m.group(2))
    return '', lab


def leggi(percorso):
    unita = []
    with pdfplumber.open(percorso) as pdf:
        for i in range(0, len(pdf.pages) - 1, 2):
            po, pe = pdf.pages[i], pdf.pages[i + 1]
            co, ce = po.crop(po.cropbox), pe.crop(pe.cropbox)
            to = [t for t in co.find_tables() if t.bbox[2] - t.bbox[0] > 300]
            te = [t for t in ce.find_tables() if t.bbox[2] - t.bbox[0] > 300]
            if not to or not te:
                continue
            ok = lambda r: r.bbox[1] >= 118 and r.bbox[3] - r.bbox[1] >= 130
            ro = [r for r in to[0].rows if ok(r)]
            rp = [r for r in te[0].rows if ok(r)]
            for a, b in zip(ro, rp):
                def ritaglia(pagina, cella, riga):
                    if cella is None:
                        return None
                    return pagina.crop((cella[0] + 1, riga.bbox[1] + 1, cella[2] - 1, riga.bbox[3] - 1))
                ca, cb = a.cells, b.cells
                if len(ca) < 5 or len(cb) < 4:
                    continue
                lab = ritaglia(co, ca[0], a)
                nuclei = ritaglia(co, ca[1], a)
                tragu = ritaglia(co, ca[3], a)
                indic = ritaglia(co, ca[4], a)
                obiet = ritaglia(ce, cb[1], b)
                unita.append({
                    'etichetta': etichetta(lab) if lab else '',
                    'lezioni': lezioni(nuclei.extract_text()) if nuclei else [],
                    'traguardi': frasi(tragu) if tragu else [],
                    'indicatori': frasi(indic) if indic else [],
                    'obiettivi': frasi(obiet) if obiet else [],
                })
    return unita


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('pdf')
    ap.add_argument('--id', required=True)
    ap.add_argument('--titolo', required=True)
    ap.add_argument('--materia', default='Scienze')
    ap.add_argument('--editore', default='')
    ap.add_argument('--prefisso', default='', help='tiene solo le unità con questo prefisso (es. A)')
    ap.add_argument('-o', '--output', required=True)
    a = ap.parse_args()
    sezioni = []
    for u in leggi(a.pdf):
        codice, titolo = codice_e_titolo(u['etichetta'])
        if not codice or (a.prefisso and not codice.startswith(a.prefisso)):
            continue
        sezioni.append({
            'id': codice, 'codice': codice, 'titolo': titolo,
            'lezioni': [{'id': f'{codice}-{n}', **l} for n, l in enumerate(u['lezioni'], 1)],
            'obiettivi': u['obiettivi'], 'indicatori': u['indicatori'], 'traguardi': u['traguardi'],
        })
    libro = {'id': a.id, 'titolo': a.titolo, 'editore': a.editore, 'materia': a.materia, 'sezioni': sezioni}
    with open(a.output, 'w', encoding='utf-8') as f:
        json.dump(libro, f, ensure_ascii=False, indent=1)
    print(f'{a.output}: {len(sezioni)} unità')


if __name__ == '__main__':
    sys.exit(main())
