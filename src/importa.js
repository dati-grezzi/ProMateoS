/* ===================== importazione da file Word =====================
   Lettura flessibile di un .docx di programmazione. Strati, in ordine:
   1. tabelle con intestazioni riconosciute (anche su più righe, con celle unite, sinonimi);
   2. tabelle senza intestazioni: i ruoli delle colonne si deducono dal contenuto;
   3. documenti senza tabelle: titoli ed elenchi;
   4. ultima spiaggia: ogni riga di tabella diventa una sezione.
   Se il riconoscimento non basta, l'app mostra le colonne e lascia correggere i ruoli a mano:
   non esiste un errore "formato non riconosciuto" senza via d'uscita. */

const NS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

const RUOLI_COLONNA = [
  { id: 'ignora', et: 'Ignora' },
  { id: 'unita', et: 'Unità / capitolo' },
  { id: 'nuclei', et: 'Lezioni / contenuti' },
  { id: 'traguardi', et: 'Traguardi / competenze' },
  { id: 'indicatori', et: 'Indicatori' },
  { id: 'obiettivi', et: 'Obiettivi' },
  { id: 'attivita', et: 'Attività (lezioni numerate)' }
];
const LISTE_SEZIONE = ['nuclei', 'attivita', 'traguardi', 'indicatori', 'obiettivi'];

// Parole delle intestazioni di colonna. Il primo ruolo che combacia vince: i più specifici vengono prima.
const PAROLE_RUOLO = [
  ['ignora', /profil|strument|valutazion|verific|autovalutaz|elicoidal|inclusiv|approfondiment|laborator|educazione civica|giochi|riferiment|\bnote?\b|\bore\b|periodo|mese|settimana/i],
  ['indicatori', /indicator/i],
  ['traguardi', /traguard/i],
  ['obiettivi', /obiettiv|abilit[àa]/i],
  ['nuclei', /nuclei|contenut|argoment|\blezion[ei]\b|conoscenz|\btemi?\b|sviluppo/i],
  ['attivita', /attivit|percorso base|esperienz/i],
  ['unita', /unit[àa]|capitol|modul|sezion|\buda\b|ambito|titolo/i],
  ['competenze', /competenz/i]
];

const VERBI_INIZIALI = /^(acquisire|affrontare|analizzare|applicare|apprendere|argomentare|calcolare|capire|classificare|collegare|comprendere|confrontare|conoscere|considerare|correlare|costruire|definire|descrivere|dimostrare|distinguere|elaborare|esaminare|essere|eseguire|esprimere|formalizzare|formulare|identificare|individuare|interpretare|intuire|leggere|mettere|misurare|operare|organizzare|osservare|progettare|raccogliere|rappresentare|realizzare|riconoscere|ricostruire|risolvere|riflettere|saper|sapere|scegliere|scomporre|spiegare|stabilire|sviluppare|trovare|usare|utilizzare|valutare|verificare|comunicare|prevedere|rispettare|tradurre|cogliere|fornire|porre|effettuare|avere|assumere|avviare|comparare|completare|consolidare|creare|determinare|evidenziare|illustrare|mostrare|precisare|ricavare|selezionare|sperimentare|svolgere|confrontare|ordinare|partire)\b/i;
const INFINITO_GENERICO = /^[A-ZÀ-Ú][a-zà-ú]{3,}(are|ere|ire|rre)\b/;

const normImp = t => String(t == null ? '' : t).replace(/\s+/g, ' ').trim();
const ruoloDaTesto = t => { for (const [r, re] of PAROLE_RUOLO) if (re.test(t)) return r; return null; };
const testoLungo = t => t.length > 70 || /\?$/.test(t);

/* ---------- lettura del documento ---------- */

function leggiParagrafo(p) {
  let testo = '';
  Array.from(p.getElementsByTagName('*')).forEach(n => {
    const nome = n.localName;
    if (nome === 't') testo += n.textContent;
    else if (nome === 'tab') testo += ' ';
    else if (nome === 'br' && n.getAttributeNS(NS_W, 'type') !== 'page') testo += '\n';
    else if (nome === 'noBreakHyphen') testo += '-';
  });
  const pr = Array.from(p.childNodes).find(x => x.localName === 'pPr');
  const stileEl = pr && Array.from(pr.childNodes).find(x => x.localName === 'pStyle');
  const stile = stileEl ? (stileEl.getAttributeNS(NS_W, 'val') || stileEl.getAttribute('w:val') || '') : '';
  const lista = !!(pr && Array.from(pr.childNodes).some(x => x.localName === 'numPr'));
  return { tipo: 'p', testo, stile, lista };
}

