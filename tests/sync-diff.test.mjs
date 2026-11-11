import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDatabase } from '../js/domain/schema.js';
import { diffDatabases, mergeMutationQueues, removeAcknowledgedMutations } from '../js/domain/sync-diff.js';
import { MAX_MUTATIONS_PER_PUSH, SyncService } from '../js/services/sync-service.js';

const account = (id, name, updatedAt) => ({ id, name, updatedAt, version: 1 });

test('diff envia somente registros incluídos, alterados ou excluídos', () => {
  const base = { ...emptyDatabase(), accounts: [
    account('same', 'Igual', '2026-11-11T10:00:00Z'),
    account('edit', 'Antes', '2026-11-11T10:00:00Z'),
    account('delete', 'Excluir', '2026-11-11T10:00:00Z'),
  ] };
  const target = { ...base, accounts: [
    base.accounts[0],
    account('edit', 'Depois', '2026-11-11T10:01:00Z'),
    account('new', 'Nova', '2026-11-11T10:01:00Z'),
  ] };
  const changes = diffDatabases(base, target);
  assert.deepEqual(changes.map((item) => `${item.type}:${item.recordId}`).sort(), ['delete:delete', 'upsert:edit', 'upsert:new']);
  assert.equal(changes.some((item) => item.recordId === 'same'), false);
});

test('fila mantém somente a alteração mais recente de cada registro', () => {
  const before = { ...emptyDatabase(), accounts: [account('a', 'Antes', '2026-11-11T10:00:00Z')] };
  const middle = { ...before, accounts: [account('a', 'Meio', '2026-11-11T10:01:00Z')] };
  const after = { ...before, accounts: [account('a', 'Final', '2026-11-11T10:02:00Z')] };
  const first = diffDatabases(before, middle);
  const second = diffDatabases(middle, after);
  const queue = mergeMutationQueues(first, second);
  assert.equal(queue.length, 1);
  assert.equal(queue[0].record.name, 'Final');
  assert.deepEqual(removeAcknowledgedMutations(queue, [first[0].id]), queue);
});

test('edição feita durante envio permanece na fila seguinte', async () => {
  const base = emptyDatabase();
  let state = { ...base, revision: 1, accounts: [account('a', 'A', '2026-11-11T10:00:00Z')] };
  state.pendingMutations = diffDatabases(base, state);
  let finishUpload;
  const uploaded = new Promise((resolve) => { finishUpload = resolve; });
  const remote = { applyChanges: async () => uploaded };
  const local = { replace(value) { state = value; return value; } };
  const service = new SyncService(local, remote);
  const flushing = service.flush(() => state, () => {});

  const beforeSecondEdit = state;
  state = { ...state, revision: 2, accounts: [...state.accounts, account('b', 'B', '2026-11-11T10:01:00Z')] };
  state.pendingMutations = mergeMutationQueues(beforeSecondEdit.pendingMutations, diffDatabases(beforeSecondEdit, state));
  finishUpload({ revision: 1 });

  await flushing;
  clearTimeout(service.timer);
  assert.deepEqual(state.accounts.map((item) => item.id).sort(), ['a', 'b']);
  assert.deepEqual(state.pendingMutations.map((item) => item.recordId), ['b']);
});

test('histórico pendente é enviado em lotes sem reenviar registros confirmados', async () => {
  const pendingMutations = Array.from({ length: MAX_MUTATIONS_PER_PUSH + 3 }, (_, index) => ({
    id: `m-${index}`, collection: 'accounts', type: 'delete', recordId: `a-${index}`, createdAt: `2026-11-11T10:00:${String(index % 60).padStart(2, '0')}Z`,
  }));
  const db = { ...emptyDatabase(), revision: 10, remoteRevision: 4, pendingMutations };
  let uploaded;
  const remote = { async applyChanges(mutations) { uploaded = mutations; return { revision: 5 }; } };
  const result = await new SyncService({ replace: (value) => value }, remote).push(db);
  assert.equal(uploaded.length, MAX_MUTATIONS_PER_PUSH);
  assert.equal(result.pendingMutations.length, 3);
  assert.deepEqual(result.pendingMutations.map((item) => item.id), ['m-250', 'm-251', 'm-252']);
});

test('abertura consulta somente a revisão quando a nuvem não mudou', async () => {
  const db = { ...emptyDatabase(), revision: 7, remoteRevision: 5, syncedRevision: 7 };
  let loads = 0;
  const remote = {
    async status() { return { revision: 5 }; },
    async load() { loads += 1; throw new Error('não deveria baixar a base'); },
  };
  const result = await new SyncService({ replace: (value) => value }, remote).bootstrap(db);
  assert.equal(loads, 0);
  assert.equal(result, db);
});

test('fila existente é enviada sem baixar novamente todos os registros', async () => {
  const base = emptyDatabase();
  const db = { ...base, revision: 2, remoteRevision: 5, syncedRevision: 1, accounts: [account('a', 'A', '2026-11-11T10:00:00Z')] };
  db.pendingMutations = diffDatabases(base, db);
  let loads = 0;
  const remote = {
    async status() { return { revision: 5 }; },
    async load() { loads += 1; throw new Error('não deveria baixar a base'); },
    async applyChanges(mutations) { assert.equal(mutations.length, 1); return { revision: 6 }; },
  };
  const result = await new SyncService({ replace: (value) => value }, remote).bootstrap(db);
  assert.equal(loads, 0);
  assert.equal(result.pendingMutations.length, 0);
});
