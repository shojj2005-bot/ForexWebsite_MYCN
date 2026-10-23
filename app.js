const RATE = 0.6252;
const storeKey = 'mycn-prototype-state-v1';

const defaultState = {
  user: null,
  wallet: 0,
  orders: [],
  history: [],
  accounts: [],
  draft: { direction: 'cny-myr', send: 1000, receive: 625.2 },
  activeOrderId: null
};

let state = loadState();
let currentPage = 'home';
let toastTimer;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storeKey));
    return saved ? { ...defaultState, ...saved } : structuredClone(defaultState);
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(storeKey, JSON.stringify(state));
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function nowTime() {
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
}

function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function updateClock() {
  document.querySelectorAll('#rate-time').forEach((el) => { el.textContent = nowTime(); });
}

function setPage(page) {
  const protectedPages = ['dashboard', 'exchange', 'orders', 'wallet', 'accounts'];
  if (protectedPages.includes(page) && !state.user) {
    showToast('请先登录或注册演示账户');
    page = 'login';
  }
  currentPage = page;
  document.querySelectorAll('[data-page]').forEach((item) => item.classList.toggle('active', item.dataset.page === page));
  document.querySelectorAll('.nav-link').forEach((item) => item.classList.toggle('active', item.dataset.action === `go-${page}`));
  if (page === 'dashboard') renderDashboard();
  if (page === 'orders') renderOrders();
  if (page === 'wallet') renderWallet();
  if (page === 'accounts') renderAccounts();
  if (['orders', 'wallet', 'accounts'].includes(page)) renderSidebarClones(page);
  if (page === 'exchange') prepareExchange();
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
  const links = [
    ['dashboard', '▦', '账户概览'],
    ['exchange', '⇄', '申请换汇'],
    ['orders', '▤', '我的订单'],
    ['wallet', '◇', '点数账户'],
    ['accounts', '▣', '收款账户']
  ];
  return `<div class="profile-block"><span class="avatar">${name.charAt(0)}</span><div><b>${name}</b><small>${email}</small></div></div><nav class="account-nav">${links.map(([page, icon, label]) => `<button class="account-nav-link ${page === activePage ? 'selected' : ''}" data-action="go-${page}">${icon} <span>${label}</span></button>`).join('')}</nav><button class="logout-button" data-action="logout">退出登录</button>`;
}

