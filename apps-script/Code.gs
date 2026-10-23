const FOREX_TOKEN_PROPERTY = 'FOREX_JOURNAL_TOKEN';
const FOREX_FOLDER_PROPERTY = 'FOREX_JOURNAL_FOLDER_ID';
const FOREX_SCHEMA_VERSION = 3;
const FOREX_MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const FOREX_ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const FOREX_HEADERS = ['id', 'version', 'updatedAt', 'payloadJson'];
const FOREX_TABS = {
  accounts: 'Accounts', phases: 'Phases', trades: 'Trades', cashFlows: 'CashFlows',
  payouts: 'Payouts', fees: 'Fees', snapshots: 'Snapshots', audit: 'Audit'
};
const FOREX_COLLECTIONS = Object.keys(FOREX_TABS);

function doGet() {
  return forexJson_({ ok: true, service: 'Forex Trading Journal Sync', version: 1 });
}

function doPost(event) {
  try {
    const request = JSON.parse((event && event.postData && event.postData.contents) || '{}');
    forexAuthorize_(request.token);
    const action = String(request.action || '');
    let data;
    if (action === 'load') data = forexLoad_();
    else if (action === 'save') data = forexSave_(request.snapshot, request.expectedRevision);
    else if (action === 'uploadScreenshot') data = forexUploadScreenshot_(request.tradeId, request.file);
    else if (action === 'loadScreenshot') data = forexLoadScreenshot_(request.fileId);
    else if (action === 'deleteScreenshot') data = forexDeleteScreenshot_(request.fileId);
    else throw forexError_('INVALID_ACTION', 'Ação inválida.');
    return forexJson_({ ok: true, data: data, spreadsheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl() });
  } catch (error) {
    const normalized = forexNormalizeError_(error);
    return forexJson_({ ok: false, code: normalized.code, error: normalized.message, detail: normalized.detail || null });
  }
}

function forexAuthorize_(received) {
  const expected = PropertiesService.getScriptProperties().getProperty(FOREX_TOKEN_PROPERTY);
  if (!expected) throw forexError_('AUTH_NOT_CONFIGURED', 'O segredo do Apps Script ainda não foi configurado.');
  if (!forexSafeEqual_(String(received || ''), expected)) throw forexError_('UNAUTHORIZED', 'Segredo inválido.');
}

function forexSafeEqual_(left, right) {
  const a = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, left);
  const b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, right);
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

function forexError_(code, message, detail) {
  const error = new Error(message);
  error.forexCode = code;
  error.forexDetail = detail || null;
  return error;
}

function forexNormalizeError_(error) {
  return {
    code: error && error.forexCode ? error.forexCode : 'SERVER_ERROR',
    message: String((error && error.message) || error || 'Erro interno.'),
    detail: error && error.forexDetail ? error.forexDetail : null
  };
}

function forexJson_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function forexEnsureSchema_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const names = Object.values(FOREX_TABS).concat(['Settings', '_meta']);
  names.forEach(function(name) {
    let sheet = spreadsheet.getSheetByName(name);
    if (!sheet) sheet = spreadsheet.insertSheet(name);
    if (name === '_meta' && !sheet.isSheetHidden()) sheet.hideSheet();
  });
  FOREX_COLLECTIONS.forEach(function(collection) {
    const sheet = spreadsheet.getSheetByName(FOREX_TABS[collection]);
    if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, FOREX_HEADERS.length).setValues([FOREX_HEADERS]);
  });
  const settings = spreadsheet.getSheetByName('Settings');
  if (settings.getLastRow() === 0) settings.getRange(1, 1, 1, FOREX_HEADERS.length).setValues([FOREX_HEADERS]);
  const meta = spreadsheet.getSheetByName('_meta');
  if (meta.getLastRow() < 4) {
    meta.getRange(1, 1, 4, 2).setValues([
      ['schemaVersion', String(FOREX_SCHEMA_VERSION)], ['revision', '0'], ['counts', '{}'], ['updatedAt', new Date(0).toISOString()]
    ]);
  }
  return spreadsheet;
}

function forexMeta_() {
  const spreadsheet = forexEnsureSchema_();
  const rows = spreadsheet.getSheetByName('_meta').getRange(1, 1, 4, 2).getValues();
  const result = {};
  rows.forEach(function(row) { if (row[0]) result[String(row[0])] = String(row[1] || ''); });
  return result;
}

