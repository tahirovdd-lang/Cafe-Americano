const TelegramApp = window.Telegram?.WebApp;

function queryNumber(name, fallback = 0) {
  const value = new URLSearchParams(location.search).get(name);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function queryText(name) {
  return (new URLSearchParams(location.search).get(name) || '').trim();
}

function userFromInitData() {
  try {
    const raw = TelegramApp?.initData || '';
    if (!raw) return {};
    const encoded = new URLSearchParams(raw).get('user');
    return encoded ? JSON.parse(encoded) : {};
  } catch (_) {
    return {};
  }
}

const unsafeUser = TelegramApp?.initDataUnsafe?.user || {};
const parsedUser = userFromInitData();
const tgUser = { ...parsedUser, ...unsafeUser };

export const bootstrapProfile = {
  progress: queryNumber('progress', 0),
  step: 6,
  left: queryNumber('left', 6),
  coffee_total: queryNumber('coffee_total', 0),
  free_total: queryNumber('free_total', 0),
  first_name: tgUser.first_name || queryText('first_name'),
  last_name: tgUser.last_name || queryText('last_name'),
  username: tgUser.username || queryText('username').replace(/^@/, ''),
  user_id: tgUser.id || queryNumber('user_id', 0),
};

const explicitApi = new URLSearchParams(location.search).get('api');
const DEFAULT_API = 'https://bot-1784631986-2397-tahirov-dd.bothost.tech';
export const API_BASE = (
  explicitApi ||
  (location.hostname.endsWith('bothost.tech') ? location.origin : DEFAULT_API)
).replace(/\/$/, '');

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    cache: 'no-store',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`API ${response.status}`);
  return response.json();
}

function readLocalOrders() {
  try {
    const value = JSON.parse(localStorage.getItem('americano_orders') || '[]');
    return Array.isArray(value) ? value : [];
  } catch (_) {
    return [];
  }
}

function mergeOrders(remoteOrders, localOrders) {
  const map = new Map();
  [...localOrders, ...remoteOrders].forEach(order => {
    if (order && order.order_id) map.set(String(order.order_id), order);
  });
  return [...map.values()]
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
    .slice(0, 50);
}

function mergeProfile(saved = {}, remote = {}) {
  const merged = { ...bootstrapProfile, ...saved, ...remote };
  if (!merged.username) merged.username = bootstrapProfile.username;
  if (!merged.first_name) merged.first_name = bootstrapProfile.first_name;
  if (!merged.last_name) merged.last_name = bootstrapProfile.last_name;
  if (!merged.user_id) merged.user_id = bootstrapProfile.user_id;
  return merged;
}

export async function loadProfile() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('americano_profile') || '{}'); } catch (_) {}

  if (!TelegramApp?.initData) return mergeProfile(saved);

  try {
    const result = await request('/api/profile', {
      method: 'POST',
      body: JSON.stringify({ init_data: TelegramApp.initData }),
    });
    const merged = mergeProfile(saved, result);
    localStorage.setItem('americano_profile', JSON.stringify(merged));
    return merged;
  } catch (error) {
    console.warn('Profile API fallback:', error);
    return mergeProfile(saved);
  }
}

export async function loadOrders() {
  const localOrders = readLocalOrders();
  if (!TelegramApp?.initData) return localOrders;
  try {
    const remoteOrders = await request('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ init_data: TelegramApp.initData }),
    });
    const merged = mergeOrders(Array.isArray(remoteOrders) ? remoteOrders : [], localOrders);
    localStorage.setItem('americano_orders', JSON.stringify(merged));
    return merged;
  } catch (error) {
    console.warn('Orders API fallback:', error);
    return localOrders;
  }
}

export function saveLocalOrder(order) {
  const merged = mergeOrders([], [order, ...readLocalOrders()]);
  localStorage.setItem('americano_orders', JSON.stringify(merged));
  return merged;
}

export function saveOptimisticProfile(profile) {
  localStorage.setItem('americano_profile', JSON.stringify(mergeProfile(profile)));
}
