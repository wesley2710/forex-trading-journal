import { money, signed } from '../domain/money.js';
import { plannedRR, tradeR, netPnlCents } from '../domain/trading.js';

export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
export const opts = (items, selected) => items.map(([id, label]) => `<option value="${esc(id)}" ${id === selected ? 'selected' : ''}>${esc(label)}</option>`).join('');
export const metric = (label, value, sub = '') => `<div class="card"><div class="eyebrow">${esc(label)}</div><div class="metric">${value}</div><div class="small muted">${esc(sub)}</div></div>`;
export const empty = (message, action = '', label = 'Começar agora') => `<div class="empty"><strong>Nenhum dado ainda</strong>${esc(message)}${action ? `<br><button class="primary" data-action="${action}">${esc(label)}</button>` : ''}</div>`;
export const currency = (cents) => `<span class="${Number(cents) > 0 ? 'green' : Number(cents) < 0 ? 'red' : 'neutral'}">${Number(cents) > 0 ? '+' : ''}${money(cents)}</span>`;
export const rfmt = (number) => `<span class="${number > 0 ? 'green' : number < 0 ? 'red' : 'neutral'}">${number == null ? '—' : signed(number, 'R')}</span>`;
export const field = (name, label, type = 'text', value = '', extra = '', full = false) => `<label class="field ${full ? 'full' : ''}">${esc(label)}<input name="${esc(name)}" type="${esc(type)}" value="${esc(value ?? '')}" ${extra}></label>`;
export const selectField = (name, label, options, value, full = false) => `<label class="field ${full ? 'full' : ''}">${esc(label)}<select name="${esc(name)}">${opts(options, value)}</select></label>`;
export const textArea = (name, label, value = '', max = 2000) => `<label class="field full">${esc(label)}<textarea name="${esc(name)}" rows="3" maxlength="${max}">${esc(value)}</textarea></label>`;

export function tradeTable(items, accountName, withActions = true) {
  if (!items.length) return empty('Registre sua primeira operação para ver o histórico.');
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Data</th><th>Conta</th><th>Ativo</th><th>Direção</th><th>Resultado</th><th>RR plan.</th><th>R</th>${withActions ? '<th>Ações</th>' : ''}</tr></thead><tbody>${items.map((trade) => `<tr><td>${esc(trade.closedDate)}</td><td>${esc(accountName(trade.accountId))}</td><td><b>${esc(trade.symbol)}</b></td><td>${esc(trade.side)}</td><td>${currency(netPnlCents(trade))}</td><td>${plannedRR(trade) === null ? '—' : `1:${plannedRR(trade).toFixed(2)}`}</td><td>${rfmt(tradeR(trade))}</td>${withActions ? `<td><div class="actions"><button data-action="edit-trade" data-id="${esc(trade.id)}">Editar</button><button data-action="delete-trade" data-id="${esc(trade.id)}">Excluir</button></div></td>` : ''}</tr>`).join('')}</tbody></table></div>`;
}
