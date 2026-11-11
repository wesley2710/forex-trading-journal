import test from 'node:test';
import assert from 'node:assert/strict';
import { AppsScriptRepository, decodeBase64, encodeBase64, MAX_SCREENSHOT_BYTES } from '../js/repositories/apps-script-repository.js';

test('codificação base64 preserva os bytes do print', () => {
  const original = new Uint8Array([0, 1, 2, 127, 128, 254, 255]);
  const encoded = encodeBase64(original.buffer);
  assert.deepEqual([...decodeBase64(encoded)], [...original]);
});

test('limite de print permanece em 8 MB', () => {
  assert.equal(MAX_SCREENSHOT_BYTES, 8 * 1024 * 1024);
});

test('alterações incrementais usam o endpoint applyChanges', async () => {
  const repository = new AppsScriptRepository({ endpoint: 'https://example.invalid', getToken: () => 'token' });
  let call;
  repository.request = async (action, data) => { call = { action, data }; return { revision: 8 }; };
  const mutations = [{ id: 'm1', collection: 'accounts', type: 'delete', recordId: 'a' }];
  const result = await repository.applyChanges(mutations, 7, {});
  assert.equal(call.action, 'applyChanges');
  assert.deepEqual(call.data, { expectedRevision: 7, mutations });
  assert.equal(result.revision, 8);
});

test('backend antigo recebe snapshot completo como compatibilidade temporária', async () => {
  const repository = new AppsScriptRepository({ endpoint: 'https://example.invalid', getToken: () => 'token' });
  const snapshot = { remoteRevision: 3 };
  repository.request = async (action) => {
    if (action === 'applyChanges') throw Object.assign(new Error('ação desconhecida'), { code: 'INVALID_ACTION' });
    assert.equal(action, 'save');
    return { revision: 4 };
  };
  const result = await repository.applyChanges([{ id: 'm1' }], 3, snapshot);
  assert.equal(result.revision, 4);
  assert.equal(result.fallbackFullSync, true);
});

test('consulta de status evita baixar a base completa', async () => {
  const repository = new AppsScriptRepository({ endpoint: 'https://example.invalid', getToken: () => 'token' });
  repository.request = async (action) => {
    assert.equal(action, 'status');
    return { revision: 12, updatedAt: '2026-11-11T12:00:00Z' };
  };
  assert.equal((await repository.status()).revision, 12);
});
