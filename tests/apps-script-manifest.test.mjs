import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile(new URL('../apps-script/appsscript.json', import.meta.url), 'utf8'));
const source = await readFile(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');

test('manifesto ativa a API avançada do Drive com escopo limitado', () => {
  assert.deepEqual(manifest.dependencies.enabledAdvancedServices, [
    { userSymbol: 'Drive', version: 'v3', serviceId: 'drive' },
  ]);
  assert.ok(manifest.oauthScopes.includes('https://www.googleapis.com/auth/drive.file'));
  assert.ok(!manifest.oauthScopes.includes('https://www.googleapis.com/auth/drive'));
});

test('backend incremental altera linhas pontuais sem limpar as abas', () => {
  assert.match(source, /action === 'applyChanges'/);
  assert.match(source, /action === 'status'/);
  assert.match(source, /version: 2, syncMode: 'incremental'/);
  const start = source.indexOf('function forexApplySheetMutations_');
  const end = source.indexOf('function forexApplyChanges_', start);
  const incrementalWriter = source.slice(start, end);
  assert.doesNotMatch(incrementalWriter, /clearContents/);
  assert.match(incrementalWriter, /setValues/);
  assert.match(incrementalWriter, /deleteRow/);
});
