// app/state.js
export const S = {
  year: new Date().getFullYear(),
  tab: 'dash',
  cats: [],
  parties: [],
  editId: null,
};

export const MO = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
export const MF = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export const CAT_ORDER = ['mensalidade','matricula','material','uniforme','extra','pensao'];
