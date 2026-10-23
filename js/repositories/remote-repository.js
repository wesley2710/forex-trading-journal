const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export class RemoteRepository {
  constructor({ baseUrl, getToken, retries = 3 }) { this.baseUrl = baseUrl.replace(/\/$/, ''); this.getToken = getToken; this.retries = retries; }

  async request(path, options = {}) {
    let lastError;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      try {
        const token = await this.getToken();
        const response = await fetch(`${this.baseUrl}${path}`, {
          ...options,
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...options.headers },
        });
        if (response.status === 409) { const detail = await response.json(); throw Object.assign(new Error('Conflito de versão.'), { code: 'conflict', detail }); }
        if (!response.ok) throw Object.assign(new Error(`Erro remoto ${response.status}.`), { retryable: response.status === 429 || response.status >= 500 });
        return response.status === 204 ? null : response.json();
      } catch (error) {
        lastError = error;
        if (error.code === 'conflict' || error.retryable === false || attempt === this.retries) break;
        await wait((2 ** attempt * 350) + Math.random() * 150);
      }
    }
    throw lastError;
  }

  load() { return this.request('/v1/snapshot'); }
  save(db) {
    return this.request('/v1/snapshot', { method: 'PUT', headers: { 'x-idempotency-key': crypto.randomUUID(), 'if-match': String(db.remoteRevision || 0) }, body: JSON.stringify({ ...db, remoteRevision: undefined }) });
  }
}