function forexReadCollection_(sheet) {
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, FOREX_HEADERS.length).getValues()
    .filter(function(row) { return row[0] && row[3]; })
    .map(function(row) { return JSON.parse(String(row[3])); });
}

function forexLoad_() {
  const spreadsheet = forexEnsureSchema_();
  const meta = forexMeta_();
  const revision = Number(meta.revision || 0);
  const data = { schemaVersion: FOREX_SCHEMA_VERSION, revision: revision, accounts: [], phases: [], trades: [], cashFlows: [], payouts: [], fees: [], snapshots: [], settings: {}, audit: [] };
  FOREX_COLLECTIONS.forEach(function(collection) {
    data[collection] = forexReadCollection_(spreadsheet.getSheetByName(FOREX_TABS[collection]));
  });
  const settingsRows = forexReadCollection_(spreadsheet.getSheetByName('Settings'));
  if (settingsRows[0]) {
    const stored = settingsRows[0];
    Object.keys(stored).forEach(function(key) {
      if (!['id', 'version', 'updatedAt'].includes(key)) data.settings[key] = stored[key];
    });
  }
  return { data: data, revision: revision, updatedAt: meta.updatedAt || null };
}

function forexValidateSnapshot_(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') throw forexError_('INVALID_DATA', 'Snapshot ausente.');
  if (Number(snapshot.schemaVersion) !== FOREX_SCHEMA_VERSION) throw forexError_('INVALID_SCHEMA', 'Versão de dados incompatível.');
  FOREX_COLLECTIONS.forEach(function(collection) {
    if (!Array.isArray(snapshot[collection])) throw forexError_('INVALID_DATA', 'Coleção inválida: ' + collection + '.');
  });
  if (!snapshot.settings || typeof snapshot.settings !== 'object' || Array.isArray(snapshot.settings)) throw forexError_('INVALID_DATA', 'Configurações inválidas.');
  if (JSON.stringify(snapshot).length > 8 * 1024 * 1024) throw forexError_('PAYLOAD_TOO_LARGE', 'O conjunto de dados excede 8 MB.');
}

function forexRow_(item) {
  return [String(item.id || ''), Number(item.version || 1), String(item.updatedAt || new Date().toISOString()), JSON.stringify(item)];
}

function forexWriteRows_(sheet, rows) {
  sheet.clearContents();
  const values = [FOREX_HEADERS].concat(rows);
  sheet.getRange(1, 1, values.length, FOREX_HEADERS.length).setValues(values);
  sheet.setFrozenRows(1);
}

function forexSave_(snapshot, expectedRevision) {
  forexValidateSnapshot_(snapshot);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const spreadsheet = forexEnsureSchema_();
    const meta = forexMeta_();
    const currentRevision = Number(meta.revision || 0);
    if (Number(expectedRevision || 0) !== currentRevision) {
      throw forexError_('conflict', 'A planilha mudou desde a última sincronização.', { revision: currentRevision });
    }
    const nextRevision = currentRevision + 1;
    const now = new Date().toISOString();
    const counts = {};
    FOREX_COLLECTIONS.forEach(function(collection) {
      counts[collection] = snapshot[collection].length;
      forexWriteRows_(spreadsheet.getSheetByName(FOREX_TABS[collection]), snapshot[collection].map(forexRow_));
    });
    forexWriteRows_(spreadsheet.getSheetByName('Settings'), [forexRow_(Object.assign({}, snapshot.settings, { id: 'settings', version: nextRevision, updatedAt: now }))]);
    spreadsheet.getSheetByName('_meta').getRange(1, 1, 4, 2).setValues([
      ['schemaVersion', String(FOREX_SCHEMA_VERSION)], ['revision', String(nextRevision)], ['counts', JSON.stringify(counts)], ['updatedAt', now]
    ]);
    SpreadsheetApp.flush();
    return { revision: nextRevision, updatedAt: now };
  } finally {
    lock.releaseLock();
  }
}

function forexDriveRequest_(url, options) {
  const settings = Object.assign({ muteHttpExceptions: true }, options || {});
  settings.headers = Object.assign({}, settings.headers || {}, { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() });
  const response = UrlFetchApp.fetch(url, settings);
  const status = response.getResponseCode();
  if (status < 200 || status >= 300) throw forexError_('DRIVE_ERROR', 'O Google Drive retornou HTTP ' + status + '.');
  return response;
}

