const TelegramApp = window.Telegram?.WebApp;

function queryNumber(name, fallback = 0) {
  const value = new URLSearchParams(location.search).get(name);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const tgUser = TelegramApp?.initDataUnsafe?.user || {};

export const bootstrapProfile = {
  progress: queryNumber('progress', 0),
  step: 6,
  left: queryNumber('left', 6),
  coffee_total: queryNumber('coffee_total', 0),
  free_total: queryNumber('free_total', 0),
  first_name: tgUser.first_name || '',
  last_name: tgUser.last_name || '',
  username: tgUser.username || '',
  user_id: tgUser.id || 0,
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

export async function loadProfile() {
  if (!TelegramApp?.initData) return bootstrapProfile;
  try {
    const result = await request('/api/profile', {
      method: 'POST',
      body: JSON.stringify({ init_data: TelegramApp.initData }),
    });
    const merged = { ...bootstrapProfile, ...result };
    localStorage.setItem('americano_profile', JSON.stringify(merged));
    return merged;
  } catch (error) {
    console.warn('Profile API fallback:', error);
    const saved = localStorage.getItem('americano_profile');
    return saved ? { ...bootstrapProfile, ...JSON.parse(saved) } : bootstrapProfile;
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
  localStorage.setItem('americano_profile', JSON.stringify(profile));
}
