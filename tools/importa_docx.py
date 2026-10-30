#!/usr/bin/env python3
"""Legge una programmazione .docx con tabella CAPITOLO | OBIETTIVI | ATTIVITÀ (formato Contaci)
e produce un libro in formato ProMateoS (JSON).

Uso:
  python3 importa_docx.py programmazione.docx --id contaci-N2 --titolo "Contaci – Numeri 2" \
      --materia Matematica --editore Zanichelli -o ../catalogo/contaci-N2.json
Richiede: python-docx
"""
import argparse, json, re, sys
import docx


def pulisci(t):
    return re.sub(r'\s+', ' ', t or '').strip()


def leggi(percorso):
    d = docx.Document(percorso)
    tabella = d.tables[0]
    sezioni = []
    for riga in tabella.rows[2:]:
        celle, prima = [], None
        for c in riga.cells:
            if c._tc is prima:
                celle.append('')
                continue
            prima = c._tc
            celle.append(c.text)
        if not celle[0].strip():
            continue
        m = re.match(r'\s*(\d+)\s*(.*)', celle[0].replace('\n', ' ').strip())
        numero = m.group(1) if m else '?'
        titolo = pulisci((m.group(2) if m else celle[0]).replace('  /', ''))
        obiettivi = [pulisci(x.strip(' •-\t')) for x in re.split(r'\n|•', celle[1]) if x.strip(' •-\t\n')]
        les = []
        for mm in re.finditer(r'Lezione\s+(\d+)\s+([^\n\t]+)', celle[2]):
            les.append({'id': f'{numero}-L{mm.group(1)}', 'titolo': f'Lezione {mm.group(1)} ' + pulisci(mm.group(2)).rstrip('/ ').strip(), 'pagine': ''})
        sezioni.append({'id': f'cap{numero}', 'codice': f'Cap. {numero}', 'titolo': titolo,
                        'lezioni': les, 'obiettivi': obiettivi, 'indicatori': [], 'traguardi': []})
    return sezioni


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('docx')
    ap.add_argument('--id', required=True)
    ap.add_argument('--titolo', required=True)
    ap.add_argument('--materia', default='Matematica')
    ap.add_argument('--editore', default='')
    ap.add_argument('-o', '--output', required=True)
    a = ap.parse_args()
    libro = {'id': a.id, 'titolo': a.titolo, 'editore': a.editore, 'materia': a.materia, 'sezioni': leggi(a.docx)}
    with open(a.output, 'w', encoding='utf-8') as f:
        json.dump(libro, f, ensure_ascii=False, indent=1)
    print(f'{a.output}: {len(libro["sezioni"])} capitoli')


if __name__ == '__main__':
    sys.exit(main())
