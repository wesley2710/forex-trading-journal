export class SyncService extends EventTarget {
  constructor(local, remote) { super(); this.local = local; this.remote = remote; this.status = 'local'; this.lastSync = null; }
  update(status, detail = '') { this.status = status; this.dispatchEvent(new CustomEvent('status', { detail: { status, detail, lastSync: this.lastSync } })); }
  async pull() {
    this.update('syncing', 'Baixando dados');
    try { const remote = await this.remote.load(); const db = this.local.replace({ ...remote.data, remoteRevision: remote.revision }); this.lastSync = new Date().toISOString(); this.update('synced'); return db; }
    catch (error) { this.update('error', error.message); throw error; }
  }
  async push(db) {
    this.update('syncing', 'Enviando dados');
    try { const remote = await this.remote.save(db); const next = this.local.replace({ ...db, remoteRevision: remote.revision }); this.lastSync = new Date().toISOString(); this.update('synced'); return next; }
    catch (error) { this.update(error.code === 'conflict' ? 'conflict' : 'error', error.message); throw error; }
  }
}
