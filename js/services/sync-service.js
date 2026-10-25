import { mergeDatabases } from '../domain/sync-merge.js';

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
    let candidate = db;
    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const saved = await this.remote.save(candidate);
          const next = { ...candidate, remoteRevision: saved.revision, syncedRevision: Number(candidate.revision || 0) };
          this.lastSync = new Date().toISOString(); this.update('synced'); return next;
        } catch (error) {
          if (error.code !== 'conflict' || attempt === 2) throw error;
          this.update('merging', 'Combinando alterações locais e da nuvem');
          const remote = await this.remote.load();
          candidate = { ...mergeDatabases(candidate, remote.data), revision: Math.max(Number(candidate.revision || 0), Number(remote.data.revision || 0)) + 1, remoteRevision: remote.revision };
        }
      }
    } catch (error) { this.update(error.code === 'conflict' ? 'conflict' : 'error', error.message); throw error; }
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
        : this.local.replace({ ...mergeDatabases(latest, next), revision: latest.revision, remoteRevision: next.remoteRevision, syncedRevision: next.syncedRevision });
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
        this.update('merging', 'Combinando alterações locais e da nuvem');
        const merged = { ...mergeDatabases(localDb, remote.data), revision: Math.max(Number(localDb.revision || 0), Number(remote.data.revision || 0)) + 1, remoteRevision: remote.revision };
        return this.local.replace(await this.push(merged));
      }
      return this.local.replace(await this.push(localDb));
    }
    if (Number(remote.revision || 0) > Number(localDb.remoteRevision || 0)) return this.pull();
    if (Number(remote.revision || 0) === 0 && (localDb.accounts.length || localDb.trades.length || localDb.audit.length)) return this.local.replace(await this.push(localDb));
    this.lastSync = new Date().toISOString(); this.update('synced'); return localDb;
  }
}
