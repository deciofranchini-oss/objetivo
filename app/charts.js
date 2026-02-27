// app/charts.js
import { S, CAT_ORDER, MO } from './state.js';
import { $, brlK, catInfo } from './utils.js';

export function drawCharts(summary) {
  const bc = summary.byCat || {};
  const gt = Object.values(bc).reduce((a, v) => a + v, 0);

  const paidActual = summary.paidActual || 0;
  const recv = summary.recv || 0;
  const deficit = paidActual - recv;

  const p0 = paidActual > 0 ? (deficit / paidActual * 100).toFixed(1) : 0;
  const p1 = paidActual > 0 ? (recv / paidActual * 100).toFixed(1) : 0;

  $('chart-area').innerHTML = `
    <div class="card" style="margin:0 20px 12px;padding:16px">
      <div class="chart-title">Visão Geral — ${S.year === 'all' ? 'Todos os anos' : S.year}</div>
      <div style="display:flex;gap:10px">
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:8px">
          <canvas id="cv1" style="width:110px;height:110px"></canvas>
          <div class="donut-name">Financiamento</div>
          <div style="width:100%;display:flex;flex-direction:column;gap:4px">
            <div class="leg-item"><div class="leg-swatch" style="background:#3B5BDB"></div>Eu<span class="leg-pct">${p0}%</span></div>
            <div class="leg-item"><div class="leg-swatch" style="background:#C0392B"></div>Pai<span class="leg-pct">${p1}%</span></div>
          </div>
        </div>
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:8px">
          <canvas id="cv2" style="width:110px;height:110px"></canvas>
          <div class="donut-name">Categorias (pagas)</div>
          <div id="pie2-leg" style="width:100%;display:flex;flex-direction:column;gap:4px"></div>
        </div>
      </div>
    </div>

    <div class="card" style="margin:0 20px 12px;padding:16px">
      <div class="chart-title">Despesas por Mês (pagas)</div>
      <canvas id="cv3" style="width:100%;display:block"></canvas>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px">
        ${CAT_ORDER.filter(k => k !== 'pensao').map(k => `
          <div class="leg-item"><div class="leg-swatch" style="background:${catInfo(k).color}"></div><span>${catInfo(k).label}</span></div>
        `).join('')}
      </div>
    </div>

    <div class="card" style="margin:0 20px 12px;padding:16px">
      <div class="chart-title">Forecast (previsões) por Mês</div>
      <canvas id="cvF" style="width:100%;display:block"></canvas>
      <div style="font-size:11px;color:var(--t-faint);margin-top:10px;line-height:1.5">
        As previsões não entram no total pago, mas ajudam a enxergar o que vem pela frente.
      </div>
    </div>
  `;

  donut('cv1', [{ v: deficit, c: '#3B5BDB' }, { v: recv, c: '#C0392B' }], 'Total', brlK(paidActual), 110);
  donut('cv2', CAT_ORDER.filter(k => k !== 'pensao').map(k => ({ v: bc[k] || 0, c: catInfo(k).color })), 'Total', brlK(gt), 110);

  $('pie2-leg').innerHTML = CAT_ORDER.filter(k => k !== 'pensao').map(k => {
    const v = bc[k] || 0;
    if (!v) return '';
    const p = gt > 0 ? (v / gt * 100).toFixed(0) : 0;
    return `<div class="leg-item"><div class="leg-swatch" style="background:${catInfo(k).color}"></div>${catInfo(k).label}<span class="leg-pct">${p}%</span></div>`;
  }).join('');

  barStacked('cv3', summary.byMonthPaid || []);
  barSingle('cvF', summary.byMonthForecast || []);
}

function donut(id, slices, lbl, val, SZ) {
  const c = $(id); if (!c) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = SZ * dpr; c.height = SZ * dpr; c.style.width = SZ + 'px'; c.style.height = SZ + 'px';
  const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cx = SZ / 2, cy = SZ / 2, R = SZ / 2 - 7, r = SZ / 2 - 23;
  const tot = slices.reduce((a, s) => a + (s.v || 0), 0); if (!tot) return;

  let a = -Math.PI / 2;
  slices.forEach(s => {
    if (!s.v) return;
    const sw = s.v / tot * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a, a + sw); ctx.closePath();
    ctx.fillStyle = s.c; ctx.fill(); a += sw;
  });

  a = -Math.PI / 2;
  slices.forEach(s => {
    if (!s.v) return;
    const sw = s.v / tot * Math.PI * 2;
    ctx.beginPath(); ctx.arc(cx, cy, R, a, a + sw, false);
    ctx.strokeStyle = '#FAFAF9'; ctx.lineWidth = 2.5; ctx.stroke(); a += sw;
  });

  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 2 * Math.PI); ctx.fillStyle = '#FFFFFF'; ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#71717A'; ctx.font = '500 8px Inter,sans-serif'; ctx.fillText(lbl, cx, cy - 5);
  ctx.fillStyle = '#000'; ctx.font = "600 11px 'SF Mono','Menlo','Consolas',monospace"; ctx.fillText(val, cx, cy + 7);
}

