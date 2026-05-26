const express = require('express');
const { protect } = require('../middleware/auth');
const { query } = require('../../config/database');

const router = express.Router();

// Get notifications for user
router.get('/', protect, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const read = req.query.read === 'true';
    const limit = parseInt(req.query.limit, 10) || 50;
    const result = await query(
      'SELECT id, title, message, issue_id, is_read, created_at FROM notifications WHERE user_id = $1 AND is_read = $2 ORDER BY created_at DESC LIMIT $3',
      [userId, read, limit]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// Mark all notifications as read
router.put('/mark-all-read', protect, async (req, res, next) => {
  try {
    const userId = req.user.id;
    await query('UPDATE notifications SET is_read = true WHERE user_id = $1', [userId]);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