function renderSidebarClones(activePage) {
  document.querySelectorAll('.sidebar-clone').forEach((sidebar) => {
    sidebar.innerHTML = sidebarMarkup(activePage);
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
}

function updateHomeCalculator() {
  const input = document.querySelector('#home-amount');
  const output = document.querySelector('#home-result');
  output.textContent = formatNumber((Number(input.value) || 0) * RATE);
}

function updateRateCalculator() {
  const direction = document.querySelector('#rate-direction').value;
  const amount = Number(document.querySelector('#rate-amount').value) || 0;
  const isCny = direction === 'cny-myr';
  document.querySelector('#rate-input-unit').textContent = isCny ? 'CNY' : 'MYR';
  document.querySelector('#rate-output').innerHTML = `${formatNumber(isCny ? amount * RATE : amount / RATE)} <em>${isCny ? 'MYR' : 'CNY'}</em>`;
}

function updateExchangeAmounts() {
  const direction = document.querySelector('input[name="direction"]:checked').value;
  const sent = Number(document.querySelector('#exchange-send').value) || 0;
  const isCny = direction === 'cny-myr';
  const receive = isCny ? sent * RATE : sent / RATE;
  state.draft = { direction, send: sent, receive };
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

function showSummary() {
  const { direction, send, receive } = state.draft;
  const method = document.querySelector('#recipient-method').value;
  const person = document.querySelector('#recipient-name').value.trim();
  const number = document.querySelector('#recipient-number').value.trim();
  if (!person || !number) {
    showToast('请填写收款人姓名和账户号码');
    return false;
  }
  const isCny = direction === 'cny-myr';
  document.querySelector('#summary-direction').textContent = isCny ? 'CNY → MYR' : 'MYR → CNY';
  document.querySelector('#summary-send').textContent = `${formatNumber(send)} ${isCny ? 'CNY' : 'MYR'}`;
  document.querySelector('#summary-receive').textContent = `${formatNumber(receive)} ${isCny ? 'MYR' : 'CNY'}`;
  document.querySelector('#summary-account').textContent = `${method} · ${person} · ${number.slice(-4).padStart(number.length, '•')}`;
  const points = Math.ceil(isCny ? send : receive);
  document.querySelector('#summary-points').textContent = `${formatNumber(points).replace('.00', '')} 点`;
  document.querySelector('#confirm-balance').textContent = Number(state.wallet).toLocaleString('zh-CN');
  return true;
}

function createOrder() {
  const { direction, send, receive } = state.draft;
  const isCny = direction === 'cny-myr';
  const cost = Math.ceil(isCny ? send : receive);
  if (state.wallet < cost) {
    showToast(`点数不足，还需要 ${cost - state.wallet} 点。请先充值。`);
    setPage('wallet');
    return;
  }
  const account = {
    method: document.querySelector('#recipient-method').value,
    name: document.querySelector('#recipient-name').value.trim(),
    bank: document.querySelector('#recipient-bank').value.trim(),
    number: document.querySelector('#recipient-number').value.trim()
  };
  const id = `MY${new Date().toISOString().slice(2, 10).replaceAll('-', '')}${String(Date.now()).slice(-4)}`;
  state.wallet -= cost;
  state.history.unshift({ type: 'use', amount: cost, title: `订单 ${id} 点数预扣`, time: formatDate() });
  state.accounts = [account, ...state.accounts.filter((item) => item.number !== account.number)];
  state.orders.unshift({ id, direction, send, receive, cost, account, status: '待上传凭证', date: formatDate(), proof: null });
  state.activeOrderId = id;
  saveState();
  document.querySelector('#proof-order-id').textContent = id;
  renderHeader();
  setExchangeStep(4);
}

function submitProof() {
  const order = state.orders.find((item) => item.id === state.activeOrderId);
  if (!order) return;
  const file = document.querySelector('#proof-file').files[0];
  order.proof = file ? file.name : '未选择文件（演示提交）';
  order.status = '待确认';
  saveState();
  showToast('凭证已提交，订单状态为“待确认”');
  setPage('orders');
}

function formatDate() {
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
}

function renderDashboard() {
  if (!state.user) return;
  document.querySelector('#user-avatar').textContent = state.user.name.charAt(0);
  document.querySelector('#user-name').textContent = state.user.name;
  document.querySelector('#user-email').textContent = state.user.email;
  document.querySelector('#dashboard-name').textContent = state.user.name;
  document.querySelector('#wallet-balance').textContent = Number(state.wallet).toLocaleString('zh-CN');
  document.querySelector('#ongoing-orders').textContent = state.orders.filter((item) => item.status !== '已完成').length;
  const area = document.querySelector('#recent-orders');
  if (!state.orders.length) {
    area.className = 'empty-state';
    area.innerHTML = '<span>◌</span><h3>还没有换汇订单</h3><p>完成第一笔换汇申请后，订单会显示在这里。</p><button class="button button-primary" data-action="go-exchange">开始换汇</button>';
    return;
  }
  area.className = 'orders-list';
  area.innerHTML = state.orders.slice(0, 3).map(orderMarkup).join('');
}

function orderMarkup(order) {
  const isCny = order.direction === 'cny-myr';
  const statusClass = order.status === '已完成' ? 'done' : '';
  return `<article class="order-card"><div><small>订单号</small><b>${escapeHtml(order.id)}</b><small>${escapeHtml(order.date)}</small></div><div><small>换汇方向</small><b>${isCny ? 'CNY → MYR' : 'MYR → CNY'}</b></div><div><small>预计收到</small><b>${formatNumber(order.receive)} ${isCny ? 'MYR' : 'CNY'}</b></div><div><span class="status ${statusClass}">${escapeHtml(order.status)}</span></div></article>`;
}

function renderOrders() {
  const area = document.querySelector('#orders-list');
  if (!state.orders.length) {
    area.innerHTML = '<div class="empty-inline">暂时没有订单。<button class="inline-button" data-action="go-exchange">开始第一笔换汇</button></div>';
    return;
  }
  area.innerHTML = state.orders.map(orderMarkup).join('');
}

function renderWallet() {
  document.querySelector('#wallet-balance-large').textContent = Number(state.wallet).toLocaleString('zh-CN');
  const area = document.querySelector('#wallet-history');
  if (!state.history.length) {
    area.innerHTML = '<div class="empty-inline">尚无点数记录。您可以点击上方金额添加模拟点数。</div>';
    return;
  }
  area.innerHTML = state.history.map((item) => `<div class="history-item"><div><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.time)}</small></div><b class="${item.type === 'use' ? 'negative' : 'positive'}">${item.type === 'use' ? '-' : '+'}${Number(item.amount).toLocaleString('zh-CN')} 点</b></div>`).join('');
}

function renderAccounts() {
  const area = document.querySelector('#saved-accounts');
  if (!state.accounts.length) {
    area.innerHTML = '<div class="empty-inline">还没有收款账户。创建换汇申请时填写的资料将会显示在这里。</div>';
    return;
  }
  area.innerHTML = state.accounts.map((account) => `<div class="saved-account"><div><b>${escapeHtml(account.method)} · ${escapeHtml(account.name)}</b><small>${escapeHtml(account.bank ? `${account.bank} · ` : '')}${escapeHtml(account.number.slice(-4).padStart(account.number.length, '•'))}</small></div><span class="status done">已保存</span></div>`).join('');
}

function recharge(amount) {
  if (!amount || amount < 1) return;
  state.wallet += amount;
  state.history.unshift({ type: 'add', amount, title: '模拟点数充值', time: formatDate() });
  saveState();
  renderWallet();
  showToast(`已添加 ${Number(amount).toLocaleString('zh-CN')} 点模拟余额`);
}

function login(form) {
  const data = new FormData(form);
  const email = String(data.get('email')).trim();
  state.user = { name: email.split('@')[0] || '同学', email };
  saveState();
  renderHeader();
  showToast('登录成功，欢迎回来');
  setPage('dashboard');
}

function register(form) {
  const data = new FormData(form);
  state.user = { name: String(data.get('name')).trim(), email: String(data.get('email')).trim() };
  saveState();
  renderHeader();
  showToast('账户已创建，已登录演示账户');
  setPage('dashboard');
}

function logout() {
  state.user = null;
  saveState();
  renderHeader();
  showToast('已退出演示账户');
  setPage('home');
}

document.addEventListener('click', (event) => {
  const actionElement = event.target.closest('[data-action]');
  if (actionElement) {
    const action = actionElement.dataset.action;
    if (action === 'start-exchange') setPage(state.user ? 'exchange' : 'register');
    else if (action === 'logout') logout();
    else if (action.startsWith('go-')) setPage(action.slice(3));
  }
  const next = event.target.closest('[data-next-step]');
  if (next) {
    const target = Number(next.dataset.nextStep);
    if (target === 3 && !showSummary()) return;
    setExchangeStep(target);
  }
  const previous = event.target.closest('[data-prev-step]');
  if (previous) setExchangeStep(Number(previous.dataset.prevStep));
  const rechargeButton = event.target.closest('[data-recharge]');
  if (rechargeButton) recharge(Number(rechargeButton.dataset.recharge));
  if (event.target.closest('#custom-recharge')) {
    const amount = Number(window.prompt('请输入要添加的模拟点数：', '1000'));
    if (Number.isFinite(amount) && amount > 0) recharge(Math.floor(amount));
  }
  if (event.target.closest('#confirm-order')) createOrder();
  if (event.target.closest('#submit-proof')) submitProof();
  if (event.target.closest('#swap-direction')) {
    const selected = document.querySelector('input[name="direction"]:checked');
    document.querySelector(`input[name="direction"][value="${selected.value === 'cny-myr' ? 'myr-cny' : 'cny-myr'}"]`).checked = true;
    updateExchangeAmounts();
  }
});

document.querySelector('#home-amount').addEventListener('input', updateHomeCalculator);
document.querySelector('#rate-amount').addEventListener('input', updateRateCalculator);
document.querySelector('#rate-direction').addEventListener('change', updateRateCalculator);
document.querySelector('#exchange-send').addEventListener('input', updateExchangeAmounts);
document.querySelectorAll('input[name="direction"]').forEach((input) => input.addEventListener('change', updateExchangeAmounts));
document.querySelector('#proof-file').addEventListener('change', (event) => {
  const file = event.target.files[0];
  document.querySelector('#selected-file').textContent = file ? `已选择：${file.name}` : '';
});
document.querySelector('#login-form').addEventListener('submit', (event) => { event.preventDefault(); login(event.currentTarget); });
document.querySelector('#register-form').addEventListener('submit', (event) => { event.preventDefault(); register(event.currentTarget); });

updateClock();
updateHomeCalculator();
updateRateCalculator();
renderHeader();
setInterval(updateClock, 30000);
