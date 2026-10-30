const { useState, useEffect, useMemo, useRef } = React;

/* ===================== catalogo incorporato ===================== */
const LIBRI_BASE = /*__CATALOGO__*/[];

/* ===================== utilità ===================== */
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const pad = n => String(n).padStart(2, '0');
const fmtISO = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const lunediDi = d => addDays(d, -((d.getDay() + 6) % 7));
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const GIORNI = ['', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const fmtGM = d => d.getDate() + ' ' + MESI_BREVI[d.getMonth()];
const fmtData = iso => (iso ? fmtGM(parseISO(iso)) + ' ' + parseISO(iso).getFullYear() : '');
const num = v => (Number(v) || 0);
const plur = (n, uno, molti) => n + ' ' + (n === 1 ? uno : molti);
const fmtOre = n => (Math.round(n * 10) / 10).toString().replace('.', ',');

function pasqua(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mese = Math.floor((h + l - 7 * m + 114) / 31), giorno = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, mese - 1, giorno);
}

// Festività nazionali proposte per un anno scolastico (da rivedere: restano modificabili)
function festivitaSuggerite(inizioISO, fineISO) {
  const y0 = parseISO(inizioISO).getFullYear();
  const y1 = Math.max(parseISO(fineISO).getFullYear(), y0);
  const out = [];
  const add = (nome, da, a) => out.push({ id: uid(), nome, da: fmtISO(da), a: fmtISO(a || da) });
  add('Tutti i Santi', new Date(y0, 10, 1));
  add('Immacolata Concezione', new Date(y0, 11, 8));
  if (y1 > y0) add('Vacanze di Natale', new Date(y0, 11, 23), new Date(y1, 0, 6));
  const p = pasqua(y1);
  add('Vacanze di Pasqua', addDays(p, -3), addDays(p, 2));
  add('Festa della Liberazione', new Date(y1, 3, 25));
  add('Festa dei Lavoratori', new Date(y1, 4, 1));
  add('Festa della Repubblica', new Date(y1, 5, 2));
  return out.filter(f => f.a >= inizioISO && f.da <= fineISO);
}

// Date proposte per l'anno scolastico che comprende oggi
function dateSuggerite() {
  const oggi = new Date();
  const y = oggi.getMonth() >= 6 ? oggi.getFullYear() : oggi.getFullYear() - 1;
  return { nome: y + '-' + String(y + 1).slice(2), inizio: y + '-09-14', fine: (y + 1) + '-06-08' };
}

/* ===================== calendario dell'anno ===================== */
function calcolaSettimane(anno) {
  if (!anno.inizio || !anno.fine) return [];
  const ini = parseISO(anno.inizio), fin = parseISO(anno.fine);
  if (fin < ini) return [];
  const trovaFesta = iso => (anno.festivita || []).find(f => f.da <= iso && iso <= (f.a || f.da));
  const nGiorni = 6;
  const out = [];
  let lun = lunediDi(ini), n = 1;
  while (lun <= fin) {
    const giorni = [];
    for (let i = 0; i < nGiorni; i++) {
      const d = addDays(lun, i), iso = fmtISO(d);
      const fuori = d < ini || d > fin;
      const festa = fuori ? null : trovaFesta(iso);
      giorni.push({ iso, dow: i + 1, fuori, festa: festa ? festa.nome : null, lavora: !fuori && !festa });
    }
    const giovedi = addDays(lun, 3);
    out.push({
      n, chiave: fmtISO(lun), lun, alVen: addDays(lun, 4), alSab: addDays(lun, 5), giorni,
      giorniScuola: giorni.filter(g => g.lavora && g.dow <= 5).length,
      mese: MESI[giovedi.getMonth()], meseIdx: giovedi.getFullYear() * 12 + giovedi.getMonth()
    });
    lun = addDays(lun, 7); n++;
  }
  return out;
}

const festeDellaSettimana = s => [...new Set(s.giorni.filter(g => g.festa).map(g => g.festa))];
// Il sabato è una scelta di classe: lo usa il piano che ha ore il sabato (regime misto)
const usaSabato = piano => num(piano.orario[6]) > 0;
const giorniVisibili = (s, piano) => s.giorni.filter(g => g.dow <= 5 || usaSabato(piano));
const vacanzaPiano = (s, piano) => giorniVisibili(s, piano).every(g => !g.lavora);
const festePiano = (s, piano) => [...new Set(giorniVisibili(s, piano).filter(g => g.festa).map(g => g.festa))];
const oreDisponibili = (s, piano) => s.giorni.reduce((t, g) => t + (g.lavora ? num(piano.orario[g.dow]) : 0), 0);
const oreAssegnate = items => (items || []).reduce((t, i) => t + num(i.ore), 0);
const chiaveLezione = r => r.b + '|' + r.s + '|' + r.l;

function indiceLibri(libri) {
  const m = {};
  libri.forEach(b => b.sezioni.forEach(s => s.lezioni.forEach(l => { m[b.id + '|' + s.id + '|' + l.id] = { libro: b, sezione: s, lezione: l }; })));
  return m;
}

// Lezioni del piano, nell'ordine scelto
function lezioniDelPiano(piano, libri) {
  const out = [];
  piano.contenuti.forEach(c => {
    const b = libri.find(x => x.id === c.b);
    const s = b && b.sezioni.find(x => x.id === c.s);
    if (!s) return;
    s.lezioni.forEach(l => out.push({ rif: { b: b.id, s: s.id, l: l.id }, libro: b, sezione: s, lezione: l }));
  });
  return out;
}

function lezioniAssegnate(piano) {
  const m = {};
  Object.keys(piano.assegnazioni).forEach(k => piano.assegnazioni[k].forEach(i => { if (i.rif) m[chiaveLezione(i.rif)] = k; }));
  return m;
}

// Distribuisce le lezioni non ancora assegnate sulle settimane, secondo le ore disponibili
function distribuisci(piano, libri, settimane, dallaChiave) {
  const nuovo = JSON.parse(JSON.stringify(piano.assegnazioni));
  const fatte = lezioniAssegnate({ assegnazioni: nuovo });
  const daFare = lezioniDelPiano(piano, libri).filter(x => !fatte[chiaveLezione(x.rif)]);
  const oreL = num(piano.oreLezione) || 1;
  let aggiunte = 0, i = 0;
  for (const s of settimane) {
    if (dallaChiave && s.chiave < dallaChiave) continue;
    let libere = oreDisponibili(s, piano) - oreAssegnate(nuovo[s.chiave]);
    while (i < daFare.length && libere >= oreL - 1e-9) {
      const x = daFare[i++];
      (nuovo[s.chiave] = nuovo[s.chiave] || []).push({ id: uid(), tipo: 'lezione', testo: x.lezione.titolo, ore: oreL, rif: x.rif });
      libere -= oreL; aggiunte++;
    }
    if (i >= daFare.length) break;
  }
  return { assegnazioni: nuovo, aggiunte, rimaste: daFare.length - i };
}

/* ===================== tabella per esportazione ===================== */
function costruisciTabella(data, pianiIds) {
  const settimane = calcolaSettimane(data.anno);
  const piani = pianiIds.map(id => data.piani.find(p => p.id === id)).filter(Boolean);
  const conSabato = piani.some(usaSabato);
  const righe = settimane.map(s => ({
    mese: s.mese, n: s.n, dal: fmtGM(s.lun), al: fmtGM(conSabato ? s.alSab : s.alVen),
    vacanza: piani.length ? piani.every(p => vacanzaPiano(s, p)) : s.giorniScuola === 0,
    note: (piani.length ? [...new Set([].concat(...piani.map(p => festePiano(s, p))))] : festeDellaSettimana(s)).join(', '),
    celle: piani.map(p => {
      const it = p.assegnazioni[s.chiave] || [];
      return { testo: it.map(x => x.testo).join('; '), ore: oreAssegnate(it) };
    })
  }));
  return { piani, righe, titolo: piani.map(p => p.nome).join(' · '), anno: data.anno.nome };
}

