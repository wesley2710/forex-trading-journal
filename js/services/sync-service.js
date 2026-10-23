export class SyncService extends EventTarget {
  constructor(local, remote) { super(); this.local = local; this.remote = remote; this.status = 'local'; this.lastSync = null; this.timer = null; this.running = false; this.queued = false; }
  update(status, detail = '') { this.status = status; this.dispatchEvent(new CustomEvent('status', { detail: { status, detail, lastSync: this.lastSync } })); }
  async pull() {
    this.update('syncing', 'Baixando dados');
    try { const remote = await this.remote.load(); const db = this.local.replace({ ...remote.data, remoteRevision: remote.revision, syncedRevision: Number(remote.data.revision || 0) }); this.lastSync = new Date().toISOString(); this.update('synced'); return db; }
    catch (error) { this.update('error', error.message); throw error; }
  }
  async push(db) {
    this.update('syncing', 'Enviando dados');
    try { const remote = await this.remote.save(db); const next = { ...db, remoteRevision: remote.revision, syncedRevision: Number(db.revision || 0) }; this.lastSync = new Date().toISOString(); this.update('synced'); return next; }
    catch (error) { this.update(error.code === 'conflict' ? 'conflict' : 'error', error.message); throw error; }
  }

  schedule(getDatabase, onSynced, delay = 900) {
    clearTimeout(this.timer);
    this.update('pending', 'Alterações salvas localmente');
    this.timer = setTimeout(() => this.flush(getDatabase, onSynced).catch(() => {}), delay);
  }

  async flush(getDatabase, onSynced) {
    clearTimeout(this.timer); this.timer = null;
    if (this.running) { this.queued = true; return null; }
    this.running = true;
    try {
      const snapshot = getDatabase();
      const next = await this.push(snapshot);
      const latest = getDatabase();
      const persisted = Number(latest.revision || 0) === Number(snapshot.revision || 0)
        ? this.local.replace(next)
        : this.local.replace({ ...latest, remoteRevision: next.remoteRevision, syncedRevision: next.syncedRevision });
      if (persisted !== next) this.queued = true;
      onSynced(persisted);
      return persisted;
    } finally {
      this.running = false;
      if (this.queued) { this.queued = false; this.schedule(getDatabase, onSynced, 120); }
    }
  }

  async bootstrap(localDb) {
    this.update('syncing', 'Conferindo a nuvem');
    const remote = await this.remote.load();
    const pending = Number(localDb.revision || 0) > Number(localDb.syncedRevision || 0);
    if (pending) {
      if (Number(remote.revision || 0) !== Number(localDb.remoteRevision || 0)) {
        const error = Object.assign(new Error('Existem alterações locais e remotas. Escolha qual versão manter em Configurações.'), { code: 'conflict' });
        this.update('conflict', error.message); throw error;
      }
      return this.local.replace(await this.push(localDb));
    }
    if (Number(remote.revision || 0) > Number(localDb.remoteRevision || 0)) return this.pull();
    if (Number(remote.revision || 0) === 0 && (localDb.accounts.length || localDb.trades.length || localDb.audit.length)) return this.local.replace(await this.push(localDb));
    this.lastSync = new Date().toISOString(); this.update('synced'); return localDb;
  }
}