function paragrafiDiCella(tc) {
  const out = [];
  Array.from(tc.getElementsByTagNameNS(NS_W, 'p')).forEach(p => {
    leggiParagrafo(p).testo.split('\n').forEach(riga => {
      const pezzi = riga.split('•').map(normImp).filter(Boolean);        // "• a • b" scritto a mano nello stesso paragrafo
      pezzi.forEach(x => out.push(x));
    });
  });
  return out;
}

function leggiTabella(tbl) {
  const righe = [];
  Array.from(tbl.childNodes).filter(n => n.localName === 'tr').forEach(tr => {
    let col = 0;
    const trPr = Array.from(tr.childNodes).find(n => n.localName === 'trPr');
    const gb = trPr && trPr.getElementsByTagNameNS(NS_W, 'gridBefore')[0];
    if (gb) col = parseInt(gb.getAttributeNS(NS_W, 'val') || gb.getAttribute('w:val'), 10) || 0;
    const celle = [];
    Array.from(tr.childNodes).filter(n => n.localName === 'tc').forEach(tc => {
      const pr = Array.from(tc.childNodes).find(n => n.localName === 'tcPr');
      const gs = pr && pr.getElementsByTagNameNS(NS_W, 'gridSpan')[0];
      const span = gs ? parseInt(gs.getAttributeNS(NS_W, 'val') || gs.getAttribute('w:val'), 10) || 1 : 1;
      const vmEl = pr && pr.getElementsByTagNameNS(NS_W, 'vMerge')[0];
      let vm = null;
      if (vmEl) vm = (vmEl.getAttributeNS(NS_W, 'val') || vmEl.getAttribute('w:val')) === 'restart' ? 'start' : 'cont';
      celle.push({ col, span, vm, par: paragrafiDiCella(tc) });
      col += span;
    });
    righe.push(celle);
  });
  const nCol = righe.reduce((m, r) => Math.max(m, r.reduce((x, c) => Math.max(x, c.col + c.span), 0)), 0);
  return { righe, nCol };
}

async function leggiDocx(file) {
  await caricaScript(URL_JSZIP);
  let zip;
  try { zip = await window.JSZip.loadAsync(await file.arrayBuffer()); } catch (e) { throw new Error('Il file non è un documento Word (.docx) valido.'); }
  const f = zip.file('word/document.xml');
  if (!f) throw new Error('Il file non è un documento Word (.docx) valido.');
  const doc = new DOMParser().parseFromString(await f.async('string'), 'application/xml');
  const body = doc.getElementsByTagNameNS(NS_W, 'body')[0];
  const tabelle = [], blocchi = [];
  const visita = nodo => Array.from(nodo.childNodes).forEach(n => {
    if (n.localName === 'p') blocchi.push(leggiParagrafo(n));
    else if (n.localName === 'tbl') { tabelle.push(leggiTabella(n)); blocchi.push({ tipo: 't', indice: tabelle.length - 1 }); }
    else if (n.localName === 'sdt' || n.localName === 'sdtContent' || n.localName === 'customXml') visita(n);
  });
  if (body) visita(body);
  return { nome: file.name, tabelle, blocchi };
}

/* ---------- utilità sulle celle ---------- */

const testoCella = c => c.par.join(' ');
const cellaInColonna = (riga, c) => riga.find(x => x.col <= c && c < x.col + x.span);
const rigaVuota = riga => riga.every(c => !c.par.length);
const rigaTitolo = (riga, nCol) => {
  const piene = riga.filter(c => c.par.length);
  return piene.length === 1 && piene[0].span >= Math.max(2, nCol * 0.6) && !ruoloDaTesto(testoCella(piene[0]));
};
function rigaIntestazione(riga) {
  const testi = riga.filter(c => c.vm !== 'cont').map(testoCella).filter(Boolean);
  if (!testi.length) return false;
  const buone = testi.filter(t => (testoLungo(t) ? /\?$/.test(t) : !!ruoloDaTesto(t)));
  return buone.length >= Math.max(1, Math.ceil(testi.length * 0.6));
}

