const admin = require('firebase-admin');

console.log('[auth.js] loaded');


function getFirebaseAdmin() {
  if (admin.apps && admin.apps.length) return admin;

  // Prefer env var, but fall back to bundled key file in this backend folder.
  // This prevents 401s on platforms where FIREBASE_SERVICE_ACCOUNT_PATH is misconfigured.
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  // Support relative path like "./serviceAccountKey.json" from backend/ folder
  const path = require('path');

  const resolvedPath = serviceAccountPath
    ? (path.isAbsolute(serviceAccountPath)
        ? serviceAccountPath
        : path.resolve(process.cwd(), serviceAccountPath))
    : path.resolve(process.cwd(), 'serviceAccountKey.json');

  // Helpful runtime info (shown in Render logs) to verify the mount path
  // without exposing secret contents.
  try {
    // eslint-disable-next-line global-require
    const fs = require('fs');
    const exists = fs.existsSync(resolvedPath);
    // eslint-disable-next-line no-console
    console.log('[firebase-admin] serviceAccountPath=', serviceAccountPath || '(default)');
    // eslint-disable-next-line no-console
    console.log('[firebase-admin] resolvedPath=', resolvedPath, 'exists=', exists);
  } catch (_) {
    // ignore logging issues
  }



  // eslint-disable-next-line import/no-dynamic-require
 const fs = require('fs');

const serviceAccount = JSON.parse(
  fs.readFileSync(resolvedPath, 'utf8')
);
console.log(
  '[firebase-admin] loaded project:',
  serviceAccount.project_id
);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  return admin;
}

async function verifyFirebaseToken(req, res, next) {
  // Allow CORS preflight to pass through without auth.
  // Browsers send OPTIONS before POST when custom headers (Authorization) are used.
  if (req.method === 'OPTIONS') {
    return next();
  }

  try {
    const authHeader = req.headers.authorization || '';
    const [, token] = authHeader.split(' ');
    if (!token) {
      return res.status(401).json({ error: 'Missing Authorization Bearer token' });
    }

    const firebaseAdmin = getFirebaseAdmin();
    const decoded = await firebaseAdmin.auth().verifyIdToken(token);

    req.user = {
      uid: decoded.uid,
      email: decoded.email || null,
      name: decoded.name || null,
      // Authorization role is hydrated deterministically from MongoDB in backend/server.js
      role: null,

    };

    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid/expired token', details: err.message });
  }
}

module.exports = { verifyFirebaseToken };

