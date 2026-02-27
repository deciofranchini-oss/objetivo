// app/main.js
// Refactored main controller: state + UI rendering + persistence.
// Keeps compatibility with original HTML (inline onclick handlers call global functions like nav(), exportCSV(), printReport()).

import { openDB, all, put, del, clr } from './db.js';
import { seedIfEmpty } from './seed.js';
import { S, MF } from './state.js';
import { $, toast, brl, fmtD, catEmoji, catInfo, partyInfo, safeKey } from './utils.js';
import { loadSettingsData, renderSettingsUI } from './settings.js';
import { renderReportHTML } from './reporting.js';
import { interpretFileToTx } from './aiService.js';
import { drawCharts } from './charts.js';

let TX = [];

async function boot() {
  await openDB();
  await seedIfEmpty();
  await loadSettingsData();
  bindUI();
  await refreshAll();
  nav('dash'); // default
}

function bindUI() {
  // Make original inline handlers work
  window.nav = nav;
  window.exportCSV = exportCSV;
  window.printReport = printReport;
  window.exportExcel = exportExcel;

  window.exportAllJSON = exportAllJSON;
  window.importAllJSON = importAllJSON;
  window.clearAll = clearAll;

  // Year select badge
  $('nav-yr')?.addEventListener('click', openYearPicker);

  // AI controls
  $('ai-drop')?.addEventListener('click', () => $('ai-file')?.click());
  $('ai-file')?.addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (f) showAiFile(f);
    e.target.value = '';
  });
  $('ai-drop')?.addEventListener('dragover', e => { e.preventDefault(); $('ai-drop').style.borderColor = 'rgba(0,0,0,.25)'; });
  $('ai-drop')?.addEventListener('dragleave', () => $('ai-drop').style.borderColor = 'rgba(0,0,0,.10)');
  $('ai-drop')?.addEventListener('drop', e => {
    e.preventDefault(); $('ai-drop').style.borderColor = 'rgba(0,0,0,.10)';
    const f = e.dataTransfer.files?.[0];
    if (f) showAiFile(f);
  });
  $('ai-run-btn')?.addEventListener('click', runAI);

  // Form save/delete
  $('f-val')?.addEventListener('input', () => $('ai-status').textContent = '');
  $('del-btn')?.addEventListener('click', deleteTx);
  // "Salvar" button is in HTML with onclick="saveTx()"
  window.saveTx = saveTx;

  // Dynamic party dropdown: add new from form
  $('f-party')?.addEventListener('change', async (e) => {
    if (e.target.value === '__add__') {
      const label = prompt('Nome da nova Parte (ex: Avó):');
      if (!label) { e.target.value = 'me'; return; }
      const key = safeKey(label);
      await put('parties', { key, label: label.trim(), system: false });
      await loadSettingsData();
      fillPartySelect();
      e.target.value = key;
      toast('Parte adicionada e salva nas Configurações');
    }
  });
}

async function refreshAll() {
  TX = await all('txs');
  TX.sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.id - b.id));
  fillPartySelect();
  fillYearSelect();
}

function yearsAvailable() {
  return Array.from(new Set(TX.map(t => t.academicYear))).sort((a, b) => a - b);
}

function fillYearSelect() {
  const y = $('yr-sel');
  if (!y) return;
  y.textContent = (S.year === 'all') ? 'Todos' : S.year;
}

function openYearPicker() {
  const years = yearsAvailable();
  const opts = ['all', ...years.map(String)];
  const current = String(S.year);
  const pick = prompt(`Selecione o ano (${opts.join(', ')}):`, current === 'all' ? 'all' : current);
  if (!pick) return;
  const v = pick.toLowerCase() === 'all' ? 'all' : Number(pick);
  if (v !== 'all' && !years.includes(v)) { toast('Ano inválido'); return; }
  S.year = v;
  fillYearSelect();
  // re-render current page
  nav(S.tab);
}

