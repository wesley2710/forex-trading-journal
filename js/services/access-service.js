const TOKEN_KEY = 'forex-journal-apps-script-token-v1';

export class AccessService extends EventTarget {
  constructor(config) {
    super();
    this.config = config;
    this.token = localStorage.getItem(TOKEN_KEY) || '';
  }

  get configured() {
    return Boolean(this.config.remoteEnabled && /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(this.config.appsScript?.endpoint || ''));
  }

  get connected() { return this.configured && this.token.length >= 32; }

  setToken(token) {
    const normalized = String(token || '').trim();
    if (normalized.length < 32) throw new Error('O segredo precisa ter pelo menos 32 caracteres.');
    localStorage.setItem(TOKEN_KEY, normalized);
    this.token = normalized;
    this.dispatchEvent(new CustomEvent('change', { detail: true }));
  }

  clear() {
    localStorage.removeItem(TOKEN_KEY);
    this.token = '';
    this.dispatchEvent(new CustomEvent('change', { detail: false }));
  }

  getToken() {
    if (!this.connected) throw new Error('Configure o acesso automático antes de sincronizar.');
    return this.token;
  }
}
