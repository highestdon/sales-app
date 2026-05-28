const express = require('express');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const AuditLog = require('../models/AuditLog');
const { requireRole } = require('../middleware/roleGuard');
const { verifyFirebaseToken } = require('../middleware/auth');

const router = express.Router();
router.use(verifyFirebaseToken);

function actingUserFields(req) {
  return {
    actingUserEmail: req.user?.email || null,
    actingUserUid: req.user?.uid || null,
  };
}

async function writeAudit(eventType, req, payload) {
  const log = await AuditLog.create({
    eventType,
    ...actingUserFields(req),
    ip: req.ip,
    deviceInfo: payload?.deviceInfo,
    payload,
  });
  return log;
}

// POST /api/sales (rep creates pending)
router.post('/', async (req, res) => {
  try {
    const role = req.user?.role || 'rep';
    const { productId, quantity } = req.body || {};
    const qty = Number(quantity);
    if (!productId) return res.status(400).json({ error: 'productId is required' });
    if (!Number.isInteger(qty) || qty <= 0) return res.status(400).json({ error: 'quantity must be > 0 integer' });

    const product = await Product.findById(productId).select('name price cost stock').lean();
    if (!product) return res.status(404).json({ error: 'Product not found' });

    if (qty > Number(product.stock || 0)) {
      return res.status(400).json({ error: `Only ${product.stock} item(s) available in stock.` });
    }

    const unitCost = Number(product.cost || 0);
    const total = qty * Number(product.price);
    const profit = qty * (Number(product.price) - unitCost);
    const marginPercent = unitCost > 0 ? ((Number(product.price) - unitCost) / unitCost) * 100 : 0;

    const now = new Date();
    const isManagerSale = role === 'manager';

    const sale = await Sale.create({
      productId: String(productId),
      productName: product.name,
      quantity: qty,
      price: Number(product.price),
      total,

      status: isManagerSale ? 'approved' : 'pending',

      userId: req.user.uid,
      userEmail: req.user.email,
      userName: req.user.name,

      createdBy: req.user.uid,
      updatedBy: req.user.uid,

      approvedBy: isManagerSale ? req.user.email : null,
      approvedAt: isManagerSale ? now : null,

      rejectedAt: null,
      rejectionReason: null,
      rejectedBy: null,

      productCost: unitCost,
      profit,
      marginPercent,

      requestedStock: Number(product.stock || 0),

      deviceInfo: {
        platform: req.body?.deviceInfo?.platform || '',
        browser: req.body?.deviceInfo?.browser || '',
        userAgent: req.body?.deviceInfo?.userAgent || '',
      },
    });

    await writeAudit(isManagerSale ? 'SALE_CREATED_APPROVED' : 'SALE_CREATED', req, {
      saleId: sale._id.toString(),
      productId: sale.productId,
      productName: sale.productName,
      quantity: sale.quantity,
      total: sale.total,
      status: sale.status,
    });

    if (isManagerSale) {
      const remainingStock = Number(product.stock || 0) - qty;
      await Product.findByIdAndUpdate(productId, { $set: { stock: remainingStock }, $currentDate: { updatedAt: true } });
      await writeAudit('STOCK_UPDATED', req, {
        productId: sale.productId,
        productName: sale.productName,
        quantityChange: -qty,
        newStock: remainingStock,
      });
    }

    return res.status(201).json({ sale });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create sale', details: err.message });
  }
});

// GET /api/sales (role filtered)
router.get('/', async (req, res) => {
  try {
    const role = req.user?.role || 'rep';
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const skip = Math.max(Number(req.query.skip || 0), 0);

    const filter = role === 'manager' ? {} : { userId: req.user.uid };

    const sales = await Sale.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('productId productName quantity price total status createdAt approvedAt rejectedAt rejectionReason userId userEmail userName')
      .lean();

    return res.json({ sales });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch sales', details: err.message });
  }
});

// GET /api/sales/pending (manager)
router.get('/pending', requireRole(['manager']), async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const pending = await Sale.find({ status: 'pending' })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('productId productName quantity total status createdAt userId userEmail userName')
      .lean();

    return res.json({ sales: pending });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch pending sales', details: err.message });
  }
});

// POST /api/sales/:id/approve (manager)
router.post('/:id/approve', requireRole(['manager']), async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ error: 'Sale not found' });
    if (sale.status !== 'pending') return res.status(400).json({ error: 'Only pending sales can be approved' });

    const product = await Product.findById(sale.productId).select('stock').lean();
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const remainingStock = Number(product.stock || 0) - Number(sale.quantity);
    if (remainingStock < 0) return res.status(400).json({ error: 'Insufficient stock to approve sale' });

    const now = new Date();

    sale.status = 'approved';
    sale.approvedAt = now;
    sale.approvedBy = req.user.email;
    sale.updatedBy = req.user.uid;

    await sale.save();

    await Product.findByIdAndUpdate(sale.productId, { $set: { stock: remainingStock }, $currentDate: { updatedAt: true } });

    await writeAudit('SALE_APPROVED', req, { saleId: sale._id.toString(), productId: sale.productId, quantity: sale.quantity, total: sale.total });
    await writeAudit('STOCK_UPDATED', req, { productId: sale.productId, productName: sale.productName, quantityChange: -sale.quantity, newStock: remainingStock });

    return res.json({ sale: sale.toObject() });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to approve sale', details: err.message });
  }
});

// POST /api/sales/:id/reject (manager)
router.post('/:id/reject', requireRole(['manager']), async (req, res) => {
  try {
    const { reason = null } = req.body || {};
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ error: 'Sale not found' });
    if (sale.status !== 'pending') return res.status(400).json({ error: 'Only pending sales can be rejected' });

    const now = new Date();
    sale.status = 'rejected';
    sale.rejectedAt = now;
    sale.rejectedBy = req.user.email;
    sale.rejectionReason = reason ? String(reason).trim() : null;
    sale.updatedBy = req.user.uid;

    await sale.save();

    await writeAudit('SALE_REJECTED', req, {
      saleId: sale._id.toString(),
      productId: sale.productId,
      quantity: sale.quantity,
      total: sale.total,
      rejectionReason: sale.rejectionReason,
    });

    return res.json({ sale: sale.toObject() });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to reject sale', details: err.message });
  }
});

module.exports = router;

