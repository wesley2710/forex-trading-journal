import { summarize } from '../domain/trading.js';
import { money, signed } from '../domain/money.js';
import { visibleAccounts, visibleAccountRecords } from '../domain/account-visibility.js';
import { esc, opts, tradeTable } from '../ui/html.js';

export function renderTrades({ db, filters, accountName }) {
  const includeArchived = Boolean(filters.includeArchived);
  const accounts = visibleAccounts(db, includeArchived);
  const baseTrades = visibleAccountRecords(db, db.trades, { includeArchived });
  const requestedAccount = filters.historyAccount ?? filters.account ?? 'all';
  const selectedAccount = requestedAccount === 'all' || accounts.some((account) => account.id === requestedAccount) ? requestedAccount : 'all';
  const firms = [...new Set(accounts.map((account) => account.firm).filter(Boolean))].sort();
  const symbols = [...new Set(baseTrades.map((trade) => trade.symbol).filter(Boolean))].sort();
  const strategies = [...new Set(baseTrades.map((trade) => trade.strategy).filter(Boolean))].sort();
  const items = baseTrades.filter((trade) => {
    const account = db.accounts.find((item) => item.id === trade.accountId);
    return (selectedAccount === 'all' || trade.accountId === selectedAccount) && (!filters.from || trade.closedDate >= filters.from) && (!filters.to || trade.closedDate <= filters.to) && (!filters.firm || account?.firm === filters.firm) && (!filters.symbol || trade.symbol === filters.symbol) && (!filters.strategy || trade.strategy === filters.strategy) && (!filters.side || trade.side === filters.side);
  }).sort((a, b) => b.closedDate.localeCompare(a.closedDate));
  const stats = summarize(items);
  return `<div class="stack"><div class="row"><h2 class="section-title">Diário de operações</h2><button class="primary" data-action="new-trade">+ Registrar operação</button></div><section class="card filters" aria-label="Filtros"><label>Conta<select data-filter="historyAccount">${opts([['all', 'Todas as contas'], ...accounts.map((account) => [account.id, `${account.name}${account.archived ? ' (arquivada)' : ''}`])], selectedAccount)}</select></label><label>De<input data-filter="from" type="date" value="${esc(filters.from)}"></label><label>Até<input data-filter="to" type="date" value="${esc(filters.to)}"></label><label>Mesa<select data-filter="firm">${opts([['', 'Todas'], ...firms.map((item) => [item, item])], filters.firm)}</select></label><label>Ativo<select data-filter="symbol">${opts([['', 'Todos'], ...symbols.map((item) => [item, item])], filters.symbol)}</select></label><label>Estratégia<select data-filter="strategy">${opts([['', 'Todas'], ...strategies.map((item) => [item, item])], filters.strategy)}</select></label><label>Direção<select data-filter="side">${opts([['', 'Todas'], ['Compra', 'Compra'], ['Venda', 'Venda']], filters.side)}</select></label><label class="archive-history-toggle"><input type="checkbox" data-include-archived ${includeArchived ? 'checked' : ''}> Incluir contas arquivadas</label><button class="ghost" data-action="clear-filters">Limpar</button></section><div class="pill summary-pill">${stats.count} trades • ${money(stats.pnlCents)} • ${signed(stats.r, 'R')}</div><section class="card">${tradeTable(items, accountName)}</section></div>`;
}
