import { logAudit, loadAuditLogs } from './audit.js';
import { refreshProducts } from './products.js';
import { apiFetch } from './apiClient.js';

let pendingSalesList = document.getElementById('pendingSalesList');
let auditLogList = document.getElementById('auditLogList');
let approvalEventsAttached = false;


function refreshElementReferences() {
  pendingSalesList = document.getElementById('pendingSalesList');
  auditLogList = document.getElementById('auditLogList');
}

function formatTimestamp(value) {
  return new Date(value).toLocaleString();
}

function createPendingSaleRow(sale) {
  return `
    <article class="card approval-row">
      <div class="card-body">
        <div class="approval-header">
          <div>
            <h4 class="card-title">${sale.productName}</h4>
            <p class="muted">Requested by ${sale.userEmail}</p>
          </div>
          <span class="status-chip status-pending">PENDING</span>
        </div>
        <p>Quantity: <strong>${sale.quantity}</strong></p>
        <p>Request total: <strong>GHS ${Number(sale.total).toFixed(2)}</strong></p>
        <p>Recorded: ${formatTimestamp(Number(sale.createdAt) || 0)}</p>
        <p class="muted">Requested stock at time: ${sale.requestedStock ?? 'unknown'}</p>
        <div class="approval-actions">
          <button class="btn btn-primary" data-action="approve" data-sale-id="${sale.id}">Approve</button>
          <button class="btn btn-secondary" data-action="reject" data-sale-id="${sale.id}">Reject</button>
        </div>
      </div>
    </article>`;
}

function createAuditLogRow(log) {
  const details = JSON.stringify(log.details || {}, null, 0);
  return `
    <article class="card audit-row">
      <div class="card-body">
        <div class="audit-header">
          <div>
            <h4 class="card-title">${log.action.replace(/_/g, ' ')}</h4>
            <p class="muted">Performed by ${log.performedBy}</p>
          </div>
          <span class="muted">${formatTimestamp(log.timestamp)}</span>
        </div>
        <p>${details}</p>
      </div>
    </article>`;
}

export async function loadPendingSales(currentUser) {
  refreshElementReferences();
  if (!pendingSalesList) return [];
  if (!currentUser || currentUser.role !== 'manager') {
    pendingSalesList.innerHTML = '<div class="empty-state">Manager access only.</div>';
    return [];
  }

  try {
    const res = await apiFetch('/api/sales/pending', { method: 'GET' });
    const salesArr = res?.sales || [];

    const sales = salesArr.map((s) => ({
      id: s.id || s._id,
      ...s
    }));

    pendingSalesList.innerHTML = sales.length
      ? sales.map(createPendingSaleRow).join('')
      : '<div class="empty-state">No pending sales to approve.</div>';

    return sales;
  } catch (error) {
    console.error('Unable to load pending sales', error);
    pendingSalesList.innerHTML = '<div class="notification">Unable to load pending approvals.</div>';
    return [];
  }
}


export async function refreshPendingSales(currentUser) {
  return loadPendingSales(currentUser);
}

export async function refreshAuditLogs(currentUser) {
  return loadRecentAuditLogs(currentUser);
}

export async function loadRecentAuditLogs(currentUser) {
  refreshElementReferences();
  if (!auditLogList) return [];
  if (!currentUser || currentUser.role !== 'manager') {
    auditLogList.innerHTML = '<div class="empty-state">Audit logs are available to managers only.</div>';
    return [];
  }

  const logs = await loadAuditLogs(40);
  auditLogList.innerHTML = logs.length
    ? logs.map(createAuditLogRow).join('')
    : '<div class="empty-state">No audit activity recorded yet.</div>';
  return logs;
}

export function attachApprovalEvents(currentUser) {
  refreshElementReferences();

  if (!pendingSalesList || !currentUser || approvalEventsAttached) return;

  console.log('Attaching approval events to pendingSalesList');
  approvalEventsAttached = true;

  pendingSalesList.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const saleId = button.dataset.saleId;
    const action = button.dataset.action;

    if (!saleId || !action) return;

    try {
      button.disabled = true;
      if (action === 'approve') {
        await approveSale(saleId, currentUser);
      } else if (action === 'reject') {
        const reason = window.prompt('Optional rejection reason:');
        await rejectSale(saleId, reason, currentUser);
      }

      await refreshProducts(currentUser.role);
      await refreshPendingSales(currentUser);
      await refreshAuditLogs(currentUser);

      if (window.refreshApp) {
        await window.refreshApp();
      }
    } catch (error) {
      console.error('Approval action failed', error);
      alert(error.message || 'Unable to complete the approval action.');
    } finally {
      button.disabled = false;
    }
  });
}

async function approveSale(saleId, currentUser) {
  // manager approval => POST /api/sales/:id/approve
  const res = await apiFetch(`/api/sales/${saleId}/approve`, {
    method: 'POST',
    body: {}
  });

  await logAudit('SALE_APPROVED', currentUser.email, {
    saleId,
    productId: res?.sale?.productId,
    productName: res?.sale?.productName,
    quantity: res?.sale?.quantity,
    approvedBy: currentUser.email
  });
}

async function rejectSale(saleId, reason, currentUser) {
  const res = await apiFetch(`/api/sales/${saleId}/reject`, {
    method: 'POST',
    body: { rejectionReason: reason || null }
  });

  await logAudit('SALE_REJECTED', currentUser.email, {
    saleId,
    productId: res?.sale?.productId,
    productName: res?.sale?.productName,
    quantity: res?.sale?.quantity,
    rejectedBy: currentUser.email,
    reason: reason || 'No reason provided'
  });
}


