import { appConfig } from './config.js';
import { lineChart } from './charts.js';
import { fromCents, money, signed, toCents } from './domain/money.js';
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
import { RemoteRepository } from './repositories/remote-repository.js';
import { AuthService } from './services/auth-service.js';
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
const filters = { account: 'all', from: '', to: '', firm: '', phase: '', symbol: '', strategy: '', side: '' };

const auth = new AuthService(appConfig);
let sync = null;
let syncStatus = appConfig.remoteEnabled ? 'aguardando login' : 'modo local';
if (appConfig.remoteEnabled) {
  const remote = new RemoteRepository({ baseUrl: appConfig.apiBaseUrl, getToken: () => auth.getToken() });
  sync = new SyncService(localRepository, remote);
  sync.addEventListener('status', (event) => { syncStatus = event.detail.status; refreshSyncStatus(event.detail.detail); if (page === 'settings') render(); });
  auth.addEventListener('change', () => { refreshSyncStatus(); if (page === 'settings') render(); });
  auth.initialize().catch((error) => { syncStatus = `erro: ${error.message}`; refreshSyncStatus(); });
}

const pageMeta = {
  dashboard: ['Dashboard', 'Resultados financeiros, desempenho em R e evolução'], accounts: ['Minhas contas', 'Contas, fases e regras configuráveis'], trades: ['Operações', 'Histórico detalhado e filtros combinados'], calendar: ['Calendário de performance', 'Resultados mensais e anuais'], analytics: ['Estatísticas', 'Consistência, expectativa e agrupamentos'], settings: ['Configurações', 'Backups, sincronização e auditoria'],
};
const accountName = (id) => db.accounts.find((account) => account.id === id)?.name || 'Conta removida';
const accountOptions = () => db.accounts.filter((account) => !account.archived).map((account) => [account.id, account.name]);
const activeTrades = () => db.trades.filter((trade) => selected === 'all' || trade.accountId === selected);
const filteredTrades = () => activeTrades().filter((trade) => (!filters.from || trade.closedDate >= filters.from) && (!filters.to || trade.closedDate <= filters.to) && (!filters.symbol || trade.symbol === filters.symbol) && (!filters.strategy || trade.strategy === filters.strategy) && (!filters.side || trade.side === filters.side));

function toast(message) { const element = $('#toast'); element.textContent = message; element.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => element.classList.remove('show'), 3300); }
function refreshSyncStatus(detail = '') {
  const label = $('#syncLabel'); const text = $('#syncDetail'); const dot = $('#syncDot'); if (!label) return;
  const logged = Boolean(auth.user); label.textContent = syncStatus === 'synced' ? 'Sincronizado' : syncStatus === 'syncing' ? 'Sincronizando…' : logged ? 'Conectado' : 'Modo local';
  text.textContent = detail || (logged ? `Conta ${auth.user.email}` : 'Backup local ativo; conecte o backend para sincronizar.');
  dot.className = `status-dot ${syncStatus}`;
}
function refreshAccountFilter() {
  if (!db.accounts.some((account) => account.id === selected && !account.archived)) selected = 'all';
  $('#accountFilter').innerHTML = opts([['all', 'Todas as contas'], ...accountOptions()], selected);
  $('#accountFilter').value = selected; filters.account = selected;
}
function commit(mutator, action, collection) {
  mutator(); db.audit.push({ id: uid(), action, collection, at: new Date().toISOString() }); db.audit = db.audit.slice(-500); db = localRepository.save(db); toast('Alterações salvas no backup local.'); render();
}
function setPage(next) {
  page = next; const [title, subtitle] = pageMeta[page]; $('#pageTitle').textContent = title; $('#pageSubtitle').textContent = subtitle;
  document.querySelectorAll('#nav button').forEach((button) => button.classList.toggle('active', button.dataset.page === page));
  $('.sidebar').classList.remove('open'); $('#menuButton').setAttribute('aria-expanded', 'false'); render(); $('#app').focus({ preventScroll: true });
}
function render() {
  refreshAccountFilter(); let result;
  if (page === 'dashboard') { result = renderDashboard({ db, selected, accountName }); $('#app').innerHTML = result.html; lineChart($('#balanceChart'), result.chart); }
  else if (page === 'accounts') $('#app').innerHTML = renderAccounts({ db, showArchived });
  else if (page === 'trades') $('#app').innerHTML = renderTrades({ db, filters, accountName });
  else if (page === 'calendar') $('#app').innerHTML = renderCalendar({ trades: activeTrades(), year, month, mode: calendarMode });
  else if (page === 'analytics') { result = renderAnalytics({ trades: filteredTrades() }); $('#app').innerHTML = result.html; lineChart($('#rChart'), result.rCurve); lineChart($('#pnlChart'), result.pnlCurve); }
  else { $('#app').innerHTML = renderSettings({ db, remoteEnabled: appConfig.remoteEnabled, signedIn: Boolean(auth.user), syncStatus }); bindImport(); }
  refreshSyncStatus();
}