function scaricaFile(nome, contenuto, tipo) {
  const blob = contenuto instanceof Blob ? contenuto : new Blob([contenuto], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const csvCella = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
function tabellaCSV(t) {
  const intest = ['Mese', 'Settimana', 'Dal', 'Al'];
  t.piani.forEach(p => { intest.push(p.nome); intest.push('Ore ' + p.nome); });
  intest.push('Note');
  const righe = [intest.map(csvCella).join(';')];
  t.righe.forEach(r => {
    const c = [r.mese, r.n, r.dal, r.al];
    r.celle.forEach(x => { c.push(x.testo); c.push(x.ore ? fmtOre(x.ore) : ''); });
    c.push(r.note);
    righe.push(c.map(csvCella).join(';'));
  });
  return '﻿' + righe.join('\r\n');
}

const caricati = {};
function caricaScript(url) {
  if (caricati[url]) return caricati[url];
  caricati[url] = new Promise((ok, ko) => {
    const s = document.createElement('script');
    s.src = url; s.onload = ok; s.onerror = () => { delete caricati[url]; ko(new Error('Impossibile caricare ' + url)); };
    document.head.appendChild(s);
  });
  return caricati[url];
}
const URL_DOCX = 'https://cdn.jsdelivr.net/npm/docx@9.7.1/dist/index.iife.js';
const URL_JSZIP = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';

async function tabellaDocx(t) {
  await caricaScript(URL_DOCX);
  const { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, TextRun, ShadingType, PageOrientation, HeadingLevel } = window.docx;
  const bordo = { style: 'single', size: 4, color: '999999' };
  const bordi = { top: bordo, bottom: bordo, left: bordo, right: bordo };
  const cella = (testo, opz = {}) => new TableCell({
    borders: bordi, width: opz.w ? { size: opz.w, type: WidthType.PERCENTAGE } : undefined,
    shading: opz.fill ? { type: ShadingType.CLEAR, fill: opz.fill, color: 'auto' } : undefined,
    children: [new Paragraph({ children: [new TextRun({ text: String(testo == null ? '' : testo), bold: !!opz.bold, size: 18, color: opz.color })] })]
  });
  const nP = t.piani.length;
  const wTesto = Math.floor((100 - 18 - nP * 8) / Math.max(nP, 1));
  const intest = new TableRow({
    tableHeader: true,
    children: [cella('mese', { bold: true, fill: 'E6E3FF', w: 10 }), cella('sett.', { bold: true, fill: 'E6E3FF', w: 8 })]
      .concat(...t.piani.map(p => [cella(p.nome, { bold: true, fill: 'E6E3FF', w: wTesto }), cella('ore', { bold: true, fill: 'E6E3FF', w: 8 })]))
  });
  let meseCorr = '';
  const corpo = t.righe.map(r => {
    const primo = r.mese !== meseCorr; meseCorr = r.mese;
    const grigio = r.vacanza ? 'F3F3F3' : undefined;
    const celleDati = [].concat(...r.celle.map((c, k) => {
      const testo = c.testo || (r.vacanza && k === 0 ? (r.note || 'Vacanza') : '');
      return [cella(testo, { fill: grigio, w: wTesto }), cella(c.ore ? fmtOre(c.ore) : '', { fill: grigio, w: 8 })];
    }));
    return new TableRow({ children: [cella(primo ? r.mese : '', { bold: true, fill: grigio, w: 10 }), cella(r.n + ' (' + r.dal + '–' + r.al + ')', { fill: grigio, w: 8 })].concat(celleDati) });
  });
  const doc = new Document({
    sections: [{
      properties: { page: { size: { orientation: PageOrientation.LANDSCAPE } } },
      children: [
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'Piano annuale ' + t.titolo + ' — anno scolastico ' + t.anno, bold: true })] }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [intest].concat(corpo) })
      ]
    }]
  });
  return Packer.toBlob(doc);
}

