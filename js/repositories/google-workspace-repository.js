import { COLLECTIONS, SCHEMA_VERSION } from '../domain/schema.js';

const TABS = { accounts: 'Accounts', phases: 'Phases', trades: 'Trades', cashFlows: 'CashFlows', payouts: 'Payouts', fees: 'Fees', snapshots: 'Snapshots', audit: 'Audit' };
const REMOTE_COLLECTIONS = [...COLLECTIONS, 'audit'];
const HEADERS = ['id', 'version', 'updatedAt', 'payloadJson'];
const REQUIRED_TABS = [...Object.values(TABS), 'Settings', '_meta'];
const META_RANGE = "'_meta'!A1:B4";
const SHEET_MARKER = { key: 'forexTradingJournal', value: 'data-v1' };
const FOLDER_MARKER = { key: 'forexTradingJournal', value: 'screenshots-v1' };
const SHEET_CACHE_KEY = 'forex-journal-google-sheet-id';
const FOLDER_CACHE_KEY = 'forex-journal-google-folder-id';

export const rowFor = (item) => [item.id, Number(item.version || 1), item.updatedAt || new Date().toISOString(), JSON.stringify(item)];
export const itemFromRow = (row) => JSON.parse(row[3]);
const parseMeta = (rows = []) => Object.fromEntries(rows.filter((row) => row.length >= 2));

export class GoogleWorkspaceRepository {
  constructor({ getToken, spreadsheetTitle = 'Forex Trading Journal Data' }) {
    this.getToken = getToken;
    this.spreadsheetTitle = spreadsheetTitle;
    this.spreadsheetId = localStorage.getItem(SHEET_CACHE_KEY) || '';
    this.folderId = localStorage.getItem(FOLDER_CACHE_KEY) || '';
  }

  get spreadsheetUrl() { return this.spreadsheetId ? `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/edit` : ''; }

