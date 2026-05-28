import { apiFetch } from './apiClient.js';

export async function logAudit(action, performedBy, details = {}) {
  const res = await apiFetch('/api/audit', {
    method: 'POST',
    body: {
      action,
      performedBy,
      details
    }
  });
  return res?.audit || res;
}

export async function loadAuditLogs(limit = 40) {
  const res = await apiFetch(`/api/audit?limit=${encodeURIComponent(limit)}`, {
    method: 'GET'
  });
  const logs = res?.logs || res?.auditLogs || [];
  return (logs || []).map((l) => ({
    id: l.id || l._id,
    ...l,
    timestamp: Number(l.timestamp || l.createdAt || Date.now())
  })).sort((a, b) => b.timestamp - a.timestamp);
}


