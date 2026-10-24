import test from 'node:test';
import assert from 'node:assert/strict';
import { renderDashboard } from '../js/pages/dashboard.js';

test('dashboard explica indicadores e resumo recente com controles acessíveis', () => {
  const db = { accounts: [], trades: [], cashFlows: [], payouts: [], snapshots: [] };
  const { html } = renderDashboard({ db, selected: 'all', accountName: () => '' });

  assert.equal((html.match(/class="info-trigger"/g) || []).length, 13);
  assert.equal((html.match(/role="tooltip"/g) || []).length, 13);
  assert.match(html, /Ajuda sobre Profit factor/);
  assert.match(html, /1,50\+ é bom/);
  assert.match(html, /mais de 33,3% pode ser suficiente/);
  assert.match(html, /Não existe valor ideal/);
  assert.match(html, /Pulso da performance/);
  assert.match(html, /Expectativa recente/);
});