// Unisce righe spezzate a metà frase (documenti nati da PDF: una riga = un paragrafo)
function uniscispezzate(par) {
  const out = [];
  par.forEach(p => {
    const prec = out[out.length - 1];
    if (prec && !/[.;:!?)]$/.test(prec) && /^[a-zà-ú(]/.test(p) && !/^\(\s*pag/i.test(p)) out[out.length - 1] = prec + ' ' + p;
    else out.push(p);
  });
  return out;
}
const senzaPuntino = t => t.replace(/^(?:[•·▪◦\-–—*]|\d{1,2}[.)])\s*/, '').trim();
const elencoPulito = par => uniscispezzate(par).map(senzaPuntino).filter(Boolean);

/* ---------- titoli e codici ---------- */

const NOMI_PROPRI = { terra: 'Terra', luna: 'Luna', sole: 'Sole', homo: 'Homo', italia: 'Italia' };

function titoloPulito(t) {
  t = normImp(t);
  const m = t.match(/^per iniziare\s*[-–—]\s*(.*)$/i);
  if (m) return 'Per iniziare – ' + titoloPulito(m[1]);
  if (t === t.toUpperCase() || t === t.toLowerCase()) t = t.toLowerCase();
  else t = t.replace(/^([A-ZÀ-Ú]{2,})(?=\s)/, w => w.toLowerCase());
  t = t.charAt(0).toUpperCase() + t.slice(1);
  return t.replace(/ (terra|luna|sole|homo|italia)\b/g, (x, w) => ' ' + NOMI_PROPRI[w]);
}

function codiceETitolo(et) {
  et = normImp(et);
  let m = et.match(/^(?:capitolo|cap\.?|unit[àa]|modulo|tema|sezione|uda|ud)\s+([A-Za-z]?\d{1,3}[A-Za-z]?)\s*[-–—:.)]?\s*(.*)$/i);
  if (m) return { codice: /^\d+$/.test(m[1]) ? 'Cap. ' + m[1] : m[1].toUpperCase(), titolo: titoloPulito(m[2] || et) };
  m = et.match(/^([A-Za-z]\d{0,2})\s*[-–—:.]\s*(.*)$/) || et.match(/^([A-Za-z]\d{1,2})\s+(.+)$/);
  if (m) return { codice: m[1].toUpperCase(), titolo: titoloPulito(m[2]) };
  m = et.match(/^(\d{1,3})\s*[-–—.:)]?\s*(.*)$/);
  if (m && m[2]) return { codice: 'Cap. ' + m[1], titolo: titoloPulito(m[2]) };
  if (m) return { codice: 'Cap. ' + m[1], titolo: 'Capitolo ' + m[1] };
  return { codice: '', titolo: titoloPulito(et) };
}

/* ---------- lezioni ---------- */

function lezioniDaParagrafi(par, soloNumerate) {
  const out = [];
  const righe = soloNumerate ? par : uniscispezzate(par);
  righe.forEach(raw => {
    const p = soloNumerate ? raw : senzaPuntino(raw);
    if (!p) return;
    if (/^\(\s*pag/i.test(p)) {            // solo le pagine, su un paragrafo a parte
      const m = p.match(/^\(\s*pag\.?\s*([^)]*)\)/i);
      if (out.length && !out[out.length - 1].pagine) out[out.length - 1].pagine = normImp(m ? m[1] : '');
      return;
    }
    const mp = p.match(/^(.*?)\s*\(\s*pag\.?\s*([^)]*)\)\s*$/i);
    if (mp && mp[1]) { out.push({ titolo: mp[1].trim(), pagine: normImp(mp[2]) }); return; }
    const ml = p.match(/^(?:lezione|lez\.?)\s*(\d+)\s*[-–—:.]?\s*(.*)$/i);
    if (ml) { out.push({ titolo: ('Lezione ' + ml[1] + ' ' + ml[2]).trim(), pagine: '' }); return; }
    if (!soloNumerate && !/^(nel libro|con guarda|nelle idee|zte|video|scopri)\b/i.test(p)) out.push({ titolo: p, pagine: '' });
  });
  return out;
}

/* ---------- da tabella a sezioni ---------- */

function ruoliDaIntestazioni(headers, nCol) {
  const ruoli = Array(nCol).fill(null);
  for (let c = 0; c < nCol; c++) {
    let trovato = null, generico = null;
    for (let k = headers.length - 1; k >= 0 && !trovato; k--) {
      const cella = cellaInColonna(headers[k], c);
      if (!cella || cella.vm === 'cont') continue;
      const t = testoCella(cella);
      if (!t || testoLungo(t)) continue;
      const r = ruoloDaTesto(t);
      if (r === 'competenze') generico = generico || 'traguardi'; else if (r) trovato = r;
    }
    ruoli[c] = trovato || generico;
  }
  return ruoli;
}