function fillPartySelect() {
  const sel = $('f-party');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = `
    ${S.parties.map(p => `<option value="${p.key}">${p.label}</option>`).join('')}
    <option value="__add__">+ Adicionar nova…</option>
  `;
  if (current && [...sel.options].some(o => o.value === current)) sel.value = current;
  else sel.value = 'me';
}

function filterTxByYear() {
  if (S.year === 'all') return TX.slice();
  return TX.filter(t => t.academicYear === S.year);
}

function computeSummary(rows) {
  const paidActual = rows.filter(t => t.type === 'PAID' && !t.isForecast).reduce((a, t) => a + (t.amount || 0), 0);
  const recv = rows.filter(t => t.type === 'RECEIVED' && !t.isForecast).reduce((a, t) => a + (t.amount || 0), 0);
  const forecast = rows.filter(t => t.isForecast).reduce((a, t) => a + (t.amount || 0), 0);

  const byCat = {};
  rows.filter(t => t.type === 'PAID' && !t.isForecast).forEach(t => byCat[t.categoryKey] = (byCat[t.categoryKey] || 0) + (t.amount || 0));

  const byMonthPaid = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const r = rows.filter(t => t.academicMonth === m && t.type === 'PAID' && !t.isForecast);
    const o = { total: 0 };
    r.forEach(t => {
      o[t.categoryKey] = (o[t.categoryKey] || 0) + (t.amount || 0);
      o.total += (t.amount || 0);
    });
    return o;
  });

  const byMonthForecast = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const r = rows.filter(t => t.academicMonth === m && t.isForecast);
    return { total: r.reduce((a, t) => a + (t.amount || 0), 0) };
  });

  return { paidActual, recv, forecast, byCat, byMonthPaid, byMonthForecast };
}

export function nav(tab) {
  S.tab = tab;

  // pages
  const pages = {
    dash: $('page-dash'),
    txs: $('page-txs'),
    add: $('page-add'),
    rpt: $('page-rpt'),
    cfg: $('page-cfg'),
  };
  Object.entries(pages).forEach(([k, el]) => { if (el) el.style.display = (k === tab) ? 'block' : 'none'; });

  // tabs active
  ['t-dash','t-txs','t-add','t-rpt','t-cfg'].forEach(id => $(id)?.classList.remove('active'));
  $(`t-${tab}`)?.classList.add('active');

  // year badge hidden only on cfg
  $('nav-yr').style.display = (tab === 'cfg') ? 'none' : 'flex';

  if (tab === 'dash') renderDash();
  if (tab === 'txs') renderTxs();
  if (tab === 'add') renderAdd();
  if (tab === 'rpt') renderReport();
  if (tab === 'cfg') renderCfg();
}

