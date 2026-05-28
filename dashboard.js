import { apiFetch } from './apiClient.js';


const summaryCards = document.getElementById('summaryCards');
const revenueSection = document.getElementById('revenueSection');
const dailyRevenueChart = document.getElementById('dailyRevenueChart');
const monthlyRevenueChart = document.getElementById('monthlyRevenueChart');
const topProductsList = document.getElementById('topProductsList');
const repLeaderboard = document.getElementById('repLeaderboard');
const lowStockSection = document.getElementById('lowStockSection');
const lowStockAlerts = document.getElementById('lowStockAlerts');
const commissionCards = document.getElementById('commissionCards');
const commissionEmpty = document.getElementById('commissionEmpty');
const salesList = document.getElementById('salesList');
const exportCsvBtn = document.getElementById('exportCsvBtn');

function getSunday(date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const distance = day;
  copy.setDate(copy.getDate() - distance);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatCurrency(value) {
  return `GHS ${value.toFixed(2)}`;
}

function createSummaryCard(title, value, detail) {
  return `
    <article class="card">
      <div class="card-body">
        <h4 class="card-title">${title}</h4>
        <p>${value}</p>
        <p class="muted">${detail}</p>
      </div>
    </article>`;
}

function createCommissionCard(report) {
  return `
    <article class="card">
      <div class="card-body">
        <h4 class="card-title">${report.repEmail}</h4>
        <p>${report.itemsSold} item(s) sold</p>
        <p>Total revenue: ${formatCurrency(report.revenue)}</p>
        <p>Commission: ${report.commissionPercent}%</p>
        <p class="muted">Earned ${formatCurrency(report.commissionValue)} this week</p>
      </div>
    </article>`;
}

function createStatusBadge(status) {
  const state = status || 'pending';
  const classes = {
    pending: 'status-chip status-pending',
    approved: 'status-chip status-approved',
    rejected: 'status-chip status-rejected'
  };
  return `<span class="${classes[state]}">${state.toUpperCase()}</span>`;
}

function createSaleRow(sale) {
  const createdAt = new Date(sale.createdAt || sale.timestamp || 0).toLocaleString();
  const approvedAt = sale.approvedAt ? new Date(sale.approvedAt).toLocaleString() : '';
  const rejectedAt = sale.rejectedAt ? new Date(sale.rejectedAt).toLocaleString() : '';
  const statusBadge = createStatusBadge(sale.status);

  return `
    <article class="card sale-row">
      <div class="card-body">
        <div class="sale-header">
          <div>
            <h4 class="card-title">${sale.productName}</h4>
            <p class="muted">Sold by: ${sale.userEmail}</p>
          </div>
          ${statusBadge}
        </div>
        <p>Quantity: <strong>${sale.quantity}</strong></p>
        <p>Total: <strong>${formatCurrency(sale.total)}</strong></p>
        <p>Profit: <strong>${formatCurrency(sale.profit || 0)}</strong></p>
        <p>Margin: <strong>${(sale.marginPercent || 0).toFixed(1)}%</strong></p>
        <p class="muted">Recorded: ${createdAt}</p>
        ${sale.status === 'approved' ? `<p class="muted">Approved: ${approvedAt}</p>` : ''}
        ${sale.status === 'rejected' ? `<p class="muted">Rejected: ${rejectedAt}</p><p class="muted">Reason: ${sale.rejectReason || 'Not provided'}</p>` : ''}
      </div>
    </article>`;
}

function getProfitSummary(salesData) {
  const totalRevenue = salesData.reduce((sum, sale) => sum + sale.total, 0);
  const totalProfit = salesData.reduce((sum, sale) => sum + (sale.profit || 0), 0);
  const averageMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  return { totalProfit, averageMargin };
}

function calculateWeeklyCommissionSummary(approvedSales) {
  const weekStart = getSunday(new Date()).getTime();
  const weeklySales = approvedSales.filter((sale) => sale.createdAt >= weekStart);
  const repMap = {};

  weeklySales.forEach((sale) => {
    const email = sale.userEmail;
    if (!repMap[email]) {
      repMap[email] = { repEmail: email, itemsSold: 0, revenue: 0 };
    }
    repMap[email].itemsSold += sale.quantity;
    repMap[email].revenue += sale.total;
  });

  const reports = Object.values(repMap).map((report) => {
    const commissionPercent = report.itemsSold >= 6 ? 15 : report.itemsSold > 0 ? 10 : 0;
    return {
      ...report,
      commissionPercent,
      commissionValue: (commissionPercent / 100) * report.revenue
    };
  });

  const totalCommission = reports.reduce((sum, report) => sum + report.commissionValue, 0);
  const topRep = reports.sort((a, b) => b.revenue - a.revenue)[0] || null;
  return { reports, totalCommission, topRep };
}

export async function renderDashboard(currentUser) {
  const [salesData, productsData] = await Promise.all([
    loadSalesData(),
    loadProductsData()
  ]);

  const approvedSales = salesData.filter((sale) => sale.status === 'approved');
  const pendingSales = salesData.filter((sale) => sale.status === 'pending');
  const rejectedSales = salesData.filter((sale) => sale.status === 'rejected');
  const { totalProfit, averageMargin } = getProfitSummary(approvedSales);

  if (currentUser.role === 'manager') {
    const totalRevenue = approvedSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
    const weeklyCommissionSummary = calculateWeeklyCommissionSummary(approvedSales);

    summaryCards.innerHTML = [
      createSummaryCard('Approved revenue', formatCurrency(totalRevenue), 'Only approved sales count'),
      createSummaryCard(
        'Weekly commission',
        formatCurrency(weeklyCommissionSummary.totalCommission),
        weeklyCommissionSummary.topRep
          ? `Top rep: ${weeklyCommissionSummary.topRep.repEmail}`
          : 'No rep sales this week'
      ),
      createSummaryCard('Pending approvals', `${pendingSales.length}`, 'Sales still awaiting review'),
      createSummaryCard('Inventory count', Object.keys(productsData).length, 'Active products')
    ].join('');

    revenueSection.innerHTML = [
      createSummaryCard('Approved this week', formatCurrency(totalRevenue), 'Revenue after approvals'),
      createSummaryCard(
        'Top rep',
        weeklyCommissionSummary.topRep ? `${weeklyCommissionSummary.topRep.repEmail}` : 'No approved rep sales',
        'Current weekly leader'
      ),
      createSummaryCard('Commission pool', formatCurrency(weeklyCommissionSummary.totalCommission), 'Estimated payout this week')
    ].join('');

    renderManagerInsights(approvedSales);
    renderRepLeaderboard(approvedSales);
    renderLowStockAlerts(productsData);
    renderCommissionReports(approvedSales);
    if (exportCsvBtn) exportCsvBtn.onclick = () => downloadSalesCSV(salesData, currentUser);
    renderSalesHistory(salesData);
  } else {
    const personalSales = salesData.filter((sale) => sale.userEmail === currentUser.email);
    const approvedPersonal = personalSales.filter((sale) => sale.status === 'approved');
    const pendingPersonal = personalSales.filter((sale) => sale.status === 'pending');
    const rejectedPersonal = personalSales.filter((sale) => sale.status === 'rejected');
    const revenue = approvedPersonal.reduce((sum, sale) => sum + sale.total, 0);
    const personalProfit = approvedPersonal.reduce((sum, sale) => sum + (sale.profit || 0), 0);
    const personalMargin = revenue > 0 ? (personalProfit / revenue) * 100 : 0;

    summaryCards.innerHTML = [
      createSummaryCard('Approved revenue', formatCurrency(revenue), 'Revenue counted after approvals'),
      createSummaryCard('Pending sales', `${pendingPersonal.length}`, 'Waiting for manager approval'),
      createSummaryCard('Rejected sales', `${rejectedPersonal.length}`, 'Sales declined by manager'),
      createSummaryCard('Products available', Object.keys(productsData).length, 'Updated inventory')
    ].join('');

    const weeklyPersonalSales = getWeeklyApprovedSales(personalSales);
    const personalCommission = calculateCommissionReport(weeklyPersonalSales);

    revenueSection.innerHTML = [
      createSummaryCard('This week', formatCurrency(revenue), 'Your approved revenue'),
      createSummaryCard('Your margin', `${personalMargin.toFixed(1)}%`, 'Approved sale margin'),
      createSummaryCard(
        'Commission status',
        personalCommission.progressMessage,
        `Current weekly commission: ${personalCommission.commissionPercent}%`
      )
    ].join('');

    renderRepCommissionCards(personalCommission, currentUser);

    if (exportCsvBtn) exportCsvBtn.onclick = () => downloadSalesCSV(personalSales, currentUser);
    renderSalesHistory(personalSales);
  }
}

function getWeeklyApprovedSales(salesData) {
  const weekStart = getSunday(new Date()).getTime();
  return salesData.filter((sale) => sale.status === 'approved' && sale.createdAt >= weekStart);
}

function calculateCommissionReport(salesData) {
  const itemsSold = salesData.reduce((sum, sale) => sum + Number(sale.quantity || 0), 0);
  const revenue = salesData.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const commissionPercent = itemsSold >= 6 ? 15 : itemsSold > 0 ? 10 : 0;
  const remaining = Math.max(0, 6 - itemsSold);
  const progressMessage = itemsSold >= 6
    ? 'You are earning 15% commission this week.'
    : remaining <= 2
      ? `Only ${remaining} more sale${remaining === 1 ? '' : 's'} to reach 15% commission!`
      : `Sell ${remaining} more sale${remaining === 1 ? '' : 's'} to reach 15% commission.`;

  return { itemsSold, revenue, commissionPercent, remaining, progressMessage };
}

function createRepCommissionCard(report, currentUser) {
  return `
    <article class="card">
      <div class="card-body">
        <div class="card-header">
          <div>
            <h4 class="card-title">${currentUser.name || currentUser.email}'s commission</h4>
            <p class="muted">Weekly approved sales performance</p>
          </div>
        </div>
        <p>${report.itemsSold} approved sale${report.itemsSold === 1 ? '' : 's'} this week</p>
        <p>Total revenue: ${formatCurrency(report.revenue)}</p>
        <p>Current commission: <strong>${report.commissionPercent}%</strong></p>
        <p>Earned this week: <strong>${formatCurrency(report.commissionValue || 0)}</strong></p>
        <p class="muted">${report.progressMessage}</p>
      </div>
    </article>`;
}

function renderRepCommissionCards(report, currentUser) {
  if (!commissionCards || !commissionEmpty) return;
  commissionCards.innerHTML = createRepCommissionCard(report, currentUser);
  commissionEmpty.classList.add('hidden');
}

async function loadProductsData() {
  try {
    const res = await apiFetch('/api/products', { method: 'GET' });
    const productsArr = res?.products || [];

    // dashboard expects { [id]: product }
    const productsById = {};
    for (const p of productsArr) {
      const id = p.id || p._id;
      if (id) productsById[id] = p;
    }

    // keep existing low-stock filtering logic untouched (it uses threshold=2)
    return productsById;
  } catch (error) {
    console.error('Error loading products for dashboard', error);
    return {};
  }
}


function normalizeSaleStatus(sale) {
  let status = sale.status;
  if (!status) {
    if (sale.approvedAt) {
      status = 'approved';
    } else if (sale.rejectedAt) {
      status = 'rejected';
    } else {
      status = 'pending';
    }
  }
  return status;
}

async function loadSalesData() {
  try {
    const res = await apiFetch('/api/sales?limit=200', { method: 'GET' });
    const salesArr = res?.sales || [];

    return (salesArr || []).map((sale) => {
      const computedStatus = normalizeSaleStatus(sale);
      return {
        id: sale.id || sale._id,
        ...sale,
        status: computedStatus,
        createdAt: Number(sale.createdAt || sale.timestamp || 0),
        approvedAt: sale.approvedAt ? Number(sale.approvedAt) : null,
        rejectedAt: sale.rejectedAt ? Number(sale.rejectedAt) : null,
        total: Number(sale.total || 0),
        profit: Number(sale.profit || 0),
        marginPercent: Number(sale.marginPercent || 0),
        quantity: Number(sale.quantity || 0),
        userEmail: sale.userEmail,
        productName: sale.productName
      };
    });
  } catch (error) {
    console.error('Error loading sales data', error);
    return [];
  }
}


function renderTopProducts(salesData) {
  if (!topProductsList) return;
  const productTotals = {};

  salesData.forEach((sale) => {
    if (!productTotals[sale.productName]) {
      productTotals[sale.productName] = { quantity: 0, revenue: 0 };
    }
    productTotals[sale.productName].quantity += Number(sale.quantity || 0);
    productTotals[sale.productName].revenue += Number(sale.total || 0);
  });

  const sorted = Object.entries(productTotals)
    .sort(([, a], [, b]) => b.revenue - a.revenue)
    .slice(0, 3);

  if (!sorted.length) {
    topProductsList.innerHTML = '<div class="top-product-card"><p class="muted">No approved sales yet this week.</p></div>';
    return;
  }

  topProductsList.innerHTML = sorted
    .map(
      ([productName, data], index) => `
        <div class="top-product-card">
          <h5>${index + 1}. ${productName}</h5>
          <span>${data.quantity} sold</span>
          <span>${formatCurrency(data.revenue)} revenue</span>
        </div>`
    )
    .join('');
}

function renderManagerInsights(salesData) {
  renderDailyRevenueChart(salesData);
  renderMonthlyRevenueChart(salesData);
  renderTopProducts(salesData);
}

function getWeeksInMonth(date) {
  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const weeks = [];
  let start = new Date(firstOfMonth);

  while (start.getMonth() === firstOfMonth.getMonth()) {
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    weeks.push({
      label: `W${weeks.length + 1}`,
      start: start.getTime(),
      end: Math.min(end.getTime(), new Date(date.getFullYear(), date.getMonth() + 1, 0).getTime())
    });
    start = new Date(end);
    start.setDate(start.getDate() + 1);
  }

  return weeks;
}

function getCurrentWeekDays() {
  const sunday = getSunday(new Date());
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(sunday);
    day.setDate(sunday.getDate() + index);
    return {
      label: day.toLocaleDateString('en-GB', { weekday: 'short' }),
      start: day.getTime(),
      end: day.getTime() + 24 * 60 * 60 * 1000
    };
  });
}

