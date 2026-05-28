const express = require('express');
const Product = require('../models/Product');
const { requireRole } = require('../middleware/roleGuard');
const { verifyFirebaseToken } = require('../middleware/auth');

const router = express.Router();

router.use(verifyFirebaseToken);

// GET /api/products
router.get('/', async (req, res) => {
  try {
    const role = req.user?.role || 'rep';
    // mimic existing frontend: reps only see stock >= 1; managers see all
    const filter = role === 'manager' ? {} : { stock: { $gte: 1 } };
    const products = await Product.find(filter)
      .select('name price cost category stock image')
      .lean();

    return res.json({ products });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch products', details: err.message });
  }
});

// POST /api/products (manager)
router.post('/', requireRole(['manager']), async (req, res) => {
  try {
    const { name, price, cost, category = 'Uncategorized', stock, image = '' } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name is required' });

    const product = await Product.create({
      name,
      price: Number(price),
      cost: Number(cost || 0),
      category: String(category || 'Uncategorized').trim(),
      stock: Number(stock || 0),
      image: String(image || ''),
      createdBy: req.user.uid,
      updatedBy: req.user.uid,
    });

    return res.status(201).json({ product });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create product', details: err.message });
  }
});

// PUT /api/products/:id (manager)
router.put('/:id', requireRole(['manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, cost, category, stock, image } = req.body || {};

    const updated = await Product.findByIdAndUpdate(
      id,
      {
        $set: {
          ...(name !== undefined ? { name } : {}),
          ...(price !== undefined ? { price: Number(price) } : {}),
          ...(cost !== undefined ? { cost: Number(cost) } : {}),
          ...(category !== undefined ? { category: String(category).trim() } : {}),
          ...(stock !== undefined ? { stock: Number(stock) } : {}),
          ...(image !== undefined ? { image: String(image) } : {}),
          updatedBy: req.user.uid,
        },
      },
      { new: true }
    ).lean();

    if (!updated) return res.status(404).json({ error: 'Product not found' });
    return res.json({ product: updated });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update product', details: err.message });
  }
});

// DELETE /api/products/:id (manager)
router.delete('/:id', requireRole(['manager']), async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id).lean();
    if (!deleted) return res.status(404).json({ error: 'Product not found' });
    return res.json({ ok: true, product: deleted });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete product', details: err.message });
  }
});

module.exports = router;