/* ===================== importazione di libri ===================== */
function libroDaTesto(testo, meta) {
  const sezioni = [];
  let cur = null;
  const nuova = titolo => { cur = { id: 's' + (sezioni.length + 1), codice: String(sezioni.length + 1), titolo, lezioni: [], obiettivi: [], indicatori: [], traguardi: [] }; sezioni.push(cur); };
  testo.split(/\r?\n/).map(r => r.trim()).filter(Boolean).forEach(r => {
    if (r.startsWith('#')) { nuova(r.replace(/^#+\s*/, '')); return; }
    if (!cur) nuova('Argomenti');
    let m;
    if ((m = r.match(/^obiettivo\s*:\s*(.+)$/i))) cur.obiettivi.push(m[1]);
    else if ((m = r.match(/^indicatore\s*:\s*(.+)$/i))) cur.indicatori.push(m[1]);
    else if ((m = r.match(/^traguardo\s*:\s*(.+)$/i))) cur.traguardi.push(m[1]);
    else {
      const mp = r.match(/^(.*?)\s*\(\s*pag\.?\s*([^)]*)\)\s*$/i);
      cur.lezioni.push({ id: 'l' + (cur.lezioni.length + 1), titolo: mp ? mp[1] : r, pagine: mp ? mp[2] : '' });
    }
  });
  return { id: 'imp-' + uid(), titolo: meta.titolo, editore: meta.editore || '', materia: meta.materia || '', sezioni, importato: true };
}

function validaLibro(j) {
  if (!j || typeof j !== 'object' || !Array.isArray(j.sezioni)) throw new Error('Formato non riconosciuto: manca l\'elenco "sezioni".');
  const b = { id: 'imp-' + uid(), titolo: String(j.titolo || 'Libro importato'), editore: String(j.editore || ''), materia: String(j.materia || ''), importato: true, sezioni: [] };
  j.sezioni.forEach((s, i) => {
    b.sezioni.push({
      id: String(s.id || 's' + (i + 1)), codice: String(s.codice || i + 1), titolo: String(s.titolo || 'Sezione ' + (i + 1)),
      lezioni: (s.lezioni || []).map((l, k) => ({ id: String(l.id || 'l' + (k + 1)), titolo: String(l.titolo || ''), pagine: String(l.pagine || '') })),
      obiettivi: (s.obiettivi || []).map(String), indicatori: (s.indicatori || []).map(String), traguardi: (s.traguardi || []).map(String)
    });
  });
  return b;
}

/*__IMPORTA__*/

/* ===================== archivio locale ===================== */
const CHIAVE = 'promateos-v1';
const datiIniziali = () => ({ v: 1, anno: { nome: '', inizio: '', fine: '', festivita: [] }, libri: [], piani: [], pianoAttivo: null });

// Passa a un nuovo anno scolastico: nuove date, festività nazionali proposte, piani spostati di un numero intero di settimane
function nuovoAnno(d, nome, inizio, fine, portaPiani) {
  const vecchio = d.anno.inizio ? lunediDi(parseISO(d.anno.inizio)) : null;
  const nuovo = lunediDi(parseISO(inizio));
  const delta = vecchio ? Math.round((nuovo - vecchio) / 86400000) : 0;
  const piani = d.piani.map(p => {
    const a = {};
    if (portaPiani) Object.keys(p.assegnazioni).forEach(k => { a[fmtISO(addDays(parseISO(k), delta))] = p.assegnazioni[k]; });
    return { ...p, assegnazioni: a };
  });
  return { ...d, anno: { ...d.anno, nome, inizio, fine, festivita: festivitaSuggerite(inizio, fine) }, piani };
}

function useArchivio() {
  const [data, setData] = useState(() => {
    try { const s = localStorage.getItem(CHIAVE); if (s) return { ...datiIniziali(), ...JSON.parse(s) }; } catch (e) { /* archivio non leggibile */ }
    return datiIniziali();
  });
  const salva = fn => setData(prev => {
    const nuovo = typeof fn === 'function' ? fn(prev) : fn;
    try { localStorage.setItem(CHIAVE, JSON.stringify(nuovo)); } catch (e) { /* spazio esaurito */ }
    return nuovo;
  });
  return [data, salva];
}

/* ===================== componenti di base ===================== */
const LOGO_SCURO_SVG = /*__LOGO_SCURO__*/'';
const ICONA_SVG = /*__ICONA__*/'';

function Logo() {
  return <span className="icona-grande" dangerouslySetInnerHTML={{ __html: ICONA_SVG }} />;
}

function Icona({ nome }) {
  const p = {
    anno: <><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
    libri: <><path d="M5 4.5h10a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z" /><path d="M5 17a3 3 0 0 1 3-3h10" /></>,
    piani: <><path d="M5 6h14M5 12h14M5 18h9" /></>,
    settimane: <><rect x="3.5" y="4" width="17" height="16" rx="3" /><path d="M7.5 9h9M7.5 13h9M7.5 17h5" /></>,
    esporta: <><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" /></>
  }[nome];
  return <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{p}</svg>;
}

function Campo({ etichetta, children, aiuto }) {
  return (
    <label className="campo">
      <span className="campo-et">{etichetta}</span>
      {children}
      {aiuto && <span className="aiuto">{aiuto}</span>}
    </label>
  );
}

function Pannello({ titolo, azioni, children, vuoto }) {
  return (
    <section className="pannello">
      {(titolo || azioni) && <div className="pannello-testa"><h2>{titolo}</h2><div className="azioni">{azioni}</div></div>}
      {children}
    </section>
  );
}

function Finestra({ titolo, chiudi, children, piede }) {
  return (
    <div className="velo" onClick={chiudi}>
      <div className="finestra" onClick={e => e.stopPropagation()}>
        <div className="finestra-testa"><h3>{titolo}</h3><button className="bt ghost piccolo" onClick={chiudi}>Chiudi</button></div>
        <div className="finestra-corpo">{children}</div>
        {piede && <div className="finestra-piede">{piede}</div>}
      </div>
    </div>
  );
}

/* ===================== scheda: anno scolastico ===================== */
function AnnoTab({ data, salva, vaiA }) {
  const a = data.anno;
  const settimane = useMemo(() => calcolaSettimane(a), [a]);
  const [nuova, setNuova] = useState({ nome: '', da: '', a: '' });
  const [nuovoAnnoAperto, setNuovoAnnoAperto] = useState(false);
  const imposta = patch => salva(d => ({ ...d, anno: { ...d.anno, ...patch } }));
  const suggerisci = () => { const s = dateSuggerite(); imposta({ nome: s.nome, inizio: s.inizio, fine: s.fine }); };
  const aggiungiFesta = () => {
    if (!nuova.nome.trim() || !nuova.da) return;
    imposta({ festivita: [...a.festivita, { id: uid(), nome: nuova.nome.trim(), da: nuova.da, a: nuova.a || nuova.da }].sort((x, y) => x.da.localeCompare(y.da)) });
    setNuova({ nome: '', da: '', a: '' });
  };
  const nazionali = () => {
    if (!a.inizio || !a.fine) return;
    const gia = new Set(a.festivita.map(f => f.nome + f.da));
    const nuove = festivitaSuggerite(a.inizio, a.fine).filter(f => !gia.has(f.nome + f.da));
    imposta({ festivita: [...a.festivita, ...nuove].sort((x, y) => x.da.localeCompare(y.da)) });
  };
  const cambiaInizio = nuovoIni => {
    // se cambia l'inizio di un numero intero di settimane, offre di spostare i piani già compilati
    imposta({ inizio: nuovoIni });
  };
  const completo = a.inizio && a.fine && settimane.length > 0;
  const piene = settimane.filter(s => s.giorniScuola > 0).length;
  const giorniTot = settimane.reduce((t, s) => t + s.giorniScuola, 0);

  return (
    <div className="stack">
      {!completo && (
        <div className="benvenuto">
          <Logo />
          <h2>Benvenuto in ProMateoS</h2>
          <p>Per cominciare indica quando inizia e finisce la scuola e i periodi di festività. Il calendario delle settimane si costruisce da solo e si aggiorna a ogni modifica.</p>
          <button className="bt" onClick={suggerisci}>Proponi le date dell'anno in corso</button>
        </div>
      )}
      <Pannello titolo="Anno scolastico">
        <div className="griglia">
          <Campo etichetta="Nome"><input value={a.nome} placeholder="es. 2026-27" onChange={e => imposta({ nome: e.target.value })} /></Campo>
          <Campo etichetta="Inizio lezioni"><input type="date" value={a.inizio} onChange={e => cambiaInizio(e.target.value)} /></Campo>
          <Campo etichetta="Fine lezioni"><input type="date" value={a.fine} onChange={e => imposta({ fine: e.target.value })} /></Campo>
        </div>
        <p className="vuoto">Il sabato si imposta per ogni classe, nell'orario del piano: così nella stessa scuola ci possono essere classi con la settimana corta e classi con il sabato.</p>
      </Pannello>

      <Pannello titolo="Festività e sospensioni" azioni={<button className="bt ghost piccolo" disabled={!a.inizio || !a.fine} onClick={nazionali}>Aggiungi le festività nazionali</button>}>
        {a.festivita.length === 0 && <p className="vuoto">Nessuna festività inserita. Le festività nazionali si possono proporre automaticamente; quelle regionali o del tuo istituto aggiungile a mano.</p>}
        <ul className="elenco">
          {a.festivita.map(f => (
            <li key={f.id} className="riga">
              <div className="riga-testo"><strong>{f.nome}</strong><span className="sotto">{f.a && f.a !== f.da ? fmtData(f.da) + ' → ' + fmtData(f.a) : fmtData(f.da)}</span></div>
              <button className="bt ghost piccolo" onClick={() => imposta({ festivita: a.festivita.filter(x => x.id !== f.id) })}>Togli</button>
            </li>
          ))}
        </ul>
        <div className="griglia aggiungi">
          <Campo etichetta="Nome"><input value={nuova.nome} placeholder="es. Santo patrono" onChange={e => setNuova({ ...nuova, nome: e.target.value })} /></Campo>
          <Campo etichetta="Dal"><input type="date" value={nuova.da} onChange={e => setNuova({ ...nuova, da: e.target.value })} /></Campo>
          <Campo etichetta="Al (se più giorni)"><input type="date" value={nuova.a} onChange={e => setNuova({ ...nuova, a: e.target.value })} /></Campo>
          <button className="bt" onClick={aggiungiFesta} disabled={!nuova.nome.trim() || !nuova.da}>Aggiungi</button>
        </div>
      </Pannello>

      {completo && (
        <Pannello titolo="Riepilogo" azioni={<button className="bt ghost piccolo" onClick={() => setNuovoAnnoAperto(true)}>Nuovo anno scolastico</button>}>
          <div className="numeri">
            <div><b>{settimane.length}</b><span>settimane di calendario</span></div>
            <div><b>{piene}</b><span>con almeno un giorno di lezione</span></div>
            <div><b>{giorniTot}</b><span>giorni di lezione (lun–ven)</span></div>
          </div>
          <button className="bt" onClick={() => vaiA('piani')}>Avanti: crea un piano</button>
        </Pannello>
      )}
      {nuovoAnnoAperto && <NuovoAnnoDialogo anno={a} chiudi={() => setNuovoAnnoAperto(false)} conferma={(n, i, f, porta) => { salva(d => nuovoAnno(d, n, i, f, porta)); setNuovoAnnoAperto(false); }} />}
    </div>
  );
}

function NuovoAnnoDialogo({ anno, chiudi, conferma }) {
  const y = anno.inizio ? parseISO(anno.inizio).getFullYear() + 1 : new Date().getFullYear();
  const [n, setN] = useState(y + '-' + String(y + 1).slice(2));
  const [i, setI] = useState(y + '-09-14');
  const [f, setF] = useState((y + 1) + '-06-08');
  const [porta, setPorta] = useState(true);
  return (
    <Finestra titolo="Nuovo anno scolastico" chiudi={chiudi} piede={<button className="bt" disabled={!i || !f || f < i} onClick={() => conferma(n, i, f, porta)}>Crea il nuovo anno</button>}>
      <div className="griglia">
        <Campo etichetta="Nome"><input value={n} onChange={e => setN(e.target.value)} /></Campo>
        <Campo etichetta="Inizio lezioni"><input type="date" value={i} onChange={e => setI(e.target.value)} /></Campo>
        <Campo etichetta="Fine lezioni"><input type="date" value={f} onChange={e => setF(e.target.value)} /></Campo>
      </div>
      <label className="spunta"><input type="checkbox" checked={porta} onChange={e => setPorta(e.target.checked)} /> Porta con me i piani già compilati (spostati di settimane intere)</label>
      <p className="vuoto">Le festività vengono sostituite da quelle nazionali del nuovo anno, che poi puoi modificare. Libri, contenuti e orari dei piani restano.</p>
    </Finestra>
  );
}

/* ===================== scheda: libri ===================== */
function LibriTab({ data, salva }) {
  const tutti = [...LIBRI_BASE, ...data.libri];
  const [aperto, setAperto] = useState(null);
  const [importa, setImporta] = useState(false);
  const rimuovi = id => { if (confirm('Rimuovere questo libro? I piani che lo usano perdono le sue lezioni.')) salva(d => ({ ...d, libri: d.libri.filter(b => b.id !== id), piani: d.piani.map(p => ({ ...p, libri: p.libri.filter(x => x !== id), contenuti: p.contenuti.filter(c => c.b !== id) })) })); };
  return (
    <div className="stack">
      <Pannello titolo="Libri e programmazioni" azioni={<button className="bt piccolo" onClick={() => setImporta(true)}>Importa</button>}>
        <p className="vuoto">Ogni libro ha sezioni (unità o capitoli) con lezioni, obiettivi e indicatori. I piani le usano per scegliere cosa fare e quando.</p>
        <ul className="elenco">
          {tutti.map(b => (
            <li key={b.id} className="blocco">
              <div className="riga" onClick={() => setAperto(aperto === b.id ? null : b.id)}>
                <div className="riga-testo">
                  <strong>{b.titolo}</strong>
                  <span className="sotto">{[b.materia, b.editore, b.sezioni.length + ' sezioni', b.sezioni.reduce((t, s) => t + s.lezioni.length, 0) + ' lezioni'].filter(Boolean).join(' · ')}</span>
                </div>
                <span className={'tag ' + (b.importato ? 'viola' : '')}>{b.importato ? 'importato' : 'incluso'}</span>
              </div>
              {aperto === b.id && (
                <div className="dettaglio">
                  {b.sezioni.map(s => (
                    <details key={s.id} className="sezione">
                      <summary><strong>{s.codice}</strong> {s.titolo} <span className="sotto">({s.lezioni.length} lezioni)</span></summary>
                      {s.lezioni.length > 0 && <ul className="lista">{s.lezioni.map(l => <li key={l.id}>{l.titolo}{l.pagine ? <span className="sotto"> · pag. {l.pagine}</span> : null}</li>)}</ul>}
                      {s.obiettivi.length > 0 && <><h4>Obiettivi</h4><ul className="lista">{s.obiettivi.map((o, i) => <li key={i}>{o}</li>)}</ul></>}
                      {s.indicatori.length > 0 && <><h4>Indicatori</h4><ul className="lista">{s.indicatori.map((o, i) => <li key={i}>{o}</li>)}</ul></>}
                    </details>
                  ))}
                  <div className="azioni">
                    <button className="bt ghost piccolo" onClick={() => scaricaFile((b.titolo.replace(/\W+/g, '_')) + '.json', JSON.stringify(b, null, 1), 'application/json')}>Scarica JSON</button>
                    {b.importato && <button className="bt ghost piccolo pericolo" onClick={() => rimuovi(b.id)}>Rimuovi</button>}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Pannello>
      {importa && <ImportaLibro chiudi={() => setImporta(false)} salva={salva} />}
    </div>
  );
}

function ImportaLibro({ chiudi, salva }) {
  const [modo, setModo] = useState('file');
  const [meta, setMeta] = useState({ titolo: '', materia: '', editore: '' });
  const [testo, setTesto] = useState('');
  const [errore, setErrore] = useState('');
  const [occupato, setOccupato] = useState(false);
  const [analisi, setAnalisi] = useState(null);      // documento Word letto, in attesa di conferma
  const [nomeFile, setNomeFile] = useState('');
  const aggiungi = libro => { salva(d => ({ ...d, libri: [...d.libri, libro] })); chiudi(); };
  const daFile = async e => {
    const f = e.target.files[0]; if (!f) return;
    setErrore(''); setOccupato(true); setAnalisi(null);
    try {
      const titolo = meta.titolo.trim() || f.name.replace(/\.\w+$/, '');
      if (/\.json$/i.test(f.name)) aggiungi(validaLibro(JSON.parse(await f.text())));
      else if (/\.docx$/i.test(f.name)) { setNomeFile(f.name); setAnalisi(analizzaDocumento(await leggiDocx(f))); }
      else if (/\.(txt|md)$/i.test(f.name)) {
        const l = libroDaTesto(await f.text(), { ...meta, titolo });
        if (!l.sezioni.length) throw new Error('Il file è vuoto.');
        aggiungi(l);
      }
      else if (/\.doc$/i.test(f.name)) throw new Error('Il vecchio formato .doc non si legge nel browser: aprilo con Word o LibreOffice, salvalo come .docx e importalo.');
      else if (/\.pdf$/i.test(f.name)) throw new Error('I PDF si leggono con lo strumento del repository (cartella tools, importa_pdf.py), che produce un .json da importare qui.');
      else throw new Error('Formato non supportato. Usa un file .docx, .json o .txt.');
    } catch (err) { setErrore(err.message || String(err)); }
    setOccupato(false); e.target.value = '';
  };
  const daTesto = () => {
    if (!meta.titolo.trim()) return setErrore('Scrivi il titolo del libro.');
    const l = libroDaTesto(testo, meta);
    if (!l.sezioni.length) return setErrore('Il testo è vuoto.');
    aggiungi(l);
  };
  return (
    <Finestra titolo="Importa un libro" chiudi={chiudi}>
      <div className="segmenti">
        <button className={modo === 'file' ? 'on' : ''} onClick={() => setModo('file')}>Da file</button>
        <button className={modo === 'testo' ? 'on' : ''} onClick={() => setModo('testo')}>Da testo</button>
      </div>
      <div className="griglia">
        <Campo etichetta="Titolo"><input value={meta.titolo} onChange={e => setMeta({ ...meta, titolo: e.target.value })} /></Campo>
        <Campo etichetta="Materia"><input value={meta.materia} onChange={e => setMeta({ ...meta, materia: e.target.value })} /></Campo>
        <Campo etichetta="Editore"><input value={meta.editore} onChange={e => setMeta({ ...meta, editore: e.target.value })} /></Campo>
      </div>
      {modo === 'file' ? (
        <>
          <p className="vuoto">Importa un <b>.docx</b> di programmazione (tabelle con colonne come unità o capitolo, nuclei o lezioni, traguardi, indicatori, obiettivi, attività, oppure semplici titoli ed elenchi), un <b>.json</b> o un <b>.txt</b>. Le colonne si riconoscono da sole e prima di importare puoi correggerle.</p>
          <input type="file" accept=".docx,.json,.txt,.md" onChange={daFile} disabled={occupato} />
          {occupato && <p className="vuoto">Lettura del file…</p>}
          {analisi && <RevisioneDocx analisi={analisi} setAnalisi={setAnalisi} nomeFile={nomeFile} meta={meta} conferma={aggiungi} />}
        </>
      ) : (
        <>
          <p className="vuoto">Una riga per lezione. Le sezioni iniziano con <code>#</code>. Facoltativi: <code>Obiettivo: …</code>, <code>Indicatore: …</code>, e la pagina tra parentesi: <code>(pag. 12-13)</code>.</p>
          <textarea rows={9} value={testo} placeholder={'# Le frazioni\nConfronto tra frazioni (pag. 10-11)\nSomma di frazioni\nObiettivo: Operare con le frazioni\n# Le equazioni\nEquazioni di primo grado'} onChange={e => setTesto(e.target.value)} />
          <button className="bt" onClick={daTesto}>Importa</button>
        </>
      )}
      {errore && <p className="errore">{errore}</p>}
    </Finestra>
  );
}

// Anteprima del riconoscimento di un documento Word, con correzione dei ruoli delle colonne
function RevisioneDocx({ analisi, setAnalisi, nomeFile, meta, conferma }) {
  const sezioni = useMemo(() => sezioniRisultanti(analisi), [analisi]);
  const tot = riassuntoSezioni(sezioni);
  const [aperta, setAperta] = useState(sezioni.length === 0);
  const [k, setK] = useState(() => Math.max(0, analisi.tabelle.findIndex(t => t.usata)));
  const t = analisi.tabelle[k];
  const aggiornaTab = (i, fn) => setAnalisi(a => ({ ...a, tabelle: a.tabelle.map((x, j) => (j === i ? fn(x) : x)) }));
  const cambiaRuolo = (c, ruolo) => aggiornaTab(k, x => ({
    ...x, usata: true,
    cfg: { ...x.cfg, origine: 'manuale', ruoli: x.cfg.ruoli.map((r, i) => (i === c ? ruolo : (ruolo === 'unita' && r === 'unita' ? 'ignora' : r))) }
  }));
  const importa = () => conferma({
    id: 'imp-' + uid(), titolo: meta.titolo.trim() || nomeFile.replace(/\.docx$/i, ''),
    editore: meta.editore, materia: meta.materia, sezioni, importato: true
  });
  return (
    <div className="revisione">
      {analisi.sembraPiano && <div className="avviso">Questo documento sembra un piano annuale (mesi e settimane), non la programmazione di un libro. Posso importarlo come elenco di argomenti, ma l'importazione dei piani con le settimane non c'è ancora.</div>}
      {!analisi.tabelle.length && !sezioni.length && <div className="avviso">Nel documento non ci sono tabelle né testo riconoscibile: potrebbe essere una scansione o un'immagine. Se è un PDF usa lo strumento nella cartella tools del repository.</div>}
      <div className={sezioni.length ? 'ok' : 'avviso'}>
        {sezioni.length
          ? 'Riconosciuto: ' + tot.sezioni + ' sezioni, ' + tot.lezioni + ' lezioni, ' + tot.obiettivi + ' obiettivi, ' + tot.indicatori + ' indicatori.'
          : 'Non sono riuscito a riconoscere le sezioni da solo: indica qui sotto il ruolo di ogni colonna.'}
      </div>
      {sezioni.length > 0 && (
        <ul className="lista-compatta">
          {sezioni.slice(0, 60).map(s => <li key={s.id}><b>{s.codice}</b> {s.titolo} <span className="sotto">· {plur(s.lezioni.length, 'lezione', 'lezioni')}, {plur(s.obiettivi.length, 'obiettivo', 'obiettivi')}, {plur(s.indicatori.length, 'indicatore', 'indicatori')}</span></li>)}
        </ul>
      )}
      <details open={aperta} onToggle={e => setAperta(e.target.open)}>
        <summary>Correggi il riconoscimento</summary>
        {analisi.tabelle.length > 1 && (
          <div className="chips">
            {analisi.tabelle.map((x, i) => (
              <button key={i} className={'chip piccolo' + (i === k ? ' on' : '')} onClick={() => setK(i)}>Tabella {i + 1}{x.usata ? '' : ' (esclusa)'}</button>
            ))}
          </div>
        )}
        {t && (
          <>
            <label className="spunta"><input type="checkbox" checked={t.usata} onChange={e => aggiornaTab(k, x => ({ ...x, usata: e.target.checked }))} /> Usa questa tabella ({t.righe.length} righe, {t.nCol} colonne)</label>
            <Campo etichetta="Righe iniziali da saltare (intestazioni)">
              <input type="number" min="0" max="12" value={t.cfg.intest} onChange={e => aggiornaTab(k, x => ({ ...x, cfg: { ...x.cfg, origine: 'manuale', intest: Math.max(0, parseInt(e.target.value, 10) || 0) } }))} />
            </Campo>
            <p className="vuoto">Ruolo di ogni colonna (si riconosce {t.cfg.origine === 'intestazioni' ? 'dalle intestazioni' : t.cfg.origine === 'contenuto' ? 'dal contenuto' : t.cfg.origine === 'manuale' ? 'come impostato da te' : 'in modo approssimativo'}):</p>
            <div className="scorri">
              <table className="tabella anteprima">
                <thead>
                  <tr>{t.cfg.ruoli.map((r, c) => (
                    <th key={c}><select value={r} onChange={e => cambiaRuolo(c, e.target.value)}>
                      {RUOLI_COLONNA.map(x => <option key={x.id} value={x.id}>{x.et}</option>)}
                    </select></th>
                  ))}</tr>
                </thead>
                <tbody>
                  {t.righe.slice(0, t.cfg.intest + 5).map((riga, i) => (
                    <tr key={i} className={i < t.cfg.intest ? 'vac' : ''}>
                      {t.cfg.ruoli.map((r, c) => {
                        const cella = riga.find(x => x.col === c);
                        const testo = cella ? cella.par.join(' · ') : '';
                        return <td key={c}>{testo.length > 90 ? testo.slice(0, 89) + '…' : testo}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <label className="spunta"><input type="checkbox" checked={analisi.usaParagrafi} onChange={e => setAnalisi(a => ({ ...a, usaParagrafi: e.target.checked }))} /> Usa anche il testo fuori dalle tabelle (titoli ed elenchi)</label>
      </details>
      <button className="bt" onClick={importa} disabled={!sezioni.length}>Importa {sezioni.length ? sezioni.length + ' sezioni' : ''}</button>
    </div>
  );
}

/* ===================== scheda: piani ===================== */
function PianiTab({ data, salva, vaiA }) {
  const tutti = [...LIBRI_BASE, ...data.libri];
  const piano = data.piani.find(p => p.id === data.pianoAttivo) || null;
  const [nome, setNome] = useState('');
  const crea = () => {
    if (!nome.trim()) return;
    const p = { id: uid(), nome: nome.trim(), materia: '', classe: '', orario: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }, oreLezione: 1, libri: [], contenuti: [], assegnazioni: {} };
    salva(d => ({ ...d, piani: [...d.piani, p], pianoAttivo: p.id })); setNome('');
  };
  const modifica = patch => salva(d => ({ ...d, piani: d.piani.map(p => p.id === piano.id ? { ...p, ...patch } : p) }));
  const elimina = () => { if (confirm('Eliminare il piano "' + piano.nome + '" con tutte le sue assegnazioni?')) salva(d => { const resto = d.piani.filter(p => p.id !== piano.id); return { ...d, piani: resto, pianoAttivo: resto[0] ? resto[0].id : null }; }); };
  const duplica = () => salva(d => { const c = { ...JSON.parse(JSON.stringify(piano)), id: uid(), nome: piano.nome + ' (copia)' }; return { ...d, piani: [...d.piani, c], pianoAttivo: c.id }; });

  const scegliLibro = id => {
    const usa = piano.libri.includes(id);
    modifica({ libri: usa ? piano.libri.filter(x => x !== id) : [...piano.libri, id], contenuti: usa ? piano.contenuti.filter(c => c.b !== id) : piano.contenuti });
  };
  const toggleSezione = (b, s) => {
    const c = piano.contenuti.find(x => x.b === b && x.s === s);
    modifica({ contenuti: c ? piano.contenuti.filter(x => x !== c) : [...piano.contenuti, { b, s }] });
  };
  const sposta = (i, d) => { const c = [...piano.contenuti], j = i + d; if (j < 0 || j >= c.length) return; [c[i], c[j]] = [c[j], c[i]]; modifica({ contenuti: c }); };

  return (
    <div className="stack">
      <Pannello titolo="Piani">
        {data.piani.length > 0 && (
          <div className="chips">
            {data.piani.map(p => <button key={p.id} className={'chip' + (p.id === data.pianoAttivo ? ' on' : '')} onClick={() => salva(d => ({ ...d, pianoAttivo: p.id }))}>{p.nome}</button>)}
          </div>
        )}
        <div className="griglia aggiungi">
          <Campo etichetta="Nuovo piano" aiuto="es. Matematica 2A, Scienze 3B"><input value={nome} onChange={e => setNome(e.target.value)} onKeyDown={e => e.key === 'Enter' && crea()} /></Campo>
          <button className="bt" onClick={crea} disabled={!nome.trim()}>Crea</button>
        </div>
      </Pannello>

      {piano && (
        <>
          <Pannello titolo={piano.nome} azioni={<><button className="bt ghost piccolo" onClick={duplica}>Duplica</button><button className="bt ghost piccolo pericolo" onClick={elimina}>Elimina</button></>}>
            <div className="griglia">
              <Campo etichetta="Nome"><input value={piano.nome} onChange={e => modifica({ nome: e.target.value })} /></Campo>
              <Campo etichetta="Materia"><input value={piano.materia} onChange={e => modifica({ materia: e.target.value })} /></Campo>
              <Campo etichetta="Classe"><input value={piano.classe} onChange={e => modifica({ classe: e.target.value })} /></Campo>
            </div>
            <h4>Orario settimanale (ore per giorno)</h4>
            <p className="vuoto">Sabato: lascia 0 se questa classe non ha lezione il sabato. Le settimane si adattano da sole.</p>
            <div className="orario">
              {[1, 2, 3, 4, 5, 6].map(g => (
                <label key={g} className="ora"><span>{GIORNI[g]}</span>
                  <input type="number" min="0" step="0.5" value={piano.orario[g] || 0} onChange={e => modifica({ orario: { ...piano.orario, [g]: num(e.target.value) } })} />
                </label>
              ))}
            </div>
            <Campo etichetta="Ore per lezione" aiuto="Usate quando le lezioni dei libri vengono assegnate alle settimane."><input type="number" min="0.5" step="0.5" value={piano.oreLezione} onChange={e => modifica({ oreLezione: num(e.target.value) || 1 })} /></Campo>
          </Pannello>

          <Pannello titolo="Cosa si fa: libri e contenuti">
            <h4>Libri usati</h4>
            <div className="chips">
              {tutti.map(b => <button key={b.id} className={'chip' + (piano.libri.includes(b.id) ? ' on' : '')} onClick={() => scegliLibro(b.id)}>{b.titolo}</button>)}
            </div>
            {piano.libri.map(id => {
              const b = tutti.find(x => x.id === id); if (!b) return null;
              return (
                <div key={id} className="blocco">
                  <h4>{b.titolo}</h4>
                  <div className="chips">
                    {b.sezioni.map(s => {
                      const on = piano.contenuti.some(c => c.b === id && c.s === s.id);
                      return <button key={s.id} className={'chip piccolo' + (on ? ' on' : '')} onClick={() => toggleSezione(id, s.id)} title={s.titolo}>{s.codice} {s.titolo.length > 28 ? s.titolo.slice(0, 27) + '…' : s.titolo}</button>;
                    })}
                  </div>
                </div>
              );
            })}
            {piano.contenuti.length > 0 && (
              <>
                <h4>Ordine di svolgimento</h4>
                <ol className="ordine">
                  {piano.contenuti.map((c, i) => {
                    const b = tutti.find(x => x.id === c.b), s = b && b.sezioni.find(x => x.id === c.s);
                    return (
                      <li key={c.b + c.s} className="riga">
                        <div className="riga-testo"><strong>{s ? s.codice + ' ' + s.titolo : '(sezione non trovata)'}</strong><span className="sotto">{b ? b.titolo : ''} · {s ? s.lezioni.length : 0} lezioni</span></div>
                        <div className="azioni">
                          <button className="bt ghost piccolo" disabled={i === 0} onClick={() => sposta(i, -1)}>↑</button>
                          <button className="bt ghost piccolo" disabled={i === piano.contenuti.length - 1} onClick={() => sposta(i, 1)}>↓</button>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </>
            )}
            <button className="bt" onClick={() => vaiA('settimane')}>Avanti: pianifica le settimane</button>
          </Pannello>
        </>
      )}
    </div>
  );
}

/* ===================== scheda: pianificazione settimanale ===================== */
function SettimaneTab({ data, salva, vaiA }) {
  const tutti = [...LIBRI_BASE, ...data.libri];
  const piano = data.piani.find(p => p.id === data.pianoAttivo) || null;
  const settimane = useMemo(() => calcolaSettimane(data.anno), [data.anno]);
  const [scelta, setScelta] = useState(null);       // settimana in cui si sta scegliendo dal libro
  const [apertaChiave, setApertaChiave] = useState(null);
  const [messaggio, setMessaggio] = useState('');

  if (!settimane.length) return <div className="stack"><p className="vuoto">Prima imposta l'anno scolastico.</p><button className="bt" onClick={() => vaiA('anno')}>Vai ad Anno</button></div>;
  if (!piano) return <div className="stack"><p className="vuoto">Crea o scegli un piano.</p><button className="bt" onClick={() => vaiA('piani')}>Vai a Piani</button></div>;

  const modificaAss = fn => salva(d => ({ ...d, piani: d.piani.map(p => p.id === piano.id ? { ...p, assegnazioni: fn(JSON.parse(JSON.stringify(p.assegnazioni))) } : p) }));
  const impostaItem = (chiave, id, patch) => modificaAss(a => { a[chiave] = (a[chiave] || []).map(i => i.id === id ? { ...i, ...patch } : i); return a; });
  const togliItem = (chiave, id) => modificaAss(a => { a[chiave] = (a[chiave] || []).filter(i => i.id !== id); if (!a[chiave].length) delete a[chiave]; return a; });
  const aggiungiLibero = (chiave, tipo) => modificaAss(a => { (a[chiave] = a[chiave] || []).push({ id: uid(), tipo, testo: tipo === 'verifica' ? 'Verifica' : tipo === 'ripasso' ? 'Ripasso' : '', ore: tipo === 'verifica' ? 1 : num(piano.oreLezione) || 1, rif: null }); return a; });
  const spostaItem = (chiave, i, d) => modificaAss(a => { const l = a[chiave], j = i + d; if (j < 0 || j >= l.length) return a; [l[i], l[j]] = [l[j], l[i]]; return a; });

  const assegnate = lezioniAssegnate(piano);
  const lezioni = lezioniDelPiano(piano, tutti);
  const daAssegnare = lezioni.filter(x => !assegnate[chiaveLezione(x.rif)]).length;
  const totDisp = settimane.reduce((t, s) => t + oreDisponibili(s, piano), 0);
  const totAss = Object.values(piano.assegnazioni).reduce((t, l) => t + oreAssegnate(l), 0);
  const nOrfane = Object.keys(piano.assegnazioni).filter(k => !settimane.some(s => s.chiave === k)).length;
  const senzaOrario = totDisp === 0;
  const primaChiaveLibera = (settimane.find(s => !vacanzaPiano(s, piano)) || settimane[0]).chiave;

  const autoDistribuisci = () => {
    if (senzaOrario) { setMessaggio('Imposta prima l\'orario settimanale del piano (scheda Piani).'); return; }
    const r = distribuisci(piano, tutti, settimane, primaChiaveLibera);
    salva(d => ({ ...d, piani: d.piani.map(p => p.id === piano.id ? { ...p, assegnazioni: r.assegnazioni } : p) }));
    setMessaggio(r.aggiunte + ' lezioni assegnate' + (r.rimaste ? '; ' + r.rimaste + ' non entrano nelle ore disponibili.' : '.'));
  };
  const svuota = () => { if (confirm('Togliere tutte le assegnazioni di questo piano?')) modificaAss(() => ({})); };

  // raggruppa per mese
  const gruppi = [];
  settimane.forEach(s => {
    const g = gruppi[gruppi.length - 1];
    if (g && g.meseIdx === s.meseIdx) g.lista.push(s); else gruppi.push({ mese: s.mese, meseIdx: s.meseIdx, lista: [s] });
  });

  return (
    <div className="stack">
      <Pannello>
        <div className="chips">
          {data.piani.map(p => <button key={p.id} className={'chip' + (p.id === piano.id ? ' on' : '')} onClick={() => salva(d => ({ ...d, pianoAttivo: p.id }))}>{p.nome}</button>)}
        </div>
        <div className="numeri">
          <div><b>{fmtOre(totAss)}/{fmtOre(totDisp)}</b><span>ore assegnate / disponibili</span></div>
          <div><b>{daAssegnare}</b><span>lezioni da assegnare</span></div>
        </div>
        {senzaOrario && <p className="avviso">L'orario di questo piano è vuoto: imposta le ore per giorno nella scheda Piani per vedere le ore disponibili e usare la distribuzione automatica.</p>}
        {nOrfane > 0 && <p className="avviso">{nOrfane} settimane con attività sono fuori dal calendario attuale (date cambiate): non compaiono qui ma restano nel piano.</p>}
        <div className="azioni">
          <button className="bt" onClick={autoDistribuisci} disabled={daAssegnare === 0}>Distribuisci le lezioni non assegnate</button>
          <button className="bt ghost" onClick={svuota} disabled={totAss === 0}>Svuota</button>
        </div>
        {messaggio && <p className="ok">{messaggio}</p>}
      </Pannello>

      {gruppi.map(g => (
        <section key={g.meseIdx} className="mese">
          <h3>{g.mese}</h3>
          {g.lista.map(s => {
            const items = piano.assegnazioni[s.chiave] || [];
            const disp = oreDisponibili(s, piano), ass = oreAssegnate(items);
            const feste = festePiano(s, piano);
            const vacanza = vacanzaPiano(s, piano);
            const aperta = apertaChiave === s.chiave;
            const sfora = disp > 0 && ass > disp + 1e-9;
            return (
              <article key={s.chiave} className={'settimana' + (vacanza ? ' vacanza' : '') + (sfora ? ' sfora' : '')}>
                <header onClick={() => setApertaChiave(apertaChiave === s.chiave ? null : s.chiave)}>
                  <div>
                    <strong>Sett. {s.n}</strong> <span className="sotto">{fmtGM(s.lun)} – {fmtGM(usaSabato(piano) ? s.alSab : s.alVen)}</span>
                    {feste.length > 0 && <div className="feste">{feste.join(' · ')}</div>}
                    {items.length > 0 && !aperta && <div className="riassunto">{items.map(i => i.testo || '—').join(' · ')}</div>}
                  </div>
                  <div className="ore">{vacanza ? <span className="tag">vacanza</span> : <span className={'tag ' + (sfora ? 'rosso' : ass >= disp && disp > 0 ? 'verde' : '')}>{fmtOre(ass)}{disp ? ' / ' + fmtOre(disp) : ''} h</span>}</div>
                </header>
                {aperta && (
                  <div className="corpo">
                    {items.map((it, i) => (
                      <div key={it.id} className={'item tipo-' + it.tipo}>
                        <select value={it.tipo} onChange={e => impostaItem(s.chiave, it.id, { tipo: e.target.value })} aria-label="Tipo">
                          <option value="lezione">Lezione</option><option value="verifica">Verifica</option><option value="ripasso">Ripasso</option><option value="uda">UDA</option><option value="altro">Altro</option>
                        </select>
                        <input className="testo" value={it.testo} placeholder="Argomento" onChange={e => impostaItem(s.chiave, it.id, { testo: e.target.value })} />
                        <input className="ore-in" type="number" min="0" step="0.5" value={it.ore} onChange={e => impostaItem(s.chiave, it.id, { ore: num(e.target.value) })} aria-label="Ore" />
                        <div className="azioni">
                          <button className="bt ghost piccolo" disabled={i === 0} onClick={() => spostaItem(s.chiave, i, -1)}>↑</button>
                          <button className="bt ghost piccolo" disabled={i === items.length - 1} onClick={() => spostaItem(s.chiave, i, 1)}>↓</button>
                          <button className="bt ghost piccolo pericolo" onClick={() => togliItem(s.chiave, it.id)}>×</button>
                        </div>
                      </div>
                    ))}
                    <div className="azioni">
                      <button className="bt piccolo" onClick={() => setScelta(s)}>+ Dal libro</button>
                      <button className="bt ghost piccolo" onClick={() => aggiungiLibero(s.chiave, 'altro')}>+ Libero</button>
                      <button className="bt ghost piccolo" onClick={() => aggiungiLibero(s.chiave, 'verifica')}>+ Verifica</button>
                      <button className="bt ghost piccolo" onClick={() => aggiungiLibero(s.chiave, 'ripasso')}>+ Ripasso</button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      ))}
      {scelta && <ScegliDalLibro settimana={scelta} settimane={settimane} piano={piano} libri={tutti} salva={salva} chiudi={() => setScelta(null)} />}
    </div>
  );
}

function ScegliDalLibro({ settimana, settimane, piano, libri, salva, chiudi }) {
  const lezioni = lezioniDelPiano(piano, libri);
  const assegnate = lezioniAssegnate(piano);
  const [sel, setSel] = useState({});
  const sezioni = [];
  lezioni.forEach(x => {
    const k = x.rif.b + '|' + x.rif.s;
    let g = sezioni.find(y => y.k === k);
    if (!g) { g = { k, sezione: x.sezione, libro: x.libro, righe: [] }; sezioni.push(g); }
    g.righe.push(x);
  });
  const nSel = Object.values(sel).filter(Boolean).length;
  const aggiungi = () => {
    const scelte = lezioni.filter(x => sel[chiaveLezione(x.rif)]);
    const oreL = num(piano.oreLezione) || 1;
    salva(d => ({
      ...d, piani: d.piani.map(p => {
        if (p.id !== piano.id) return p;
        const a = JSON.parse(JSON.stringify(p.assegnazioni));
        a[settimana.chiave] = (a[settimana.chiave] || []).concat(scelte.map(x => ({ id: uid(), tipo: 'lezione', testo: x.lezione.titolo, ore: oreL, rif: x.rif })));
        return { ...p, assegnazioni: a };
      })
    }));
    chiudi();
  };
  const selezionaSezione = g => setSel(prev => { const n = { ...prev }; g.righe.filter(x => !assegnate[chiaveLezione(x.rif)]).forEach(x => { n[chiaveLezione(x.rif)] = true; }); return n; });
  return (
    <Finestra titolo={'Sett. ' + settimana.n + ' · scegli dal libro'} chiudi={chiudi}
      piede={<button className="bt" onClick={aggiungi} disabled={!nSel}>Aggiungi {nSel ? '(' + nSel + ')' : ''}</button>}>
      {!sezioni.length && <p className="vuoto">Questo piano non ha ancora contenuti: scegli libri e sezioni nella scheda Piani.</p>}
      {sezioni.map(g => (
        <div key={g.k} className="blocco">
          <div className="riga"><div className="riga-testo"><strong>{g.sezione.codice} {g.sezione.titolo}</strong><span className="sotto">{g.libro.titolo}</span></div>
            <button className="bt ghost piccolo" onClick={() => selezionaSezione(g)}>Seleziona tutto</button></div>
          <ul className="lista-scelta">
            {g.righe.map(x => {
              const k = chiaveLezione(x.rif), dove = assegnate[k];
              const sDove = dove ? settimane.find(w => w.chiave === dove) : null;
              return (
                <li key={k}>
                  <label className="spunta">
                    <input type="checkbox" checked={!!sel[k]} onChange={e => setSel({ ...sel, [k]: e.target.checked })} />
                    <span>{x.lezione.titolo}{x.lezione.pagine ? <span className="sotto"> · pag. {x.lezione.pagine}</span> : null}</span>
                    {dove && <span className="tag">{sDove ? 'sett. ' + sDove.n : 'assegnata'}</span>}
                  </label>
                </li>
              );
            })}
          </ul>
          {g.sezione.obiettivi.length > 0 && <details><summary className="sotto">Obiettivi della sezione</summary><ul className="lista">{g.sezione.obiettivi.map((o, i) => <li key={i}>{o}</li>)}</ul></details>}
        </div>
      ))}
    </Finestra>
  );
}

/* ===================== scheda: esporta ===================== */
function EsportaTab({ data, salva }) {
  const [ids, setIds] = useState(() => data.pianoAttivo ? [data.pianoAttivo] : []);
  const [msg, setMsg] = useState('');
  const [occ, setOcc] = useState(false);
  const tab = useMemo(() => costruisciTabella(data, ids), [data, ids]);
  const toggle = id => setIds(ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  const nome = 'ProMateoS_' + (tab.titolo || 'piano').replace(/[^\w]+/g, '_');
  const docx = async () => {
    setOcc(true); setMsg('');
    try { scaricaFile(nome + '.docx', await tabellaDocx(tab)); } catch (e) { setMsg('Esportazione Word non riuscita: ' + (e.message || e) + ' (serve la connessione).'); }
    setOcc(false);
  };
  const ripristina = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { const j = JSON.parse(await f.text()); if (!j.anno || !Array.isArray(j.piani)) throw new Error('File non valido'); if (confirm('Sostituire tutti i dati attuali con quelli del file?')) salva({ ...datiIniziali(), ...j }); }
    catch (err) { setMsg('Ripristino non riuscito: ' + err.message); }
    e.target.value = '';
  };
  return (
    <div className="stack">
      <Pannello titolo="Piano annuale">
        {data.piani.length === 0 && <p className="vuoto">Nessun piano da esportare.</p>}
        <p className="vuoto">Scegli i piani da mettere affiancati (per esempio aritmetica e geometria nella stessa tabella).</p>
        <div className="chips">
          {data.piani.map(p => <button key={p.id} className={'chip' + (ids.includes(p.id) ? ' on' : '')} onClick={() => toggle(p.id)}>{p.nome}</button>)}
        </div>
        <div className="azioni">
          <button className="bt" disabled={!ids.length || occ} onClick={docx}>Scarica Word (.docx)</button>
          <button className="bt ghost" disabled={!ids.length} onClick={() => scaricaFile(nome + '.csv', tabellaCSV(tab), 'text/csv;charset=utf-8')}>CSV</button>
          <button className="bt ghost" disabled={!ids.length} onClick={() => window.print()}>Stampa / PDF</button>
        </div>
        {msg && <p className="errore">{msg}</p>}
      </Pannello>

      {ids.length > 0 && (
        <Pannello titolo="Anteprima">
          <div className="scorri"><TabellaPiano tab={tab} /></div>
        </Pannello>
      )}

      <Pannello titolo="Copia di sicurezza">
        <p className="vuoto">I dati restano su questo dispositivo. Scarica una copia per spostarli su un altro dispositivo o per sicurezza.</p>
        <div className="azioni">
          <button className="bt ghost" onClick={() => scaricaFile('ProMateoS_backup_' + fmtISO(new Date()) + '.json', JSON.stringify(data, null, 1), 'application/json')}>Scarica backup</button>
          <label className="bt ghost file">Ripristina<input type="file" accept=".json" onChange={ripristina} hidden /></label>
        </div>
      </Pannello>
      <div className="solo-stampa"><h1>Piano annuale {tab.titolo} — anno scolastico {tab.anno}</h1><TabellaPiano tab={tab} /></div>
    </div>
  );
}

function TabellaPiano({ tab }) {
  let corrente = '';
  return (
    <table className="tabella">
      <thead><tr><th>mese</th><th>sett.</th>{tab.piani.map(p => <React.Fragment key={p.id}><th>{p.nome}</th><th>ore</th></React.Fragment>)}</tr></thead>
      <tbody>
        {tab.righe.map(r => {
          const primo = r.mese !== corrente; corrente = r.mese;
          return (
            <tr key={r.n} className={r.vacanza ? 'vac' : ''}>
              <td className="mese-col">{primo ? r.mese : ''}</td>
              <td className="sett-col">{r.n}<span>{r.dal}–{r.al}</span></td>
              {r.celle.map((c, k) => <React.Fragment key={k}><td>{c.testo || (r.vacanza && k === 0 ? r.note || 'Vacanza' : '')}</td><td className="ore-col">{c.ore ? fmtOre(c.ore) : ''}</td></React.Fragment>)}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ===================== applicazione ===================== */
const SCHEDE = [
  { id: 'anno', et: 'Anno' }, { id: 'libri', et: 'Libri' }, { id: 'piani', et: 'Piani' },
  { id: 'settimane', et: 'Settimane' }, { id: 'esporta', et: 'Esporta' }
];

function App() {
  const [data, salva] = useArchivio();
  const pronto = data.anno.inizio && data.anno.fine;
  const [scheda, setScheda] = useState(() => (pronto ? 'settimane' : 'anno'));
  const vaiA = id => { setScheda(id); window.scrollTo(0, 0); };
  return (
    <>
      <header className="testata">
        <div className="marchio" role="img" aria-label="ProMateoS" dangerouslySetInnerHTML={{ __html: LOGO_SCURO_SVG }} />
        {data.anno.nome && <div className="anno-badge">A.S. {data.anno.nome}</div>}
      </header>
      <nav className="schede">
        {SCHEDE.map(s => <button key={s.id} className={scheda === s.id ? 'on' : ''} onClick={() => vaiA(s.id)}><Icona nome={s.id} /><span>{s.et}</span></button>)}
      </nav>
      <main>
        {scheda === 'anno' && <AnnoTab data={data} salva={salva} vaiA={vaiA} />}
        {scheda === 'libri' && <LibriTab data={data} salva={salva} />}
        {scheda === 'piani' && <PianiTab data={data} salva={salva} vaiA={vaiA} />}
        {scheda === 'settimane' && <SettimaneTab data={data} salva={salva} vaiA={vaiA} />}
        {scheda === 'esporta' && <EsportaTab data={data} salva={salva} />}
      </main>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
