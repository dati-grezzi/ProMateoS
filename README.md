# ProMateoS

Strumento per stilare **piani annuali e programmazioni didattiche**, settimana per settimana.
Si parte dal calendario dell'anno scolastico (inizio, fine, festività), si importano le
programmazioni dei libri di testo e si sceglie cosa fare e quando.

App web a file unico (React via CDN), senza server: i dati restano nel browser.

## Come si usa

1. **Anno**: inizio e fine delle lezioni, festività (le nazionali si propongono da sole). Il calendario delle settimane si ricalcola a ogni modifica. "Nuovo anno scolastico" riparte da nuove date portando con sé i piani.
2. **Libri**: libri e programmazioni, con sezioni, lezioni, obiettivi e indicatori. Si importano da `.json`, `.docx` (tabella capitolo / obiettivi / attività) o da testo incollato.
3. **Piani**: un piano per materia e classe, con orario settimanale, libri usati, sezioni scelte e ordine di svolgimento. Il sabato si decide classe per classe (ore del sabato maggiori di zero), per le scuole con regime misto.
4. **Settimane**: per ogni settimana si scelgono le lezioni dal libro, o si aggiungono voci libere, verifiche e ripassi. "Distribuisci" riempie le settimane in base alle ore disponibili.
5. **Esporta**: tabella annuale in Word (`.docx`), CSV o PDF (stampa). Più piani possono stare affiancati, come nelle tabelle aritmetica / geometria. Il backup completo si scarica e si ripristina da qui.

## Libri inclusi

* *Scopri perché!* (Tibone, Tarasco, Zanichelli), volumi A, B, C, D: unità, lezioni con pagine, traguardi, indicatori, obiettivi.
* *Contaci* (Zanichelli), programmazioni di numeri e di misure, spazio e figure per le classi seconde e terze: capitoli, obiettivi, lezioni.

I cataloghi sono in `catalogo/`, estratti dalle programmazioni ufficiali per gli insegnanti.

## Importare altre programmazioni

L'importazione dei file **Word (.docx)** è nell'app stessa e riconosce da sola il formato:

* tabelle con intestazioni diverse (unità, capitolo, modulo…; nuclei, contenuti, lezioni…; traguardi, indicatori, obiettivi, abilità, attività…), anche su più righe, con celle unite e intestazioni ripetute;
* tabelle senza intestazioni: il ruolo di ogni colonna si deduce dal contenuto (pagine, "Lezione N", verbi degli obiettivi);
* documenti senza tabelle: titoli ed elenchi (`Obiettivi:`, `Lezioni:`).

Prima di importare, l'app mostra cosa ha riconosciuto e lascia correggere il ruolo di ogni colonna: se il riconoscimento non basta non c'è un errore senza uscita, si imposta a mano. Si importano anche `.json` e `.txt`.

I **PDF** si leggono con uno strumento Python (le tabelle dei PDF sono la fonte più precisa) che produce un `.json` da importare nell'app o da mettere in `catalogo/`:

```
pip install pdfplumber
python3 tools/importa_pdf.py volume.pdf --id scopri-A --titolo "Scopri perché! – Volume A" \
    --materia Scienze --editore Zanichelli --prefisso A -o catalogo/scopri-A.json
python3 tools/build.py        # rigenera index.html
```

`importa_pdf.py` legge il formato "Idee per insegnare" (pagine dispari: unità / nuclei / profili / traguardi / indicatori; pagine pari: obiettivi / attività). Il vecchio `.doc` va salvato come `.docx` prima dell'importazione.

Formato di un libro:

```json
{ "id": "…", "titolo": "…", "editore": "…", "materia": "…",
  "sezioni": [ { "id": "A4", "codice": "A4", "titolo": "Le basi della chimica",
                 "lezioni": [ { "id": "A4-1", "titolo": "…", "pagine": "A84-A85" } ],
                 "obiettivi": [], "indicatori": [], "traguardi": [] } ] }
```

## Sviluppo

* `src/app.jsx`: l'applicazione.
* `src/index.template.html`: pagina e stile.
* `tools/build.py`: unisce template, app, importatore e cataloghi in `index.html` (il file che si pubblica).
* `src/importa.js`: lettura dei file Word.
* `tools/importa_pdf.py`: lettura dei PDF delle programmazioni.

Per pubblicare su GitHub Pages: impostazioni del repository, Pages, ramo `main`, cartella radice.

## Licenza

ProMateoS è software libero, rilasciato con la licenza **GNU General Public License v3.0**: vedi il file `LICENSE`.
