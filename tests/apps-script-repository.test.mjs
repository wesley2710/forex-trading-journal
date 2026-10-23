import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeBase64, encodeBase64, MAX_SCREENSHOT_BYTES } from '../js/repositories/apps-script-repository.js';

test('codificação base64 preserva os bytes do print', () => {
  const original = new Uint8Array([0, 1, 2, 127, 128, 254, 255]);
  const encoded = encodeBase64(original.buffer);
  assert.deepEqual([...decodeBase64(encoded)], [...original]);
});

test('limite de print permanece em 8 MB', () => {
  assert.equal(MAX_SCREENSHOT_BYTES, 8 * 1024 * 1024);
});