function renderDash() {
  const rows = filterTxByYear();
  const sum = computeSummary(rows);

  $('kpi-row').innerHTML = `
    <div class="kpi blue">
      <div class="kpi-label">Total Pago</div>
      <div class="kpi-value mono">R$ ${brl(sum.paidActual)}</div>
      <div class="kpi-sub">Despesas efetivadas</div>
    </div>
    <div class="kpi red">
      <div class="kpi-label">Pensão</div>
      <div class="kpi-value mono">R$ ${brl(sum.recv)}</div>
      <div class="kpi-sub">Recebimentos</div>
    </div>
    <div class="kpi ora">
      <div class="kpi-label">Saldo</div>
      <div class="kpi-value mono">R$ ${brl(sum.recv - sum.paidActual)}</div>
      <div class="kpi-sub">Recebido − Pago</div>
    </div>
    <div class="kpi purple">
      <div class="kpi-label">Previsão</div>
      <div class="kpi-value mono">R$ ${brl(sum.forecast)}</div>
      <div class="kpi-sub">Pagamentos futuros</div>
    </div>
  `;

  drawCharts(sum);

  // Recent
  const rec = rows.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.id - a.id)).slice(0, 6);
  $('recent-card').innerHTML = rec.map(t => {
    const cat = catInfo(t.categoryKey);
    const prt = partyInfo(t.party);
    const sign = t.type === 'RECEIVED' ? '+' : '-';
    const late = (t.type === 'RECEIVED' && t.isLate) ? `<span class="tag red">fora do prazo</span>` : '';
    const fc = t.isForecast ? `<span class="tag" style="border-color:rgba(107,79,187,.3);background:rgba(107,79,187,.08);color:#6B4FBB">previsão</span>` : '';
    return `
      <div class="row" onclick="editTx(${t.id})">
        <div class="row-left">
          <span class="dot" style="background:${cat.color}"></span>
          <div style="display:flex;flex-direction:column;gap:2px">
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              <span style="font-weight:800">${catEmoji(t.categoryKey)} ${cat.label}</span>
              ${late}${fc}
            </div>
            <div class="tiny" style="color:var(--t-faint)">${fmtD(t.date)} · ${prt.label}${t.notes ? ' · ' + t.notes : ''}</div>
          </div>
        </div>
        <div class="row-actions">
          <div class="mono" style="font-weight:800;${t.type === 'RECEIVED' ? 'color:var(--red)' : ''}">${sign} R$ ${brl(t.amount || 0)}</div>
        </div>
      </div>
    `;
  }).join('') || `<div class="empty-state">Sem transações.</div>`;

  window.editTx = (id) => openEdit(id);
}

function renderTxs() {
  const rows = filterTxByYear().slice().sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.id - a.id));
  // chips (type/category) already in HTML, but original filters were static.
  // For now, keep existing filter UI and just render list.
  $('tx-wrap').innerHTML = rows.map(t => {
    const cat = catInfo(t.categoryKey);
    const prt = partyInfo(t.party);
    const sign = t.type === 'RECEIVED' ? '+' : '-';
    const late = (t.type === 'RECEIVED' && t.isLate) ? `<span class="tag red">fora do prazo</span>` : '';
    const fc = t.isForecast ? `<span class="tag" style="border-color:rgba(107,79,187,.3);background:rgba(107,79,187,.08);color:#6B4FBB">previsão</span>` : '';
    return `
      <div class="row" onclick="editTx(${t.id})">
        <div class="row-left">
          <span class="dot" style="background:${cat.color}"></span>
          <div style="display:flex;flex-direction:column;gap:2px">
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              <span style="font-weight:800">${catEmoji(t.categoryKey)} ${cat.label}</span>
              ${late}${fc}
            </div>
            <div class="tiny" style="color:var(--t-faint)">${fmtD(t.date)} · ${prt.label}${t.notes ? ' · ' + t.notes : ''}</div>
          </div>
        </div>
        <div class="row-actions">
          <div class="mono" style="font-weight:800;${t.type === 'RECEIVED' ? 'color:var(--red)' : ''}">${sign} R$ ${brl(t.amount || 0)}</div>
        </div>
      </div>
    `;
  }).join('') || `<div class="empty-state">Sem transações.</div>`;

  window.editTx = (id) => openEdit(id);
}

function renderAdd() {
  // Reset AI state visuals
  $('ai-status').textContent = 'Envie um comprovante em PDF/Imagem. A análise acontece no seu navegador (sem token e sem chave).';
}

function renderReport() {
  $('rpt-content').innerHTML = renderReportHTML(TX, S.year);
  $('rpt-hint').innerHTML = 'Dica: no relatório, "Pago fora do prazo" aparece ao lado da data. Previsões (futuro) não entram no total pago.';
}

function renderCfg() {
  renderSettingsUI();
}

// ===== Form open/edit =====

