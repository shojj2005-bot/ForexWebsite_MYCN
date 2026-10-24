const RATE = 0.6252;
const storeKey = 'mycn-prototype-state-v2';

const defaultState = {
  user: null,
  points: { available: 0, frozen: 0 },
  orders: [],
  history: [],
  accounts: [],
  draft: { direction: 'cny-myr', send: 1000, receive: 625.2 },
  selectedOrderId: null,
  priority: { supplier: 1, partner: 2, customer: 3 }
};

let state = loadState();
let toastTimer;

function loadState() {
  try {
    const old = JSON.parse(localStorage.getItem('mycn-prototype-state-v1'));
    const saved = JSON.parse(localStorage.getItem(storeKey)) || old;
    const next = { ...structuredClone(defaultState), ...(saved || {}) };
    next.points = { available: Number(saved?.points?.available ?? saved?.wallet ?? 0), frozen: Number(saved?.points?.frozen ?? 0) };
    next.priority = { ...defaultState.priority, ...(saved?.priority || {}) };
    next.orders = Array.isArray(saved?.orders) ? saved.orders : [];
    next.history = Array.isArray(saved?.history) ? saved.history : [];
    next.accounts = Array.isArray(saved?.accounts) ? saved.accounts : [];
    return next;
  } catch { return structuredClone(defaultState); }
}

function saveState() { localStorage.setItem(storeKey, JSON.stringify(state)); }
function formatNumber(value) { return Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function formatPoints(value) { return Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 }); }
function nowTime() { return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()); }
function formatDate() { return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char])); }

function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function updateClock() { document.querySelectorAll('#rate-time').forEach((el) => { el.textContent = nowTime(); }); }

