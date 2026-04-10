const mongoose = require('mongoose');

const receiptSchema = new mongoose.Schema({
  userId: { type: String, required: true }, // The email of the user
  name: { type: String, required: true },
  imageUrl: { type: String, required: true }, // Google Drive link
  description: { type: String, default: '' },
  category: { type: String, enum: ['Purchase', 'Expense'], required: true },
  date: { type: Date, required: true },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Receipt', receiptSchema);
