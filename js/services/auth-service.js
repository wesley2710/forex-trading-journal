export class AuthService extends EventTarget {
  constructor(config) { super(); this.config = config; this.user = null; this.auth = null; }

  async initialize() {
    if (!this.config.remoteEnabled || !this.config.firebase) return null;
    const [{ initializeApp }, authModule] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js'),
    ]);
    const { getAuth, onAuthStateChanged } = authModule;
    this.authModule = authModule;
    this.auth = getAuth(initializeApp(this.config.firebase));
    onAuthStateChanged(this.auth, (user) => { this.user = user; this.dispatchEvent(new CustomEvent('change', { detail: user })); });
    return this.auth;
  }

  async signIn() {
    if (!this.auth) throw new Error('Sincronização remota não configurada.');
    const provider = new this.authModule.GoogleAuthProvider();
    return this.authModule.signInWithPopup(this.auth, provider);
  }
  async signOut() { if (this.auth) await this.authModule.signOut(this.auth); }
  async getToken() { if (!this.user) throw new Error('Faça login antes de sincronizar.'); return this.user.getIdToken(); }
}