function forexDriveJson_(url, options) {
  const response = forexDriveRequest_(url, options);
  const text = response.getContentText();
  return text ? JSON.parse(text) : {};
}

function forexEnsureFolder_() {
  const properties = PropertiesService.getScriptProperties();
  const cached = properties.getProperty(FOREX_FOLDER_PROPERTY);
  if (cached) {
    try {
      const item = forexDriveJson_('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(cached) + '?fields=id,mimeType,trashed');
      if (!item.trashed && item.mimeType === 'application/vnd.google-apps.folder') return cached;
    } catch (ignored) { properties.deleteProperty(FOREX_FOLDER_PROPERTY); }
  }
  const created = forexDriveJson_('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify({ name: 'Forex Trading Journal - Prints', mimeType: 'application/vnd.google-apps.folder', appProperties: { forexTradingJournal: 'screenshots-v1' } })
  });
  properties.setProperty(FOREX_FOLDER_PROPERTY, created.id);
  return created.id;
}

function forexValidateFileId_(fileId) {
  const normalized = String(fileId || '');
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(normalized)) throw forexError_('INVALID_FILE', 'Identificador de arquivo inválido.');
  return normalized;
}

function forexFileMetadata_(fileId) {
  const id = forexValidateFileId_(fileId);
  const metadata = forexDriveJson_('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id) + '?fields=id,name,mimeType,size,parents,trashed');
  const folderId = forexEnsureFolder_();
  if (metadata.trashed || !Array.isArray(metadata.parents) || metadata.parents.indexOf(folderId) < 0) throw forexError_('FORBIDDEN_FILE', 'Este arquivo não pertence à pasta do diário.');
  return metadata;
}

function forexUploadScreenshot_(tradeId, file) {
  const safeTradeId = String(tradeId || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 100);
  const originalName = String((file && file.name) || 'print').replace(/[\\/:*?"<>|\r\n]/g, '_').slice(0, 160);
  const mimeType = String((file && file.mimeType) || '').toLowerCase();
  if (!safeTradeId) throw forexError_('INVALID_TRADE', 'Operação inválida.');
  if (FOREX_ALLOWED_IMAGE_TYPES.indexOf(mimeType) < 0) throw forexError_('INVALID_IMAGE', 'Formato de imagem não permitido.');
  const base64 = String((file && file.base64) || '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length > 12 * 1024 * 1024) throw forexError_('INVALID_IMAGE', 'Conteúdo da imagem inválido.');
  const bytes = Utilities.base64Decode(base64);
  if (!bytes.length || bytes.length > FOREX_MAX_IMAGE_BYTES) throw forexError_('IMAGE_TOO_LARGE', 'O print deve ter no máximo 8 MB.');
  const folderId = forexEnsureFolder_();
  const metadata = forexDriveJson_('https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,size,parents', {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify({ name: safeTradeId + '-' + originalName, mimeType: mimeType, parents: [folderId], appProperties: { forexTradeId: safeTradeId } })
  });
  try {
    forexDriveRequest_('https://www.googleapis.com/upload/drive/v3/files/' + encodeURIComponent(metadata.id) + '?uploadType=media&fields=id,name,mimeType,size', {
      method: 'patch', contentType: mimeType, payload: bytes
    });
  } catch (error) {
    try { forexDriveRequest_('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(metadata.id), { method: 'delete' }); } catch (ignored) {}
    throw error;
  }
  return { id: metadata.id, name: originalName, mimeType: mimeType, size: bytes.length };
}

function forexLoadScreenshot_(fileId) {
  const metadata = forexFileMetadata_(fileId);
  if (Number(metadata.size || 0) > FOREX_MAX_IMAGE_BYTES) throw forexError_('IMAGE_TOO_LARGE', 'O print excede o limite de leitura.');
  const response = forexDriveRequest_('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(metadata.id) + '?alt=media');
  return { id: metadata.id, name: metadata.name, mimeType: metadata.mimeType, size: Number(metadata.size || 0), base64: Utilities.base64Encode(response.getContent()) };
}

function forexDeleteScreenshot_(fileId) {
  const metadata = forexFileMetadata_(fileId);
  forexDriveRequest_('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(metadata.id), { method: 'delete' });
  return { deleted: true, id: metadata.id };
}