// Quante righe iniziano la tabella senza contenere dati (titoli, intestazioni, righe vuote)
function righeDiTesta(t) {
  const headers = [];
  let i = 0;
  while (i < t.righe.length && i < 8) {
    const r = t.righe[i];
    if (rigaVuota(r) || rigaTitolo(r, t.nCol)) { i++; continue; }
    if (rigaIntestazione(r)) { headers.push(r); i++; continue; }
    break;
  }
  return { n: i, headers };
}

function statisticheColonne(t, daRiga) {
  const stat = [];
  for (let c = 0; c < t.nCol; c++) {
    const celle = t.righe.slice(daRiga).map(r => r.find(x => x.col === c)).filter(x => x && x.par.length);
    const par = [].concat(...celle.map(x => x.par));
    const frac = (arr, re) => (arr.length ? arr.filter(x => re.test(x)).length / arr.length : 0);
    stat.push({
      c, n: celle.length, nPar: celle.length ? par.length / celle.length : 0,
      lunghezza: par.length ? par.reduce((s, x) => s + x.length, 0) / par.length : 0,
      pPag: frac(celle.map(testoCella), /\(\s*pag|\bpag\.\s*[A-Z]?\d/i),
      pLez: frac(celle.map(testoCella), /\blezione\s+\d+/i),
      pCod: frac(celle.map(x => x.par[0]), /^\s*(?:(?:capitolo|cap\.?|unit[àa]|modulo|tema|uda)\s+)?([A-Za-z]\d{0,2}|\d{1,3})\s*(?:[-–—.:)]|$)/i),
      pVerbo: frac(par, VERBI_INIZIALI) + 0 * 1 || frac(par, INFINITO_GENERICO)
    });
    stat[stat.length - 1].pVerbo = Math.max(frac(par, VERBI_INIZIALI), frac(par, INFINITO_GENERICO));
  }
  return stat;
}

// Ruoli dedotti dal contenuto, per tabelle senza intestazioni riconoscibili
function inferisciRuoli(t, daRiga) {
  const ruoli = Array(t.nCol).fill('ignora');
  const stat = statisticheColonne(t, daRiga).filter(s => s.n > 0);
  if (!stat.length) return ruoli;
  const liberi = () => stat.filter(s => ruoli[s.c] === 'ignora');
  const migliore = (arr, chiave, soglia) => arr.filter(s => s[chiave] >= soglia).sort((a, b) => b[chiave] - a[chiave])[0];
  const u = migliore(stat, 'pCod', 0.5) || stat[0];
  ruoli[u.c] = 'unita';
  const nuc = migliore(liberi(), 'pPag', 0.3);
  if (nuc) ruoli[nuc.c] = 'nuclei';
  const att = migliore(liberi(), 'pLez', 0.3);
  if (att) ruoli[att.c] = 'attivita';
  const verbi = liberi().filter(s => s.pVerbo >= 0.35).sort((a, b) => a.c - b.c);
  if (verbi.length === 1) ruoli[verbi[0].c] = 'obiettivi';
  else if (verbi.length === 2) { ruoli[verbi[0].c] = 'indicatori'; ruoli[verbi[1].c] = 'obiettivi'; }
  else if (verbi.length >= 3) verbi.forEach((s, k) => { ruoli[s.c] = k === 0 ? 'traguardi' : k === verbi.length - 1 ? 'obiettivi' : 'indicatori'; });
  if (!Object.values(ruoli).includes('nuclei') && !Object.values(ruoli).includes('attivita')) {
    const resto = liberi().sort((a, b) => b.nPar - a.nPar)[0];
    if (resto) ruoli[resto.c] = 'nuclei';
  }
  return ruoli;
}

function proponiConfigurazione(t) {
  const testa = righeDiTesta(t);
  let ruoli = testa.headers.length ? ruoliDaIntestazioni(testa.headers, t.nCol) : Array(t.nCol).fill(null);
  const riconosciute = ruoli.filter(r => r && r !== 'ignora');
  let origine = 'intestazioni';
  if (riconosciute.length < 2 || !ruoli.includes('unita')) {
    // intestazioni assenti o povere: se la prima riga sembra un'intestazione la si salta, poi si deduce dal contenuto
    ruoli = inferisciRuoli(t, testa.n);
    origine = 'contenuto';
  } else {
    ruoli = ruoli.map(r => (r === 'competenze' ? 'traguardi' : r || 'ignora'));
  }
  return { intest: testa.n, ruoli, origine };
}

