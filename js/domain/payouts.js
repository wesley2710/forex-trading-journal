import { round } from './money.js';

export const payoutDate = (payout) => payout.date || payout.receivedAt || payout.requestedAt || '';
export const payoutGrossCents = (payout) => Number.isInteger(payout.grossCents) ? payout.grossCents : Number.isInteger(payout.requestedCents) ? payout.requestedCents : Number(payout.receivedCents || 0);

export function payoutSharePercent(payout) {
  if (Number.isFinite(Number(payout.traderSharePercent))) return Number(payout.traderSharePercent);
  const gross = payoutGrossCents(payout);
  return gross > 0 && Number.isInteger(payout.receivedCents) ? round(payout.receivedCents / gross * 100) : 100;
}

export function payoutNetCents(payout) {
  if (Number.isInteger(payout.netCents)) return payout.netCents;
  if (Number.isInteger(payout.receivedCents)) return payout.receivedCents;
  return Math.round(payoutGrossCents(payout) * payoutSharePercent(payout) / 100);
}

export const payoutFirmCents = (payout) => Math.max(0, payoutGrossCents(payout) - payoutNetCents(payout));
export const isCompletedPayout = (payout) => Number.isInteger(payout.grossCents) || payout.status === 'received';

export function payoutSummary(payouts) {
  const items = payouts.filter(isCompletedPayout);
  return {
    count: items.length,
    grossCents: items.reduce((sum, item) => sum + payoutGrossCents(item), 0),
    netCents: items.reduce((sum, item) => sum + payoutNetCents(item), 0),
    firmCents: items.reduce((sum, item) => sum + payoutFirmCents(item), 0),
  };
}
