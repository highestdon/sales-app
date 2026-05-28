// apiClient.js (minimal helper for REST calls to MongoDB backend)

export const API_BASE_URL = 'http://localhost:5000';

export async function apiFetch(path, { method = 'GET', body = undefined, token = window.firebaseIdToken } = {}) {
  // token may be fetched lazily from Firebase Auth; avoids passing undefined during initial render.
  if (!token) {
    try {
      // Prefer a dedicated helper if available
      if (typeof window.getFirebaseIdToken === 'function') {
        token = await window.getFirebaseIdToken();
      } else if (window?.currentUser?.firebaseUser?.getIdToken) {
        // Fallback shape if currentUser stores the firebaseUser object
        token = await window.currentUser.firebaseUser.getIdToken();
      }
    } catch (_) {
      // ignore; request will fail with 401 and we’ll show backend error.
    }
  }

  const headers = {
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let text = '';
    try {
      text = await res.text();
    } catch (_) {}
    throw new Error(text || `API request failed: ${res.status}`);
  }

  // Some endpoints might return empty body
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return null;
  return res.json();
}

