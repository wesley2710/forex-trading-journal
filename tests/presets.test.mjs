import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { deletePreset, normalizePreset, presetOptions, presetValues, savePreset } from '../js/domain/presets.js';
import { renderSettings } from '../js/pages/settings.js';

const db = (settings = {}, trades = []) => ({ settings, trades, accounts: [], cashFlows: [], payouts: [], fees: [], audit: [] });

test('presets usam dados históricos e um ativo inicial seguro', () => {
  assert.deepEqual(presetValues(db(), 'symbols'), ['EUR/USD']);
  assert.deepEqual(presetValues(db({}, [{ symbol: 'gbp/usd', strategy: 'Pullback' }]), 'symbols'), ['GBP/USD']);
  assert.deepEqual(presetValues(db({}, [{ symbol: 'gbp/usd', strategy: 'Pullback' }]), 'strategies'), ['Pullback']);
});

test('cadastro normaliza ativos e rejeita duplicidade', () => {
  const value = db({ symbols: ['EUR/USD'] });
  value.settings = savePreset(value, 'symbols', '  gbp/usd  ');
  assert.deepEqual(value.settings.symbols, ['EUR/USD', 'GBP/USD']);
  assert.throws(() => savePreset(value, 'symbols', 'GBP/USD'), /já está cadastrado/);
  assert.equal(normalizePreset('strategies', '  Rompimento   e reteste  '), 'Rompimento e reteste');
});

test('editar e excluir presets não altera trades históricos', () => {
  const value = db({ symbols: ['EUR/USD', 'GBP/USD'] }, [{ id: 't1', symbol: 'EUR/USD', strategy: 'Pullback' }]);
  value.settings = savePreset(value, 'symbols', 'EUR/JPY', 'EUR/USD');
  value.settings = deletePreset(value, 'symbols', 'GBP/USD');
  assert.equal(value.trades[0].symbol, 'EUR/USD');
  assert.deepEqual(value.settings.symbols, ['EUR/JPY']);
  assert.deepEqual(presetOptions(value, 'symbols', 'EUR/USD'), [['EUR/JPY', 'EUR/JPY'], ['EUR/USD', 'EUR/USD']]);
  assert.throws(() => deletePreset(value, 'symbols', 'EUR/JPY'), /ao menos um/);
});

test('configurações exibem os dois cadastros e ações de manutenção', () => {
  const html = renderSettings({ db: db({ symbols: ['EUR/USD'], strategies: ['Pullback'] }), remoteEnabled: false, connected: false, syncStatus: 'modo local' });
  assert.match(html, /Cadastros das operações/);
  assert.match(html, /data-kind="symbols"/);
  assert.match(html, /data-kind="strategies"/);
  assert.match(html, /Pullback/);
});

test('formulário de operação usa listas fechadas para ativo e estratégia', async () => {
  const source = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');
  assert.match(source, /selectField\('symbol', 'Par \/ ativo'/);
  assert.match(source, /selectField\('strategy', 'Estratégia'/);
  assert.doesNotMatch(source, /field\('symbol', 'Par \/ ativo', 'text'/);
  assert.doesNotMatch(source, /field\('strategy', 'Estratégia', 'text'/);
});