function modal(title, html, onSubmit, { submit = true } = {}) {
  $('#modalTitle').textContent = title; $('#formFields').innerHTML = html; $('#formError').textContent = ''; formHandler = onSubmit; $('#entityForm button[type=submit]').hidden = !submit; $('#dialog').showModal();
}
const phaseOptions = (accountId) => db.phases.filter((phase) => phase.accountId === accountId).map((phase) => [phase.id, phase.name]);
function accountForm(id) {
  const current = db.accounts.find((account) => account.id === id) || { name: '', firm: '', status: 'Ativa', initialBalanceCents: 1000000, profitTargetCents: 100000, dailyLossLimitCents: 50000, maxLossLimitCents: 100000, drawdownType: 'static', lossBasis: 'balance', timezone: 'UTC', rolloverTime: '00:00', profitSplit: 80 };
  const html = field('name', 'Nome da conta', 'text', current.name, 'required maxlength="80"') + field('firm', 'Mesa proprietária', 'text', current.firm, 'maxlength="80"') + selectField('status', 'Status', [['Ativa', 'Ativa'], ['Pausada', 'Pausada'], ['Aprovada', 'Aprovada'], ['Encerrada', 'Encerrada'], ['Reprovada', 'Reprovada']], current.status) + field('initialBalance', 'Saldo inicial (USD)', 'number', fromCents(current.initialBalanceCents), 'required min="0" step="0.01"') + field('profitTarget', 'Meta de lucro (USD)', 'number', fromCents(current.profitTargetCents), 'min="0" step="0.01"') + field('dailyLossLimit', 'Perda diária máxima (USD)', 'number', fromCents(current.dailyLossLimitCents), 'min="0" step="0.01"') + field('maxLossLimit', 'Perda total máxima (USD)', 'number', fromCents(current.maxLossLimitCents), 'min="0" step="0.01"') + selectField('drawdownType', 'Drawdown', [['static', 'Estático'], ['trailing', 'Trailing'], ['custom', 'Personalizado']], current.drawdownType) + selectField('lossBasis', 'Base da regra', [['balance', 'Balance'], ['equity', 'Equity']], current.lossBasis) + field('timezone', 'Fuso IANA', 'text', current.timezone, 'required placeholder="America/New_York"') + field('rolloverTime', 'Rollover diário', 'time', current.rolloverTime, 'required') + field('profitSplit', 'Profit split (%)', 'number', current.profitSplit, 'min="0" max="100" step="0.01"');
  modal(id ? 'Editar conta' : 'Cadastrar conta', html, (values) => {
    const now = new Date().toISOString(); const account = { ...current, ...values, id: id || uid(), initialBalanceCents: toCents(values.initialBalance), profitTargetCents: toCents(values.profitTarget), dailyLossLimitCents: toCents(values.dailyLossLimit), maxLossLimitCents: toCents(values.maxLossLimit), profitSplit: Number(values.profitSplit), archived: current.archived || false, createdAt: current.createdAt || now, updatedAt: now, version: Number(current.version || 0) + 1 };
    validateAccount(account); commit(() => { if (id) db.accounts = db.accounts.map((item) => item.id === id ? account : item); else { db.accounts.push(account); db.phases.push({ id: uid(), accountId: account.id, name: 'Avaliação', status: 'active', startedAt: now, endedAt: null, version: 1 }); } }, id ? 'update' : 'create', 'accounts');
  });
}
function tradeForm(id) {
  if (!db.accounts.some((account) => !account.archived)) { toast('Cadastre uma conta ativa antes.'); setPage('accounts'); return; }
  const current = db.trades.find((trade) => trade.id === id) || { accountId: selected === 'all' ? accountOptions()[0][0] : selected, closedDate: isoDate(), openedAt: `${isoDate()}T09:00`, closedAt: `${isoDate()}T12:00`, symbol: 'EUR/USD', side: 'Compra', riskCents: 10000, plannedRewardCents: 20000, grossPnlCents: 0, feesCents: 0, swapCents: 0, commissionCents: 0, entry: '', stopLoss: '', takeProfit: '', exit: '', lots: '', strategy: '', notes: '', partialExits: [] };
  const activePhase = current.phaseId || db.phases.find((phase) => phase.accountId === current.accountId && phase.status === 'active')?.id;
  const html = selectField('accountId', 'Conta', accountOptions(), current.accountId) + selectField('phaseId', 'Fase', phaseOptions(current.accountId), activePhase) + field('closedDate', 'Data operacional', 'date', current.closedDate, 'required') + selectField('side', 'Direção', [['Compra', 'Compra'], ['Venda', 'Venda']], current.side) + field('symbol', 'Par / ativo', 'text', current.symbol, 'required maxlength="30"') + field('lots', 'Lotes', 'number', current.lots, 'min="0" step="0.01"') + field('entry', 'Entrada', 'number', current.entry, 'min="0" step="any"') + field('stopLoss', 'Stop loss', 'number', current.stopLoss, 'min="0" step="any"') + field('takeProfit', 'Take profit', 'number', current.takeProfit, 'min="0" step="any"') + field('exit', 'Saída final', 'number', current.exit, 'min="0" step="any"') + field('risk', 'Risco inicial (USD)', 'number', fromCents(current.riskCents), 'required min="0.01" step="0.01"') + field('plannedReward', 'Recompensa planejada (USD)', 'number', fromCents(current.plannedRewardCents), 'required min="0" step="0.01"') + field('grossPnl', 'PnL bruto (USD)', 'number', fromCents(current.grossPnlCents), 'required step="0.01"') + field('fees', 'Custos (USD)', 'number', fromCents(current.feesCents), 'min="0" step="0.01"') + field('commission', 'Comissão (USD)', 'number', fromCents(current.commissionCents), 'min="0" step="0.01"') + field('swap', 'Swap (USD)', 'number', fromCents(current.swapCents), 'step="0.01"') + field('strategy', 'Estratégia', 'text', current.strategy, 'maxlength="80"') + field('partialPnls', 'Saídas parciais — PnL USD, separado por vírgula', 'text', current.partialExits.map((item) => fromCents(item.pnlCents)).join(', '), 'placeholder="50, 75.25"', true) + textArea('notes', 'Observações', current.notes);
  modal(id ? 'Editar operação' : 'Registrar operação', html, (values) => {
    const account = db.accounts.find((item) => item.id === values.accountId); if (!account) throw new Error('Conta inválida.');
    const trade = normalizeTrade({ ...current, ...values, id: id || uid(), phaseId: db.phases.some((phase) => phase.id === values.phaseId && phase.accountId === values.accountId) ? values.phaseId : db.phases.find((phase) => phase.accountId === values.accountId && phase.status === 'active')?.id, closedDate: values.closedDate, openedAt: current.openedAt || `${values.closedDate}T09:00:00Z`, closedAt: `${values.closedDate}T12:00:00Z`, timezone: account.timezone, entry: values.entry === '' ? null : Number(values.entry), stopLoss: values.stopLoss === '' ? null : Number(values.stopLoss), takeProfit: values.takeProfit === '' ? null : Number(values.takeProfit), exit: values.exit === '' ? null : Number(values.exit), lots: values.lots === '' ? null : Number(values.lots), partialExits: values.partialPnls.split(',').map((item) => item.trim()).filter(Boolean).map((item, index) => ({ id: `${id || 'new'}-${index}`, pnlCents: toCents(item) })), version: Number(current.version || 0) + 1 });
    validateTrade(trade, db); commit(() => { if (id) db.trades = db.trades.map((item) => item.id === id ? trade : item); else db.trades.push(trade); }, id ? 'update' : 'create', 'trades');
  });
}
function phaseForm(accountId) {
  const current = db.phases.find((phase) => phase.accountId === accountId && phase.status === 'active'); modal('Transição de fase', field('name', 'Nova fase', 'text', '', 'required maxlength="80"') + field('startedAt', 'Início', 'date', isoDate(), 'required') + selectField('previousResult', 'Resultado da fase anterior', [['passed', 'Aprovada'], ['failed', 'Reprovada'], ['closed', 'Encerrada']], 'passed'), (values) => commit(() => { if (current) Object.assign(current, { status: values.previousResult, endedAt: `${values.startedAt}T00:00:00Z`, version: current.version + 1 }); db.phases.push({ id: uid(), accountId, name: values.name.trim(), status: 'active', startedAt: `${values.startedAt}T00:00:00Z`, endedAt: null, version: 1 }); }, 'transition', 'phases'));
}
function cashFlowForm(accountId) {
  if (!db.accounts.length) return toast('Cadastre uma conta primeiro.'); modal('Registrar movimentação', selectField('accountId', 'Conta', accountOptions(), accountId || accountOptions()[0][0]) + field('date', 'Data', 'date', isoDate(), 'required') + selectField('type', 'Tipo', [['deposit', 'Depósito'], ['withdrawal', 'Saque'], ['adjustment', 'Ajuste'], ['fee', 'Taxa'], ['payout', 'Payout']], 'deposit') + field('amount', 'Valor com sinal (USD)', 'number', 0, 'required step="0.01"') + `<label class="check field full"><input name="affectsBalance" type="checkbox" checked> Impacta o saldo operacional</label>` + textArea('notes', 'Observações', '', 500), (values) => { const amountCents = toCents(values.amount); commit(() => db.cashFlows.push({ id: uid(), accountId: values.accountId, date: values.date, occurredAt: `${values.date}T12:00:00Z`, type: values.type, amountCents, affectsBalance: values.affectsBalance === 'on', notes: values.notes.trim(), version: 1 }), 'create', 'cashFlows'); });
}
function payoutForm(accountId) {
  modal('Registrar payout', selectField('accountId', 'Conta', accountOptions(), accountId || accountOptions()[0][0]) + selectField('status', 'Status', [['requested', 'Solicitado'], ['approved', 'Aprovado'], ['received', 'Recebido'], ['rejected', 'Recusado']], 'requested') + field('requestedAt', 'Data da solicitação', 'date', isoDate(), 'required') + field('receivedAt', 'Data do recebimento', 'date', '') + field('requested', 'Valor solicitado (USD)', 'number', 0, 'required min="0" step="0.01"') + field('received', 'Valor recebido (USD)', 'number', 0, 'min="0" step="0.01"'), (values) => commit(() => db.payouts.push({ id: uid(), accountId: values.accountId, status: values.status, requestedAt: values.requestedAt, receivedAt: values.receivedAt || null, requestedCents: toCents(values.requested), receivedCents: toCents(values.received), version: 1 }), 'create', 'payouts'));
}
function feeForm(accountId) {
  modal('Registrar taxa de prop firm', selectField('accountId', 'Conta', accountOptions(), accountId || accountOptions()[0][0]) + field('date', 'Data', 'date', isoDate(), 'required') + selectField('type', 'Tipo', [['evaluation', 'Avaliação'], ['reset', 'Reset'], ['activation', 'Ativação'], ['platform', 'Plataforma'], ['other', 'Outra']], 'evaluation') + field('amount', 'Valor pago (USD)', 'number', 0, 'required min="0" step="0.01"') + textArea('notes', 'Observações', '', 500), (values) => commit(() => db.fees.push({ id: uid(), accountId: values.accountId, date: values.date, type: values.type, amountCents: toCents(values.amount), notes: values.notes.trim(), version: 1 }), 'create', 'fees'));
}
function snapshotForm(accountId) { modal('Snapshot de balance e equity', field('capturedAt', 'Data e hora', 'datetime-local', new Date().toISOString().slice(0, 16), 'required') + field('balance', 'Balance (USD)', 'number', 0, 'required step="0.01"') + field('equity', 'Equity (USD)', 'number', 0, 'required step="0.01"'), (values) => commit(() => db.snapshots.push({ id: uid(), accountId, capturedAt: new Date(values.capturedAt).toISOString(), balanceCents: toCents(values.balance), equityCents: toCents(values.equity), version: 1 }), 'create', 'snapshots')); }
function dayDetail(date) { const trades = activeTrades().filter((trade) => trade.closedDate === date); const stats = summarize(trades); modal(`Operações de ${date}`, `<div class="field full"><strong>${money(stats.pnlCents)} • ${signed(stats.r, 'R')} • ${stats.count} operações</strong></div><div class="field full">${trades.map((trade) => `<div class="detail-item">${esc(trade.symbol)} • ${esc(accountName(trade.accountId))} • ${money(netPnlCents(trade))} • ${signed(tradeR(trade), 'R')}</div>`).join('') || 'Nenhuma operação.'}</div>`, () => {}, { submit: false }); }