function renderDailyRevenueChart(salesData) {
  if (!dailyRevenueChart) return;
  const days = getCurrentWeekDays();
  const totals = days.map((day) => ({
    label: day.label,
    revenue: salesData.reduce((sum, sale) => (sale.createdAt >= day.start && sale.createdAt < day.end ? sum + sale.total : sum), 0)
  }));
  renderChart(dailyRevenueChart, totals);
}

function renderMonthlyRevenueChart(salesData) {
  if (!monthlyRevenueChart) return;
  const now = new Date();
  const weeks = getWeeksInMonth(now);
  const totals = weeks.map((week) => ({
    label: week.label,
    revenue: salesData.reduce((sum, sale) => (sale.createdAt >= week.start && sale.createdAt <= week.end ? sum + sale.total : sum), 0)
  }));
  renderChart(monthlyRevenueChart, totals);
}

function renderChart(container, totals) {
  const maxRevenue = Math.max(...totals.map((item) => item.revenue), 1);
  container.innerHTML = totals
    .map(
      (item) => `
        <div class="chart-bar-wrapper">
          <div class="chart-bar" style="height: ${Math.max(10, Math.round((item.revenue / maxRevenue) * 100))}%;"></div>
          <span>${item.label}</span>
          <span class="bar-value">${formatCurrency(item.revenue)}</span>
        </div>`
    )
    .join('');
}