function barStacked(id, byMonthPaid) {
  const c = $(id); if (!c) return;
  const par = c.parentElement;
  const W = Math.max((par ? par.getBoundingClientRect().width || par.offsetWidth : 320) - 32, 200);
  const H = 100, dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = W * dpr; c.height = H * dpr; c.style.width = W + 'px'; c.style.height = H + 'px';
  const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const keys = CAT_ORDER.filter(k => k !== 'pensao');
  const data = (byMonthPaid || []).map(m => keys.map(k => m[k] || 0));
  const cols = keys.map(k => catInfo(k).color);

  const pL = 30, pB = 16, pT = 6, pR = 2, cW = W - pL - pR, cH = H - pT - pB;
  const maxV = Math.max(...data.map(r => r.reduce((a, b) => a + b, 0)), 1);
  const scale = Math.ceil(maxV / 2000) * 2000 || 2000;

  for (let i = 0; i <= 3; i++) {
    const y = pT + cH * (1 - i / 3);
    ctx.strokeStyle = 'rgba(0,0,0,.05)'; ctx.lineWidth = .6;
    ctx.beginPath(); ctx.moveTo(pL, y); ctx.lineTo(pL + cW, y); ctx.stroke();
    ctx.fillStyle = '#A1A1AA'; ctx.textAlign = 'right';
    ctx.font = "7.5px 'SF Mono','Menlo','Consolas',monospace";
    ctx.fillText(brlK(scale / 3 * i), pL - 3, y + 3);
  }

  const mW = cW / 12, bW = mW * .72, bOff = (mW - bW) / 2;
  data.forEach((cats, mi) => {
    const gx = pL + mi * mW + bOff; let yBase = pT + cH;
    cats.forEach((v, ci) => {
      if (!v) return;
      const bH = Math.max(1, (v / scale) * cH);
      yBase -= bH; ctx.fillStyle = cols[ci]; ctx.fillRect(gx, yBase, bW, bH);
    });
    ctx.fillStyle = '#A1A1AA'; ctx.textAlign = 'center'; ctx.font = '7px Inter,sans-serif';
    ctx.fillText(MO[mi], pL + mi * mW + mW / 2, H - 2);
  });
}

function barSingle(id, byMonthForecast) {
  const c = $(id); if (!c) return;
  const par = c.parentElement;
  const W = Math.max((par ? par.getBoundingClientRect().width || par.offsetWidth : 320) - 32, 200);
  const H = 95, dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = W * dpr; c.height = H * dpr; c.style.width = W + 'px'; c.style.height = H + 'px';
  const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const data = (byMonthForecast || []).map(m => m.total || 0);
  const pL = 30, pB = 16, pT = 6, pR = 2, cW = W - pL - pR, cH = H - pT - pB;
  const maxV = Math.max(...data, 1);
  const scale = Math.ceil(maxV / 2000) * 2000 || 2000;

  for (let i = 0; i <= 3; i++) {
    const y = pT + cH * (1 - i / 3);
    ctx.strokeStyle = 'rgba(0,0,0,.05)'; ctx.lineWidth = .6;
    ctx.beginPath(); ctx.moveTo(pL, y); ctx.lineTo(pL + cW, y); ctx.stroke();
    ctx.fillStyle = '#A1A1AA'; ctx.textAlign = 'right';
    ctx.font = "7.5px 'SF Mono','Menlo','Consolas',monospace";
    ctx.fillText(brlK(scale / 3 * i), pL - 3, y + 3);
  }

  const mW = cW / 12, bW = mW * .72, bOff = (mW - bW) / 2;
  data.forEach((v, mi) => {
    const gx = pL + mi * mW + bOff;
    const bH = Math.max(1, (v / scale) * cH);
    ctx.fillStyle = '#6B4FBB'; // uses existing purple token in CSS palette
    ctx.fillRect(gx, pT + cH - bH, bW, bH);

    ctx.fillStyle = '#A1A1AA'; ctx.textAlign = 'center'; ctx.font = '7px Inter,sans-serif';
    ctx.fillText(MO[mi], pL + mi * mW + mW / 2, H - 2);
  });
}
