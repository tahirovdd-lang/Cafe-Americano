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

// Remove an old API address saved by previous Mini App versions.
localStorage.removeItem('americano_api_url');

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`API ${response.status}`);
  return response.json();
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
  try {
    if (!TelegramApp?.initData) {
      const saved = localStorage.getItem('americano_orders');
      return saved ? JSON.parse(saved) : [];
    }
    const result = await request('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ init_data: TelegramApp.initData }),
    });
    const orders = Array.isArray(result) ? result : [];
    localStorage.setItem('americano_orders', JSON.stringify(orders));
    return orders;
  } catch (error) {
    console.warn('Orders API fallback:', error);
    const saved = localStorage.getItem('americano_orders');
    return saved ? JSON.parse(saved) : [];
  }
}

export function saveOptimisticProfile(profile) {
  localStorage.setItem('americano_profile', JSON.stringify(profile));
}