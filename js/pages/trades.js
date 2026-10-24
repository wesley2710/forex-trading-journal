import { summarize } from '../domain/trading.js';
import { money, signed } from '../domain/money.js';
import { esc, opts, tradeTable } from '../ui/html.js';

export function renderTrades({ db, filters, accountName }) {
  const firms = [...new Set(db.accounts.map((account) => account.firm).filter(Boolean))].sort();
  const symbols = [...new Set(db.trades.map((trade) => trade.symbol).filter(Boolean))].sort();
  const strategies = [...new Set(db.trades.map((trade) => trade.strategy).filter(Boolean))].sort();
  const items = db.trades.filter((trade) => {
    const account = db.accounts.find((item) => item.id === trade.accountId);
    return (filters.account === 'all' || trade.accountId === filters.account) && (!filters.from || trade.closedDate >= filters.from) && (!filters.to || trade.closedDate <= filters.to) && (!filters.firm || account?.firm === filters.firm) && (!filters.symbol || trade.symbol === filters.symbol) && (!filters.strategy || trade.strategy === filters.strategy) && (!filters.side || trade.side === filters.side);
  }).sort((a, b) => b.closedDate.localeCompare(a.closedDate));
  const stats = summarize(items);
  return `<div class="stack"><div class="row"><h2 class="section-title">Diário de operações</h2><button class="primary" data-action="new-trade">+ Registrar operação</button></div><section class="card filters" aria-label="Filtros"><label>De<input data-filter="from" type="date" value="${esc(filters.from)}"></label><label>Até<input data-filter="to" type="date" value="${esc(filters.to)}"></label><label>Mesa<select data-filter="firm">${opts([['', 'Todas'], ...firms.map((item) => [item, item])], filters.firm)}</select></label><label>Ativo<select data-filter="symbol">${opts([['', 'Todos'], ...symbols.map((item) => [item, item])], filters.symbol)}</select></label><label>Estratégia<select data-filter="strategy">${opts([['', 'Todas'], ...strategies.map((item) => [item, item])], filters.strategy)}</select></label><label>Direção<select data-filter="side">${opts([['', 'Todas'], ['Compra', 'Compra'], ['Venda', 'Venda']], filters.side)}</select></label><button class="ghost" data-action="clear-filters">Limpar</button></section><div class="pill summary-pill">${stats.count} trades • ${money(stats.pnlCents)} • ${signed(stats.r, 'R')}</div><section class="card">${tradeTable(items, accountName)}</section></div>`;
}
