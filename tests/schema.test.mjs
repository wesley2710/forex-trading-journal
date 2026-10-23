import test from 'node:test';
import assert from 'node:assert/strict';
import { migrate, normalizeTrade, SCHEMA_VERSION } from '../js/domain/schema.js';
import { validateAccount, validateDatabase, validateTrade } from '../js/domain/validation.js';

test('migração v1 preserva conta, trade e movimentação', () => {
  const migrated = migrate({ accounts: [{ id: 'a', name: 'Conta', initialBalance: 10000, timezone: 'UTC' }], trades: [{ id: 't', accountId: 'a', date: '2026-10-23', symbol: 'EUR/USD', risk: 100, plannedReward: 200, pnl: 50 }], flows: [{ id: 'f', accountId: 'a', date: '2026-10-23', type: 'Depósito', amount: 10 }] });
  assert.equal(migrated.schemaVersion, SCHEMA_VERSION); assert.equal(migrated.accounts[0].initialBalanceCents, 1000000); assert.equal(migrated.trades[0].netPnlCents, 5000); assert.equal(migrated.cashFlows[0].amountCents, 1000); validateDatabase(migrated);
});
test('normalização subtrai taxas e comissão e soma swap', () => { const value = normalizeTrade({ risk: 100, plannedReward: 300, grossPnl: 200, fees: 5, commission: 2.5, swap: -1 }); assert.equal(value.netPnlCents, 19150); });
test('validação rejeita timezone e referência de conta inválidos', () => { assert.throws(() => validateAccount({ name: 'X', firm: '', timezone: 'Planeta/Marte', initialBalanceCents: 1, profitSplit: 80 }), /Fuso/); assert.throws(() => validateTrade({ accountId: 'x', symbol: 'EURUSD', closedDate: '2026-10-23', riskCents: 1, netPnlCents: 0 }, { accounts: [] }), /Conta/); });
