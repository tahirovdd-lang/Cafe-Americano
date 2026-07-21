const TelegramApp = window.Telegram?.WebApp;

function queryNumber(name, fallback = 0) {
  const value = new URLSearchParams(location.search).get(name);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const bootstrapProfile = {
  progress: queryNumber('progress', 0),
  step: 6,
  left: queryNumber('left', 6),
  coffee_total: queryNumber('coffee_total', 0),
  free_total: queryNumber('free_total', 0),
  first_name: TelegramApp?.initDataUnsafe?.user?.first_name || '',
  username: TelegramApp?.initDataUnsafe?.user?.username || '',
};

const explicitApi = new URLSearchParams(location.search).get('api');
export const API_BASE = (
  explicitApi ||
  localStorage.getItem('americano_api_url') ||
  location.origin
).replace(/\/$/, '');

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
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
    localStorage.setItem('americano_profile', JSON.stringify(result));
    return result;
  } catch (error) {
    console.warn('Profile API fallback:', error);
    const saved = localStorage.getItem('americano_profile');
    return saved ? { ...bootstrapProfile, ...JSON.parse(saved) } : bootstrapProfile;
  }
}

export async function loadOrders() {
  if (!TelegramApp?.initData) return [];
  try {
    return await request('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ init_data: TelegramApp.initData }),
    });
  } catch (error) {
    console.warn('Orders API fallback:', error);
    return [];
  }
}

export function saveOptimisticProfile(profile) {
  localStorage.setItem('americano_profile', JSON.stringify(profile));
}
