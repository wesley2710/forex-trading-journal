import { equitySeries, evaluateAccountLimits, maxDrawdown, operationalBalanceCents, summarize } from '../domain/trading.js';
import { fromCents, money, signed } from '../domain/money.js';
import { currency, metric, rfmt, tradeTable, esc } from '../ui/html.js';

export function renderDashboard({ db, selected, accountName }) {
  const accounts = db.accounts.filter((account) => !account.archived && (selected === 'all' || account.id === selected));
  const trades = db.trades.filter((trade) => selected === 'all' || trade.accountId === selected).sort((a, b) => a.closedDate.localeCompare(b.closedDate));
  const flows = db.cashFlows.filter((flow) => selected === 'all' || flow.accountId === selected);
  const stats = summarize(trades);
  const total = accounts.reduce((sum, account) => sum + operationalBalanceCents(account, db.trades, db.cashFlows), 0);
  const opening = accounts.reduce((sum, account) => sum + account.initialBalanceCents, 0);
  const series = equitySeries(trades, flows, opening);
  const payouts = db.payouts.filter((item) => item.status === 'received' && (selected === 'all' || item.accountId === selected)).reduce((sum, item) => sum + item.receivedCents, 0);
  const alerts = accounts.flatMap((account) => evaluateAccountLimits(account, db.trades, db.snapshots).warnings.map((warning) => ({ ...warning, account: account.name })));
  return { chart: series.map((item) => fromCents(item.value)), html: `<div class="stack"><div class="row"><h2 class="section-title">Visão geral</h2><span class="pill">${selected === 'all' ? 'Todas as contas' : esc(accountName(selected))}</span></div>
    <section class="metric-grid">${metric('Saldo operacional agregado', money(total), 'Capital nominal das contas')}${metric('Resultado realizado', currency(stats.pnlCents), `${stats.count} operações`)}${metric('R acumulado', rfmt(stats.r), `Média: ${signed(stats.avgR, 'R')} / trade`)}${metric('Payout recebido', money(payouts), 'Patrimônio efetivamente recebido')}</section>
    ${alerts.length ? `<section class="card alerts"><h2 class="section-title">Alertas preventivos</h2>${alerts.map((alert) => `<p class="alert ${alert.level}"><b>${esc(alert.account)}</b> — ${esc(alert.message)}</p>`).join('')}<p class="helper">Sem mark-to-market, os alertas não garantem compliance intradiário.</p></section>` : ''}
    <div class="two-col"><section class="card"><div class="row"><h2 class="section-title">Evolução do saldo</h2><span class="small muted">Eventos realizados</span></div><canvas id="balanceChart" aria-label="Gráfico de evolução do saldo" role="img"></canvas></section><section class="card"><h2 class="section-title">Indicadores</h2><div class="detail-list"><div class="row detail-item">Profit factor <b>${stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}</b></div><div class="row detail-item">Expectativa por trade <b>${money(stats.expectancyCents)}</b></div><div class="row detail-item">Drawdown observado <b>${money(maxDrawdown(series.map((item) => item.value)))}</b></div><div class="row detail-item">Win rate <b>${stats.winRate}%</b></div><div class="row detail-item">Contas ativas <b>${accounts.length}</b></div></div></section></div>
    <section class="card"><div class="row"><h2 class="section-title">Últimas operações</h2><button class="ghost" data-goto="trades">Ver histórico →</button></div>${tradeTable(trades.slice(-7).reverse(), accountName, false)}</section></div>` };
}
