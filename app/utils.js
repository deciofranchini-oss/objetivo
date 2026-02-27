// app/utils.js
import { S } from './state.js';

export const el = (id) => document.getElementById(id);
export const $ = el;

export const brl = (v) => Math.abs(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const brlK = (v) => (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : Math.round(v || 0).toString());

export const fmtD = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

export function toast(msg, ms = 2800) {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('on'), ms);
}

export function catInfo(key) {
  return S.cats.find(c => c.key === key) || { key, label: key, color: '#8E8E93' };
}

export function partyInfo(key) {
  return S.parties.find(p => p.key === key) || { key, label: key };
}

export function catEmoji(k) {
  return ({ mensalidade: '🏫', matricula: '📝', material: '📚', uniforme: '👕', extra: '🎭', pensao: '💰' }[k] || '📌');
}

export function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

export function toISODateFromBR(br) {
  // dd/mm/yyyy -> yyyy-mm-dd
  const m = (br || '').match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!m) return null;
  const dd = String(m[1]).padStart(2, '0');
  const mm = String(m[2]).padStart(2, '0');
  const yy = m[3];
  return `${yy}-${mm}-${dd}`;
}

export function safeKey(s) {
  return (s || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
}
