const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    cost: { type: Number, required: true, min: 0 },
    category: { type: String, default: 'Uncategorized', index: true },
    stock: { type: Number, required: true, min: 0, index: true },
    image: { type: String, default: '' },
    createdBy: { type: String },
    updatedBy: { type: String },
  },
  { timestamps: true }
);

productSchema.index({ stock: 1, category: 1 });

module.exports = mongoose.model('Product', productSchema);

