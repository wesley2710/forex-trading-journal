export const SCHEMA_VERSION = 2;
export const COLLECTIONS = ['accounts', 'phases', 'trades', 'cashFlows', 'payouts', 'fees', 'snapshots', 'audit'];
export const TABS = { accounts: 'Accounts', phases: 'Phases', trades: 'Trades', cashFlows: 'CashFlows', payouts: 'Payouts', fees: 'Fees', snapshots: 'Snapshots', audit: 'Audit' };
export const HEADERS = ['id', 'version', 'updatedAt', 'payloadJson'];
export const MAX_ITEMS_PER_COLLECTION = 10000;
export const MAX_TEXT_LENGTH = 200000;

export function validateSnapshot(value) {
  if (!value || typeof value !== 'object' || value.schemaVersion !== SCHEMA_VERSION) throw Object.assign(new Error(`schemaVersion deve ser ${SCHEMA_VERSION}.`), { status: 400 });
  for (const collection of COLLECTIONS) {
    if (!Array.isArray(value[collection])) throw Object.assign(new Error(`${collection} deve ser uma lista.`), { status: 400 });
    if (value[collection].length > MAX_ITEMS_PER_COLLECTION) throw Object.assign(new Error(`${collection} excede o limite.`), { status: 413 });
    const ids = new Set();
    for (const item of value[collection]) {
      if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id || ids.has(item.id)) throw Object.assign(new Error(`${collection} contém ID inválido ou duplicado.`), { status: 400 });
      ids.add(item.id); if (JSON.stringify(item).length > MAX_TEXT_LENGTH) throw Object.assign(new Error(`Registro em ${collection} excede o limite.`), { status: 413 });
    }
  }
  if (!value.settings || typeof value.settings !== 'object' || Array.isArray(value.settings)) throw Object.assign(new Error('settings inválido.'), { status: 400 });
  const accounts = new Set(value.accounts.map((item) => item.id));
  for (const collection of ['phases', 'trades', 'cashFlows', 'payouts', 'fees', 'snapshots']) for (const item of value[collection]) if (!accounts.has(item.accountId)) throw Object.assign(new Error(`${collection} referencia conta inexistente.`), { status: 400 });
  return value;
}

export const rowFor = (item) => [item.id, Number(item.version || 1), item.updatedAt || new Date().toISOString(), JSON.stringify(item)];
export const itemFromRow = (row) => JSON.parse(row[3]);
