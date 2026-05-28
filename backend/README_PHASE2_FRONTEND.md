# Phase 2: Frontend migration (no UI redesign)

## Goal
Keep `index.html` + UI layout + login flow as-is.
Only replace Firebase Realtime Database read/write calls with REST calls to the MongoDB backend.

## How frontend will authenticate
Frontend already uses Firebase Authentication. We must attach the Firebase ID token:

- Get ID token: `firebaseUser.getIdToken()` (already accessible in auth.js)
- Send it on every request:
  - `Authorization: Bearer <idToken>`

## Add one constant
Create (or inline) something like:

```js
const API_BASE_URL = 'http://localhost:5000';
```

## Fetch wrappers (recommended)
Add helpers in frontend code (minimal diff):

```js
async function apiFetch(path, { method='GET', body, token } = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(()=> '');
    throw new Error(text || `API ${res.status}`);
  }
  return res.json();
}
```

## Replace in this order
1) `products.js`
   - replace `loadProducts()` + restock/product save with `/api/products`
2) `sales.js`
   - replace `recordSale()` with `POST /api/sales`
3) `approvals.js`
   - replace `loadPendingSales()` with `GET /api/sales/pending`
   - replace approve/reject with `POST /api/sales/:id/approve|reject`
4) `audit.js`
   - replace `loadRecentAuditLogs()` and `logAudit()` with REST (needs API endpoints)

## Backend missing endpoints
Phase 1 implemented products + sales. To fully switch audit approvals without breaking UI, we still need:
- `GET /api/audit` (manager)
- `POST /api/audit` (optional; backend writes is better)

Once those are added, the frontend can stop using Firebase Realtime DB completely.