function setPage(page) {
  const protectedPages = ['dashboard', 'exchange', 'orders', 'wallet', 'accounts', 'order-detail', 'dev'];
  if (protectedPages.includes(page) && !state.user) {
    showToast('请先登录或点击“查看示例订单”');
    page = 'login';
  }
  document.querySelectorAll('[data-page]').forEach((item) => item.classList.toggle('active', item.dataset.page === page));
  document.querySelectorAll('.nav-link').forEach((item) => item.classList.toggle('active', item.dataset.action === `go-${page}`));
  if (page === 'dashboard') renderDashboard();
  if (page === 'orders') renderOrders();
  if (page === 'wallet') renderWallet();
  if (page === 'accounts') renderAccounts();
  if (page === 'exchange') prepareExchange();
  if (page === 'order-detail') renderOrderDetail();
  if (page === 'dev') renderDeveloperMode();
  if (['orders', 'wallet', 'accounts', 'order-detail', 'dev'].includes(page)) renderSidebarClones(page);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderHeader() {
  const holder = document.querySelector('#header-actions');
  if (state.user) {
    holder.innerHTML = `<button class="user-menu" data-action="go-dashboard"><span class="avatar">${escapeHtml(state.user.name.charAt(0))}</span><span>${escapeHtml(state.user.name)}</span></button>`;
  } else {
    holder.innerHTML = '<button class="button button-ghost button-small" data-action="go-login">登录</button><button class="button button-primary button-small" data-action="go-register">注册</button>';
  }
}

function sidebarMarkup(activePage) {
  const name = escapeHtml(state.user?.name || '用户');
  const email = escapeHtml(state.user?.email || 'user@example.com');
  const links = [['dashboard', '▦', '账户概览'], ['exchange', '⇄', '创建订单'], ['orders', '▤', '我的订单'], ['wallet', '◇', '点数账户'], ['accounts', '▣', '收款账户'], ['dev', '⚙', '开发者模式']];
  return `<div class="profile-block"><span class="avatar">${name.charAt(0)}</span><div><b>${name}</b><small>${email}</small></div></div><nav class="account-nav">${links.map(([page, icon, label]) => `<button class="account-nav-link ${page === activePage ? 'selected' : ''}" data-action="go-${page}">${icon} <span>${label}</span></button>`).join('')}</nav><button class="logout-button" data-action="logout">退出登录</button>`;
}

function renderSidebarClones(activePage) { document.querySelectorAll('.sidebar-clone').forEach((sidebar) => { sidebar.innerHTML = sidebarMarkup(activePage); }); }

function updateHomeCalculator() { document.querySelector('#home-result').textContent = formatNumber((Number(document.querySelector('#home-amount').value) || 0) * RATE); }
function updateRateCalculator() {
  const direction = document.querySelector('#rate-direction').value;
  const amount = Number(document.querySelector('#rate-amount').value) || 0;
  const isCny = direction === 'cny-myr';
  document.querySelector('#rate-input-unit').textContent = isCny ? 'CNY' : 'MYR';
  document.querySelector('#rate-output').innerHTML = `${formatNumber(isCny ? amount * RATE : amount / RATE)} <em>${isCny ? 'MYR' : 'CNY'}</em>`;
}

function updateExchangeAmounts() {
  const direction = document.querySelector('input[name="direction"]:checked').value;
  const send = Number(document.querySelector('#exchange-send').value) || 0;
  const isCny = direction === 'cny-myr';
  const receive = isCny ? send * RATE : send / RATE;
  state.draft = { direction, send, receive };
  document.querySelector('#exchange-send-unit').textContent = isCny ? 'CNY' : 'MYR';
  document.querySelector('#exchange-receive-unit').textContent = isCny ? 'MYR' : 'CNY';
  document.querySelector('#exchange-receive').textContent = formatNumber(receive);
  document.querySelector('#exchange-rate').textContent = isCny ? '1 CNY = 0.6252 MYR' : '1 MYR = 1.5995 CNY';
}

function prepareExchange() {
  setExchangeStep(1);
  const selected = document.querySelector(`input[name="direction"][value="${state.draft.direction}"]`);
  if (selected) selected.checked = true;
  document.querySelector('#exchange-send').value = state.draft.send || 1000;
  updateExchangeAmounts();
}
function setExchangeStep(number) {
  document.querySelectorAll('.exchange-step').forEach((part) => part.classList.toggle('active', Number(part.dataset.step) === number));
  document.querySelectorAll('#stepper .step').forEach((part, index) => part.classList.toggle('active', index < number));
}
function estimateFee(draft) { return Math.max(1, Math.ceil((draft.direction === 'cny-myr' ? draft.receive : draft.send) * 0.01)); }

function showSummary() {
  const { direction, send, receive } = state.draft;
  const method = document.querySelector('#recipient-method').value;
  const person = document.querySelector('#recipient-name').value.trim();
  const number = document.querySelector('#recipient-number').value.trim();
  if (!person || !number) { showToast('请填写收款人姓名和账户号码'); return false; }
  const isCny = direction === 'cny-myr';
  document.querySelector('#summary-direction').textContent = isCny ? 'CNY → MYR' : 'MYR → CNY';
  document.querySelector('#summary-send').textContent = `${formatNumber(send)} ${isCny ? 'CNY' : 'MYR'}`;
  document.querySelector('#summary-receive').textContent = `${formatNumber(receive)} ${isCny ? 'MYR' : 'CNY'}`;
  document.querySelector('#summary-account').textContent = `${method} · ${person} · ${number.slice(-4).padStart(number.length, '•')}`;
  document.querySelector('#summary-points').textContent = `${formatPoints(estimateFee(state.draft))} 点（匹配后冻结）`;
  document.querySelector('#confirm-balance').textContent = formatPoints(state.points.available);
  return true;
}

function createWaitingOrder() {
  const { direction, send, receive } = state.draft;
  const account = { method: document.querySelector('#recipient-method').value, name: document.querySelector('#recipient-name').value.trim(), bank: document.querySelector('#recipient-bank').value.trim(), number: document.querySelector('#recipient-number').value.trim() };
  const id = `MY${new Date().toISOString().slice(2, 10).replaceAll('-', '')}${String(Date.now()).slice(-4)}`;
  const order = { id, direction, send, receive, account, fee: estimateFee({ direction, send, receive }), feeFrozen: false, route: null, status: '等待匹配', date: formatDate(), myProof: null, counterpartyProof: null, customerConfirmed: false, subOrders: [] };
  state.orders.unshift(order);
  state.accounts = [account, ...state.accounts.filter((item) => item.number !== account.number)];
  state.selectedOrderId = id;
  saveState();
  showToast('等候订单已创建；匹配成功后才需冻结点数');
  setPage('order-detail');
}

function makeDemoCounterparty() { return { role: '供应商', name: '王供应商', bank: '中国银行', number: '6217 0012 3456 7890' }; }
function getSelectedOrder() { return state.orders.find((item) => item.id === state.selectedOrderId); }

function matchOrder(order) {
  if (!order || order.feeFrozen) return;
  if (state.points.available < order.fee) { showToast(`可用点数不足，还需要 ${formatPoints(order.fee - state.points.available)} 点`); setPage('wallet'); return; }
  state.points.available -= order.fee;
  state.points.frozen += order.fee;
  state.history.unshift({ type: 'freeze', amount: order.fee, title: `订单 ${order.id} 服务费已冻结`, time: formatDate() });
  order.feeFrozen = true;
  order.route = '供应商优先';
  order.status = '已匹配 · 点数已冻结';
  order.counterparty = makeDemoCounterparty();
  order.subOrders = [{ id: `${order.id}-1`, role: '供应商', amount: order.receive, currency: order.direction === 'cny-myr' ? 'MYR' : 'CNY', status: '等待您转账' }];
  saveState();
  renderOrderDetail();
  showToast('点数已冻结，对方账户资料已解锁');
}

function submitProof() {
  const order = getSelectedOrder();
  const file = document.querySelector('#modal-proof-file')?.files[0];
  if (!order || !file) { showToast('请先选择一张水单图片或 PDF'); return; }
  order.myProof = file.name;
  order.status = '已上传我的水单 · 等待收款确认';
  if (order.subOrders[0]) order.subOrders[0].status = '等待对方确认收款';
  saveState();
  closeModal();
  renderOrderDetail();
  showToast('水单已上传（演示中仅保存文件名称）');
}

function confirmReceived() {
  const order = getSelectedOrder();
  if (!order?.myProof) { showToast('请先上传您转出的款项水单'); return; }
  if (!window.confirm('确认您已实际收到对方转入的款项吗？确认后，冻结点数将会被扣除。')) return;
  order.customerConfirmed = true;
  order.status = '已完成';
  if (order.subOrders[0]) order.subOrders[0].status = '双方已确认完成';
  state.points.frozen = Math.max(0, state.points.frozen - order.fee);
  state.history.unshift({ type: 'use', amount: order.fee, title: `订单 ${order.id} 已完成，服务费已扣除`, time: formatDate() });
  saveState();
  renderOrderDetail();
  showToast('订单已完成，冻结点数已扣除');
}

function deleteOrder() {
  const order = getSelectedOrder();
  if (!order || order.feeFrozen || order.status !== '等待匹配') { showToast('仅未匹配且没有冻结点数的订单可以删除'); return; }
  if (!window.confirm(`确定删除订单 ${order.id} 吗？删除后无法恢复。`)) return;
  state.orders = state.orders.filter((item) => item.id !== order.id);
  state.selectedOrderId = state.orders[0]?.id || null;
  saveState();
  showToast('订单已删除');
  setPage('orders');
}

function renderDashboard() {
  if (!state.user) return;
  document.querySelector('#user-avatar').textContent = state.user.name.charAt(0);
  document.querySelector('#user-name').textContent = state.user.name;
  document.querySelector('#user-email').textContent = state.user.email;
  document.querySelector('#dashboard-name').textContent = state.user.name;
  document.querySelector('#wallet-balance').textContent = formatPoints(state.points.available);
  document.querySelector('#frozen-balance').textContent = formatPoints(state.points.frozen);
  document.querySelector('#ongoing-orders').textContent = state.orders.filter((item) => item.status !== '已完成').length;
  const area = document.querySelector('#recent-orders');
  if (!state.orders.length) {
    area.className = 'empty-state';
    area.innerHTML = '<span>◌</span><h3>还没有换汇订单</h3><p>订单匹配后，服务费点数才会被冻结。</p><button class="button button-primary" data-action="go-exchange">创建订单</button>';
  } else { area.className = 'orders-list'; area.innerHTML = state.orders.slice(0, 3).map(orderMarkup).join(''); }
}

function orderMarkup(order) {
  const isCny = order.direction === 'cny-myr';
  const statusClass = order.status === '已完成' ? 'done' : order.feeFrozen ? 'frozen' : '';
  const route = order.route ? `<small>${escapeHtml(order.route)}</small>` : '<small>尚未分配对手方</small>';
  return `<button class="order-card" data-action="open-order" data-order-id="${escapeHtml(order.id)}"><div><small>订单号</small><b>${escapeHtml(order.id)}</b><small>${escapeHtml(order.date)}</small></div><div><small>换汇方向</small><b>${isCny ? 'CNY → MYR' : 'MYR → CNY'}</b>${route}</div><div><small>预计收到</small><b>${formatNumber(order.receive)} ${isCny ? 'MYR' : 'CNY'}</b><small>${order.feeFrozen ? `已冻结 ${formatPoints(order.fee)} 点` : `服务费 ${formatPoints(order.fee)} 点`}</small></div><div><span class="status ${statusClass}">${escapeHtml(order.status)}</span><small class="view-order">查看详情 →</small></div></button>`;
}

function renderOrders() {
  const area = document.querySelector('#orders-list');
  area.innerHTML = state.orders.length ? state.orders.map(orderMarkup).join('') : '<div class="empty-inline">暂时没有订单。<button class="inline-button" data-action="go-exchange">创建第一笔等候订单</button></div>';
}

function detailAccountCard(order) {
  const cp = order.counterparty;
  const normalized = cp.number.replace(/\s/g, '');
  return `<section class="detail-card account-unlocked"><div class="card-label-row"><div><span class="unlock-icon">✓</span><small>点数已冻结，资料已解锁</small></div><span class="status frozen">${escapeHtml(order.route || '已匹配')}</span></div><h2>请转账至对方账户</h2><p class="detail-copy">完成转账后上传您自己的水单；对方转账后，您也可以查看对方水单。</p><div class="copy-stack"><button class="copy-item" data-action="copy-account" data-copy="${escapeHtml(normalized)}"><span><small>银行账户号码 · ${escapeHtml(cp.bank)}</small><b>${escapeHtml(cp.number)}</b></span><em>点击复制</em></button><button class="copy-item" data-action="copy-name" data-copy="${escapeHtml(cp.name)}"><span><small>账户户名</small><b>${escapeHtml(cp.name)}</b></span><em>点击复制</em></button></div></section>`;
}

function renderOrderDetail() {
  const area = document.querySelector('#order-detail-content');
  const order = getSelectedOrder();
  if (!order) { area.innerHTML = '<button class="back-link" data-action="go-orders">← 返回我的订单</button><div class="empty-inline">找不到这张订单。</div>'; return; }
  const isCny = order.direction === 'cny-myr';
  const canDelete = !order.feeFrozen && order.status === '等待匹配';
  const routeText = order.feeFrozen ? (order.route || '已匹配') : '系统正在按优先级寻找对手方';
  const lockedContent = `<section class="detail-card account-locked"><span class="locked-icon">🔒</span><h2>对方资料将在匹配后显示</h2><p>订单成功匹配后，先冻结 ${formatPoints(order.fee)} 点服务费，才会解锁对方银行账户与户名。</p>${state.points.available >= order.fee ? '<button class="button button-primary" data-action="simulate-match">原型演示：模拟匹配并冻结点数</button>' : '<button class="button button-ghost" data-action="go-wallet">充值点数后再匹配</button>'}</section>`;
  const matchedActions = `<section class="detail-card actions-card"><div class="card-label-row"><div><p class="eyebrow"><span></span> 交易操作</p><h2>按顺序完成本笔交易</h2></div></div><div class="action-list"><button class="action-row ${order.myProof ? 'complete' : ''}" data-action="open-upload"><span class="action-index">1</span><span><b>${order.myProof ? '我的水单已上传' : '上传转账水单'}</b><small>${order.myProof ? escapeHtml(order.myProof) : '我把款项转出后，上传自己的付款凭证。'}</small></span><em>${order.myProof ? '已上传' : '上传 →'}</em></button><button class="action-row" data-action="view-counterproof"><span class="action-index">2</span><span><b>查看对方上传的水单</b><small>确认对方已转出 ${formatNumber(order.receive)} ${isCny ? 'MYR' : 'CNY'}。</small></span><em>查看 →</em></button><button class="action-row ${order.customerConfirmed ? 'complete' : ''}" data-action="confirm-received"><span class="action-index">3</span><span><b>确认收款完成</b><small>实际收到款项后才确认；确认后才扣除冻结点数。</small></span><em>${order.customerConfirmed ? '已完成' : '确认 →'}</em></button></div></section>`;
  const subRows = order.subOrders?.length ? order.subOrders.map((child, index) => `<div class="child-order"><span>${index + 1}</span><div><b>${escapeHtml(child.role)} · ${formatNumber(child.amount)} ${escapeHtml(child.currency)}</b><small>${escapeHtml(child.status)}</small></div><i class="${child.status.includes('完成') ? 'dot-done' : ''}"></i></div>`).join('') : '<div class="child-order empty-child"><span>—</span><div><b>尚未创建子订单</b><small>系统匹配时会优先单笔成交，最多拆成三笔。</small></div></div>';
  area.innerHTML = `<button class="back-link" data-action="go-orders">← 返回我的订单</button><div class="detail-heading"><div><p class="eyebrow"><span></span> 当前订单详情</p><h1>${isCny ? 'CNY → MYR' : 'MYR → CNY'} <span class="status ${order.status === '已完成' ? 'done' : order.feeFrozen ? 'frozen' : ''}">${escapeHtml(order.status)}</span></h1><p>订单号：${escapeHtml(order.id)} · ${escapeHtml(order.date)}</p></div>${canDelete ? '<button class="button button-danger" data-action="delete-order">删除此订单</button>' : `<span class="delete-note">${order.feeFrozen ? '点数已冻结，不能删除订单' : '订单已完成，不能删除'}</span>`}</div><div class="detail-summary"><div><small>我支付</small><strong>${formatNumber(order.send)} ${isCny ? 'CNY' : 'MYR'}</strong></div><div><small>预计收到</small><strong>${formatNumber(order.receive)} ${isCny ? 'MYR' : 'CNY'}</strong></div><div><small>服务费点数</small><strong>${formatPoints(order.fee)} 点</strong><em>${order.feeFrozen ? '已冻结' : '匹配后冻结'}</em></div><div><small>派单路径</small><strong>${escapeHtml(routeText)}</strong></div></div><div class="detail-layout"><div class="detail-main">${order.feeFrozen ? detailAccountCard(order) + matchedActions : lockedContent}</div><aside class="order-progress"><p class="eyebrow"><span></span> 订单进度</p><h2>${order.subOrders?.length > 1 ? `${order.subOrders.length} 笔子订单` : '单笔订单'}</h2><p>系统优先尝试完整匹配；不能完整承接时最多拆分为三笔。</p><div class="child-list">${subRows}</div><div class="freeze-box"><small>服务费点数</small><b>${order.feeFrozen ? `冻结中：${formatPoints(order.fee)} 点` : `待冻结：${formatPoints(order.fee)} 点`}</b><span>${order.customerConfirmed ? '订单完成，点数已实际扣除。' : '只有双方确认完成后才会实际扣除。'}</span></div></aside></div>`;
}

function renderWallet() {
  document.querySelector('#wallet-balance-large').textContent = formatPoints(state.points.available);
  document.querySelector('#wallet-frozen-large').textContent = formatPoints(state.points.frozen);
  const area = document.querySelector('#wallet-history');
  if (!state.history.length) { area.innerHTML = '<div class="empty-inline">尚无点数记录。点数在订单匹配后才会被冻结。</div>'; return; }
  area.innerHTML = state.history.map((item) => {
    const prefix = item.type === 'use' ? '-' : item.type === 'freeze' ? '冻结 ' : '+';
    const className = item.type === 'use' ? 'negative' : item.type === 'freeze' ? 'frozen-text' : 'positive';
    return `<div class="history-item"><div><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.time)}</small></div><b class="${className}">${prefix}${formatPoints(item.amount)} 点</b></div>`;
  }).join('');
}

function renderAccounts() {
  const area = document.querySelector('#saved-accounts');
  area.innerHTML = state.accounts.length ? state.accounts.map((account) => `<div class="saved-account"><div><b>${escapeHtml(account.method)} · ${escapeHtml(account.name)}</b><small>${escapeHtml(account.bank ? `${account.bank} · ` : '')}${escapeHtml(account.number.slice(-4).padStart(account.number.length, '•'))}</small></div><span class="status done">已保存</span></div>`).join('') : '<div class="empty-inline">还没有收款账户。创建等候订单时填写的资料将会显示在这里。</div>';
}

function renderDeveloperMode() {
  document.querySelectorAll('[data-priority-role]').forEach((select) => { select.value = String(state.priority[select.dataset.priorityRole]); });
  updatePriorityNumbers();
}
function updatePriorityNumbers() { document.querySelectorAll('#priority-list article').forEach((item) => { item.querySelector('.priority-number').textContent = item.querySelector('select').value; }); }
function savePriority() {
  const next = {};
  document.querySelectorAll('[data-priority-role]').forEach((select) => { next[select.dataset.priorityRole] = Number(select.value); });
  if (new Set(Object.values(next)).size !== 3) { showToast('三个角色必须使用不同的优先级'); return; }
  state.priority = next;
  saveState();
  updatePriorityNumbers();
  showToast('演示优先级已保存；真实系统将按此顺序派单');
}

function recharge(amount) {
  if (!amount || amount < 1) return;
  state.points.available += amount;
  state.history.unshift({ type: 'add', amount, title: '模拟点数充值', time: formatDate() });
  saveState();
  renderWallet();
  showToast(`已添加 ${formatPoints(amount)} 点模拟余额`);
}

function login(form) {
  const data = new FormData(form);
  const email = String(data.get('email')).trim();
  state.user = { name: email.split('@')[0] || '同学', email };
  saveState(); renderHeader(); showToast('登录成功，欢迎回来'); setPage('dashboard');
}
function register(form) {
  const data = new FormData(form);
  state.user = { name: String(data.get('name')).trim(), email: String(data.get('email')).trim() };
  saveState(); renderHeader(); showToast('账户已创建，已登录演示账户'); setPage('dashboard');
}
function logout() { state.user = null; saveState(); renderHeader(); showToast('已退出演示账户'); setPage('home'); }
function openOrder(id) { state.selectedOrderId = id; saveState(); setPage('order-detail'); }

function copyText(value, name) {
  const fallback = () => { const input = document.createElement('textarea'); input.value = String(value); document.body.append(input); input.select(); document.execCommand('copy'); input.remove(); showToast(`${name}已复制`); };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(String(value)).then(() => showToast(`${name}已复制`)).catch(fallback); else fallback();
}

function openModal(mode) {
  const order = getSelectedOrder();
  if (!order) return;
  const modal = document.querySelector('#proof-modal');
  const title = document.querySelector('#modal-title');
  const desc = document.querySelector('#modal-description');
  const body = document.querySelector('#modal-body');
  const actions = document.querySelector('#modal-actions');
  if (mode === 'view') {
    title.textContent = '对方上传的转账水单';
    desc.textContent = '这是原型示例，正式版会显示对方实际上传的图片。';
    body.innerHTML = `<div class="slip-preview"><div class="slip-top"><span>转账回单</span><b>已转账</b></div><strong>RM ${formatNumber(order.receive)}</strong><p>付款方：${escapeHtml(order.counterparty?.name || '对方')}</p><p>收款方：${escapeHtml(state.user?.name || '客户')}</p><small>示例水单 · ${formatDate()}</small></div>`;
    actions.innerHTML = '<button class="button button-primary" data-action="close-modal">关闭</button>';
  } else {
    title.textContent = '上传我的转账水单';
    desc.textContent = '选择图片或 PDF 后，再点击确认上传。';
    body.innerHTML = '<label class="upload-zone compact-upload"><input id="modal-proof-file" type="file" accept="image/*,.pdf" /><span class="upload-icon">↑</span><b>选择图片或 PDF</b><small>演示原型只记录文件名称</small></label><p id="modal-selected-file" class="selected-file"></p>';
    actions.innerHTML = '<button class="button button-ghost" data-action="close-modal">取消</button><button class="button button-primary" id="confirm-proof-upload">确认上传</button>';
  }
  modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false');
}
function closeModal() { const modal = document.querySelector('#proof-modal'); modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }

function buildDemoState() {
  const demoOrder = { id: 'MY-DEMO-2601', direction: 'cny-myr', send: 5000, receive: 3049.9, fee: 31, feeFrozen: true, route: '供应商优先 · 单笔承接', status: '已匹配 · 点数已冻结', date: '2026/10/23 10:20', account: { method: 'Maybank', name: '林同学', bank: 'Maybank', number: '012 345 6789' }, counterparty: makeDemoCounterparty(), myProof: null, counterpartyProof: 'supplier-transfer-demo.jpg', customerConfirmed: false, subOrders: [{ id: 'MY-DEMO-2601-1', role: '供应商', amount: 3049.9, currency: 'MYR', status: '等待您转账' }] };
  const waitingOrder = { id: 'MY-DEMO-WAIT-02', direction: 'myr-cny', send: 5000, receive: 7997.5, fee: 50, feeFrozen: false, route: null, status: '等待匹配', date: '2026/10/23 09:40', account: { method: '中国银行', name: '林同学', bank: '中国银行', number: '6217 0022 1133 4455' }, myProof: null, counterpartyProof: null, customerConfirmed: false, subOrders: [] };
  return { ...structuredClone(defaultState), user: { name: '林同学', email: 'demo@mycn.test' }, points: { available: 469, frozen: 31 }, orders: [demoOrder, waitingOrder], accounts: [demoOrder.account, waitingOrder.account], history: [{ type: 'freeze', amount: 31, title: '订单 MY-DEMO-2601 服务费已冻结', time: '2026/10/23 10:20' }, { type: 'add', amount: 500, title: '模拟点数充值', time: '2026/10/23 10:00' }], selectedOrderId: demoOrder.id };
}
function loadDemo() {
  if (state.orders.length && !window.confirm('载入示例订单会替换目前浏览器中的原型数据，确定继续吗？')) return;
  state = buildDemoState(); saveState(); renderHeader(); showToast('已载入示例订单：供应商优先、点数冻结与订单详情'); setPage('order-detail');
}

document.addEventListener('click', (event) => {
  const actionElement = event.target.closest('[data-action]');
  if (actionElement) {
    const action = actionElement.dataset.action;
    if (action === 'start-exchange') setPage(state.user ? 'exchange' : 'register');
    else if (action === 'load-demo') loadDemo();
    else if (action === 'logout') logout();
    else if (action === 'open-order') openOrder(actionElement.dataset.orderId);
    else if (action === 'simulate-match') matchOrder(getSelectedOrder());
    else if (action === 'delete-order') deleteOrder();
    else if (action === 'copy-account') copyText(actionElement.dataset.copy, '银行账户号码');
    else if (action === 'copy-name') copyText(actionElement.dataset.copy, '账户户名');
    else if (action === 'open-upload') openModal('upload');
    else if (action === 'view-counterproof') openModal('view');
    else if (action === 'confirm-received') confirmReceived();
    else if (action === 'close-modal') closeModal();
    else if (action.startsWith('go-')) setPage(action.slice(3));
  }
  const next = event.target.closest('[data-next-step]');
  if (next) { const target = Number(next.dataset.nextStep); if (target === 3 && !showSummary()) return; setExchangeStep(target); }
  const previous = event.target.closest('[data-prev-step]');
  if (previous) setExchangeStep(Number(previous.dataset.prevStep));
  const rechargeButton = event.target.closest('[data-recharge]');
  if (rechargeButton) recharge(Number(rechargeButton.dataset.recharge));
  if (event.target.closest('#custom-recharge')) { const amount = Number(window.prompt('请输入要添加的模拟点数：', '1000')); if (Number.isFinite(amount) && amount > 0) recharge(Math.floor(amount)); }
  if (event.target.closest('#confirm-order')) createWaitingOrder();
  if (event.target.closest('#confirm-proof-upload')) submitProof();
  if (event.target.closest('#save-priority')) savePriority();
  if (event.target.closest('#swap-direction')) {
    const selected = document.querySelector('input[name="direction"]:checked');
    document.querySelector(`input[name="direction"][value="${selected.value === 'cny-myr' ? 'myr-cny' : 'cny-myr'}"]`).checked = true;
    updateExchangeAmounts();
  }
});

document.addEventListener('change', (event) => {
  if (event.target.id === 'modal-proof-file') { const output = document.querySelector('#modal-selected-file'); if (output) output.textContent = event.target.files[0] ? `已选择：${event.target.files[0].name}` : ''; }
  if (event.target.matches('[data-priority-role]')) updatePriorityNumbers();
});
document.querySelector('#home-amount').addEventListener('input', updateHomeCalculator);
document.querySelector('#rate-amount').addEventListener('input', updateRateCalculator);
document.querySelector('#rate-direction').addEventListener('change', updateRateCalculator);
document.querySelector('#exchange-send').addEventListener('input', updateExchangeAmounts);
document.querySelectorAll('input[name="direction"]').forEach((input) => input.addEventListener('change', updateExchangeAmounts));
document.querySelector('#login-form').addEventListener('submit', (event) => { event.preventDefault(); login(event.currentTarget); });
document.querySelector('#register-form').addEventListener('submit', (event) => { event.preventDefault(); register(event.currentTarget); });

updateClock(); updateHomeCalculator(); updateRateCalculator(); renderHeader(); setInterval(updateClock, 30000);
