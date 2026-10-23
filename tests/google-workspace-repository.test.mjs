import test from 'node:test';
import assert from 'node:assert/strict';
import { itemFromRow, rowFor } from '../js/repositories/google-workspace-repository.js';

test('linha da planilha preserva o objeto completo em JSON', () => {
  const item = { id: 'trade-1', version: 2, updatedAt: '2026-10-23T12:00:00.000Z', symbol: 'EUR/USD', screenshots: [{ id: 'img-1', name: 'entrada.png' }] };
  const row = rowFor(item);
  assert.deepEqual(row.slice(0, 3), ['trade-1', 2, '2026-10-23T12:00:00.000Z']);
  assert.deepEqual(itemFromRow(row), item);
});
