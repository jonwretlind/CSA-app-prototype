/**
 * api.js — Base API client utility
 * Included on every authenticated page before page-specific scripts.
 */

const API_BASE = '/api';

/**
 * Make an authenticated API request.
 * Automatically attaches the JWT from localStorage.
 * Redirects to login on 401.
 */
async function apiRequest(method, path, body = null) {
  const token = localStorage.getItem('csa_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const options = { method, headers };
  if (body !== null) options.body = JSON.stringify(body);

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, options);
  } catch {
    throw { error: 'Network error — check your connection' };
  }

  if (response.status === 401) {
    localStorage.removeItem('csa_token');
    localStorage.removeItem('csa_user');
    window.location.href = '/index.html';
    return;
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw { error: 'Unexpected server response' };
  }

  if (!response.ok) throw data;
  return data;
}

const api = {
  get:    (path)       => apiRequest('GET',    path),
  post:   (path, body) => apiRequest('POST',   path, body),
  put:    (path, body) => apiRequest('PUT',    path, body),
  delete: (path)       => apiRequest('DELETE', path)
};

/** Get current user from localStorage (cached) */
function currentUser() {
  const raw = localStorage.getItem('csa_user');
  return raw ? JSON.parse(raw) : null;
}

/** Redirect to login unless a valid token exists */
function requireAuth() {
  const token = localStorage.getItem('csa_token');
  if (!token) {
    window.location.href = '/index.html';
    return false;
  }
  return true;
}

/** Redirect to login unless user has one of the required roles */
function requireRole(...roles) {
  if (!requireAuth()) return false;
  const user = currentUser();
  if (!user || !roles.includes(user.role)) {
    window.location.href = '/dashboard.html';
    return false;
  }
  return true;
}

/** Score → hex color */
function scoreColor(score) {
  const colors = {
    1: '#EF5350', 2: '#EF5350', 3: '#FF7043',
    4: '#FFA726', 5: '#FFC107', 6: '#D4E157',
    7: '#9CCC65', 8: '#66BB6A', 9: '#43A047', 10: '#2E7D32'
  };
  return colors[Math.round(score)] || '#9E9E9E';
}

/** Score → zone label */
function scoreZone(score) {
  if (score <= 3) return 'Natural State';
  if (score <= 6) return 'Growing';
  return 'Spiritual State';
}

/** Format ISO date */
function formatDate(iso) {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Show alert element */
function showAlert(elId, message, type = 'error') {
  const el = document.getElementById(elId);
  if (!el) return;
  el.className = `alert alert-${type}`;
  el.textContent = message;
  el.classList.remove('hidden');
}

/** Hide alert element */
function hideAlert(elId) {
  const el = document.getElementById(elId);
  if (el) el.classList.add('hidden');
}
