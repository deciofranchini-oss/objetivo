// app/seed.js
import { all, put } from './db.js';

export async function seedIfEmpty() {
  const existing = await all('txs');
  if (existing.length > 0) return;

  // Categories
  const CATS = [
    { key: 'mensalidade', label: 'Mensalidade', color: '#3B5BDB', system: true },
    { key: 'pensao',      label: 'Pensão Alimentícia', color: '#C0392B', system: true },
    { key: 'matricula',   label: 'Matrícula', color: '#C05C1A', system: true },
    { key: 'material',    label: 'Material',  color: '#1A7F7A', system: true },
    { key: 'uniforme',    label: 'Uniforme',  color: '#6B4FBB', system: true },
    { key: 'extra',       label: 'Extra',     color: '#2E7D55', system: true },
  ];
  for (const c of CATS) await put('cats', c);

  // Parties (dynamic "Parte")
  const PARTIES = [
    { key: 'me', label: 'Eu', system: true },
    { key: 'father', label: 'Pai', system: true },
    { key: 'school', label: 'Escola', system: true },
    { key: 'store', label: 'Loja', system: true },
    { key: 'other', label: 'Outro', system: true },
  ];
  for (const p of PARTIES) await put('parties', p);

  let id = 1;
  const nowISO = () => new Date().toISOString();
  const mk = (o) => ({ id: id++, createdAt: nowISO(), updatedAt: nowISO(), isForecast: false, ...o });

  // Demo data from original app (kept to preserve behavior)
  const MF = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  const m25 = [4998.41,4998.41,4998.41,4998.41,4998.41,4998.41,4998.41,4998.41,4998.41,4998.41,4998.41,4998.40];
  for (let i=0;i<12;i++) {
    await put('txs', mk({
      amount: m25[i], type: 'PAID', categoryKey: 'mensalidade', party: 'me',
      date: `2025-${String(i+1).padStart(2,'0')}-05`, academicYear: 2025, academicMonth: i+1,
      isLate: false, notes: `Mensalidade ${MF[i]}/2025`, tags: 'mensalidade',
    }));
  }

  await put('txs', mk({ amount: 4256.88, type:'PAID', categoryKey:'matricula', party:'me', date:'2025-01-05', academicYear:2025, academicMonth:1, isLate:false, notes:'Matrícula anual 2025', tags:'matricula' }));

  for (const [m, d] of [[1,'2025-01-05'],[4,'2025-04-05'],[7,'2025-07-05'],[9,'2025-09-05']]) {
    await put('txs', mk({ amount:724.50, type:'PAID', categoryKey:'material', party:'me', date:d, academicYear:2025, academicMonth:m, isLate:false, notes:`Material ${MF[m-1]}/2025`, tags:'material' }));
  }

  await put('txs', mk({ amount:1084.23, type:'PAID', categoryKey:'extra', party:'me', date:'2025-01-05', academicYear:2025, academicMonth:1, isLate:false, notes:'Extra Jan/2025', tags:'extra' }));

  const p25 = [[1,'2025-01-05',2000,false],[2,'2025-02-05',2000,false],[3,'2025-03-05',2000,false],[4,'2025-04-05',2000,false],[5,'2025-05-06',1000,true],[6,'2025-06-05',2000,false],[7,'2025-07-03',1000,false],[7,'2025-07-17',1000,true],[8,'2025-08-05',2000,false],[9,'2025-09-05',2000,false],[10,'2025-10-04',2000,false],[11,'2025-11-05',2000,false],[11,'2025-11-22',1500,true],[12,'2025-12-05',3500,false]];
  for (const [m, d, amt, late] of p25) {
    await put('txs', mk({ amount: amt, type:'RECEIVED', categoryKey:'pensao', party:'father', date:d, academicYear:2025, academicMonth:m, isLate:late, notes:`Pensão ${MF[m-1]}/2025`, tags:'pensao' }));
  }

  for (const [m, d] of [[1,'2026-01-05'],[2,'2026-02-05']]) {
    await put('txs', mk({ amount:5666.85, type:'PAID', categoryKey:'mensalidade', party:'me', date:d, academicYear:2026, academicMonth:m, isLate:false, notes:`Mensalidade ${MF[m-1]}/2026`, tags:'mensalidade' }));
  }

  await put('txs', mk({ amount:1491.29, type:'PAID', categoryKey:'matricula', party:'me', date:'2026-01-05', academicYear:2026, academicMonth:1, isLate:false, notes:'Matrícula 2026', tags:'matricula' }));
  await put('txs', mk({ amount:1047.33, type:'PAID', categoryKey:'material', party:'me', date:'2026-01-05', academicYear:2026, academicMonth:1, isLate:false, notes:'Material Jan/2026', tags:'material' }));
  await put('txs', mk({ amount:1503.41, type:'PAID', categoryKey:'extra', party:'me', date:'2026-02-05', academicYear:2026, academicMonth:2, isLate:false, notes:'Excursão parcela 1', tags:'extra' }));
  for (let i=0;i<6;i++){
    const m=i+3;
    await put('txs', mk({ amount:429, type:'PAID', categoryKey:'extra', party:'me', date:`2026-${String(m).padStart(2,'0')}-05`, academicYear:2026, academicMonth:m, isLate:false, notes:`Excursão ${MF[m-1]}/2026`, tags:'extra,excursao' }));
  }

  await put('txs', mk({ amount:2000, type:'RECEIVED', categoryKey:'pensao', party:'father', date:'2026-01-12', academicYear:2026, academicMonth:1, isLate:true, notes:'Pensão Jan/2026 — atraso', tags:'pensao' }));
  await put('txs', mk({ amount:2500, type:'RECEIVED', categoryKey:'pensao', party:'father', date:'2026-02-07', academicYear:2026, academicMonth:2, isLate:true, notes:'Pensão Fev/2026 — atraso', tags:'pensao' }));
}
