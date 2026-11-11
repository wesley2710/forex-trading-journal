import test from 'node:test';
import assert from 'node:assert/strict';
import { visibleAccountRecords, visibleAccounts } from '../js/domain/account-visibility.js';
import { renderAnalytics } from '../js/pages/analytics.js';
import { renderDashboard } from '../js/pages/dashboard.js';
import { renderTrades } from '../js/pages/trades.js';

const account = (id, archived = false) => ({ id, name: archived ? 'Conta arquivada' : 'Conta ativa', firm: 'Mesa', status: 'Ativa', archived, initialBalanceCents: 1000000, profitTargetCents: 100000, dailyLossLimitCents: 50000, maxLossLimitCents: 100000, lossBasis: 'balance', timezone: 'UTC' });
const trade = (id, accountId, pnl) => ({ id, accountId, closedDate: '2026-11-11', closedAt: '2026-11-11T12:00:00Z', symbol: accountId === 'archived' ? 'ARQUIVADO' : 'ATIVO', strategy: 'Teste', side: 'Compra', riskCents: 10000, grossPnlCents: pnl, feesCents: 0, commissionCents: 0, swapCents: 0, netPnlCents: pnl, screenshots: [] });

function fixture() {
  const active = account('active'); const archived = account('archived', true);
  return {
    accounts: [active, archived],
    trades: [trade('t-active', 'active', 10000), trade('t-archived', 'archived', 500000)],
    cashFlows: [{ id: 'f-active', accountId: 'active', date: '2026-11-11', amountCents: 1000, affectsBalance: true }, { id: 'f-archived', accountId: 'archived', date: '2026-11-11', amountCents: 900000, affectsBalance: true }],
    payouts: [{ id: 'p-active', accountId: 'active', date: '2026-11-11', grossCents: 10000, traderSharePercent: 80, netCents: 8000, status: 'received' }, { id: 'p-archived', accountId: 'archived', date: '2026-11-11', grossCents: 900000, traderSharePercent: 80, netCents: 720000, status: 'received' }],
    snapshots: [], fees: [], phases: [], settings: {}, audit: [],
  };
}

test('visibilidade padrão considera somente contas ativas', () => {
  const db = fixture();
  assert.deepEqual(visibleAccounts(db).map((item) => item.id), ['active']);
  assert.deepEqual(visibleAccountRecords(db, db.trades).map((item) => item.id), ['t-active']);
  assert.equal(visibleAccountRecords(db, db.trades, { includeArchived: true }).length, 2);
});

test('dashboard ignora trades, movimentações e saques arquivados', () => {
  const db = fixture();
  const result = renderDashboard({ db, selected: 'all', accountName: (id) => id });
  assert.match(result.html, /ATIVO/);
  assert.doesNotMatch(result.html, /ARQUIVADO/);
  assert.match(result.html, /US\$\s*80,00/);
  assert.doesNotMatch(result.html, /US\$\s*7\.200,00/);
  assert.deepEqual(result.chart, [10000, 10100, 10110]);
});

test('estatísticas ignoram saques arquivados', () => {
  const db = fixture(); const active = db.accounts[0]; const trades = [db.trades[0]];
  const result = renderAnalytics({ db, trades, accounts: [active] });
  assert.match(result.html, /US\$\s*80,00/);
  assert.doesNotMatch(result.html, /US\$\s*7\.200,00/);
  assert.doesNotMatch(result.html, /Conta arquivada/);
});

test('histórico mostra arquivadas somente quando a opção é ativada', () => {
  const db = fixture(); const accountName = (id) => db.accounts.find((item) => item.id === id)?.name || '';
  const baseFilters = { account: 'all', historyAccount: 'all', includeArchived: false, from: '', to: '', firm: '', symbol: '', strategy: '', side: '' };
  const activeOnly = renderTrades({ db, filters: baseFilters, accountName });
  const withArchived = renderTrades({ db, filters: { ...baseFilters, includeArchived: true }, accountName });
  assert.match(activeOnly, /ATIVO/);
  assert.doesNotMatch(activeOnly, /ARQUIVADO/);
  assert.match(withArchived, /ARQUIVADO/);
  assert.match(withArchived, /Conta arquivada \(arquivada\)/);
  assert.match(withArchived, /data-include-archived checked/);
});
