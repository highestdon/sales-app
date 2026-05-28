const express = require('express');

const AuditLog = require('../models/AuditLog');
const { verifyFirebaseToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleGuard');

const router = express.Router();

router.use(verifyFirebaseToken);

// POST /api/audit
// Minimal endpoint needed by current frontend (action, performedBy, details)
router.post('/', async (req, res) => {
  try {
    const { action, performedBy, details = {} } = req.body || {};

    if (!action) {
      return res.status(400).json({ error: 'action is required' });
    }

    const log = await AuditLog.create({
      eventType: String(action),
      actingUserEmail: performedBy || req.user?.email || null,
      actingUserUid: req.user?.uid || null,
      ip: req.ip,
      deviceInfo: details?.deviceInfo,
      payload: {
        performedBy: performedBy || null,
        details,
      },
    });

    return res.status(201).json({ audit: log });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to write audit log', details: err.message });
  }
});

// GET /api/audit?limit=40
// Manager only (keeps other role data restricted)
router.get('/', requireRole(['manager']), async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 40), 200);

    const logs = await AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.json({ logs });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load audit logs', details: err.message });
  }
});

module.exports = router;

