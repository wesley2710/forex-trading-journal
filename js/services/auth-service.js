const GOOGLE_IDENTITY_URL = 'https://accounts.google.com/gsi/client';
const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.file',
].join(' ');

function loadGoogleIdentity() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GOOGLE_IDENTITY_URL}"]`);
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', () => reject(new Error('Não foi possível carregar o login Google.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = GOOGLE_IDENTITY_URL;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Não foi possível carregar o login Google.'));
    document.head.append(script);
  });
}

export class AuthService extends EventTarget {
  constructor(config) {
    super();
    this.config = config;
    this.user = null;
    this.accessToken = null;
    this.expiresAt = 0;
    this.tokenClient = null;
  }

  async initialize() {
    if (!this.config.remoteEnabled || !this.config.google?.clientId) return null;
    await loadGoogleIdentity();
    this.tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: this.config.google.clientId,
      scope: GOOGLE_SCOPES,
      include_granted_scopes: true,
      callback: () => {},
    });
    return this.tokenClient;
  }

  requestToken(prompt = 'consent') {
    if (!this.tokenClient) throw new Error('Integração Google não configurada.');
    return new Promise((resolve, reject) => {
      this.tokenClient.callback = (response) => {
        if (response.error) return reject(new Error(response.error_description || 'Login Google cancelado.'));
        this.accessToken = response.access_token;
        this.expiresAt = Date.now() + (Number(response.expires_in || 3600) * 1000) - 60_000;
        resolve(this.accessToken);
      };
      this.tokenClient.error_callback = () => reject(new Error('A janela de login Google foi fechada.'));
      this.tokenClient.requestAccessToken({ prompt });
    });
  }

  async signIn() {
    await this.requestToken('consent');
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { authorization: `Bearer ${this.accessToken}` } });
    if (!response.ok) throw new Error('Não foi possível identificar a conta Google.');
    const profile = await response.json();
    this.user = { id: profile.sub, email: profile.email, name: profile.name || profile.email };
    this.dispatchEvent(new CustomEvent('change', { detail: this.user }));
    return this.user;
  }

  async signOut() {
    const token = this.accessToken;
    this.user = null;
    this.accessToken = null;
    this.expiresAt = 0;
    if (token && window.google?.accounts?.oauth2) await new Promise((resolve) => window.google.accounts.oauth2.revoke(token, resolve));
    this.dispatchEvent(new CustomEvent('change', { detail: null }));
  }

  async getToken() {
    if (!this.user) throw new Error('Conecte sua conta Google antes de sincronizar.');
    if (!this.accessToken || Date.now() >= this.expiresAt) await this.requestToken('');
    return this.accessToken;
  }
}
