import { COLLECTIONS, HEADERS, SCHEMA_VERSION, TABS, itemFromRow, rowFor } from './model.js';

const META_RANGE = "'_meta'!A1:B5";
const parseMeta = (rows = []) => Object.fromEntries(rows.filter((row) => row.length >= 2));

export class SheetsStore {
  constructor(sheets, spreadsheetId) { this.sheets = sheets; this.spreadsheetId = spreadsheetId; }
  async ensureSchema() {
    const response = await this.sheets.spreadsheets.get({ spreadsheetId: this.spreadsheetId });
    const current = new Set(response.data.sheets.map((sheet) => sheet.properties.title));
    const required = [...Object.values(TABS), 'Settings', '_meta'];
    const requests = required.filter((title) => !current.has(title)).map((title) => ({ addSheet: { properties: { title, hidden: title === '_meta' } } }));
    if (requests.length) await this.sheets.spreadsheets.batchUpdate({ spreadsheetId: this.spreadsheetId, requestBody: { requests } });
    const data = Object.values(TABS).map((tab) => ({ range: `'${tab}'!A1:D1`, values: [HEADERS] })); data.push({ range: "'Settings'!A1:D1", values: [HEADERS] });
    const meta = await this.meta(); data.push({ range: META_RANGE, values: [['schemaVersion', String(SCHEMA_VERSION)], ['revision', meta.revision || '0'], ['counts', meta.counts || '{}'], ['idempotency', meta.idempotency || '[]'], ['updatedAt', meta.updatedAt || new Date(0).toISOString()]] });
    await this.sheets.spreadsheets.values.batchUpdate({ spreadsheetId: this.spreadsheetId, requestBody: { valueInputOption: 'RAW', data } });
  }
  async meta() { const response = await this.sheets.spreadsheets.values.get({ spreadsheetId: this.spreadsheetId, range: META_RANGE }).catch(() => ({ data: { values: [] } })); return parseMeta(response.data.values); }
  async readSnapshot() {
    const meta = await this.meta(); const counts = JSON.parse(meta.counts || '{}'); const ranges = COLLECTIONS.map((collection) => `'${TABS[collection]}'!A2:D${Math.max(2, Number(counts[collection] || 0) + 1)}`); ranges.push("'Settings'!A2:D2");
    const response = await this.sheets.spreadsheets.values.batchGet({ spreadsheetId: this.spreadsheetId, ranges }); const data = { schemaVersion: SCHEMA_VERSION, revision: 0, settings: {} };
    COLLECTIONS.forEach((collection, index) => { data[collection] = (response.data.valueRanges[index]?.values || []).slice(0, counts[collection] || 0).map(itemFromRow); });
    const settingsRow = response.data.valueRanges.at(-1)?.values?.[0]; if (settingsRow) { const { id, version, updatedAt, ...settings } = itemFromRow(settingsRow); data.settings = settings; }
    return { data, revision: Number(meta.revision || 0), updatedAt: meta.updatedAt || null };
  }
  async writeSnapshot(snapshot, { expectedRevision, idempotencyKey, actor }) {
    const meta = await this.meta(); const revision = Number(meta.revision || 0); const keys = JSON.parse(meta.idempotency || '[]'); if (keys.includes(idempotencyKey)) return { revision, duplicate: true };
    if (expectedRevision !== revision) throw Object.assign(new Error('Conflito de versão.'), { status: 409, revision });
    const nextRevision = revision + 1; const now = new Date().toISOString(); const auditEvent = { id: crypto.randomUUID(), action: 'snapshot.replace', collection: '*', actor, at: now, version: 1 };
    const next = { ...snapshot, audit: [...snapshot.audit, auditEvent].slice(-1000) }; const counts = Object.fromEntries(COLLECTIONS.map((collection) => [collection, next[collection].length]));
    const data = COLLECTIONS.map((collection) => ({ range: `'${TABS[collection]}'!A1:D${Math.max(1, next[collection].length + 1)}`, values: [HEADERS, ...next[collection].map(rowFor)] }));
    data.push({ range: "'Settings'!A1:D2", values: [HEADERS, rowFor({ ...next.settings, id: 'settings', version: nextRevision, updatedAt: now })] });
    data.push({ range: META_RANGE, values: [['schemaVersion', String(SCHEMA_VERSION)], ['revision', String(nextRevision)], ['counts', JSON.stringify(counts)], ['idempotency', JSON.stringify([...keys, idempotencyKey].slice(-100))], ['updatedAt', now]] });
    await this.sheets.spreadsheets.values.batchUpdate({ spreadsheetId: this.spreadsheetId, requestBody: { valueInputOption: 'RAW', data } }); return { revision: nextRevision, duplicate: false };
  }
}
