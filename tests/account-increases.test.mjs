import test from 'node:test';
import assert from 'node:assert/strict';
import { operationalBalanceCents, summarize } from '../js/core.js';
import { renderSettings } from '../js/pages/settings.js';
import { renderAccounts } from '../js/pages/accounts.js';

const account = { id: 'a', name: 'Conta 100k', firm: 'Mesa', status: 'Ativa', initialBalanceCents: 10000000, profitTargetCents: 1000000, dailyLossLimitCents: 500000, maxLossLimitCents: 1000000, drawdownType: 'static', lossBasis: 'balance', timezone: 'UTC', rolloverTime: '00:00' };
const trade = { id: 't', accountId: 'a', closedDate: '2026-10-20', riskCents: 10000, netPnlCents: 250000 };
const increase = { id: 'i', accountId: 'a', date: '2026-10-24', amountCents: 2500000, affectsBalance: true, type: 'account-increase', source: 'account-increase', notes: 'Ampliação da mesa' };

test('aumento de conta altera apenas o saldo, sem mudar as métricas dos trades', () => {
  const before = summarize([trade]);
  assert.equal(operationalBalanceCents(account, [trade], []), 10250000);
  assert.equal(operationalBalanceCents(account, [trade], [increase]), 12750000);
  assert.deepEqual(summarize([trade]), before);
});

test('contas e configurações expõem o fluxo dedicado de aumento', () => {
  const db = { accounts: [account], trades: [trade], cashFlows: [increase], payouts: [], fees: [], snapshots: [], settings: {}, audit: [] };
  const accountsHtml = renderAccounts({ db });
  const settingsHtml = renderSettings({ db, remoteEnabled: false, connected: false, syncStatus: 'local' });
  assert.match(accountsHtml, /data-action="account-increase"/);
  assert.match(settingsHtml, /Aumentos de conta/);
  assert.match(settingsHtml, /data-action="edit-account-increase"/);
  assert.match(settingsHtml, /Ampliação da mesa/);
});

test('formulário dedicado explica que o aumento não altera estatísticas', async () => {
  const appSource = await (await import('node:fs/promises')).readFile(new URL('../js/app.js', import.meta.url), 'utf8');
  assert.match(appSource, /Registrar aumento de conta/);
  assert.match(appSource, /não altera R, RR, win rate, profit factor/);
  assert.match(appSource, /source: 'account-increase'/);
});
