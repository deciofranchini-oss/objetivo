// app/aiService.js
// "IA gratuita do GitHub" (offline):
// - PDF text extraction via pdf.js (Mozilla, open-source)
// - Image OCR via tesseract.js (open-source)
// - Heuristic parsing to fill the transaction form
//
// This design removes any paid-token dependency and keeps an abstraction layer
// to swap in another AI strategy later.

import { S } from './state.js';
import { catInfo, safeKey, toISODateFromBR } from './utils.js';

const AI = {
  ready: false,
  pdfjs: null,
  tesseract: null,
};

export function ensureAiDepsLoaded() {
  if (AI.ready) return Promise.resolve();
  return new Promise((resolve, reject) => {
    // Load deps lazily (GitHub Pages friendly)
    // pdfjs + tesseract are hosted on CDN, sourced from GitHub repos.
    const loadScript = (src) => new Promise((ok, fail) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = ok;
      s.onerror = () => fail(new Error('Falha ao carregar: ' + src));
      document.head.appendChild(s);
    });

    Promise.resolve()
      .then(() => loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.5.136/build/pdf.min.js'))
      .then(() => {
        // eslint-disable-next-line no-undef
        AI.pdfjs = window['pdfjsLib'];
        if (AI.pdfjs) {
          AI.pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.5.136/build/pdf.worker.min.js';
        }
      })
      .then(() => loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.0/dist/tesseract.min.js'))
      .then(() => {
        // eslint-disable-next-line no-undef
        AI.tesseract = window['Tesseract'];
        AI.ready = true;
        resolve();
      })
      .catch(reject);
  });
}

async function extractTextFromPdf(file) {
  const buf = await file.arrayBuffer();
  const doc = await AI.pdfjs.getDocument({ data: buf }).promise;
  let out = '';
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const txt = tc.items.map(i => i.str).join(' ');
    out += txt + '\n';
  }
  return out;
}

async function extractTextFromImage(file) {
  const { data } = await AI.tesseract.recognize(file, 'por', {
    logger: () => {}, // keep quiet
  });
  return (data && data.text) ? data.text : '';
}

function parseMoney(text) {
  // capture R$ 1.234,56 and also 1234,56 near TOTAL
  const vals = [];

  const rx = /R\$\s*([\d\.\,]{3,})/gi;
  let m;
  while ((m = rx.exec(text)) !== null) {
    vals.push(m[1]);
  }

  // Extra: "Total: 1234,56"
  const rx2 = /(total|valor)\s*[:\-]?\s*([\d\.\,]{3,})/gi;
  while ((m = rx2.exec(text)) !== null) {
    vals.push(m[2]);
  }

  const toNum = (s) => {
    const n = (s || '').replace(/\./g, '').replace(',', '.');
    const v = parseFloat(n);
    return isFinite(v) ? v : null;
  };

  const nums = vals.map(toNum).filter(v => v != null);
  if (!nums.length) return null;

  // Heuristic: pick the largest value (usually the payable total).
  return nums.sort((a, b) => b - a)[0];
}

function parseDate(text) {
  // dd/mm/yyyy
  const rx = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/;
  const m = text.match(rx);
  if (!m) return null;
  return toISODateFromBR(m[1]);
}

function inferCategory(text) {
  const t = text.toLowerCase();
  const kw = [
    ['pensao', /(pensão|pensao|aliment[ií]cia)/],
    ['mensalidade', /(mensalidade|mensal)/],
    ['matricula', /(matr[ií]cula)/],
    ['material', /(material|livro|apostila)/],
    ['uniforme', /(uniforme|camiseta|agasalho)/],
    ['extra', /(excurs|extra|passeio|evento|teatro)/],
  ];
  for (const [k, r] of kw) if (r.test(t)) return k;
  return 'extra';
}

function summarize(text) {
  const line = (text || '').split('\n').map(s => s.trim()).filter(Boolean)[0];
  if (!line) return 'Documento analisado.';
  return line.slice(0, 120);
}

export async function interpretFileToTx(file) {
  await ensureAiDepsLoaded();

  let text = '';
  if (file.type === 'application/pdf') {
    text = await extractTextFromPdf(file);
  } else if (/image\/(png|jpe?g)/.test(file.type)) {
    text = await extractTextFromImage(file);
  } else {
    throw new Error('Use PDF, JPG ou PNG');
  }

  const amount = parseMoney(text);
  const dateISO = parseDate(text) || new Date().toISOString().slice(0, 10);

  const categoryKey = inferCategory(text);
  const isPensao = categoryKey === 'pensao';

  // Build candidate tx
  const dt = new Date(dateISO + 'T00:00:00');
  const academicYear = dt.getFullYear();
  const academicMonth = dt.getMonth() + 1;

  const type = isPensao ? 'RECEIVED' : 'PAID';
  const party = isPensao ? 'father' : 'me';

  const day = dt.getDate();
  const isLate = isPensao ? (day > 5) : false;

  const found = {
    amount: amount != null,
    date: !!dateISO,
    category: !!categoryKey,
  };
  const score = Object.values(found).filter(Boolean).length;
  const confidence = score === 3 ? 'high' : score === 2 ? 'medium' : 'low';

  // Ensure category exists (if user deleted system categories, keep key but UI will show raw)
  const catKeys = S.cats.map(c => c.key);
  const safeCatKey = catKeys.includes(categoryKey) ? categoryKey : 'extra';

  return {
    amount: amount ?? 0,
    type,
    categoryKey: safeCatKey,
    party,
    date: dateISO,
    academicYear,
    academicMonth,
    isLate,
    isForecast: false,
    notes: summarize(text),
    tags: isPensao ? 'pensao' : safeKey(safeCatKey),
    confidence,
    summary: `Detectado: ${catInfo(safeCatKey).label} · R$ ${amount ? amount.toFixed(2).replace('.', ',') : '—'}`,
    _rawTextPreview: (text || '').slice(0, 800),
  };
}
