const admin = require('firebase-admin');

function getFirebaseAdmin() {
  if (admin.apps && admin.apps.length) return admin;

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!serviceAccountPath) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH is not set');
  }

  // Support relative path like "./serviceAccountKey.json" from backend/ folder
  const path = require('path');
  const resolvedPath = path.isAbsolute(serviceAccountPath)
    ? serviceAccountPath
    : path.resolve(process.cwd(), serviceAccountPath);

  // eslint-disable-next-line import/no-dynamic-require
  const serviceAccount = require(resolvedPath);

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