function exportCsv() { const columns = ['closedDate', 'accountId', 'phaseId', 'symbol', 'side', 'entry', 'stopLoss', 'takeProfit', 'exit', 'lots', 'riskCents', 'plannedRewardCents', 'grossPnlCents', 'feesCents', 'swapCents', 'commissionCents', 'netPnlCents', 'strategy', 'notes']; const rows = [columns.join(','), ...db.trades.map((trade) => columns.map((key) => `"${String(trade[key] ?? '').replace(/"/g, '""')}"`).join(','))]; download('forex-trades.csv', `\ufeff${rows.join('\r\n')}`, 'text/csv;charset=utf-8'); }
function bindImport() { const input = $('#importFile'); if (!input) return; input.onchange = async (event) => { const file = event.target.files?.[0]; if (!file) return; try { const imported = validateImport(JSON.parse(await file.text())); if (confirm('Substituir todos os dados locais pelo backup validado?')) { db = localRepository.replace(imported); selected = 'all'; toast('Backup importado.'); render(); } } catch (error) { alert(error.message); } }; }

$('#entityForm').onsubmit = (event) => { event.preventDefault(); try { formHandler(Object.fromEntries(new FormData(event.currentTarget).entries())); $('#dialog').close(); } catch (error) { $('#formError').textContent = error.message; } };
$('#dialog').addEventListener('close', () => { $('#entityForm button[type=submit]').hidden = false; formHandler = null; });
$('#closeDialog').onclick = $('#cancelDialog').onclick = () => $('#dialog').close();
$('#nav').addEventListener('click', (event) => { const button = event.target.closest('[data-page]'); if (button) setPage(button.dataset.page); });
$('#accountFilter').onchange = (event) => { selected = event.target.value; filters.account = selected; render(); };
$('#quickAdd').onclick = () => tradeForm();
$('#menuButton').onclick = () => { const open = $('.sidebar').classList.toggle('open'); $('#menuButton').setAttribute('aria-expanded', String(open)); };
$('#app').addEventListener('change', (event) => { if (event.target.dataset.filter) { filters[event.target.dataset.filter] = event.target.value; render(); } });
$('#app').addEventListener('click', async (event) => {
  const button = event.target.closest('button'); if (!button) return; if (button.dataset.goto) return setPage(button.dataset.goto); const action = button.dataset.action; const id = button.dataset.id; if (!action) return;
  try {
    if (action === 'new-account') accountForm(); else if (action === 'edit-account') accountForm(id); else if (action === 'toggle-archived') { showArchived = !showArchived; render(); }
    else if (action === 'archive-account') commit(() => { const account = db.accounts.find((item) => item.id === id); account.archived = !account.archived; account.updatedAt = new Date().toISOString(); }, 'archive-toggle', 'accounts');
    else if (action === 'phase') phaseForm(id); else if (action === 'cash-flow') cashFlowForm(id); else if (action === 'fee') feeForm(id); else if (action === 'payout') payoutForm(id); else if (action === 'snapshot') snapshotForm(id);
    else if (action === 'new-trade') tradeForm(); else if (action === 'edit-trade') tradeForm(id); else if (action === 'delete-trade' && confirm('Excluir esta operação?')) commit(() => { db.trades = db.trades.filter((trade) => trade.id !== id); }, 'delete', 'trades');
    else if (action === 'delete-cash-flow' && confirm('Excluir esta movimentação?')) commit(() => { db.cashFlows = db.cashFlows.filter((flow) => flow.id !== id); }, 'delete', 'cashFlows');
    else if (action === 'clear-filters') { Object.assign(filters, { account: selected, from: '', to: '', firm: '', phase: '', symbol: '', strategy: '', side: '' }); render(); }
    else if (action === 'calendar-mode') { calendarMode = button.dataset.mode; render(); } else if (action === 'prev-period') { if (calendarMode === 'year') year -= 1; else if (--month < 0) { month = 11; year -= 1; } render(); } else if (action === 'next-period') { if (calendarMode === 'year') year += 1; else if (++month > 11) { month = 0; year += 1; } render(); } else if (action === 'today') { year = new Date().getFullYear(); month = new Date().getMonth(); render(); } else if (action === 'open-month') { month = Number(button.dataset.month); calendarMode = 'month'; render(); } else if (action === 'day-detail') dayDetail(button.dataset.date);
    else if (action === 'export-json') download(`forex-journal-backup-${isoDate()}.json`, JSON.stringify(db, null, 2)); else if (action === 'import-json') $('#importFile').click(); else if (action === 'export-csv') exportCsv();
    else if (action === 'sign-in') await auth.signIn(); else if (action === 'sign-out') await auth.signOut(); else if (action === 'sync-pull') { if (confirm('Substituir a cópia local pela versão remota?')) { db = await sync.pull(); render(); } } else if (action === 'sync-push') { db = await sync.push(db); render(); }
  } catch (error) { toast(error.message); }
});
window.addEventListener('resize', () => { if (page === 'dashboard' || page === 'analytics') render(); });
render();
