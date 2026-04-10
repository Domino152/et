const express = require('express');
const router = express.Router();
const Receipt = require('../models/Receipt');

// @route   POST /api/receipts
// @desc    Store new receipt metadata after successful upload
router.post('/', async (req, res) => {
  try {
    console.log('[RECEIPT_POST] Incoming record saving request:', req.body);
    const { userId, name, imageUrl, description, category, date } = req.body;


    // Simplified validation: email is no longer required
    if (!userId || !imageUrl || !category || !date) {
      return res.status(400).json({ error: 'Missing required fields (userId, imageUrl, category, date).' });
    }

    const newReceipt = new Receipt({ userId, name, imageUrl, description, category, date });
    const saved = await newReceipt.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error('Error saving receipt:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/receipts
// @desc    Get receipts for a user, using userId (email)
router.get('/', async (req, res) => {
  try {
    const userId = req.query.userId || req.query.email;
    console.log(`[RECEIPT_GET] Fetching history for user: ${userId}`);


    if (!userId) {
      return res.status(400).json({ error: 'userId query parameter is required.' });
    }

    const filter = { userId };
    const { category } = req.query;

    if (category && (category === 'Purchase' || category === 'Expense')) {
      filter.category = category;
    }

    const receipts = await Receipt.find(filter).sort({ date: -1, timestamp: -1 });
    res.json(receipts);
  } catch (err) {
    console.error('Error fetching receipts:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