function sezioniDaTabella(t, intest, ruoli) {
  const colsDi = ruolo => ruoli.map((r, c) => (r === ruolo ? c : -1)).filter(c => c >= 0);
  let colUnita = ruoli.indexOf('unita');
  if (colUnita < 0) colUnita = 0;
  const grezze = [];
  let corrente = null;
  t.righe.slice(intest).forEach(riga => {
    if (rigaVuota(riga)) return;
    if (rigaIntestazione(riga) && riga.filter(c => c.par.length).length >= 3) return;   // intestazione ripetuta a metà tabella
    const cu = cellaInColonna(riga, colUnita);
    const et = cu && cu.vm !== 'cont' ? cu.par.join(' ') : '';
    if (et) {
      corrente = { etichetta: et };
      LISTE_SEZIONE.forEach(l => { corrente[l] = []; });
      grezze.push(corrente);
    }
    if (!corrente) return;
    LISTE_SEZIONE.forEach(l => colsDi(l).forEach(c => {
      const cella = cellaInColonna(riga, c);
      if (cella && cella.vm !== 'cont' && cella.col === c) corrente[l].push(...cella.par);
    }));
  });
  return grezze.map(costruisciSezione);
}

function costruisciSezione(g, n) {
  const { codice, titolo } = codiceETitolo(g.etichetta);
  let lezioni = lezioniDaParagrafi(g.nuclei);
  const numerate = lezioniDaParagrafi(g.attivita, true);
  lezioni = lezioni.length ? lezioni : numerate;
  return {
    codice, titolo: titolo || codice || 'Sezione',
    lezioni: lezioni.map(l => ({ titolo: l.titolo, pagine: l.pagine })),
    obiettivi: elencoPulito(g.obiettivi), indicatori: elencoPulito(g.indicatori), traguardi: elencoPulito(g.traguardi)
  };
}

/* ---------- da testo libero (titoli ed elenchi) a sezioni ---------- */

function sezioniDaParagrafi(blocchi) {
  const righe = blocchi.filter(b => b.tipo === 'p').flatMap(b => b.testo.split('\n').map(x => ({ testo: normImp(x), stile: b.stile, lista: b.lista }))).filter(r => r.testo);
  if (righe.length < 2) return [];
  const eTitolo = r => /^(heading|titolo|intestazione)\s*[1-4]$/i.test(r.stile) || /^(heading|titolo)[1-4]$/i.test(r.stile);
  const eMarcatore = r => r.testo.length < 130 && (/^(capitolo|cap\.|unit[àa]|modulo|tema|sezione|uda|percorso)\s+[\w.]+/i.test(r.testo) || /^[A-Za-z]\d{1,2}\s*[-–—:.]\s*\S/.test(r.testo));
  const eNumerato = r => r.testo.length < 100 && /^\d{1,2}\s*[-–—.)]\s+[A-ZÀ-Ú]/.test(r.testo) && !/[.;]$/.test(r.testo);
  const conta = f => righe.filter(f).length;
  let eInizio = null;
  if (conta(eTitolo) >= 2) eInizio = eTitolo;
  else if (conta(eMarcatore) >= 2) eInizio = eMarcatore;
  else if (conta(eNumerato) >= 2) eInizio = eNumerato;
  const gruppi = [];
  let cur = null;
  righe.forEach(r => {
    if (eInizio && eInizio(r)) { cur = { etichetta: r.testo, righe: [] }; gruppi.push(cur); return; }
    if (!cur) { cur = { etichetta: 'Argomenti', righe: [] }; gruppi.push(cur); }
    cur.righe.push(r.testo);
  });
  const ETICHETTE = [['obiettivi', /^obiettivi?(?: di apprendimento| minimi)?/i], ['indicatori', /^indicatori/i], ['traguardi', /^(?:traguardi|competenze)/i], ['nuclei', /^(?:lezioni|contenuti|argomenti|nuclei(?: fondamentali)?)/i]];
  return gruppi.map(g => {
    const raw = { etichetta: g.etichetta };
    LISTE_SEZIONE.forEach(l => { raw[l] = []; });
    let modo = 'nuclei';
    g.righe.forEach(r => {
      const et = ETICHETTE.find(([, re]) => re.test(r));
      if (et) {
        modo = et[0];
        const resto = r.replace(et[1], '').replace(/^\s*(?:di apprendimento|minimi|fondamentali)?\s*:?\s*/i, '').trim();
        if (resto) raw[modo].push(resto);
        return;
      }
      raw[modo].push(r);
    });
    return costruisciSezione(raw);
  }).filter(s => s.titolo);
}

