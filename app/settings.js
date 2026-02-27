// app/settings.js
import { all, put, del } from './db.js';
import { S } from './state.js';
import { $, toast, safeKey } from './utils.js';

export async function loadSettingsData() {
  S.cats = (await all('cats')).sort((a, b) => (a.label || '').localeCompare(b.label || ''));
  S.parties = (await all('parties')).sort((a, b) => (a.label || '').localeCompare(b.label || ''));
}

export function renderSettingsUI() {
  renderCatList();
  renderPartyList();
}

function renderCatList() {
  const wrap = $('cat-list-wrap');
  if (!wrap) return;

  wrap.innerHTML = S.cats.map(c => `
    <div class="row">
      <div class="row-left">
        <span class="dot" style="background:${c.color}"></span>
        <div style="display:flex;flex-direction:column">
          <span style="font-weight:700">${c.label}</span>
          <span class="tiny mono">${c.key}</span>
        </div>
      </div>
      <div class="row-actions">
        <button class="btn ghost" onclick="editCat('${c.key}')">Editar</button>
        <button class="btn ghost" onclick="deleteCat('${c.key}')" ${c.system ? 'disabled title="Categoria do sistema"' : ''}>Excluir</button>
      </div>
    </div>
  `).join('') || `<div style="color:var(--t-faint);font-size:12px">Sem categorias.</div>`;
}

function renderPartyList() {
  const wrap = $('party-list-wrap');
  if (!wrap) return;

  wrap.innerHTML = S.parties.map(p => `
    <div class="row">
      <div class="row-left">
        <div style="display:flex;flex-direction:column">
          <span style="font-weight:700">${p.label}</span>
          <span class="tiny mono">${p.key}</span>
        </div>
      </div>
      <div class="row-actions">
        <button class="btn ghost" onclick="editParty('${p.key}')">Editar</button>
        <button class="btn ghost" onclick="deleteParty('${p.key}')" ${p.system ? 'disabled title="Parte do sistema"' : ''}>Excluir</button>
      </div>
    </div>
  `).join('') || `<div style="color:var(--t-faint);font-size:12px">Sem partes.</div>`;
}

// Globals for inline buttons (keeps compatibility with original inline onclick style)
window.saveCat = async function saveCat() {
  const k = safeKey($('nc-key').value);
  const label = ($('nc-label').value || '').trim();
  const color = $('nc-color').value || '#3B5BDB';
  if (!k || !label) { toast('Preencha chave e nome'); return; }

  await put('cats', { key: k, label, color, system: false });
  $('cat-sheet').classList.remove('open');
  $('nc-key').value = ''; $('nc-label').value = '';
  await loadSettingsData(); renderSettingsUI();
  toast('Categoria criada');
};

window.editCat = async function editCat(key) {
  const c = S.cats.find(x => x.key === key);
  if (!c) return;
  const label = prompt('Novo nome da categoria:', c.label);
  if (label == null) return;
  const color = prompt('Nova cor HEX (#RRGGBB):', c.color);
  if (color == null) return;
  await put('cats', { ...c, label: label.trim() || c.label, color: (color.trim() || c.color) });
  await loadSettingsData(); renderSettingsUI();
  toast('Categoria atualizada');
};

window.deleteCat = async function deleteCat(key) {
  const c = S.cats.find(x => x.key === key);
  if (!c) return;
  if (c.system) { toast('Categoria do sistema não pode ser excluída'); return; }
  if (!confirm(`Excluir categoria "${c.label}"?`)) return;
  await del('cats', key);
  await loadSettingsData(); renderSettingsUI();
  toast('Categoria excluída');
};

// Parties
window.saveParty = async function saveParty() {
  const k = safeKey($('np-key').value);
  const label = ($('np-label').value || '').trim();
  if (!k || !label) { toast('Preencha chave e nome'); return; }

  await put('parties', { key: k, label, system: false });
  $('party-sheet').classList.remove('open');
  $('np-key').value = ''; $('np-label').value = '';
  await loadSettingsData(); renderSettingsUI();
  toast('Parte criada');
};

window.editParty = async function editParty(key) {
  const p = S.parties.find(x => x.key === key);
  if (!p) return;
  const label = prompt('Novo nome da parte:', p.label);
  if (label == null) return;
  await put('parties', { ...p, label: label.trim() || p.label });
  await loadSettingsData(); renderSettingsUI();
  toast('Parte atualizada');
};

window.deleteParty = async function deleteParty(key) {
  const p = S.parties.find(x => x.key === key);
  if (!p) return;
  if (p.system) { toast('Parte do sistema não pode ser excluída'); return; }
  if (!confirm(`Excluir parte "${p.label}"?`)) return;
  await del('parties', key);
  await loadSettingsData(); renderSettingsUI();
  toast('Parte excluída');
};
