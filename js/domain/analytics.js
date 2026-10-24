import { round } from './money.js';
import { netPnlCents, operationalBalanceCents, summarize, tradeR } from './trading.js';

const ordered = (trades) => [...trades].sort((a, b) => `${a.closedDate}${a.closedAt || ''}`.localeCompare(`${b.closedDate}${b.closedAt || ''}`));
const finiteRatio = (numerator, denominator) => denominator ? round(numerator / denominator) : numerator > 0 ? Infinity : 0;

export function groupPerformance(trades, selector, minimumSample = 5) {
  const groups = new Map();
  for (const trade of trades) {
    const key = selector(trade) || 'Sem informação';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(trade);
  }
  return [...groups].map(([name, items]) => ({ name, ...summarize(items), sampleAdequate: items.length >= minimumSample }))
    .sort((a, b) => b.avgR - a.avgR || b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'));
}

export function rankedPerformance(groups, limit = 5) {
  const adequate = groups.filter((item) => item.sampleAdequate);
  const source = adequate.length ? adequate : groups;
  return {
    usedSmallSample: !adequate.length && source.length > 0,
    best: [...source].sort((a, b) => b.avgR - a.avgR || b.r - a.r).slice(0, limit),
    worst: [...source].sort((a, b) => a.avgR - b.avgR || a.r - b.r).slice(0, limit),
  };
}

export function streakStats(trades) {
  let maxWins = 0; let maxLosses = 0; let winRun = 0; let lossRun = 0;
  let lossRunCents = 0; let worstLossRunCents = 0; let currentType = 'none'; let currentCount = 0;
  for (const trade of ordered(trades)) {
    const result = netPnlCents(trade);
    if (result > 0) {
      winRun += 1; lossRun = 0; lossRunCents = 0; maxWins = Math.max(maxWins, winRun);
      if (currentType === 'win') currentCount += 1; else { currentType = 'win'; currentCount = 1; }
    } else if (result < 0) {
      lossRun += 1; winRun = 0; lossRunCents += Math.abs(result); maxLosses = Math.max(maxLosses, lossRun); worstLossRunCents = Math.max(worstLossRunCents, lossRunCents);
      if (currentType === 'loss') currentCount += 1; else { currentType = 'loss'; currentCount = 1; }
    } else {
      winRun = 0; lossRun = 0; lossRunCents = 0; currentType = 'none'; currentCount = 0;
    }
  }
  return { maxWins, maxLosses, worstLossRunCents, currentType, currentCount };
}

export function payoffStats(trades) {
  const wins = trades.filter((trade) => netPnlCents(trade) > 0);
  const losses = trades.filter((trade) => netPnlCents(trade) < 0);
  const avgWinCents = wins.length ? Math.round(wins.reduce((sum, trade) => sum + netPnlCents(trade), 0) / wins.length) : 0;
  const avgLossCents = losses.length ? Math.round(Math.abs(losses.reduce((sum, trade) => sum + netPnlCents(trade), 0)) / losses.length) : 0;
  const winRs = wins.map(tradeR).filter(Number.isFinite);
  const lossRs = losses.map(tradeR).filter(Number.isFinite);
  const avgWinR = winRs.length ? round(winRs.reduce((sum, value) => sum + value, 0) / winRs.length) : 0;
  const avgLossR = lossRs.length ? round(Math.abs(lossRs.reduce((sum, value) => sum + value, 0) / lossRs.length)) : 0;
  const payoffRatio = finiteRatio(avgWinR || avgWinCents, avgLossR || avgLossCents);
  const requiredWinRate = avgWinR > 0 && avgLossR > 0 ? round(avgLossR / (avgWinR + avgLossR) * 100) : null;
  return { avgWinCents, avgLossCents, avgWinR, avgLossR, payoffRatio, requiredWinRate };
}

export function rDistribution(trades) {
  const buckets = [
    { label: '< −1R', count: 0 }, { label: '−1R a 0R', count: 0 }, { label: '0R a +1R', count: 0 }, { label: '+1R a +2R', count: 0 }, { label: '≥ +2R', count: 0 },
  ];
  for (const trade of trades) {
    const value = tradeR(trade); if (!Number.isFinite(value)) continue;
    const index = value < -1 ? 0 : value < 0 ? 1 : value < 1 ? 2 : value < 2 ? 3 : 4;
    buckets[index].count += 1;
  }
  return buckets;
}

export function drawdownStats(trades, startingCapitalCents = 0) {
  const items = ordered(trades); const equity = [Number(startingCapitalCents || 0)]; const seriesCents = [0];
  let running = equity[0]; let peak = running; let peakIndex = 0; let maxCents = 0; let maxPercent = 0; let maxPeakIndex = 0; let troughIndex = 0; let peakAtMax = peak;
  items.forEach((trade, index) => {
    running += netPnlCents(trade); equity.push(running);
    if (running >= peak) { peak = running; peakIndex = index + 1; }
    const decline = Math.max(0, peak - running); seriesCents.push(-decline);
    const percent = peak > 0 ? decline / peak * 100 : 0;
    if (decline > maxCents) { maxCents = decline; maxPercent = percent; maxPeakIndex = peakIndex; troughIndex = index + 1; peakAtMax = peak; }
  });
  let recoveryIndex = maxCents === 0 ? 0 : null;
  if (maxCents > 0) for (let index = troughIndex + 1; index < equity.length; index += 1) if (equity[index] >= peakAtMax) { recoveryIndex = index; break; }
  const currentCents = Math.abs(seriesCents.at(-1) || 0);
  return { seriesCents, maxCents, maxPercent: round(maxPercent), currentCents, tradesToTrough: troughIndex - maxPeakIndex, recoveryTrades: recoveryIndex === null ? null : Math.max(0, recoveryIndex - troughIndex) };
}

export function monthlyPerformance(trades) {
  const groups = new Map();
  for (const trade of trades) { const key = trade.closedDate?.slice(0, 7); if (!key) continue; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(trade); }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([key, items]) => ({ key, label: new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(`${key}-15T12:00:00Z`)).replace('.', ''), ...summarize(items) }));
}