/* ---------- analisi complessiva ---------- */

const sezioneValida = s => s.lezioni.length + s.obiettivi.length + s.indicatori.length + s.traguardi.length > 0;
const riassuntoSezioni = sez => ({
  sezioni: sez.length, lezioni: sez.reduce((t, s) => t + s.lezioni.length, 0),
  obiettivi: sez.reduce((t, s) => t + s.obiettivi.length, 0), indicatori: sez.reduce((t, s) => t + s.indicatori.length, 0)
});

function analizzaDocumento(doc) {
  const tabelle = doc.tabelle.map(t => {
    const cfg = proponiConfigurazione(t);
    const sezioni = sezioniDaTabella(t, cfg.intest, cfg.ruoli);
    return { righe: t.righe, nCol: t.nCol, cfg, usata: sezioni.filter(sezioneValida).length > 0 };
  });
  const sezParagrafi = sezioniDaParagrafi(doc.blocchi);
  const haTabelleBuone = tabelle.some(t => t.usata);
  const sembraPiano = doc.tabelle.some(t => {
    const testa = t.righe.slice(0, 3).map(r => r.map(testoCella).join(' ')).join(' ');
    return /settiman/i.test(testa) && /\bmes[ei]\b/i.test(testa);
  });
  const analisi = { nome: doc.nome, tabelle, blocchi: doc.blocchi, sembraPiano, usaParagrafi: !haTabelleBuone && sezParagrafi.filter(sezioneValida).length > 0 };
  // ultima spiaggia: nessuna fonte valida -> la tabella più grande, una riga per sezione, la prima colonna come titolo
  if (!haTabelleBuone && !analisi.usaParagrafi && tabelle.length) {
    const k = tabelle.reduce((m, t, i, a) => (t.righe.length > a[m].righe.length ? i : m), 0);
    const t = tabelle[k];
    const ruoli = Array(t.nCol).fill('nuclei'); ruoli[0] = 'unita';
    t.cfg = { intest: righeDiTesta(t).n, ruoli, origine: 'ultima-spiaggia' };
    t.usata = true;
  }
  return analisi;
}

// Sezioni risultanti dalla configurazione attuale (modificabile dall'utente)
function sezioniRisultanti(analisi) {
  let sez = [];
  analisi.tabelle.forEach(t => { if (t.usata) sez = sez.concat(sezioniDaTabella(t, t.cfg.intest, t.cfg.ruoli)); });
  if (analisi.usaParagrafi) sez = sez.concat(sezioniDaParagrafi(analisi.blocchi));
  const usati = {};
  return sez.filter(s => s.titolo && (sezioneValida(s) || s.codice)).map((s, i) => {
    let id = (s.codice || 's' + (i + 1)).replace(/\s+/g, '');
    usati[id] = (usati[id] || 0) + 1;
    if (usati[id] > 1) id += '_' + usati[id];
    return { id, codice: s.codice || String(i + 1), titolo: s.titolo, obiettivi: s.obiettivi, indicatori: s.indicatori, traguardi: s.traguardi,
      lezioni: s.lezioni.map((l, k) => ({ id: id + '-' + (k + 1), titolo: l.titolo, pagine: l.pagine })) };
  });
}

async function libroDaDocx(file, meta) {
  const analisi = analizzaDocumento(await leggiDocx(file));
  const sezioni = sezioniRisultanti(analisi);
  if (!sezioni.length) throw new Error('Nel documento non ho trovato testo di programmazione leggibile (potrebbe essere una scansione o un\'immagine).');
  return { id: 'imp-' + uid(), titolo: meta.titolo, editore: meta.editore || '', materia: meta.materia || '', sezioni, importato: true };
}

// Per i controlli automatici
if (typeof window !== 'undefined') window.ProMateoSImporta = { leggiDocx, analizzaDocumento, sezioniRisultanti, riassuntoSezioni };