function openEdit(id = null) {
  nav('add');
  const t = id ? TX.find(x => x.id === id) : null;
  S.editId = id || null;

  $('add-title').textContent = id ? 'Editar transação' : 'Nova transação';
  $('f-id').value = id || '';
  $('f-type').value = t?.type || 'PAID';
  $('f-cat').value = t?.categoryKey || 'mensalidade';
  $('f-party').value = t?.party || 'me';
  $('f-date').value = t?.date || new Date().toISOString().slice(0, 10);
  $('f-year').value = t?.academicYear || new Date().getFullYear();
  $('f-month').value = t?.academicMonth || (new Date().getMonth() + 1);
  $('f-val').value = (t?.amount != null) ? String(t.amount) : '';
  $('f-notes').value = t?.notes || '';
  $('f-tags').value = t?.tags || '';

  $('tog')?.classList.toggle('on', !!t?.isLate);
  $('tog-forecast')?.classList.toggle('on', !!t?.isForecast);

  $('del-btn').style.display = id ? 'inline-flex' : 'none';
}

async function saveTx() {
  const id = Number($('f-id').value || 0) || null;
  const type = $('f-type').value;
  const categoryKey = $('f-cat').value;
  const party = $('f-party').value;
  const date = $('f-date').value;
  const amount = parseFloat(($('f-val').value || '0').replace(',', '.'));
  const notes = $('f-notes').value || '';
  const tags = $('f-tags').value || '';

  const isLate = $('tog')?.classList.contains('on') || false;
  const isForecast = $('tog-forecast')?.classList.contains('on') || false;

  if (!date || !isFinite(amount)) { toast('Data e valor são obrigatórios'); return; }

  const dt = new Date(date + 'T00:00:00');
  const academicYear = dt.getFullYear();
  const academicMonth = dt.getMonth() + 1;

  const now = new Date().toISOString();
  const base = {
    type, categoryKey, party,
    date, amount,
    academicYear, academicMonth,
    isLate: (type === 'RECEIVED') ? !!isLate : false,
    isForecast: !!isForecast,
    notes, tags,
    updatedAt: now,
  };

  if (id) {
    const old = TX.find(x => x.id === id) || { id };
    await put('txs', { ...old, ...base });
    toast('Transação atualizada');
  } else {
    await put('txs', { ...base, createdAt: now });
    toast('Transação criada');
  }

  await refreshAll();
  nav('txs');
}

async function deleteTx() {
  const id = Number($('f-id').value || 0);
  if (!id) return;
  if (!confirm('Excluir esta transação?')) return;
  await del('txs', id);
  toast('Transação excluída');
  await refreshAll();
  nav('txs');
}

// ===== AI (offline) =====
let AI_FILE = null;

function showAiFile(file) {
  AI_FILE = file;
  $('ai-file-info').style.display = 'flex';
  $('ai-file-nm').textContent = file.name;
  $('ai-file-sz').textContent = `${Math.round(file.size/1024)} KB`;
  $('ai-idle').style.display = 'none';
  $('ai-result').style.display = 'none';
  $('ai-status').textContent = 'Pronto para interpretar.';
}

async function runAI() {
  if (!AI_FILE) { toast('Escolha um arquivo primeiro'); return; }
  try {
    $('ai-status').textContent = 'Analisando documento…';
    const tx = await interpretFileToTx(AI_FILE);

    // Fill form
    $('f-type').value = tx.type;
    $('f-cat').value = tx.categoryKey;
    $('f-party').value = tx.party;
    $('f-date').value = tx.date;
    $('f-year').value = tx.academicYear;
    $('f-month').value = tx.academicMonth;
    $('f-val').value = String(tx.amount || '');
    $('f-notes').value = tx.notes || '';
    $('f-tags').value = tx.tags || '';

    $('tog')?.classList.toggle('on', !!tx.isLate);
    $('tog-forecast')?.classList.toggle('on', !!tx.isForecast);

    $('ai-summary').textContent = tx.summary || 'OK';
    $('ai-result').style.display = 'block';

    $('ai-status').textContent = `IA (offline): ${tx.confidence === 'high' ? 'alta' : tx.confidence === 'medium' ? 'média' : 'baixa'} confiança`;
    toast('Campos preenchidos');
  } catch (err) {
    console.error(err);
    $('ai-status').textContent = err?.message || 'Falha na IA';
    toast('Falha na IA');
  }
}

