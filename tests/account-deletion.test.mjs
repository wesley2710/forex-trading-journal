import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { accountDeletionSummary, deleteAccountRecords } from '../js/domain/account-deletion.js';
import { emptyDatabase } from '../js/domain/schema.js';
import { mergeDatabases } from '../js/domain/sync-merge.js';
import { renderAccounts } from '../js/pages/accounts.js';

const account = (id, name) => ({ id, name, firm: 'Mesa', status: 'Ativa', archived: false, initialBalanceCents: 10000000, profitTargetCents: 0, dailyLossLimitCents: 0, maxLossLimitCents: 0, drawdownType: 'static', lossBasis: 'balance', timezone: 'UTC', rolloverTime: '00:00', profitSplit: 80, createdAt: '2026-11-11T10:00:00Z', updatedAt: '2026-11-11T10:00:00Z', version: 1 });
const record = (id, accountId, extra = {}) => ({ id, accountId, createdAt: '2026-11-11T10:00:00Z', updatedAt: '2026-11-11T10:00:00Z', version: 1, ...extra });

function fixture() {
  return {
    ...emptyDatabase(),
    accounts: [account('test', 'Backtest NAS100'), account('real', 'Conta real')],
    phases: [record('phase-test', 'test'), record('phase-real', 'real')],
    trades: [record('trade-test', 'test', { closedDate: '2026-11-11', symbol: 'NAS100', strategy: '', notes: '', riskCents: 10000, netPnlCents: 5000, screenshots: [{ id: 'print-1', name: 'teste.png' }] }), record('trade-real', 'real', { closedDate: '2026-11-11', symbol: 'XAU/USD', strategy: '', notes: '', riskCents: 10000, netPnlCents: 10000, screenshots: [] })],
    cashFlows: [record('flow-test', 'test'), record('flow-real', 'real')],
    payouts: [record('payout-test', 'test')],
    fees: [record('fee-test', 'test')],
    snapshots: [record('snapshot-test', 'test')],
  };
}

test('resumo informa tudo que será removido com a conta', () => {
  const summary = accountDeletionSummary(fixture(), 'test');
  assert.equal(summary.trades, 1);
  assert.equal(summary.payouts, 1);
  assert.equal(summary.cashFlows, 1);
  assert.equal(summary.fees, 1);
  assert.equal(summary.snapshots, 1);
  assert.deepEqual(summary.screenshots.map((item) => item.id), ['print-1']);
});

test('exclusão remove somente a conta escolhida e seus dados vinculados', () => {
  const db = fixture();
  deleteAccountRecords(db, 'test', '2026-11-11T11:00:00Z');
  assert.deepEqual(db.accounts.map((item) => item.id), ['real']);
  for (const collection of ['phases', 'trades', 'cashFlows', 'payouts', 'fees', 'snapshots']) assert.ok(db[collection].every((item) => item.accountId === 'real'));
  const tombstoneKeys = new Set(db.settings.syncTombstones.map((item) => `${item.collection}:${item.id}`));
  assert.ok(tombstoneKeys.has('accounts:test'));
  assert.ok(tombstoneKeys.has('trades:trade-test'));
});

test('combinação sincronizada não ressuscita conta nem registros antigos', () => {
  const local = fixture(); const remote = fixture();
  deleteAccountRecords(local, 'test', '2026-11-11T11:00:00Z');
  const merged = mergeDatabases(local, remote);
  assert.deepEqual(merged.accounts.map((item) => item.id), ['real']);
  assert.ok(merged.trades.every((item) => item.accountId === 'real'));
  assert.ok(merged.cashFlows.every((item) => item.accountId === 'real'));
});

test('interface oferece exclusão protegida por nome e backup automático', async () => {
  const db = fixture();
  const html = renderAccounts({ db });
  const appSource = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');
  assert.match(html, /data-action="delete-account"/);
  assert.match(appSource, /Digite exatamente o nome da conta/);
  assert.match(appSource, /backup-antes-excluir/);
  assert.match(appSource, /deleteAccountRecords/);
});
