import { toCents, addCents } from './money.js';

export const SCHEMA_VERSION = 3;
export const COLLECTIONS = ['accounts', 'phases', 'trades', 'cashFlows', 'payouts', 'fees', 'snapshots'];
export const emptyDatabase = () => ({ schemaVersion: SCHEMA_VERSION, revision: 0, accounts: [], phases: [], trades: [], cashFlows: [], payouts: [], fees: [], snapshots: [], settings: {}, audit: [] });
const cents = (value) => { try { return toCents(value || 0); } catch { return 0; } };

export function migrate(raw) {
  if (!raw || typeof raw !== 'object') return emptyDatabase();
  if (raw.schemaVersion === SCHEMA_VERSION) return { ...emptyDatabase(), ...raw };
  if (raw.schemaVersion === 2) return {
    ...emptyDatabase(),
    ...raw,
    schemaVersion: SCHEMA_VERSION,
    trades: (raw.trades || []).map((trade) => ({ ...trade, screenshots: Array.isArray(trade.screenshots) ? trade.screenshots : [] })),
  };
  const db = emptyDatabase();
  db.accounts = (raw.accounts || []).map((account) => ({
    id: account.id, name: account.name, firm: account.firm || '', status: account.status || 'Ativa', archived: false,
    initialBalanceCents: cents(account.initialBalance), profitTargetCents: cents(account.profitTarget), dailyLossLimitCents: cents(account.dailyLossLimit), maxLossLimitCents: cents(account.maxLossLimit),
    drawdownType: account.drawdownType || 'static', lossBasis: /equity/i.test(account.drawdownType || '') ? 'equity' : 'balance', timezone: account.timezone || 'UTC', rolloverTime: '00:00', profitSplit: Number(account.profitSplit || 80),
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1,
  }));
  db.phases = db.accounts.map((account) => ({ id: `phase-${account.id}`, accountId: account.id, name: raw.accounts.find((item) => item.id === account.id)?.phase || 'Avaliação', startedAt: new Date().toISOString(), endedAt: null, status: 'active', version: 1 }));
  db.trades = (raw.trades || []).map((trade) => ({
    id: trade.id, accountId: trade.accountId, phaseId: `phase-${trade.accountId}`, openedAt: `${trade.date}T12:00:00Z`, closedAt: `${trade.date}T12:00:00Z`, closedDate: trade.date,
    symbol: trade.symbol, side: trade.side, entry: null, stopLoss: null, takeProfit: null, exit: null, lots: null,
    riskCents: cents(trade.risk), plannedRewardCents: cents(trade.plannedReward), grossPnlCents: cents(trade.pnl), feesCents: 0, swapCents: 0, commissionCents: 0, netPnlCents: cents(trade.pnl),
    strategy: trade.strategy || '', notes: trade.notes || '', partialExits: [], screenshots: [], timezone: db.accounts.find((account) => account.id === trade.accountId)?.timezone || 'UTC', version: 1,
  }));
  db.cashFlows = (raw.flows || []).map((flow) => ({ id: flow.id || `${flow.accountId}-${flow.date}-${Math.random()}`, accountId: flow.accountId, date: flow.date, occurredAt: `${flow.date}T12:00:00Z`, type: flow.type || 'adjustment', amountCents: cents(flow.amount), affectsBalance: !/informativo/i.test(flow.type || ''), notes: '', version: 1 }));
  db.settings = raw.settings || {};
  return db;
}

export function normalizeTrade(input) {
  const grossPnlCents = cents(input.grossPnl ?? input.pnl);
  const feesCents = Math.abs(cents(input.fees));
  const swapCents = cents(input.swap);
  const commissionCents = Math.abs(cents(input.commission));
  return { ...input, screenshots: Array.isArray(input.screenshots) ? input.screenshots : [], riskCents: cents(input.risk), plannedRewardCents: cents(input.plannedReward), grossPnlCents, feesCents, swapCents, commissionCents, netPnlCents: addCents(grossPnlCents, -feesCents, swapCents, -commissionCents) };
}
