import test from 'node:test';
import assert from 'node:assert/strict';
import { renderDashboard } from '../js/pages/dashboard.js';

test('dashboard explica indicadores e resumo recente com controles acessíveis', () => {
  const db = { accounts: [], trades: [], cashFlows: [], payouts: [], snapshots: [] };
  const { html } = renderDashboard({ db, selected: 'all', accountName: () => '' });

  assert.equal((html.match(/class="info-trigger"/g) || []).length, 14);
  assert.equal((html.match(/role="tooltip"/g) || []).length, 14);
  assert.match(html, /Ajuda sobre Profit factor/);
  assert.match(html, /1,50\+ é bom/);
  assert.match(html, /mais de 33,3% pode ser suficiente/);
  assert.match(html, /Não existe valor ideal/);
  assert.match(html, /Pulso da performance/);
  assert.match(html, /Expectativa recente/);
  assert.match(html, /data-performance-period/);
});

test('filtro do dashboard altera desempenho sem distorcer o saldo atual', () => {
  const account = { id: 'a', name: 'Conta', status: 'Ativa', archived: false, initialBalanceCents: 1000000, profitTargetCents: 100000, dailyLossLimitCents: 50000, maxLossLimitCents: 100000, lossBasis: 'balance', timezone: 'UTC' };
  const trade = (id, date, pnl, symbol) => ({ id, accountId: 'a', closedDate: date, closedAt: `${date}T12:00:00Z`, symbol, riskCents: 10000, grossPnlCents: pnl, feesCents: 0, commissionCents: 0, swapCents: 0, netPnlCents: pnl, screenshots: [] });
  const db = { accounts: [account], trades: [trade('old', '2026-01-10', 10000, 'OLD'), trade('new', '2026-02-10', -5000, 'NEW')], cashFlows: [], payouts: [{ accountId: 'a', status: 'received', requestedAt: '2026-01-10', receivedAt: '2026-01-11', receivedCents: 10000 }, { accountId: 'a', status: 'received', requestedAt: '2026-02-10', receivedAt: '2026-02-11', receivedCents: 20000 }], snapshots: [] };
  const period = { mode: 'custom', from: '2026-02-01', to: '2026-02-28', label: '01/02/2026 a 28/02/2026', customFrom: '2026-02-01', customTo: '2026-02-28', invalid: false };
  const { html, chart } = renderDashboard({ db, selected: 'all', accountName: () => 'Conta', period });
  assert.match(html, /Saldo operacional atual/);
  assert.match(html, /1 operações/);
  assert.match(html, /NEW/);
  assert.doesNotMatch(html, />OLD</);
  assert.deepEqual(chart, [10100, 10050]);
});

test('saque aparece no saldo, mas não vira drawdown operacional', () => {
  const account = { id: 'a', name: 'Conta', status: 'Ativa', archived: false, initialBalanceCents: 10000000, profitTargetCents: 1000000, dailyLossLimitCents: 500000, maxLossLimitCents: 1000000, lossBasis: 'balance', timezone: 'UTC' };
  const trade = { id: 't', accountId: 'a', closedDate: '2026-10-20', closedAt: '2026-10-20T12:00:00Z', symbol: 'NAS100', riskCents: 100000, grossPnlCents: 250000, feesCents: 0, commissionCents: 0, swapCents: 0, netPnlCents: 250000, screenshots: [] };
  const flow = { id: 'payout-flow-p', accountId: 'a', date: '2026-10-21', occurredAt: '2026-10-21T12:00:00Z', amountCents: -250000, affectsBalance: true, source: 'payout', sourceId: 'p' };
  const payout = { id: 'p', accountId: 'a', date: '2026-10-21', grossCents: 250000, traderSharePercent: 80, netCents: 200000, status: 'received' };
  const db = { accounts: [account], trades: [trade], cashFlows: [flow], payouts: [payout], snapshots: [] };
  const { html, chart } = renderDashboard({ db, selected: 'all', accountName: () => 'Conta' });
  assert.deepEqual(chart, [100000, 102500, 100000]);
  assert.match(html, /Saques e outras movimentações não são tratados como perdas/);
  assert.match(html, /\+2,50R/);
});
