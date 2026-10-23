import { addCents, round } from './money.js';

export const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const isoDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const safeDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00Z`).getTime());
export const netPnlCents = (trade) => Number.isInteger(trade.netPnlCents) ? trade.netPnlCents : addCents(trade.grossPnlCents, -Number(trade.feesCents || 0), trade.swapCents, -Number(trade.commissionCents || 0));
export const tradeR = (trade) => Number(trade.riskCents) > 0 ? round(netPnlCents(trade) / Number(trade.riskCents), 4) : null;
export const plannedRR = (trade) => Number(trade.riskCents) > 0 && Number(trade.plannedRewardCents) >= 0 ? round(Number(trade.plannedRewardCents) / Number(trade.riskCents), 4) : null;

export function summarize(trades = []) {
  const pnlCents = trades.reduce((sum, trade) => sum + netPnlCents(trade), 0);
  const r = round(trades.reduce((sum, trade) => sum + (tradeR(trade) || 0), 0));
  const wins = trades.filter((trade) => netPnlCents(trade) > 0);
  const losses = trades.filter((trade) => netPnlCents(trade) < 0);
  const grossProfitCents = wins.reduce((sum, trade) => sum + netPnlCents(trade), 0);
  const grossLossCents = Math.abs(losses.reduce((sum, trade) => sum + netPnlCents(trade), 0));
  return { count: trades.length, pnlCents, r, wins: wins.length, losses: losses.length, winRate: trades.length ? round(wins.length / trades.length * 100) : 0, avgR: trades.length ? round(r / trades.length) : 0, expectancyCents: trades.length ? Math.round(pnlCents / trades.length) : 0, profitFactor: grossLossCents ? round(grossProfitCents / grossLossCents) : grossProfitCents > 0 ? Infinity : 0 };
}

export function operationalBalanceCents(account, trades = [], cashFlows = []) {
  return Number(account.initialBalanceCents || 0) + trades.filter((trade) => trade.accountId === account.id).reduce((sum, trade) => sum + netPnlCents(trade), 0) + cashFlows.filter((flow) => flow.accountId === account.id && flow.affectsBalance !== false).reduce((sum, flow) => sum + Number(flow.amountCents || 0), 0);
}

export const monthTrades = (trades, year, month) => trades.filter((trade) => trade.closedDate?.slice(0, 7) === `${year}-${String(month + 1).padStart(2, '0')}`);
export const dailyStats = (trades, date) => summarize(trades.filter((trade) => trade.closedDate === date));

export function equitySeries(trades = [], cashFlows = [], openingCents = 0) {
  let running = Number(openingCents || 0);
  const items = [...trades.map((trade) => ({ date: trade.closedAt || `${trade.closedDate}T23:59:59Z`, delta: netPnlCents(trade), kind: 'trade' })), ...cashFlows.filter((flow) => flow.affectsBalance !== false).map((flow) => ({ date: flow.occurredAt || `${flow.date}T12:00:00Z`, delta: Number(flow.amountCents), kind: 'flow' }))].sort((a, b) => a.date.localeCompare(b.date));
  return [{ label: 'Início', value: running }, ...items.map((item, index) => ({ label: `${item.date.slice(0, 10)} #${index + 1}`, value: (running += item.delta), kind: item.kind }))];
}

export function maxDrawdown(values = []) { let peak = -Infinity; let max = 0; for (const value of values) { peak = Math.max(peak, Number(value)); max = Math.max(max, peak - Number(value)); } return max; }

export function dateInTimezone(isoTimestamp, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(isoTimestamp));
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

export function evaluateAccountLimits(account, trades = [], snapshots = [], now = new Date()) {
  const accountTrades = trades.filter((trade) => trade.accountId === account.id);
  const balance = operationalBalanceCents(account, accountTrades, []);
  const timezone = account.timezone || 'UTC';
  const today = dateInTimezone(now.toISOString(), timezone);
  const dailyPnl = accountTrades.filter((trade) => (trade.closedDate || dateInTimezone(trade.closedAt, timezone)) === today).reduce((sum, trade) => sum + netPnlCents(trade), 0);
  const latestEquity = snapshots.filter((snapshot) => snapshot.accountId === account.id).sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0]?.equityCents;
  const base = account.lossBasis === 'equity' && Number.isInteger(latestEquity) ? latestEquity : balance;
  const totalLoss = Math.max(0, Number(account.initialBalanceCents || 0) - base);
  const warnings = [];
  if (account.dailyLossLimitCents > 0 && -dailyPnl >= account.dailyLossLimitCents * 0.8) warnings.push({ level: -dailyPnl >= account.dailyLossLimitCents ? 'danger' : 'warning', code: 'daily-loss', message: 'Limite diário próximo ou atingido.' });
  if (account.maxLossLimitCents > 0 && totalLoss >= account.maxLossLimitCents * 0.8) warnings.push({ level: totalLoss >= account.maxLossLimitCents ? 'danger' : 'warning', code: 'max-loss', message: 'Limite total próximo ou atingido.' });
  if (!Number.isInteger(latestEquity) && account.lossBasis === 'equity') warnings.push({ level: 'info', code: 'no-equity', message: 'Sem snapshot de equity: o alerta não cobre perda flutuante intradiária.' });
  return { balanceCents: balance, referenceCents: base, dailyPnlCents: dailyPnl, totalLossCents: totalLoss, warnings };
}
