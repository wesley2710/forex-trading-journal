export const toCents = (value) => {
  const normalized = typeof value === 'string' ? value.trim().replace(',', '.') : value;
  const number = Number(normalized);
  if (!Number.isFinite(number)) throw new TypeError('Valor monetário inválido.');
  return Math.round((number + Number.EPSILON) * 100);
};

export const fromCents = (cents) => Number(cents || 0) / 100;
export const addCents = (...values) => values.reduce((sum, value) => sum + Math.trunc(Number(value || 0)), 0);
export const money = (cents, currency = 'USD') => new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(fromCents(cents));
export const signed = (number, suffix = '') => `${Number(number) > 0 ? '+' : ''}${Number(number || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${suffix}`;
export const round = (number, digits = 2) => Math.round((Number(number) + Number.EPSILON) * 10 ** digits) / 10 ** digits;
