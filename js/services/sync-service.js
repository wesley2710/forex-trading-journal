import { mergeDatabases } from '../domain/sync-merge.js';
import { diffDatabases, mergeMutationQueues, removeAcknowledgedMutations } from '../domain/sync-diff.js';

export const MAX_MUTATIONS_PER_PUSH = 250;

export class SyncService extends EventTarget {
  constructor(local, remote) { super(); this.local = local; this.remote = remote; this.status = 'local'; this.lastSync = null; this.timer = null; this.running = false; this.queued = false; }
  update(status, detail = '') { this.status = status; this.dispatchEvent(new CustomEvent('status', { detail: { status, detail, lastSync: this.lastSync } })); }
  async pull() {
    this.update('syncing', 'Baixando dados');
    try { const remote = await this.remote.load(); const db = this.local.replace({ ...remote.data, pendingMutations: [], remoteRevision: remote.revision, syncedRevision: Number(remote.data.revision || 0) }); this.lastSync = new Date().toISOString(); this.update('synced'); return db; }
    catch (error) { this.update('error', error.message); throw error; }
  }
  async push(db) {
    this.update('syncing', 'Enviando dados');
    let candidate = { ...db, pendingMutations: [...(db.pendingMutations || [])] };
    let mutations = candidate.pendingMutations.slice(0, MAX_MUTATIONS_PER_PUSH);
    if (!mutations.length) { this.lastSync = new Date().toISOString(); this.update('synced'); return { ...candidate, syncedRevision: Number(candidate.revision || 0), acknowledgedMutationIds: [] }; }
    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const saved = this.remote.applyChanges
            ? await this.remote.applyChanges(mutations, candidate.remoteRevision, candidate)
            : await this.remote.save(candidate);
          const acknowledgedMutationIds = (saved.fallbackFullSync ? candidate.pendingMutations : mutations).map((mutation) => mutation.id);
          const next = { ...candidate, pendingMutations: removeAcknowledgedMutations(candidate.pendingMutations, acknowledgedMutationIds), remoteRevision: saved.revision, syncedRevision: Number(candidate.revision || 0), acknowledgedMutationIds };
          this.lastSync = new Date().toISOString(); this.update('synced'); return next;
        } catch (error) {
          if (error.code !== 'conflict' || attempt === 2) throw error;
          this.update('merging', 'Combinando alterações locais e da nuvem');
          const remote = await this.remote.load();
          const merged = mergeDatabases(candidate, remote.data);
          const pendingMutations = diffDatabases(remote.data, merged);
          mutations = pendingMutations.slice(0, MAX_MUTATIONS_PER_PUSH);
          candidate = { ...merged, pendingMutations, revision: Math.max(Number(candidate.revision || 0), Number(remote.data.revision || 0)) + 1, remoteRevision: remote.revision };
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
      const acknowledgedMutationIds = next.acknowledgedMutationIds || [];
      delete next.acknowledgedMutationIds;
      const latest = getDatabase();
      let persisted;
      if (Number(latest.revision || 0) === Number(snapshot.revision || 0)) persisted = this.local.replace(next);
      else {
        const merged = mergeDatabases(latest, next);
        const remaining = removeAcknowledgedMutations(latest.pendingMutations, acknowledgedMutationIds);
        const uncovered = diffDatabases(next, merged);
        persisted = this.local.replace({ ...merged, pendingMutations: mergeMutationQueues(remaining, uncovered), revision: latest.revision, remoteRevision: next.remoteRevision, syncedRevision: next.syncedRevision });
      }
      if ((persisted.pendingMutations || []).length) this.queued = true;
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
    const pending = (localDb.pendingMutations || []).length > 0 || Number(localDb.revision || 0) > Number(localDb.syncedRevision || 0);
    if (pending) {
      if (Number(remote.revision || 0) !== Number(localDb.remoteRevision || 0)) {
        this.update('merging', 'Combinando alterações locais e da nuvem');
        const merged = { ...mergeDatabases(localDb, remote.data), revision: Math.max(Number(localDb.revision || 0), Number(remote.data.revision || 0)) + 1, remoteRevision: remote.revision };
        merged.pendingMutations = diffDatabases(remote.data, merged);
        const result = await this.push(merged); delete result.acknowledgedMutationIds; return this.local.replace(result);
      }
      const candidate = { ...localDb, pendingMutations: mergeMutationQueues(localDb.pendingMutations, diffDatabases(remote.data, localDb)) };
      const result = await this.push(candidate); delete result.acknowledgedMutationIds; return this.local.replace(result);
    }
    if (Number(remote.revision || 0) > Number(localDb.remoteRevision || 0)) return this.pull();
    if (Number(remote.revision || 0) === 0 && (localDb.accounts.length || localDb.trades.length || localDb.audit.length)) {
      const candidate = { ...localDb, pendingMutations: diffDatabases(remote.data, localDb) };
      const result = await this.push(candidate); delete result.acknowledgedMutationIds; return this.local.replace(result);
    }
    this.lastSync = new Date().toISOString(); this.update('synced'); return localDb;
  }
}
