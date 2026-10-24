import { appConfig } from './config.js';
import { barChart, lineChart } from './charts.js';
import { fromCents, money, signed, toCents } from './domain/money.js';
import { analyticsPeriodRange, filterTradesByPeriod } from './domain/analytics.js';
import { deletePreset, presetOptions, presetValues, savePreset } from './domain/presets.js';
import { payoutDate, payoutGrossCents, payoutNetCents, payoutSharePercent } from './domain/payouts.js';
import { normalizeTrade } from './domain/schema.js';
import { isoDate, netPnlCents, summarize, tradeR, uid } from './domain/trading.js';
import { validateAccount, validateTrade } from './domain/validation.js';
import { renderAccounts } from './pages/accounts.js';
import { renderAnalytics } from './pages/analytics.js';
import { renderCalendar } from './pages/calendar.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderSettings } from './pages/settings.js';
import { renderTrades } from './pages/trades.js';
import { LocalRepository, download, validateImport } from './repositories/local-repository.js';
import { AppsScriptRepository } from './repositories/apps-script-repository.js';
import { AccessService } from './services/access-service.js';
import { SyncService } from './services/sync-service.js';
import { esc, field, opts, selectField, textArea } from './ui/html.js';

const $ = (selector) => document.querySelector(selector);
const localRepository = new LocalRepository();
let db = localRepository.load();
let page = 'dashboard';
let selected = 'all';
let showArchived = false;
let year = new Date().getFullYear();
let month = new Date().getMonth();
let calendarMode = 'month';
let formHandler = null;
let galleryUrls = [];
const filters = { account: 'all', from: '', to: '', firm: '', symbol: '', strategy: '', side: '' };
const performanceFilter = { mode: 'all', from: '', to: '' };
const performancePeriod = () => ({ ...analyticsPeriodRange(performanceFilter.mode, performanceFilter), customFrom: performanceFilter.from, customTo: performanceFilter.to });

const access = new AccessService(appConfig);
let sync = null;
let workspace = null;
let syncStatus = access.connected ? 'conferindo a nuvem' : access.configured ? 'aguardando configuração' : 'modo local';
if (access.configured) {
  workspace = new AppsScriptRepository({ endpoint: appConfig.appsScript.endpoint, getToken: () => access.getToken(), spreadsheetUrl: appConfig.appsScript.spreadsheetUrl });
  sync = new SyncService(localRepository, workspace);
  sync.addEventListener('status', (event) => { syncStatus = event.detail.status; refreshSyncStatus(event.detail.detail); if (page === 'settings') render(); });
  access.addEventListener('change', () => { syncStatus = access.connected ? 'conferindo a nuvem' : 'aguardando configuração'; refreshSyncStatus(); if (page === 'settings') render(); });
}

const pageMeta = {
  dashboard: ['Dashboard', 'Resultados financeiros, desempenho em R e evolução'], accounts: ['Minhas contas', 'Contas e regras configuráveis'], trades: ['Operações', 'Histórico detalhado e filtros combinados'], calendar: ['Calendário de performance', 'Resultados mensais e anuais'], analytics: ['Estatísticas', 'Consistência, expectativa e agrupamentos'], settings: ['Configurações', 'Backups, sincronização e auditoria'],
};
const accountName = (id) => db.accounts.find((account) => account.id === id)?.name || 'Conta removida';
const accountOptions = () => db.accounts.filter((account) => !account.archived).map((account) => [account.id, account.name]);
const activeTrades = () => db.trades.filter((trade) => selected === 'all' || trade.accountId === selected);

