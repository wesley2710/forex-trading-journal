import { COLLECTIONS } from './schema.js';
import { safeDate } from './trading.js';

const text = (value, max, label, required = false) => {
  const normalized = String(value || '').trim();
  if (required && !normalized) throw new Error(`${label} é obrigatório.`);
  if (normalized.length > max) throw new Error(`${label} excede ${max} caracteres.`);
  return normalized;
};
const finite = (value, label, { min = -Infinity, max = Infinity } = {}) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new Error(`${label} inválido.`);
  return number;
};
export function validateAccount(account) {
  text(account.name, 80, 'Nome', true); text(account.firm, 80, 'Mesa'); text(account.timezone, 80, 'Fuso', true);
  try { new Intl.DateTimeFormat('pt-BR', { timeZone: account.timezone }).format(); } catch { throw new Error('Fuso horário IANA inválido.'); }
  finite(account.initialBalanceCents, 'Saldo inicial', { min: 0 }); finite(account.profitSplit, 'Profit split', { min: 0, max: 100 }); return account;
}
export function validateTrade(trade, db) {
  if (!db.accounts.some((account) => account.id === trade.accountId)) throw new Error('Conta inválida.');
  text(trade.symbol, 30, 'Ativo', true); text(trade.strategy, 80, 'Estratégia'); text(trade.notes, 2000, 'Observações');
  if (!safeDate(trade.closedDate)) throw new Error('Data de fechamento inválida.');
  finite(trade.riskCents, 'Risco', { min: 1 }); finite(trade.netPnlCents, 'Resultado');
  for (const key of ['entry', 'stopLoss', 'takeProfit', 'exit', 'lots']) if (trade[key] !== null && trade[key] !== '') finite(trade[key], key, { min: 0 });
  return trade;
}
export function validateDatabase(db) {
  if (!db || typeof db !== 'object') throw new Error('Backup inválido.');
  for (const collection of COLLECTIONS) if (!Array.isArray(db[collection])) throw new Error(`Coleção ${collection} inválida.`);
  const ids = new Set();
  for (const account of db.accounts) { if (!account.id || ids.has(account.id)) throw new Error('Conta sem ID ou duplicada.'); ids.add(account.id); validateAccount(account); }
  for (const trade of db.trades) { if (!trade.id) throw new Error('Operação sem ID.'); validateTrade(trade, db); }
  return db;
}
