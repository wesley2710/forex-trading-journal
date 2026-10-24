import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isCompletedPayout, payoutDate, payoutFirmCents, payoutGrossCents, payoutNetCents, payoutSharePercent, payoutSummary } from '../js/domain/payouts.js';
import { renderSettings } from '../js/pages/settings.js';

test('saque 80/20 calcula bruto, líquido e parte da mesa', () => {
  const payout = { id: 'p1', date: '2026-10-24', grossCents: 200000, traderSharePercent: 80, netCents: 160000, status: 'received' };
  assert.equal(payoutDate(payout), '2026-10-24');
  assert.equal(payoutGrossCents(payout), 200000);
  assert.equal(payoutSharePercent(payout), 80);
  assert.equal(payoutNetCents(payout), 160000);
  assert.equal(payoutFirmCents(payout), 40000);
  assert.deepEqual(payoutSummary([payout]), { count: 1, grossCents: 200000, netCents: 160000, firmCents: 40000 });
});

test('payouts antigos recebidos continuam compatíveis', () => {
  const legacy = { requestedAt: '2026-01-01', receivedAt: '2026-01-03', requestedCents: 100000, receivedCents: 80000, status: 'received' };
  assert.equal(isCompletedPayout(legacy), true);
  assert.equal(payoutGrossCents(legacy), 100000);
  assert.equal(payoutSharePercent(legacy), 80);
  assert.equal(payoutNetCents(legacy), 80000);
});

test('configurações exibem histórico de saques com edição e exclusão', async () => {
  const db = { accounts: [{ id: 'a', name: 'Conta' }], trades: [], cashFlows: [], payouts: [{ id: 'p1', accountId: 'a', date: '2026-10-24', grossCents: 200000, traderSharePercent: 80, netCents: 160000, status: 'received' }], fees: [], audit: [], settings: {} };
  const html = renderSettings({ db, remoteEnabled: false, connected: false, syncStatus: 'modo local' });
  assert.match(html, /Saques recebidos/);
  assert.match(html, /80%/);
  assert.match(html, /data-action="edit-payout"/);
  assert.match(html, /data-action="delete-payout"/);
  const appSource = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');
  assert.match(appSource, /Valor bruto do saque/);
  assert.match(appSource, /traderSharePercent/);
});