  async request(url, options = {}) {
    const token = await this.getToken();
    const response = await fetch(url, {
      ...options,
      headers: { authorization: `Bearer ${token}`, ...(options.body && !(options.body instanceof Blob) ? { 'content-type': 'application/json' } : {}), ...options.headers },
    });
    if (response.status === 204) return null;
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error?.message || `Google API retornou ${response.status}.`);
    return payload;
  }

  async findMarkedFile(marker, mimeType) {
    const query = `appProperties has { key='${marker.key}' and value='${marker.value}' } and mimeType='${mimeType}' and trashed=false`;
    const params = new URLSearchParams({ q: query, spaces: 'drive', fields: 'files(id,name)', pageSize: '10' });
    const data = await this.request(`https://www.googleapis.com/drive/v3/files?${params}`);
    return data.files?.[0] || null;
  }

  async markFile(id, marker) {
    await this.request(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id,appProperties`, {
      method: 'PATCH', body: JSON.stringify({ appProperties: { [marker.key]: marker.value } }),
    });
  }

  async verifySpreadsheet(id) {
    try {
      await this.request(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}?fields=spreadsheetId`);
      return true;
    } catch { return false; }
  }

  async verifyFile(id) {
    try { await this.request(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id`); return true; }
    catch { return false; }
  }

  async createSpreadsheet() {
    const sheets = REQUIRED_TABS.map((title) => ({ properties: { title, hidden: title === '_meta' } }));
    const data = await this.request('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST', body: JSON.stringify({ properties: { title: this.spreadsheetTitle }, sheets }),
    });
    await this.markFile(data.spreadsheetId, SHEET_MARKER);
    return data.spreadsheetId;
  }

  async ensureWorkspace() {
    if (this.spreadsheetId && await this.verifySpreadsheet(this.spreadsheetId)) {
      await this.ensureSchema();
      return this.spreadsheetId;
    }
    this.spreadsheetId = '';
    const existing = await this.findMarkedFile(SHEET_MARKER, 'application/vnd.google-apps.spreadsheet');
    this.spreadsheetId = existing?.id || await this.createSpreadsheet();
    localStorage.setItem(SHEET_CACHE_KEY, this.spreadsheetId);
    await this.ensureSchema();
    return this.spreadsheetId;
  }

  async ensureSchema() {
    const book = await this.request(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(this.spreadsheetId)}?fields=sheets.properties`);
    const current = new Set((book.sheets || []).map((sheet) => sheet.properties.title));
    const requests = REQUIRED_TABS.filter((title) => !current.has(title)).map((title) => ({ addSheet: { properties: { title, hidden: title === '_meta' } } }));
    if (requests.length) await this.request(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(this.spreadsheetId)}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests }) });
    const meta = await this.meta();
    const data = Object.values(TABS).map((tab) => ({ range: `'${tab}'!A1:D1`, values: [HEADERS] }));
    data.push({ range: "'Settings'!A1:D1", values: [HEADERS] });
    data.push({ range: META_RANGE, values: [['schemaVersion', String(SCHEMA_VERSION)], ['revision', meta.revision || '0'], ['counts', meta.counts || '{}'], ['updatedAt', meta.updatedAt || new Date(0).toISOString()]] });
    await this.valuesBatchUpdate(data);
  }

  async valuesBatchUpdate(data) {
    return this.request(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(this.spreadsheetId)}/values:batchUpdate`, {
      method: 'POST', body: JSON.stringify({ valueInputOption: 'RAW', data }),
    });
  }

  async meta() {
    const range = encodeURIComponent(META_RANGE);
    try {
      const data = await this.request(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(this.spreadsheetId)}/values/${range}`);
      return parseMeta(data.values);
    } catch { return {}; }
  }

  async load() {
    await this.ensureWorkspace();
    const meta = await this.meta();
    const counts = JSON.parse(meta.counts || '{}');
    const ranges = REMOTE_COLLECTIONS.map((collection) => `'${TABS[collection]}'!A2:D${Math.max(2, Number(counts[collection] || 0) + 1)}`);
    ranges.push("'Settings'!A2:D2");
    const params = new URLSearchParams();
    ranges.forEach((range) => params.append('ranges', range));
    const response = await this.request(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(this.spreadsheetId)}/values:batchGet?${params}`);
    const data = { schemaVersion: SCHEMA_VERSION, revision: 0, settings: {} };
    REMOTE_COLLECTIONS.forEach((collection, index) => { data[collection] = (response.valueRanges?.[index]?.values || []).slice(0, Number(counts[collection] || 0)).map(itemFromRow); });
    const settingsRow = response.valueRanges?.at(-1)?.values?.[0];
    if (settingsRow) { const { id, version, updatedAt, ...settings } = itemFromRow(settingsRow); data.settings = settings; }
    return { data, revision: Number(meta.revision || 0), updatedAt: meta.updatedAt || null };
  }

  async save(snapshot) {
    await this.ensureWorkspace();
    const meta = await this.meta();
    const revision = Number(meta.revision || 0);
    const expectedRevision = Number(snapshot.remoteRevision || 0);
    if (expectedRevision !== revision) throw Object.assign(new Error('A planilha mudou desde a última sincronização. Baixe a versão remota antes de enviar.'), { code: 'conflict', detail: { revision } });
    const nextRevision = revision + 1;
    const now = new Date().toISOString();
    const next = { ...snapshot, audit: [...snapshot.audit, { id: crypto.randomUUID(), action: 'sheets.sync', collection: '*', at: now, version: 1 }].slice(-1000) };
    const counts = Object.fromEntries(REMOTE_COLLECTIONS.map((collection) => [collection, next[collection].length]));
    const data = REMOTE_COLLECTIONS.map((collection) => ({ range: `'${TABS[collection]}'!A1:D${Math.max(1, next[collection].length + 1)}`, values: [HEADERS, ...next[collection].map(rowFor)] }));
    data.push({ range: "'Settings'!A1:D2", values: [HEADERS, rowFor({ ...next.settings, id: 'settings', version: nextRevision, updatedAt: now })] });
    data.push({ range: META_RANGE, values: [['schemaVersion', String(SCHEMA_VERSION)], ['revision', String(nextRevision)], ['counts', JSON.stringify(counts)], ['updatedAt', now]] });
    await this.valuesBatchUpdate(data);
    return { revision: nextRevision };
  }

  async ensureScreenshotFolder() {
    if (this.folderId && await this.verifyFile(this.folderId)) return this.folderId;
    this.folderId = '';
    const existing = await this.findMarkedFile(FOLDER_MARKER, 'application/vnd.google-apps.folder');
    if (existing) this.folderId = existing.id;
    else {
      const folder = await this.request('https://www.googleapis.com/drive/v3/files?fields=id', {
        method: 'POST', body: JSON.stringify({ name: 'Forex Trading Journal - Prints', mimeType: 'application/vnd.google-apps.folder', appProperties: { [FOLDER_MARKER.key]: FOLDER_MARKER.value } }),
      });
      this.folderId = folder.id;
    }
    localStorage.setItem(FOLDER_CACHE_KEY, this.folderId);
    return this.folderId;
  }

  async uploadScreenshots(files, tradeId) {
    const folderId = await this.ensureScreenshotFolder();
    const output = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) throw new Error(`${file.name} não é uma imagem.`);
      if (file.size > 8 * 1024 * 1024) throw new Error(`${file.name} excede o limite de 8 MB.`);
      const boundary = `forex-journal-${crypto.randomUUID()}`;
      const metadata = JSON.stringify({ name: `${tradeId}-${file.name}`, parents: [folderId], appProperties: { forexTradeId: tradeId } });
      const body = new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${file.type}\r\n\r\n`, file, `\r\n--${boundary}--`], { type: `multipart/related; boundary=${boundary}` });
      const uploaded = await this.request('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size', { method: 'POST', body, headers: { 'content-type': `multipart/related; boundary=${boundary}` } });
      output.push({ id: uploaded.id, name: file.name, mimeType: uploaded.mimeType || file.type, size: Number(uploaded.size || file.size) });
    }
    return output;
  }

  async loadScreenshot(fileId) {
    const token = await this.getToken();
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, { headers: { authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error('Não foi possível carregar o print.');
    return response.blob();
  }

  async deleteScreenshot(fileId) {
    await this.request(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, { method: 'DELETE' });
  }
}
