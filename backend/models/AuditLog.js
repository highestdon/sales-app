const mongoose = require('mongoose');

const auditSchema = new mongoose.Schema(
  {
    eventType: { type: String, index: true, required: true },
    actingUserEmail: { type: String, index: true },
    actingUserUid: { type: String, index: true },
    ip: { type: String },
    deviceInfo: { type: Object },
    payload: { type: Object },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

module.exports = mongoose.model('AuditLog', auditSchema);

