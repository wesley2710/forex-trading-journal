import { netPnlCents, summarize, tradeR } from '../domain/trading.js';
import { fromCents, money, round, signed } from '../domain/money.js';
import { empty, esc, metric } from '../ui/html.js';

export function renderAnalytics({ trades }) {
  const items = [...trades].sort((a, b) => a.closedDate.localeCompare(b.closedDate)); const stats = summarize(items); let cumulative = 0;
  const rCurve = [0, ...items.map((trade) => round(cumulative += tradeR(trade) || 0))];
  const pnlCurve = [0, ...items.map((_, index) => fromCents(items.slice(0, index + 1).reduce((sum, trade) => sum + netPnlCents(trade), 0)))];
  const bySymbol = Object.entries(items.reduce((map, trade) => { (map[trade.symbol] ||= []).push(trade); return map; }, {})).sort((a, b) => summarize(b[1]).pnlCents - summarize(a[1]).pnlCents);
  const byStrategy = Object.entries(items.reduce((map, trade) => { const key = trade.strategy || 'Sem estratégia'; (map[key] ||= []).push(trade); return map; }, {})).sort((a, b) => summarize(b[1]).r - summarize(a[1]).r);
  const table = (groups, label) => groups.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>${label}</th><th>Trades</th><th>PnL</th><th>R</th></tr></thead><tbody>${groups.map(([key, group]) => { const item = summarize(group); return `<tr><td>${esc(key)}</td><td>${item.count}</td><td>${money(item.pnlCents)}</td><td>${signed(item.r, 'R')}</td></tr>`; }).join('')}</tbody></table></div>` : empty('Sem operações para analisar.');
  return { rCurve, pnlCurve, html: `<div class="stack"><div class="metric-grid">${metric('R acumulado', signed(stats.r, 'R'))}${metric('R médio', signed(stats.avgR, 'R'))}${metric('Profit factor', stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2))}${metric('Expectativa', money(stats.expectancyCents))}</div><div class="two-col"><section class="card"><h2 class="section-title">R acumulado</h2><canvas id="rChart" role="img" aria-label="Curva de R acumulado"></canvas></section><section class="card"><h2 class="section-title">PnL acumulado</h2><canvas id="pnlChart" role="img" aria-label="Curva de PnL acumulado"></canvas></section></div><div class="two-col"><section class="card"><h2 class="section-title">Por ativo</h2>${table(bySymbol, 'Ativo')}</section><section class="card"><h2 class="section-title">Por estratégia</h2>${table(byStrategy, 'Estratégia')}</section></div></div>` };
}
