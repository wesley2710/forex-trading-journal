import test from 'node:test';
import assert from 'node:assert/strict';
import { accountPerformance, analyticsPeriodRange, costStats, drawdownStats, filterTradesByPeriod, groupPerformance, monthlyPerformance, payoffStats, rDistribution, rankedPerformance, recentComparison, streakStats, weekdayPerformance } from '../js/domain/analytics.js';
import { renderAnalytics } from '../js/pages/analytics.js';

const makeTrade = (pnl, date, overrides = {}) => ({ id: `${date}-${pnl}-${Math.random()}`, accountId: 'a', closedDate: date, closedAt: `${date}T12:00:00Z`, symbol: 'EUR/USD', strategy: 'Pullback', riskCents: 10000, grossPnlCents: pnl, feesCents: 0, commissionCents: 0, swapCents: 0, netPnlCents: pnl, ...overrides });
const account = { id: 'a', name: 'Conta A', status: 'Ativa', initialBalanceCents: 1000000, profitTargetCents: 100000, maxLossLimitCents: 100000 };

test('ranking usa R médio e protege amostra pequena', () => {
  const trades = [makeTrade(20000, '2026-01-01'), makeTrade(-10000, '2026-01-02'), makeTrade(10000, '2026-01-03', { symbol: 'GBP/USD' })];
  const groups = groupPerformance(trades, (trade) => trade.symbol);
  const ranking = rankedPerformance(groups);
  assert.equal(ranking.usedSmallSample, true);
  assert.equal(ranking.best[0].name, 'GBP/USD');
  assert.equal(ranking.worst[0].name, 'EUR/USD');
});

test('sequências, payoff e distribuição em R são calculados', () => {
  const trades = [makeTrade(20000, '2026-01-01'), makeTrade(10000, '2026-01-02'), makeTrade(-10000, '2026-01-03'), makeTrade(-10000, '2026-01-04'), makeTrade(30000, '2026-01-05')];
  assert.deepEqual(streakStats(trades), { maxWins: 2, maxLosses: 2, worstLossRunCents: 20000, currentType: 'win', currentCount: 1 });
  const payoff = payoffStats(trades);
  assert.equal(payoff.avgWinR, 2); assert.equal(payoff.avgLossR, 1); assert.equal(payoff.payoffRatio, 2); assert.equal(payoff.requiredWinRate, 33.33);
  assert.deepEqual(rDistribution(trades).map((item) => item.count), [0, 2, 0, 1, 2]);
});

test('drawdown informa fundo, recuperação e drawdown atual', () => {
  const trades = [makeTrade(20000, '2026-01-01'), makeTrade(-30000, '2026-01-02'), makeTrade(40000, '2026-01-03'), makeTrade(-10000, '2026-01-04')];
  const value = drawdownStats(trades, 1000000);
  assert.equal(value.maxCents, 30000); assert.equal(value.tradesToTrough, 1); assert.equal(value.recoveryTrades, 1); assert.equal(value.currentCents, 10000);
  assert.equal(drawdownStats([makeTrade(10000, '2026-01-01')], 1000000).recoveryTrades, 0);
});

test('períodos, custos, contas e janela recente são resumidos', () => {
  const trades = [makeTrade(20000, '2026-01-05', { grossPnlCents: 22000, feesCents: 500, commissionCents: 1000, swapCents: -500 }), makeTrade(-10000, '2026-02-03')];
  assert.equal(monthlyPerformance(trades).length, 2);
  assert.equal(weekdayPerformance(trades).find((item) => item.name === 'Segunda').count, 1);
  const costs = costStats(trades); assert.equal(costs.grossCents, 12000); assert.equal(costs.impactCents, 2000);
  const accounts = accountPerformance([account], trades, []); assert.equal(accounts[0].count, 2); assert.equal(accounts[0].days, 2);
  assert.equal(recentComparison(trades, 1).recent.count, 1);
});

test('filtros de hoje, semana, mês, 30 dias, ano e personalizado limitam todos os trades', () => {
  const now = new Date(2026, 9, 24, 12);
  assert.deepEqual(analyticsPeriodRange('week', { now }), { mode: 'week', from: '2026-10-19', to: '2026-10-25', label: 'Esta semana: 19/10/2026 a 25/10/2026', invalid: false });
  assert.equal(analyticsPeriodRange('month', { now }).from, '2026-10-01');
  assert.equal(analyticsPeriodRange('last30', { now }).from, '2026-09-25');
  assert.equal(analyticsPeriodRange('year', { now }).to, '2026-12-31');
  const custom = analyticsPeriodRange('custom', { from: '2026-10-02', to: '2026-10-10', now });
  const trades = [makeTrade(1000, '2026-10-01'), makeTrade(1000, '2026-10-05'), makeTrade(1000, '2026-10-11')];
  assert.deepEqual(filterTradesByPeriod(trades, custom).map((trade) => trade.closedDate), ['2026-10-05']);
  assert.equal(analyticsPeriodRange('custom', { from: '2026-10-10', to: '2026-10-02', now }).invalid, true);
});

test('página de estatísticas contém as dez análises e ajuda contextual', () => {
  const trades = [makeTrade(20000, '2026-01-05'), makeTrade(-10000, '2026-01-06', { symbol: 'NAS100' })];
  const db = { accounts: [account], trades, cashFlows: [] };
  const result = renderAnalytics({ db, trades, accounts: [account] });
  for (const text of ['Melhores e piores desempenhos', 'Sequências de resultados', 'Ganho, perda e payoff', 'Distribuição dos resultados em R', 'Drawdown completo', 'Resultados por mês', 'Desempenho por dia da semana', 'Impacto dos custos', 'Comparação entre contas', 'Desempenho recente']) assert.match(result.html, new RegExp(text));
  assert.match(result.html, /Resultado detalhado por ativo/);
  assert.match(result.html, /EUR\/USD/);
  assert.match(result.html, /NAS100/);
  assert.match(result.html, /data-analytics-period/);
  assert.ok((result.html.match(/class="info-trigger"/g) || []).length >= 15);
  assert.deepEqual(result.charts.distribution.labels, ['< −1R', '−1R a 0R', '0R a +1R', '+1R a +2R', '≥ +2R']);
});
