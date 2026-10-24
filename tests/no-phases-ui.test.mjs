import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderAccounts } from '../js/pages/accounts.js';
import { renderTrades } from '../js/pages/trades.js';

const account = {
  id: 'account-1', name: 'Conta teste', firm: 'Mesa', status: 'Ativa', archived: false,
  initialBalanceCents: 1000000, profitTargetCents: 100000, dailyLossLimitCents: 50000,
  maxLossLimitCents: 100000, drawdownType: 'static', lossBasis: 'balance', timezone: 'UTC',
  rolloverTime: '00:00', profitSplit: 80,
};
const db = {
  accounts: [account], phases: [{ id: 'legacy-phase', accountId: account.id, name: 'Avaliação', status: 'active' }],
  trades: [], cashFlows: [], snapshots: [],
};

test('interface de contas e operações não exibe fases legadas', async () => {
  const accountsHtml = renderAccounts({ db, showArchived: false });
  const tradesHtml = renderTrades({ db, filters: { account: 'all', from: '', to: '', firm: '', symbol: '', strategy: '', side: '' }, accountName: () => account.name });
  const appSource = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');

  assert.doesNotMatch(accountsHtml, /Avaliação|Nova fase|data-action="phase"/);
  assert.doesNotMatch(tradesHtml, />Fase<|data-filter="phase"/);
  assert.doesNotMatch(appSource, /selectField\('phaseId'|function phaseForm/);
});