// ===== Exports =====

function exportCSV() {
  const rows = (S.year === 'all') ? TX : TX.filter(t => t.academicYear === S.year);
  const header = ['id','date','academicYear','academicMonth','type','categoryKey','party','amount','isLate','isForecast','notes','tags'];
  const lines = [header.join(';')];
  rows.forEach(t => {
    const vals = header.map(k => String((t[k] ?? '')).replaceAll('\n',' ').replaceAll(';', ','));
    lines.push(vals.join(';'));
  });
  downloadText(lines.join('\n'), `school-ledger-${S.year === 'all' ? 'all' : S.year}.csv`, 'text/csv;charset=utf-8');
}

function printReport() {
  // Print current report area to PDF via browser
  nav('rpt');
  const w = window.open('', '_blank');
  const content = $('rpt-content')?.innerHTML || '';
  const html = `
    <html><head><meta charset="utf-8"><title>Relatório</title>
      <style>
        body{font-family:Inter,system-ui,Arial;margin:20px;}
        table{border-collapse:collapse;width:100%;font-size:12px}
        th,td{border:1px solid #ddd;padding:6px;text-align:left}
        th{background:#f6f6f6}
        .tag{padding:2px 6px;border-radius:999px;border:1px solid rgba(0,0,0,.12);font-size:11px}
        .red{color:#C0392B;border-color:rgba(192,57,43,.35);background:rgba(192,57,43,.08)}
        .mono{font-family:ui-monospace,Menlo,Consolas,monospace}
      </style>
    </head>
    <body>
      <h2>School Ledger — Relatório</h2>
      ${content}
      <script>window.onload=()=>{window.print();}</script>
    </body></html>`;
  w.document.write(html);
  w.document.close();
}

function exportExcel() {
  // Minimal Excel export: generate HTML as .xls (works in Excel/Numbers)
  const content = $('rpt-content')?.innerHTML || '';
  const blob = new Blob([`<html><head><meta charset="utf-8"></head><body>${content}</body></html>`], { type: 'application/vnd.ms-excel' });
  downloadBlob(blob, `school-ledger-report-${S.year === 'all' ? 'all' : S.year}.xls`);
}

function exportAllJSON() {
  const payload = { txs: TX, cats: S.cats, parties: S.parties };
  downloadText(JSON.stringify(payload, null, 2), 'school-ledger-backup.json', 'application/json');
  toast('Backup JSON gerado');
}

async function importAllJSON() {
  const f = await pickFile('.json');
  if (!f) return;
  const txt = await f.text();
  const obj = JSON.parse(txt);
  if (!obj?.txs) { toast('Arquivo inválido'); return; }

  await clr('txs'); await clr('cats'); await clr('parties');
  for (const c of (obj.cats || [])) await put('cats', c);
  for (const p of (obj.parties || [])) await put('parties', p);
  for (const t of obj.txs) await put('txs', t);

  await loadSettingsData();
  await refreshAll();
  nav('dash');
  toast('Backup importado');
}

async function clearAll() {
  if (!confirm('Apagar TODOS os dados?')) return;
  await clr('txs'); await clr('cats'); await clr('parties');
  await seedIfEmpty();
  await loadSettingsData();
  await refreshAll();
  nav('dash');
  toast('Dados resetados');
}

function downloadText(text, filename, mime) {
  const blob = new Blob([text], { type: mime });
  downloadBlob(blob, filename);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function pickFile(accept) {
  return new Promise((resolve) => {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = accept || '*/*';
    i.onchange = () => resolve(i.files?.[0] || null);
    i.click();
  });
}

// Service worker registration (kept)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

boot();
