# TODO

## Auth/Backend Fixes (popup + 403 role)
- [x] Step 1: Add single in-flight guard + stricter error handling around Google popup in `auth.js`

- [x] Step 2: Make role hydration deterministic in `backend/server.js` (always hydrate from Mongo when role missing/falsey)

- [x] Step 3: Simplify `backend/middleware/auth.js` to not set `role` from token (uid/email/name only)

- [ ] Step 4: Test: hard refresh, Google login once, verify `/api/sales/pending` returns 200 for managers


