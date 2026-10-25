import { COLLECTIONS } from './schema.js';

const TOMBSTONES_KEY = 'syncTombstones';
const SETTINGS_UPDATED_KEY = 'syncUpdatedAt';

const timestamp = (item = {}) => String(item.updatedAt || item.createdAt || '');
const version = (item = {}) => Number(item.version || 0);
const keyOf = (item) => `${item.collection}:${item.id}`;

function newer(left, right) {
  const leftTime = timestamp(left); const rightTime = timestamp(right);
  if (leftTime && rightTime && leftTime !== rightTime) return leftTime > rightTime ? left : right;
  if (version(left) !== version(right)) return version(left) > version(right) ? left : right;
  if (leftTime !== rightTime) return leftTime > rightTime ? left : right;
  return left;
}

function mergeTombstones(local = [], remote = []) {
  const merged = new Map();
  for (const item of [...remote, ...local]) {
    if (!item?.collection || !item?.id || !item?.deletedAt) continue;
    const key = keyOf(item); const current = merged.get(key);
    if (!current || item.deletedAt >= current.deletedAt) merged.set(key, item);
  }
  return [...merged.values()].sort((a, b) => a.deletedAt.localeCompare(b.deletedAt)).slice(-1000);
}

function mergeCollection(local = [], remote = [], collection, tombstones) {
  const records = new Map();
  for (const item of remote) if (item?.id) records.set(item.id, item);
  for (const item of local) if (item?.id) records.set(item.id, records.has(item.id) ? newer(item, records.get(item.id)) : item);
  return [...records.values()].filter((item) => {
    const deleted = tombstones.get(`${collection}:${item.id}`);
    return !deleted || deleted.deletedAt < timestamp(item);
  });
}

function mergeSettings(local = {}, remote = {}, tombstones) {
  const localTime = String(local[SETTINGS_UPDATED_KEY] || ''); const remoteTime = String(remote[SETTINGS_UPDATED_KEY] || '');
  const primary = localTime >= remoteTime ? local : remote; const secondary = primary === local ? remote : local;
  return { ...secondary, ...primary, [TOMBSTONES_KEY]: tombstones, [SETTINGS_UPDATED_KEY]: localTime >= remoteTime ? localTime : remoteTime };
}

export function mergeDatabases(local, remote) {
  const tombstoneItems = mergeTombstones(local?.settings?.[TOMBSTONES_KEY], remote?.settings?.[TOMBSTONES_KEY]);
  const tombstones = new Map(tombstoneItems.map((item) => [keyOf(item), item]));
  const output = { ...remote, ...local };
  for (const collection of COLLECTIONS) output[collection] = mergeCollection(local?.[collection], remote?.[collection], collection, tombstones);
  output.audit = mergeCollection(local?.audit, remote?.audit, 'audit', new Map())
    .sort((a, b) => String(a.at || '').localeCompare(String(b.at || ''))).slice(-500);
  output.settings = mergeSettings(local?.settings, remote?.settings, tombstoneItems);
  return output;
}

export function markDeleted(db, collection, id, deletedAt = new Date().toISOString()) {
  if (!COLLECTIONS.includes(collection)) throw new Error('Coleção inválida para exclusão sincronizada.');
  const tombstones = mergeTombstones(db.settings?.[TOMBSTONES_KEY], [{ collection, id, deletedAt }]);
  db.settings = { ...(db.settings || {}), [TOMBSTONES_KEY]: tombstones };
}

export function touchSettings(db, updatedAt = new Date().toISOString()) {
  db.settings = { ...(db.settings || {}), [SETTINGS_UPDATED_KEY]: updatedAt };
}

export { SETTINGS_UPDATED_KEY, TOMBSTONES_KEY };