export function weekdayPerformance(trades) {
  const labels = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const groups = Array.from({ length: 7 }, () => []);
  for (const trade of trades) { const day = new Date(`${trade.closedDate}T12:00:00Z`).getUTCDay(); if (Number.isInteger(day)) groups[day].push(trade); }
  return [1, 2, 3, 4, 5].map((day) => ({ name: labels[day], ...summarize(groups[day]) }));
}

export function costStats(trades) {
  const grossCents = trades.reduce((sum, trade) => sum + Number(trade.grossPnlCents || 0), 0);
  const feesCents = trades.reduce((sum, trade) => sum + Math.abs(Number(trade.feesCents || 0)), 0);
  const commissionCents = trades.reduce((sum, trade) => sum + Math.abs(Number(trade.commissionCents || 0)), 0);
  const swapCents = trades.reduce((sum, trade) => sum + Number(trade.swapCents || 0), 0);
  const netCents = trades.reduce((sum, trade) => sum + netPnlCents(trade), 0);
  const impactCents = grossCents - netCents;
  const positiveGrossCents = trades.reduce((sum, trade) => sum + Math.max(0, Number(trade.grossPnlCents || 0)), 0);
  return { grossCents, feesCents, commissionCents, swapCents, netCents, impactCents, impactPercent: positiveGrossCents ? round(impactCents / positiveGrossCents * 100) : 0 };
}

export function accountPerformance(accounts, trades, cashFlows = []) {
  return accounts.map((account) => {
    const items = trades.filter((trade) => trade.accountId === account.id); const stats = summarize(items);
    const balanceCents = operationalBalanceCents(account, items, cashFlows.filter((flow) => flow.accountId === account.id));
    const lossUsedCents = Math.max(0, Number(account.initialBalanceCents || 0) - balanceCents);
    return { id: account.id, name: account.name, status: account.status, ...stats, balanceCents, drawdownCents: drawdownStats(items, account.initialBalanceCents).maxCents, targetProgress: account.profitTargetCents > 0 ? round(stats.pnlCents / account.profitTargetCents * 100) : null, lossBufferCents: account.maxLossLimitCents > 0 ? Math.max(0, account.maxLossLimitCents - lossUsedCents) : null, days: new Set(items.map((trade) => trade.closedDate)).size };
  }).sort((a, b) => b.r - a.r);
}

export function recentComparison(trades, window = 20) {
  const items = ordered(trades); const recent = items.slice(-window);
  return { window, count: recent.length, recent: { ...summarize(recent), ...payoffStats(recent) }, all: { ...summarize(items), ...payoffStats(items) } };
}
