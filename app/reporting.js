// app/reporting.js
import { S, MF } from './state.js';
import { brl, fmtD, catInfo } from './utils.js';

// Build report data with required rules:
// - For a specific year: always show 12 months (even empty)
// - For "Todos": only years that exist in the DB (no empty years)
// - Include payment date and "Pago fora do prazo" next to the date for late payments (pensao)

export function computeReport(txs, yearSel) {
  const yearsAvailable = Array.from(new Set(txs.map(t => t.academicYear))).sort((a, b) => a - b);
  const years = (yearSel === 'all') ? yearsAvailable : [Number(yearSel)];

  const out = [];
  for (const y of years) {
    const months = Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
      const rows = txs.filter(t => t.academicYear === y && t.academicMonth === m);

      const paidActual = rows.filter(t => t.type === 'PAID' && !t.isForecast).reduce((a, t) => a + (t.amount || 0), 0);
      const received = rows.filter(t => t.type === 'RECEIVED' && !t.isForecast).reduce((a, t) => a + (t.amount || 0), 0);

      const forecast = rows.filter(t => t.isForecast).reduce((a, t) => a + (t.amount || 0), 0);

      // Pensão: may have multiple payments in a month. We'll present:
      // - total received
      // - latest payment date and a "(Pago fora do prazo)" flag if ANY pensao tx in month has isLate.
      const pensaoRows = rows.filter(t => t.type === 'RECEIVED' && t.categoryKey === 'pensao' && !t.isForecast)
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      const payDate = pensaoRows.length ? pensaoRows[pensaoRows.length - 1].date : null;
      const isLate = pensaoRows.some(t => !!t.isLate);

      const byCat = {};
      rows.filter(t => t.type === 'PAID' && !t.isForecast).forEach(t => {
        byCat[t.categoryKey] = (byCat[t.categoryKey] || 0) + (t.amount || 0);
      });

      return {
        year: y, month: m,
        paidActual, received, forecast,
        pensaoPaymentDate: payDate,
        pensaoLate: isLate,
        byCat,
      };
    });

    const totals = months.reduce((acc, m) => {
      acc.paidActual += m.paidActual;
      acc.received += m.received;
      acc.forecast += m.forecast;
      Object.entries(m.byCat).forEach(([k, v]) => acc.byCat[k] = (acc.byCat[k] || 0) + v);
      return acc;
    }, { paidActual: 0, received: 0, forecast: 0, byCat: {} });

    out.push({ year: y, months, totals });
  }

  return { yearsAvailable, years, blocks: out };
}

export function renderReportHTML(txs, yearSel) {
  const { blocks, yearsAvailable } = computeReport(txs, yearSel);

  const title = (yearSel === 'all')
    ? `Relatório (anos disponíveis: ${yearsAvailable.join(', ') || '—'})`
    : `Relatório ${yearSel}`;

  const rowsForYear = (blk) => blk.months.map(m => `
    <tr>
      <td class="mono">${m.month.toString().padStart(2,'0')} — ${MF[m.month-1]}</td>
      <td class="mono">${m.pensaoPaymentDate ? `${fmtD(m.pensaoPaymentDate)}${m.pensaoLate ? ' <span class="tag red">Pago fora do prazo</span>' : ''}` : '—'}</td>
      <td class="mono">R$ ${brl(m.received)}</td>
      <td class="mono">R$ ${brl(m.paidActual)}</td>
      <td class="mono">R$ ${brl(m.forecast)}</td>
    </tr>
  `).join('');

  const catRows = (totByCat) => Object.entries(totByCat)
    .filter(([k]) => k !== 'pensao')
    .sort((a, b) => (catInfo(a[0]).label || a[0]).localeCompare(catInfo(b[0]).label || b[0]))
    .map(([k, v]) => `
      <tr>
        <td>${catInfo(k).label}</td>
        <td class="mono">R$ ${brl(v)}</td>
      </tr>
    `).join('');

  return `
    <div class="card" style="margin:0 20px 12px;padding:16px">
      <div class="chart-title">${title}</div>
      <div style="font-size:12px;color:var(--t-faint);margin-top:4px;line-height:1.5">
        Regras aplicadas: ano único sempre mostra os 12 meses; "Todos" mostra somente anos com registros; "Pago fora do prazo" aparece ao lado da data.
      </div>
    </div>

    ${blocks.map(blk => `
      <div class="card" style="margin:0 20px 12px;padding:16px">
        <div class="chart-title">Ano ${blk.year}</div>
        <div style="overflow:auto">
          <table class="tbl" style="min-width:760px">
            <thead>
              <tr>
                <th>Mês</th>
                <th>Data de Pagamento (Pai)</th>
                <th>Pensão Recebida</th>
                <th>Total Pago</th>
                <th>Total Previsão</th>
              </tr>
            </thead>
            <tbody>
              ${rowsForYear(blk)}
            </tbody>
            <tfoot>
              <tr>
                <td class="mono">TOTAL</td>
                <td></td>
                <td class="mono">R$ ${brl(blk.totals.received)}</td>
                <td class="mono">R$ ${brl(blk.totals.paidActual)}</td>
                <td class="mono">R$ ${brl(blk.totals.forecast)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div style="margin-top:12px;display:flex;gap:12px;flex-wrap:wrap">
          <div style="flex:1;min-width:240px">
            <div style="font-size:12px;font-weight:700;margin-bottom:6px">Por categoria (pagos)</div>
            <div style="overflow:auto">
              <table class="tbl" style="min-width:260px">
                <thead><tr><th>Categoria</th><th>Total</th></tr></thead>
                <tbody>${catRows(blk.totals.byCat) || `<tr><td colspan="2" style="color:var(--t-faint)">Sem despesas pagas</td></tr>`}</tbody>
              </table>
            </div>
          </div>

          <div style="flex:1;min-width:240px">
            <div style="font-size:12px;font-weight:700;margin-bottom:6px">Observações</div>
            <div style="font-size:12px;color:var(--t-faint);line-height:1.5">
              • Previsões (isForecast=true) não entram em "Total Pago".<br>
              • Para pensão, a data mostrada é a última data do mês (se houver mais de um pagamento).<br>
              • O indicador de atraso é calculado a partir de qualquer transação de pensão marcada como fora do prazo.
            </div>
          </div>
        </div>
      </div>
    `).join('')}
  `;
}
