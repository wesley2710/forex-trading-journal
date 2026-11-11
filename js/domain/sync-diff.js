import { COLLECTIONS } from './schema.js';

export const SYNC_COLLECTIONS = [...COLLECTIONS, 'audit'];

const mutationId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const stable = (value) => JSON.stringify(value);
const clone = (value) => globalThis.structuredClone ? structuredClone(value) : JSON.parse(JSON.stringify(value));
const mutationKey = (mutation) => `${mutation.collection}:${mutation.recordId}`;

function createMutation(collection, type, recordId, record) {
  return { id: mutationId(), collection, type, recordId, ...(record ? { record: clone(record) } : {}), createdAt: new Date().toISOString() };
}

export function diffDatabases(base = {}, target = {}) {
  const mutations = [];
  for (const collection of SYNC_COLLECTIONS) {
    const before = new Map((base[collection] || []).filter((item) => item?.id).map((item) => [item.id, item]));
    const after = new Map((target[collection] || []).filter((item) => item?.id).map((item) => [item.id, item]));
    for (const [id, record] of after) if (!before.has(id) || stable(before.get(id)) !== stable(record)) mutations.push(createMutation(collection, 'upsert', id, record));
    for (const id of before.keys()) if (!after.has(id)) mutations.push(createMutation(collection, 'delete', id));
  }
  if (stable(base.settings || {}) !== stable(target.settings || {})) mutations.push(createMutation('settings', 'upsert', 'settings', target.settings || {}));
  return mutations;
}

export function mergeMutationQueues(current = [], incoming = []) {
  const merged = new Map();
  for (const mutation of [...current, ...incoming]) if (mutation?.collection && mutation?.recordId) merged.set(mutationKey(mutation), mutation);
  return [...merged.values()].sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
}

export function removeAcknowledgedMutations(queue = [], acknowledgedIds = []) {
  const ids = new Set(acknowledgedIds);
  return queue.filter((mutation) => !ids.has(mutation.id));
}
