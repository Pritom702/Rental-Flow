// ============================================================
//  RentalFlow  |  Sprint 1  |  Owner: M3 - Promit Ghosh Turjo (Promit)
//  GitHub: @___  |  Part: Frontend API client + auth token handling
// ============================================================
// Tiny fetch wrapper. Reads JWT from localStorage and attaches it.
const TOKEN_KEY = 'rentalflow_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // A 401 while we HAD a token means it's expired/invalid — drop it and send
    // the user to login. (Guarded so a failed login attempt doesn't redirect.)
    if (res.status === 401 && getToken()) {
      setToken(null);
      if (window.location.pathname !== '/login') window.location.assign('/login');
    }
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

// Upload one or more image files from the user's device.
// Returns { urls: [...] }. Sends multipart/form-data (no JSON Content-Type so the
// browser sets the multipart boundary itself).
async function uploadImages(fileList) {
  const form = new FormData();
  for (const file of fileList) form.append('images', file);

  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch('/api/uploads', { method: 'POST', headers, body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b),
  put: (p, b) => request('PUT', p, b),
  patch: (p, b) => request('PATCH', p, b),
  del: (p) => request('DELETE', p),
  uploadImages,
};
