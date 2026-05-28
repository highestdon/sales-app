const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema(
  {
    productId: { type: String, index: true, required: true },
    productName: { type: String, required: true },

    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true },
    total: { type: Number, required: true },

    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },

    userId: { type: String, index: true, required: true },
    userEmail: { type: String },
    userName: { type: String },

    createdBy: { type: String },
    updatedBy: { type: String },

    // approvals
    approvedBy: { type: String },
    approvedAt: { type: Date },

    rejectedAt: { type: Date },
    rejectionReason: { type: String },
    rejectedBy: { type: String },

    // commission fields (optional precomputed)
    productCost: { type: Number, default: 0 },
    profit: { type: Number, default: 0 },
    marginPercent: { type: Number, default: 0 },

    // requested stock snapshot
    requestedStock: { type: Number },

    deviceInfo: {
      platform: { type: String, default: '' },
      browser: { type: String, default: '' },
      userAgent: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

saleSchema.index({ userId: 1, createdAt: -1 });
saleSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Sale', saleSchema);