function renderRepLeaderboard(salesData) {
  if (!repLeaderboard) return;
  const repTotals = {};

  salesData.forEach((sale) => {
    const email = sale.userEmail;
    if (!repTotals[email]) {
      repTotals[email] = { revenue: 0, itemsSold: 0 };
    }
    repTotals[email].revenue += Number(sale.total || 0);
    repTotals[email].itemsSold += Number(sale.quantity || 0);
  });

  const sorted = Object.entries(repTotals)
    .sort(([, a], [, b]) => b.revenue - a.revenue)
    .slice(0, 5);

  if (!sorted.length) {
    repLeaderboard.innerHTML = '<div class="top-product-card"><p class="muted">No rep sales yet.</p></div>';
    return;
  }

  repLeaderboard.innerHTML = sorted
    .map(
      ([email, stats], index) => `
        <div class="top-product-card">
          <h5>${index + 1}. ${email}</h5>
          <span>${stats.itemsSold} items sold</span>
          <span>${formatCurrency(stats.revenue)} revenue</span>
        </div>`
    )
    .join('');
}

function setupLowStockDropdown() {
  if (!lowStockSection || !lowStockAlerts) return;

  if (!lowStockSection.querySelector('[data-low-stock-toggle]')) {
    const panelHeader = lowStockSection.querySelector('.panel-header');

    if (panelHeader) {
      panelHeader.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%">
          <h3 style="margin:0">Low stock alerts</h3>
          <button type="button" class="btn btn-secondary" data-low-stock-toggle aria-expanded="false">
            Show
          </button>
        </div>
      `;
    }

    const toggleBtn = lowStockSection.querySelector('[data-low-stock-toggle]');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const expanded = toggleBtn.getAttribute('aria-expanded') === 'true';
        toggleBtn.setAttribute('aria-expanded', String(!expanded));
        toggleBtn.textContent = expanded ? 'Show' : 'Hide';
        lowStockAlerts.classList.toggle('hidden', expanded);
      });

      lowStockAlerts.classList.add('hidden');
    }
  }
}

function renderLowStockAlerts(productsData) {
  if (!lowStockSection || !lowStockAlerts) return;

  const threshold = 2;
  const lowStockProducts = Object.entries(productsData).filter(([, product]) =>
    Number(product.stock) <= threshold && Number(product.stock) >= 0
  );

  if (!lowStockProducts.length) {
    lowStockAlerts.innerHTML = '';
    lowStockSection.classList.add('hidden');
    return;
  }

  lowStockSection.classList.remove('hidden');
  setupLowStockDropdown();

  lowStockAlerts.innerHTML = lowStockProducts
    .map(
      ([id, product]) => `
        <div class="alert-chip">
          <div>
            <strong>${product.name}</strong>
            <span>${product.stock} left in stock</span>
          </div>
          <span class="badge low-stock">Low stock</span>
        </div>`
    )
    .join('');
}

function downloadSalesCSV(salesData, currentUser) {
  const headers = ['Product name', 'Quantity', 'Total', 'Rep email', 'Profit', 'Margin %', 'Status', 'Created at'];
  const rows = salesData
    .filter((sale) => currentUser.role === 'manager' || sale.userEmail === currentUser.email)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((sale) => [
      sale.productName,
      sale.quantity,
      sale.total.toFixed(2),
      sale.userEmail,
      (sale.profit || 0).toFixed(2),
      ((sale.marginPercent || 0).toFixed(2)),
      sale.status || 'pending',
      new Date(sale.createdAt).toLocaleString()
    ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `sales-report-${currentUser.role}-${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function renderCommissionReports(salesData) {
  const weekStart = getSunday(new Date()).getTime();
  const weekSales = salesData.filter((sale) => sale.createdAt >= weekStart && sale.status === 'approved');
  const repMap = {};

  weekSales.forEach((sale) => {
    const email = sale.userEmail;
    if (!repMap[email]) {
      repMap[email] = { repEmail: email, itemsSold: 0, revenue: 0 };
    }
    repMap[email].itemsSold += sale.quantity;
    repMap[email].revenue += sale.total;
  });

  const reports = Object.values(repMap).map((report) => {
    const commissionPercent = report.itemsSold >= 6 ? 15 : report.itemsSold > 0 ? 10 : 0;
    return {
      ...report,
      commissionPercent,
      commissionValue: (commissionPercent / 100) * report.revenue
    };
  });

  commissionCards.innerHTML = reports.length
    ? reports.map((report) => createCommissionCard(report)).join('')
    : '';
  commissionEmpty.classList.toggle('hidden', reports.length > 0);
}

function renderSalesHistory(salesData) {
  if (!salesList) return;
  if (!salesData.length) {
    salesList.innerHTML = '<div class="empty-state">No sales recorded yet.</div>';
    return;
  }

  const sorted = salesData.sort((a, b) => (b.createdAt || b.timestamp) - (a.createdAt || a.timestamp));
  salesList.innerHTML = sorted.map(createSaleRow).join('');
}

