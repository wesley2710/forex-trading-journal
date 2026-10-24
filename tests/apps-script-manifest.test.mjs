import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile(new URL('../apps-script/appsscript.json', import.meta.url), 'utf8'));

test('manifesto ativa a API avançada do Drive com escopo limitado', () => {
  assert.deepEqual(manifest.dependencies.enabledAdvancedServices, [
    { userSymbol: 'Drive', version: 'v3', serviceId: 'drive' },
  ]);
  assert.ok(manifest.oauthScopes.includes('https://www.googleapis.com/auth/drive.file'));
  assert.ok(!manifest.oauthScopes.includes('https://www.googleapis.com/auth/drive'));
});
