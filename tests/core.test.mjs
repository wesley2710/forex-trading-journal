import test from 'node:test';
import assert from 'node:assert/strict';
import { addCents, dateInTimezone, evaluateAccountLimits, maxDrawdown, operationalBalanceCents, plannedRR, summarize, toCents, tradeR } from '../js/core.js';

const trade = (overrides = {}) => ({ accountId: 'a', closedDate: '2026-10-23', riskCents: 10000, plannedRewardCents: 30000, grossPnlCents: 25000, feesCents: 100, commissionCents: 200, swapCents: -50, netPnlCents: 24650, ...overrides });
test('centavos eliminam erro binário em somas monetárias', () => { assert.equal(addCents(toCents('0.10'), toCents('0.20')), 30); assert.equal(toCents('123,45'), 12345); });
test('R realizado usa PnL líquido e RR usa recompensa planejada', () => { assert.equal(tradeR(trade()), 2.465); assert.equal(plannedRR(trade()), 3); assert.equal(tradeR(trade({ riskCents: 0 })), null); });
test('resumo calcula PnL, winrate, profit factor e expectativa', () => { const result = summarize([trade(), trade({ netPnlCents: -10000 }), trade({ netPnlCents: 15000 })]); assert.equal(result.pnlCents, 29650); assert.equal(result.winRate, 66.67); assert.equal(result.expectancyCents, 9883); assert.equal(result.profitFactor, 3.97); });
test('saldo operacional fica isolado por conta', () => { const trades = [trade(), trade({ accountId: 'b', netPnlCents: -10000 })]; const flows = [{ accountId: 'a', amountCents: 5000 }, { accountId: 'b', amountCents: 9999 }]; assert.equal(operationalBalanceCents({ id: 'a', initialBalanceCents: 100000 }, trades, flows), 129650); });
test('drawdown absoluto em centavos', () => assert.equal(maxDrawdown([10000, 12000, 9500, 11000, 8000]), 4000));
test('data respeita mudança de dia no fuso da mesa', () => { assert.equal(dateInTimezone('2026-10-23T02:30:00Z', 'America/New_York'), '2026-10-22'); assert.equal(dateInTimezone('2026-10-23T02:30:00Z', 'Asia/Tokyo'), '2026-10-23'); });
test('alerta de equity explicita ausência de mark-to-market', () => { const account = { id: 'a', initialBalanceCents: 1000000, dailyLossLimitCents: 50000, maxLossLimitCents: 100000, lossBasis: 'equity', timezone: 'UTC' }; const result = evaluateAccountLimits(account, [], [], new Date('2026-10-23T12:00:00Z')); assert.ok(result.warnings.some((item) => item.code === 'no-equity')); });