function toast(message) { const element = $('#toast'); element.textContent = message; element.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => element.classList.remove('show'), 3300); }
function refreshSyncStatus(detail = '') {
  const label = $('#syncLabel'); const text = $('#syncDetail'); const dot = $('#syncDot'); if (!label) return;
  const connected = access.connected; label.textContent = syncStatus === 'synced' ? 'Sincronizado' : syncStatus === 'syncing' ? 'Sincronizando…' : syncStatus === 'pending' ? 'Salvo; enviando…' : syncStatus === 'conflict' ? 'Conflito de versões' : connected ? 'Automático ativo' : 'Modo local';
  text.textContent = detail || (connected ? 'Google Planilhas e Drive conectados automaticamente.' : 'Backup local ativo; configure o acesso automático uma única vez.');
  dot.className = `status-dot ${syncStatus}`;
}
function refreshAccountFilter() {
  if (!db.accounts.some((account) => account.id === selected && !account.archived)) selected = 'all';
  $('#accountFilter').innerHTML = opts([['all', 'Todas as contas'], ...accountOptions()], selected);
  $('#accountFilter').value = selected; filters.account = selected;
}
function commit(mutator, action, collection) {
  mutator(); db.audit.push({ id: uid(), action, collection, at: new Date().toISOString() }); db.audit = db.audit.slice(-500); db = localRepository.save(db); toast('Alterações salvas no backup local.'); render();
  if (access.connected) sync.schedule(() => db, (next) => { db = next; if (page === 'settings') render(); });
}
function setPage(next) {
  page = next; const [title, subtitle] = pageMeta[page]; $('#pageTitle').textContent = title; $('#pageSubtitle').textContent = subtitle;
  document.querySelectorAll('#nav button').forEach((button) => button.classList.toggle('active', button.dataset.page === page));
  $('.sidebar').classList.remove('open'); $('#menuButton').setAttribute('aria-expanded', 'false'); render(); $('#app').focus({ preventScroll: true });
}
function render() {
  refreshAccountFilter(); let result;
  if (page === 'dashboard') { result = renderDashboard({ db, selected, accountName, period: performancePeriod() }); $('#app').innerHTML = result.html; lineChart($('#balanceChart'), result.chart); }
  else if (page === 'accounts') $('#app').innerHTML = renderAccounts({ db, showArchived });
  else if (page === 'trades') $('#app').innerHTML = renderTrades({ db, filters, accountName });
  else if (page === 'calendar') $('#app').innerHTML = renderCalendar({ trades: activeTrades(), year, month, mode: calendarMode });
  else if (page === 'analytics') { const accounts = db.accounts.filter((account) => !account.archived && (selected === 'all' || account.id === selected)); const period = performancePeriod(); result = renderAnalytics({ db, trades: filterTradesByPeriod(activeTrades(), period), accounts, selected, period }); $('#app').innerHTML = result.html; lineChart($('#rChart'), result.charts.rCurve); lineChart($('#pnlChart'), result.charts.pnlCurve); lineChart($('#drawdownChart'), result.charts.drawdown); barChart($('#distributionChart'), result.charts.distribution.values, result.charts.distribution.labels); barChart($('#monthlyChart'), result.charts.monthly.values, result.charts.monthly.labels); }
  else { $('#app').innerHTML = renderSettings({ db, remoteEnabled: access.configured, connected: access.connected, syncStatus, spreadsheetUrl: workspace?.spreadsheetUrl || appConfig.appsScript?.spreadsheetUrl }); bindImport(); }
  refreshSyncStatus();
}

