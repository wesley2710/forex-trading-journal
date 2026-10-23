const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024;

function encodeBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export class AppsScriptRepository {
  constructor({ endpoint, getToken, spreadsheetUrl = '' }) {
    this.endpoint = endpoint;
    this.getToken = getToken;
    this.spreadsheetUrl = spreadsheetUrl;
  }

  async request(action, data = {}) {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'text/plain;charset=utf-8' },
      redirect: 'follow',
      body: JSON.stringify({ action, token: this.getToken(), ...data }),
    });
    if (!response.ok) throw new Error(`O serviço de sincronização retornou HTTP ${response.status}.`);
    const payload = await response.json().catch(() => null);
    if (!payload?.ok) {
      const error = new Error(payload?.error || 'Resposta inválida do serviço de sincronização.');
      error.code = payload?.code || 'remote-error';
      error.detail = payload?.detail;
      throw error;
    }
    if (payload.spreadsheetUrl) this.spreadsheetUrl = payload.spreadsheetUrl;
    return payload.data;
  }

  load() { return this.request('load'); }

  save(snapshot) {
    return this.request('save', {
      expectedRevision: Number(snapshot.remoteRevision || 0),
      snapshot,
    });
  }

  async uploadScreenshots(files, tradeId) {
    const output = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) throw new Error(`${file.name} não é uma imagem.`);
      if (file.size > MAX_SCREENSHOT_BYTES) throw new Error(`${file.name} excede o limite de 8 MB.`);
      const result = await this.request('uploadScreenshot', {
        tradeId,
        file: {
          name: file.name,
          mimeType: file.type,
          size: file.size,
          base64: encodeBase64(await file.arrayBuffer()),
        },
      });
      output.push(result);
    }
    return output;
  }

  async loadScreenshot(fileId) {
    const result = await this.request('loadScreenshot', { fileId });
    return new Blob([decodeBase64(result.base64)], { type: result.mimeType || 'application/octet-stream' });
  }

  deleteScreenshot(fileId) { return this.request('deleteScreenshot', { fileId }); }
}

export { decodeBase64, encodeBase64, MAX_SCREENSHOT_BYTES };
