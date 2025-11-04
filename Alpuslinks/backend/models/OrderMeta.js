const mongoose = require('mongoose');

const orderMetaSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  meta_property: {
    type: String,
    required: true,
    trim: true,
    enum: ['rejectionReason', 'internalNote', 'customerFeedback', 'publisherNote', 'advertiserNote']
  },
  meta_value: {
    type: String,
    required: false,
    trim: true,
    maxlength: [1000, 'Meta value cannot exceed 1000 characters']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for better query performance - ensure unique constraint on orderId + meta_property combination
orderMetaSchema.index({ orderId: 1, meta_property: 1 }, { unique: true });

// Non-unique index for orderId queries
orderMetaSchema.index({ orderId: 1 });

module.exports = mongoose.model('OrderMeta', orderMetaSchema);