function modal(title, html, onSubmit, { submit = true } = {}) {
  $('#modalTitle').textContent = title; $('#formFields').innerHTML = html; $('#formError').textContent = ''; formHandler = onSubmit; $('#entityForm button[type=submit]').hidden = !submit; $('#dialog').showModal();
}
function accountForm(id) {
  const current = db.accounts.find((account) => account.id === id) || { name: '', firm: '', status: 'Ativa', initialBalanceCents: 1000000, profitTargetCents: 100000, dailyLossLimitCents: 50000, maxLossLimitCents: 100000, drawdownType: 'static', lossBasis: 'balance', timezone: 'UTC', rolloverTime: '00:00', profitSplit: 80 };
  const html = field('name', 'Nome da conta', 'text', current.name, 'required maxlength="80"') + field('firm', 'Mesa proprietária', 'text', current.firm, 'maxlength="80"') + selectField('status', 'Status', [['Ativa', 'Ativa'], ['Pausada', 'Pausada'], ['Aprovada', 'Aprovada'], ['Encerrada', 'Encerrada'], ['Reprovada', 'Reprovada']], current.status) + field('initialBalance', 'Saldo inicial (USD)', 'number', fromCents(current.initialBalanceCents), 'required min="0" step="0.01"') + field('profitTarget', 'Meta de lucro (USD)', 'number', fromCents(current.profitTargetCents), 'min="0" step="0.01"') + field('dailyLossLimit', 'Perda diária máxima (USD)', 'number', fromCents(current.dailyLossLimitCents), 'min="0" step="0.01"') + field('maxLossLimit', 'Perda total máxima (USD)', 'number', fromCents(current.maxLossLimitCents), 'min="0" step="0.01"') + selectField('drawdownType', 'Drawdown', [['static', 'Estático'], ['trailing', 'Trailing'], ['custom', 'Personalizado']], current.drawdownType) + selectField('lossBasis', 'Base da regra', [['balance', 'Balance'], ['equity', 'Equity']], current.lossBasis) + field('timezone', 'Fuso IANA', 'text', current.timezone, 'required placeholder="America/New_York"') + field('rolloverTime', 'Rollover diário', 'time', current.rolloverTime, 'required') + field('profitSplit', 'Profit split (%)', 'number', current.profitSplit, 'min="0" max="100" step="0.01"');
  modal(id ? 'Editar conta' : 'Cadastrar conta', html, (values) => {
    const now = new Date().toISOString(); const account = { ...current, ...values, id: id || uid(), initialBalanceCents: toCents(values.initialBalance), profitTargetCents: toCents(values.profitTarget), dailyLossLimitCents: toCents(values.dailyLossLimit), maxLossLimitCents: toCents(values.maxLossLimit), profitSplit: Number(values.profitSplit), archived: current.archived || false, createdAt: current.createdAt || now, updatedAt: now, version: Number(current.version || 0) + 1 };
    validateAccount(account); commit(() => { if (id) db.accounts = db.accounts.map((item) => item.id === id ? account : item); else db.accounts.push(account); }, id ? 'update' : 'create', 'accounts');
  });
}
function tradeForm(id) {
  if (!db.accounts.some((account) => !account.archived)) { toast('Cadastre uma conta ativa antes.'); setPage('accounts'); return; }
  const symbols = presetValues(db, 'symbols');
  const strategies = presetValues(db, 'strategies');
  const current = db.trades.find((trade) => trade.id === id) || { accountId: selected === 'all' ? accountOptions()[0][0] : selected, closedDate: isoDate(), openedAt: `${isoDate()}T09:00`, closedAt: `${isoDate()}T12:00`, symbol: symbols[0], side: 'Compra', riskCents: 10000, plannedRewardCents: 20000, grossPnlCents: 0, feesCents: 0, swapCents: 0, commissionCents: 0, entry: '', stopLoss: '', takeProfit: '', exit: '', lots: '', strategy: strategies[0] || '', notes: '', partialExits: [], screenshots: [] };
  const strategyOptions = [['', 'Sem estratégia'], ...presetOptions(db, 'strategies', current.strategy)];
  const html = selectField('accountId', 'Conta', accountOptions(), current.accountId) + field('closedDate', 'Data operacional', 'date', current.closedDate, 'required') + selectField('side', 'Direção', [['Compra', 'Compra'], ['Venda', 'Venda']], current.side) + selectField('symbol', 'Par / ativo', presetOptions(db, 'symbols', current.symbol), current.symbol) + field('lots', 'Lotes', 'number', current.lots, 'min="0" step="0.01"') + field('entry', 'Entrada', 'number', current.entry, 'min="0" step="any"') + field('stopLoss', 'Stop loss', 'number', current.stopLoss, 'min="0" step="any"') + field('takeProfit', 'Take profit', 'number', current.takeProfit, 'min="0" step="any"') + field('exit', 'Saída final', 'number', current.exit, 'min="0" step="any"') + field('risk', 'Risco inicial (USD)', 'number', fromCents(current.riskCents), 'required min="0.01" step="0.01"') + field('plannedReward', 'Recompensa planejada (USD)', 'number', fromCents(current.plannedRewardCents), 'required min="0" step="0.01"') + field('grossPnl', 'PnL bruto (USD)', 'number', fromCents(current.grossPnlCents), 'required step="0.01"') + field('fees', 'Custos (USD)', 'number', fromCents(current.feesCents), 'min="0" step="0.01"') + field('commission', 'Comissão (USD)', 'number', fromCents(current.commissionCents), 'min="0" step="0.01"') + field('swap', 'Swap (USD)', 'number', fromCents(current.swapCents), 'step="0.01"') + selectField('strategy', 'Estratégia', strategyOptions, current.strategy) + field('partialPnls', 'Saídas parciais — PnL USD, separado por vírgula', 'text', current.partialExits.map((item) => fromCents(item.pnlCents)).join(', '), 'placeholder="50, 75.25"', true) + textArea('notes', 'Observações', current.notes) + `<label class="field full file-field">Prints da operação<input name="screenshots" type="file" accept="image/*" multiple ${access.connected ? '' : 'disabled'}><span class="helper">${access.connected ? 'As imagens serão salvas automaticamente em uma pasta privada no seu Google Drive.' : 'Configure o acesso automático em Configurações para anexar prints.'}</span></label>`;
  modal(id ? 'Editar operação' : 'Registrar operação', html, async (values) => {
    const account = db.accounts.find((item) => item.id === values.accountId); if (!account) throw new Error('Conta inválida.');
    const tradeId = id || uid();
    const files = values.__screenshots || [];
    delete values.__screenshots; delete values.screenshots;
    const trade = normalizeTrade({ ...current, ...values, id: tradeId, screenshots: [...(current.screenshots || [])], closedDate: values.closedDate, openedAt: current.openedAt || `${values.closedDate}T09:00:00Z`, closedAt: `${values.closedDate}T12:00:00Z`, timezone: account.timezone, entry: values.entry === '' ? null : Number(values.entry), stopLoss: values.stopLoss === '' ? null : Number(values.stopLoss), takeProfit: values.takeProfit === '' ? null : Number(values.takeProfit), exit: values.exit === '' ? null : Number(values.exit), lots: values.lots === '' ? null : Number(values.lots), partialExits: values.partialPnls.split(',').map((item) => item.trim()).filter(Boolean).map((item, index) => ({ id: `${tradeId}-${index}`, pnlCents: toCents(item) })), version: Number(current.version || 0) + 1 });
    validateTrade(trade, db);
    if (files.length) trade.screenshots.push(...await workspace.uploadScreenshots(files, tradeId));
    validateTrade(trade, db); commit(() => { if (id) db.trades = db.trades.map((item) => item.id === id ? trade : item); else db.trades.push(trade); }, id ? 'update' : 'create', 'trades');
  });
}
function presetForm(kind, previous = '') {
  const symbol = kind === 'symbols';
  const label = symbol ? 'Par / ativo' : 'Estratégia';
  modal(previous ? `Editar ${label.toLowerCase()}` : `Adicionar ${label.toLowerCase()}`, field('value', label, 'text', previous, `required maxlength="${symbol ? 30 : 80}" autocomplete="off"`, true), (values) => {
    commit(() => { db.settings = savePreset(db, kind, values.value, previous); }, previous ? 'update-preset' : 'create-preset', 'settings');
  });
}
function cashFlowForm(accountId) {
  if (!db.accounts.length) return toast('Cadastre uma conta primeiro.'); modal('Registrar movimentação', selectField('accountId', 'Conta', accountOptions(), accountId || accountOptions()[0][0]) + field('date', 'Data', 'date', isoDate(), 'required') + selectField('type', 'Tipo', [['deposit', 'Depósito'], ['withdrawal', 'Retirada do saldo operacional'], ['adjustment', 'Ajuste'], ['fee', 'Taxa'], ['payout', 'Ajuste de saldo por saque']], 'deposit') + field('amount', 'Valor com sinal (USD)', 'number', 0, 'required step="0.01"') + `<label class="check field full"><input name="affectsBalance" type="checkbox" checked> Impacta o saldo operacional</label>` + textArea('notes', 'Observações', '', 500), (values) => { const amountCents = toCents(values.amount); commit(() => db.cashFlows.push({ id: uid(), accountId: values.accountId, date: values.date, occurredAt: `${values.date}T12:00:00Z`, type: values.type, amountCents, affectsBalance: values.affectsBalance === 'on', notes: values.notes.trim(), version: 1 }), 'create', 'cashFlows'); });
}
function updatePayoutPreview() {
  const grossInput = document.querySelector('[name="payoutGross"]'); const shareInput = document.querySelector('[name="traderSharePercent"]');
  const netTarget = $('#payoutNetPreview'); const firmTarget = $('#payoutFirmPreview'); if (!grossInput || !shareInput || !netTarget || !firmTarget) return;
  const gross = Number(String(grossInput.value).replace(',', '.')); const share = Number(String(shareInput.value).replace(',', '.'));
  const grossCents = Number.isFinite(gross) ? Math.max(0, Math.round(gross * 100)) : 0; const validShare = Number.isFinite(share) ? Math.min(100, Math.max(0, share)) : 0;
  const netCents = Math.round(grossCents * validShare / 100); netTarget.textContent = money(netCents); firmTarget.textContent = money(grossCents - netCents);
}
function payoutForm(accountId, payoutId) {
  const existing = db.payouts.find((item) => item.id === payoutId);
  const options = accountOptions();
  if (existing && !options.some(([id]) => id === existing.accountId)) { const account = db.accounts.find((item) => item.id === existing.accountId); if (account) options.push([account.id, account.name]); }
  if (!options.length) { toast('Cadastre uma conta antes de registrar um saque.'); return; }
  const selectedAccountId = existing?.accountId || accountId || options[0][0]; const account = db.accounts.find((item) => item.id === selectedAccountId);
  const grossCents = existing ? payoutGrossCents(existing) : 0; const share = existing ? payoutSharePercent(existing) : Number(account?.profitSplit ?? 80); const date = existing ? payoutDate(existing) : isoDate();
  const html = selectField('accountId', 'Conta', options, selectedAccountId) + field('payoutDate', 'Data do saque', 'date', date, 'required') + field('payoutGross', 'Valor bruto do saque (USD)', 'number', fromCents(grossCents), 'required min="0.01" step="0.01"') + field('traderSharePercent', 'Sua porcentagem (%)', 'number', share, 'required min="0" max="100" step="0.01"') + `<div class="field full payout-preview"><span>Divisão calculada</span><div class="compact-metrics"><div><span>Você recebe</span><b id="payoutNetPreview">${money(existing ? payoutNetCents(existing) : 0)}</b></div><div><span>Parte da mesa</span><b id="payoutFirmPreview">${money(existing ? payoutGrossCents(existing) - payoutNetCents(existing) : 0)}</b></div></div></div>` + textArea('notes', 'Observações', existing?.notes || '', 500);
  modal(existing ? 'Editar saque' : 'Registrar saque', html, (values) => {
    const gross = toCents(values.payoutGross); const traderSharePercent = Number(values.traderSharePercent);
    if (gross <= 0) throw new Error('O valor bruto do saque deve ser maior que zero.');
    if (!Number.isFinite(traderSharePercent) || traderSharePercent < 0 || traderSharePercent > 100) throw new Error('A porcentagem deve ficar entre 0% e 100%.');
    const netCents = Math.round(gross * traderSharePercent / 100); const now = new Date().toISOString();
    const payout = { ...existing, id: payoutId || uid(), accountId: values.accountId, date: values.payoutDate, grossCents: gross, traderSharePercent, netCents, status: 'received', requestedAt: values.payoutDate, receivedAt: values.payoutDate, requestedCents: gross, receivedCents: netCents, notes: values.notes.trim(), createdAt: existing?.createdAt || now, updatedAt: now, version: Number(existing?.version || 0) + 1 };
    commit(() => { if (payoutId) db.payouts = db.payouts.map((item) => item.id === payoutId ? payout : item); else db.payouts.push(payout); }, payoutId ? 'update' : 'create', 'payouts');
  });
  updatePayoutPreview();
}
function feeForm(accountId) {
  modal('Registrar taxa de prop firm', selectField('accountId', 'Conta', accountOptions(), accountId || accountOptions()[0][0]) + field('date', 'Data', 'date', isoDate(), 'required') + selectField('type', 'Tipo', [['evaluation', 'Avaliação'], ['reset', 'Reset'], ['activation', 'Ativação'], ['platform', 'Plataforma'], ['other', 'Outra']], 'evaluation') + field('amount', 'Valor pago (USD)', 'number', 0, 'required min="0" step="0.01"') + textArea('notes', 'Observações', '', 500), (values) => commit(() => db.fees.push({ id: uid(), accountId: values.accountId, date: values.date, type: values.type, amountCents: toCents(values.amount), notes: values.notes.trim(), version: 1 }), 'create', 'fees'));
}
function snapshotForm(accountId) { modal('Snapshot de balance e equity', field('capturedAt', 'Data e hora', 'datetime-local', new Date().toISOString().slice(0, 16), 'required') + field('balance', 'Balance (USD)', 'number', 0, 'required step="0.01"') + field('equity', 'Equity (USD)', 'number', 0, 'required step="0.01"'), (values) => commit(() => db.snapshots.push({ id: uid(), accountId, capturedAt: new Date(values.capturedAt).toISOString(), balanceCents: toCents(values.balance), equityCents: toCents(values.equity), version: 1 }), 'create', 'snapshots')); }
function dayDetail(date) { const trades = activeTrades().filter((trade) => trade.closedDate === date); const stats = summarize(trades); modal(`Operações de ${date}`, `<div class="field full"><strong>${money(stats.pnlCents)} • ${signed(stats.r, 'R')} • ${stats.count} operações</strong></div><div class="field full">${trades.map((trade) => `<div class="detail-item">${esc(trade.symbol)} • ${esc(accountName(trade.accountId))} • ${money(netPnlCents(trade))} • ${signed(tradeR(trade), 'R')}</div>`).join('') || 'Nenhuma operação.'}</div>`, () => {}, { submit: false }); }
async function showScreenshots(tradeId) {
  const trade = db.trades.find((item) => item.id === tradeId);
  if (!trade?.screenshots?.length) return toast('Esta operação não possui prints.');
  modal('Prints da operação', `<div class="attachment-gallery">${trade.screenshots.map((item) => `<article class="attachment-card"><div class="attachment-preview" data-screenshot="${esc(item.id)}">Carregando…</div><div><strong>${esc(item.name)}</strong><small>${Math.ceil((item.size || 0) / 1024)} KB</small><button class="danger ghost" type="button" data-action="delete-screenshot" data-id="${esc(item.id)}" data-trade-id="${esc(tradeId)}">Excluir print</button></div></article>`).join('')}</div>`, () => {}, { submit: false });
  for (const image of trade.screenshots) {
    try {
      const blob = await workspace.loadScreenshot(image.id);
      const url = URL.createObjectURL(blob); galleryUrls.push(url);
      const target = document.querySelector(`[data-screenshot="${CSS.escape(image.id)}"]`);
      if (target) target.innerHTML = `<img src="${url}" alt="${esc(image.name)}">`;
    } catch { const target = document.querySelector(`[data-screenshot="${CSS.escape(image.id)}"]`); if (target) target.textContent = 'Não foi possível carregar.'; }
  }
}
async function deleteTrade(tradeId) {
  const trade = db.trades.find((item) => item.id === tradeId); if (!trade) return;
  const screenshots = trade.screenshots || [];
  const message = screenshots.length ? `Excluir esta operação e ${screenshots.length} print(s) do Google Drive?` : 'Excluir esta operação?';
  if (!confirm(message)) return;
  if (screenshots.length && !access.connected) throw new Error('Configure o acesso automático antes de excluir uma operação que possui prints.');
  for (const screenshot of screenshots) await workspace.deleteScreenshot(screenshot.id);
  commit(() => { db.trades = db.trades.filter((item) => item.id !== tradeId); }, 'delete', 'trades');
}

