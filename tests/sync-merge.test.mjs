import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDatabase } from '../js/domain/schema.js';
import { markDeleted, mergeDatabases } from '../js/domain/sync-merge.js';
import { SyncService } from '../js/services/sync-service.js';

const account = (id, updatedAt, name = id) => ({ id, name, firm: '', status: 'Ativa', archived: false, initialBalanceCents: 10000000, profitTargetCents: 0, dailyLossLimitCents: 0, maxLossLimitCents: 0, drawdownType: 'static', lossBasis: 'balance', timezone: 'UTC', rolloverTime: '00:00', profitSplit: 80, createdAt: updatedAt, updatedAt, version: 1 });
const trade = (id, accountId, updatedAt) => ({ id, accountId, closedDate: '2026-10-25', symbol: 'EUR/USD', strategy: '', notes: '', riskCents: 10000, netPnlCents: 10000, screenshots: [], createdAt: updatedAt, updatedAt, version: 1 });
const database = (overrides = {}) => ({ ...emptyDatabase(), ...overrides });

test('combinação preserva registros diferentes criados localmente e na nuvem', () => {
  const local = database({ accounts: [account('local', '2026-10-25T10:00:00Z')] });
  const remote = database({ accounts: [account('remote', '2026-10-25T10:01:00Z')] });
  const merged = mergeDatabases(local, remote);
  assert.deepEqual(merged.accounts.map((item) => item.id).sort(), ['local', 'remote']);
});

test('edição mais recente vence apenas para o mesmo registro', () => {
  const local = database({ accounts: [account('a', '2026-10-25T10:02:00Z', 'Nome local')] });
  const remote = database({ accounts: [account('a', '2026-10-25T10:01:00Z', 'Nome remoto')] });
  assert.equal(mergeDatabases(local, remote).accounts[0].name, 'Nome local');
});

test('exclusão sincronizada impede que registro antigo reapareça', () => {
  const local = database({ accounts: [account('a', '2026-10-25T10:00:00Z')] });
  const remote = database({ accounts: [account('a', '2026-10-25T10:00:00Z')], trades: [trade('t', 'a', '2026-10-25T10:01:00Z')] });
  markDeleted(local, 'trades', 't', '2026-10-25T10:02:00Z');
  assert.equal(mergeDatabases(local, remote).trades.length, 0);
});

test('registro de exclusão não sobrescreve cadastros mais novos da nuvem', () => {
  const local = database({ settings: { symbols: ['EUR/USD'], syncUpdatedAt: '2026-10-25T10:00:00Z' } });
  const remote = database({ settings: { symbols: ['EUR/USD', 'XAU/USD'], syncUpdatedAt: '2026-10-25T10:02:00Z' } });
  markDeleted(local, 'trades', 't', '2026-10-25T10:03:00Z');
  const merged = mergeDatabases(local, remote);
  assert.deepEqual(merged.settings.symbols, ['EUR/USD', 'XAU/USD']);
  assert.equal(merged.settings.syncTombstones[0].id, 't');
});

test('serviço resolve conflito remoto combinando e reenviando os dados', async () => {
  const localDb = database({ revision: 2, remoteRevision: 1, syncedRevision: 1, accounts: [account('local', '2026-10-25T10:00:00Z')] });
  const remoteDb = database({ revision: 4, accounts: [account('remote', '2026-10-25T10:01:00Z')] });
  let saves = 0; let uploaded;
  const remote = {
    async save(snapshot) { saves += 1; if (saves === 1) throw Object.assign(new Error('conflito'), { code: 'conflict' }); uploaded = snapshot; return { revision: 6 }; },
    async load() { return { data: remoteDb, revision: 5 }; },
  };
  const local = { replace(value) { return value; } };
  const result = await new SyncService(local, remote).push(localDb);
  assert.equal(saves, 2);
  assert.deepEqual(uploaded.accounts.map((item) => item.id).sort(), ['local', 'remote']);
  assert.equal(uploaded.remoteRevision, 5);
  assert.equal(result.remoteRevision, 6);
  assert.equal(result.syncedRevision, uploaded.revision);
});

test('bootstrap combina alterações pendentes com uma revisão remota nova', async () => {
  const localDb = database({ revision: 3, remoteRevision: 1, syncedRevision: 2, accounts: [account('local', '2026-10-25T10:00:00Z')] });
  const remoteDb = database({ revision: 8, accounts: [account('remote', '2026-10-25T10:01:00Z')] });
  let uploaded;
  const remote = { async load() { return { data: remoteDb, revision: 7 }; }, async save(snapshot) { uploaded = snapshot; return { revision: 8 }; } };
  const local = { replace(value) { return value; } };
  const result = await new SyncService(local, remote).bootstrap(localDb);
  assert.deepEqual(result.accounts.map((item) => item.id).sort(), ['local', 'remote']);
  assert.equal(uploaded.remoteRevision, 7);
  assert.equal(result.remoteRevision, 8);
});
