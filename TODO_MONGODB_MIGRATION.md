# TODO - Move from Firebase Realtime Database to MongoDB + Node API

## 1) Backend scaffold (Node + Express + Mongoose)
- [ ] Create `server/` folder
- [ ] Add `server/package.json`
- [ ] Add `server/server.js` (Express app + middleware)
- [ ] Add `.env.example` and `server/.env` (Mongo URI, Firebase service account file path, API base config)

## 2) Firebase token verification middleware
- [ ] Add `server/middleware/auth.js` to verify Firebase ID tokens using `firebase-admin`
- [ ] Provide `req.user = { uid, email, role, name }` (role comes from MongoDB `users` collection)

## 3) MongoDB schemas
- [ ] Create Mongoose models: `User`, `Product`, `Sale`, `AuditLog`
- [ ] Ensure indexes for common queries (e.g., `sales.status`, `sales.createdAt`)

## 4) API endpoints (match frontend needs)
- [ ] `GET /api/me`
- [ ] `GET /api/products`
- [ ] `POST /api/products` (manager only)
- [ ] `PATCH /api/products/:id` (manager only)
- [ ] `POST /api/sales` (rep creates pending)
- [ ] `GET /api/sales` (manager: pending + recent; rep: own sales)
- [ ] `POST /api/sales/:id/approve` (manager)
- [ ] `POST /api/sales/:id/reject` (manager)
- [ ] `POST /api/audit` (server writes; used by internal helper)
- [ ] `GET /api/audit` (manager only)

## 5) Frontend integration
- [ ] Update `firebase.js` / auth flow: keep Firebase Auth only
- [ ] Replace all Firebase Realtime DB calls in:
  - [ ] `auth.js`
  - [ ] `products.js`
  - [ ] `sales.js`
  - [ ] `approvals.js`
  - [ ] `dashboard.js`
  - [ ] `audit.js`
- [ ] Add `API_BASE_URL` constant and attach `Authorization: Bearer <firebaseIdToken>`

## 6) Migration from existing Firebase data (optional)
- [ ] If you can export Firebase data, create a one-time import script
- [ ] Otherwise, create a manual seed script for users/products

## 7) Testing checklist
- [ ] Smoke test: login with Google/email
- [ ] Manager loads products & updates stock
- [ ] Rep records sale (pending)
- [ ] Manager approves/rejects; product stock updates
- [ ] Dashboard analytics render
- [ ] Audit logs show for managers