function exportCsv() { const columns = ['closedDate', 'accountId', 'symbol', 'side', 'entry', 'stopLoss', 'takeProfit', 'exit', 'lots', 'riskCents', 'plannedRewardCents', 'grossPnlCents', 'feesCents', 'swapCents', 'commissionCents', 'netPnlCents', 'strategy', 'notes']; const rows = [columns.join(','), ...db.trades.map((trade) => columns.map((key) => `"${String(trade[key] ?? '').replace(/"/g, '""')}"`).join(','))]; download('forex-trades.csv', `\ufeff${rows.join('\r\n')}`, 'text/csv;charset=utf-8'); }
function bindImport() { const input = $('#importFile'); if (!input) return; input.onchange = async (event) => { const file = event.target.files?.[0]; if (!file) return; try { const imported = validateImport(JSON.parse(await file.text())); if (confirm('Substituir todos os dados locais pelo backup validado?')) { db = localRepository.replace(imported); selected = 'all'; toast('Backup importado.'); render(); } } catch (error) { alert(error.message); } }; }

$('#entityForm').addEventListener('input', (event) => { if (['payoutGross', 'traderSharePercent'].includes(event.target.name)) updatePayoutPreview(); });
$('#entityForm').addEventListener('change', (event) => { if (event.target.name === 'accountId' && $('#payoutNetPreview')) { const account = db.accounts.find((item) => item.id === event.target.value); const share = document.querySelector('[name="traderSharePercent"]'); if (account && share) share.value = Number(account.profitSplit ?? 80); updatePayoutPreview(); } });
$('#entityForm').onsubmit = async (event) => {
  event.preventDefault(); const submit = $('#entityForm button[type=submit]');
  try {
    submit.disabled = true; const formData = new FormData(event.currentTarget); const values = Object.fromEntries(formData.entries());
    values.__screenshots = formData.getAll('screenshots').filter((file) => file instanceof File && file.size);
    await formHandler(values); $('#dialog').close();
  } catch (error) { $('#formError').textContent = error.message; } finally { submit.disabled = false; }
};
$('#dialog').addEventListener('close', () => { galleryUrls.forEach((url) => URL.revokeObjectURL(url)); galleryUrls = []; $('#entityForm button[type=submit]').hidden = false; formHandler = null; });
$('#dialog').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action="delete-screenshot"]'); if (!button) return;
  if (!confirm('Excluir este print do Google Drive?')) return;
  try {
    await workspace.deleteScreenshot(button.dataset.id);
    commit(() => { const trade = db.trades.find((item) => item.id === button.dataset.tradeId); trade.screenshots = trade.screenshots.filter((item) => item.id !== button.dataset.id); }, 'delete-screenshot', 'trades');
    $('#dialog').close();
  } catch (error) { $('#formError').textContent = error.message; }
});
$('#closeDialog').onclick = $('#cancelDialog').onclick = () => $('#dialog').close();
$('#nav').addEventListener('click', (event) => { const button = event.target.closest('[data-page]'); if (button) setPage(button.dataset.page); });
$('#accountFilter').onchange = (event) => { selected = event.target.value; filters.account = selected; render(); };
$('#quickAdd').onclick = () => tradeForm();
$('#menuButton').onclick = () => { const open = $('.sidebar').classList.toggle('open'); $('#menuButton').setAttribute('aria-expanded', String(open)); };
$('#app').addEventListener('change', (event) => {
  if (event.target.dataset.filter) { filters[event.target.dataset.filter] = event.target.value; render(); }
  else if (event.target.dataset.performancePeriod !== undefined) { performanceFilter.mode = event.target.value; render(); }
  else if (event.target.dataset.performanceDate) { performanceFilter[event.target.dataset.performanceDate] = event.target.value; render(); }
});
$('#app').addEventListener('click', async (event) => {
  const button = event.target.closest('button'); if (!button) return; if (button.dataset.goto) return setPage(button.dataset.goto); const action = button.dataset.action; const id = button.dataset.id; if (!action) return;
  try {
    if (action === 'new-account') accountForm(); else if (action === 'edit-account') accountForm(id); else if (action === 'toggle-archived') { showArchived = !showArchived; render(); }
    else if (action === 'archive-account') commit(() => { const account = db.accounts.find((item) => item.id === id); account.archived = !account.archived; account.updatedAt = new Date().toISOString(); }, 'archive-toggle', 'accounts');
    else if (action === 'cash-flow') cashFlowForm(id); else if (action === 'fee') feeForm(id); else if (action === 'withdrawal') payoutForm(id); else if (action === 'edit-payout') payoutForm('', id); else if (action === 'delete-payout' && confirm('Excluir este saque?')) commit(() => { db.payouts = db.payouts.filter((item) => item.id !== id); }, 'delete', 'payouts'); else if (action === 'snapshot') snapshotForm(id);
    else if (action === 'new-trade') tradeForm(); else if (action === 'edit-trade') tradeForm(id); else if (action === 'view-screenshots') await showScreenshots(id); else if (action === 'delete-trade') await deleteTrade(id);
    else if (action === 'add-preset') presetForm(button.dataset.kind);
    else if (action === 'edit-preset') presetForm(button.dataset.kind, button.dataset.value);
    else if (action === 'delete-preset' && confirm(`Excluir “${button.dataset.value}” das opções futuras? As operações antigas não serão alteradas.`)) commit(() => { db.settings = deletePreset(db, button.dataset.kind, button.dataset.value); }, 'delete-preset', 'settings');
    else if (action === 'delete-cash-flow' && confirm('Excluir esta movimentação?')) commit(() => { db.cashFlows = db.cashFlows.filter((flow) => flow.id !== id); }, 'delete', 'cashFlows');
    else if (action === 'clear-filters') { Object.assign(filters, { account: selected, from: '', to: '', firm: '', symbol: '', strategy: '', side: '' }); render(); }
    else if (action === 'calendar-mode') { calendarMode = button.dataset.mode; render(); } else if (action === 'prev-period') { if (calendarMode === 'year') year -= 1; else if (--month < 0) { month = 11; year -= 1; } render(); } else if (action === 'next-period') { if (calendarMode === 'year') year += 1; else if (++month > 11) { month = 0; year += 1; } render(); } else if (action === 'today') { year = new Date().getFullYear(); month = new Date().getMonth(); render(); } else if (action === 'open-month') { month = Number(button.dataset.month); calendarMode = 'month'; render(); } else if (action === 'day-detail') dayDetail(button.dataset.date);
    else if (action === 'export-json') download(`forex-journal-backup-${isoDate()}.json`, JSON.stringify(db, null, 2)); else if (action === 'import-json') $('#importFile').click(); else if (action === 'export-csv') exportCsv();
    else if (action === 'configure-access') accessForm();
    else if (action === 'forget-access') { access.clear(); syncStatus = 'aguardando configuração'; render(); }
    else if (action === 'sync-now') { db = await sync.flush(() => db, (next) => { db = next; }); render(); }
    else if (action === 'sync-pull') { if (confirm('Substituir a cópia local pela versão da sua planilha Google?')) { db = await sync.pull(); render(); } }
  } catch (error) { toast(error.message); }
});
window.addEventListener('resize', () => { if (page === 'dashboard' || page === 'analytics') render(); });
function accessForm() {
  modal('Configurar acesso automático', field('secret', 'Segredo pessoal', 'password', '', 'required minlength="32" autocomplete="current-password"') + '<p class="helper full">Digite o segredo configurado no Apps Script. Ele ficará salvo somente neste navegador.</p>', async (values) => {
    access.setToken(values.secret);
    syncStatus = 'conferindo a nuvem';
    try { db = await sync.bootstrap(db); }
    catch (error) { if (error.code === 'UNAUTHORIZED' || error.code === 'AUTH_NOT_CONFIGURED') access.clear(); throw error; }
    render();
  });
}

async function bootstrapRemote() {
  if (!access.connected || !sync) return;
  try { db = await sync.bootstrap(db); render(); }
  catch (error) { toast(error.message); refreshSyncStatus(error.message); }
}

render();
bootstrapRemote();
