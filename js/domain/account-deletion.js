import { markDeleted } from './sync-merge.js';

const LINKED_COLLECTIONS = ['phases', 'trades', 'cashFlows', 'payouts', 'fees', 'snapshots'];

export function accountDeletionSummary(db, accountId) {
  const linked = Object.fromEntries(LINKED_COLLECTIONS.map((collection) => [collection, (db[collection] || []).filter((item) => item.accountId === accountId)]));
  const screenshots = linked.trades.flatMap((trade) => (trade.screenshots || []).map((screenshot) => ({ ...screenshot, tradeId: trade.id })));
  return {
    linked,
    screenshots,
    trades: linked.trades.length,
    payouts: linked.payouts.length,
    cashFlows: linked.cashFlows.length,
    fees: linked.fees.length,
    snapshots: linked.snapshots.length,
  };
}

export function deleteAccountRecords(db, accountId, deletedAt = new Date().toISOString()) {
  const account = (db.accounts || []).find((item) => item.id === accountId);
  if (!account) throw new Error('Conta não encontrada.');
  const summary = accountDeletionSummary(db, accountId);
  for (const collection of LINKED_COLLECTIONS) {
    for (const item of summary.linked[collection]) markDeleted(db, collection, item.id, deletedAt);
    db[collection] = (db[collection] || []).filter((item) => item.accountId !== accountId);
  }
  // O marcador da conta fica por último para continuar preservado mesmo se o histórico de exclusões atingir o limite.
  markDeleted(db, 'accounts', accountId, deletedAt);
  db.accounts = db.accounts.filter((item) => item.id !== accountId);
  return summary;
}

export { LINKED_COLLECTIONS };
