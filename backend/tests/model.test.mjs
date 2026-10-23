import test from 'node:test';
import assert from 'node:assert/strict';
import { bearerToken } from '../src/auth.js';
import { validateSnapshot } from '../src/model.js';

const snapshot = () => ({ schemaVersion: 2, accounts: [{ id: 'a', version: 1 }], phases: [], trades: [], cashFlows: [], payouts: [], fees: [], snapshots: [], audit: [], settings: {} });
test('extrai somente Bearer token', () => { assert.equal(bearerToken('Bearer abc.def'), 'abc.def'); assert.equal(bearerToken('Basic abc'), ''); });
test('snapshot válido é aceito', () => assert.equal(validateSnapshot(snapshot()).accounts[0].id, 'a'));
test('IDs duplicados são rejeitados', () => { const data = snapshot(); data.accounts.push({ id: 'a' }); assert.throws(() => validateSnapshot(data), /duplicado/); });
test('referência cruzada inválida é rejeitada', () => { const data = snapshot(); data.trades.push({ id: 't', accountId: 'outra' }); assert.throws(() => validateSnapshot(data), /inexistente/); });
