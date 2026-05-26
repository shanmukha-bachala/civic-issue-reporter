const express = require('express');
const jwt = require('jsonwebtoken');
const { query } = require('../../config/database');

const router = express.Router();

const generateToken = (id, email, role) => {
  return jwt.sign(
    { id, email, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

const validProviders = new Set(['google', 'facebook', 'x']);

// Dev-friendly start endpoints (optional)
router.get('/:provider/start', async (req, res) => {
  const { provider } = req.params;
  if (!validProviders.has(provider)) {
    return res.status(400).json({ success: false, error: 'Unsupported provider' });
  }
  // In production, redirect to provider auth URL.
  return res.status(200).json({ success: true, message: `OAuth dev start for ${provider}. Use POST /api/auth/oauth to complete.` });
});

router.get('/:provider/callback', (req, res) => {
  return res.status(200).json({ success: true, message: 'OAuth dev callback placeholder.' });
});

// POST /api/auth/oauth
// Accepts { provider, email?, firstName?, lastName?, role? }
// In production, verify provider token/id; here we support a dev-friendly flow using email.
router.post('/', async (req, res, next) => {
  try {
    const { provider, email, firstName, lastName, role } = req.body || {};
    if (!provider || !validProviders.has(provider)) {
      return res.status(400).json({ success: false, error: 'Invalid provider' });
    }

    const finalEmail = (email || `${provider}_${Date.now()}@example.dev`).toLowerCase();

    // Check if user exists
    let userResult = await query('SELECT id, email, first_name, last_name, role, is_verified, created_at FROM users WHERE email = $1', [finalEmail]);

    let user;
    if (userResult.rows.length === 0) {
      // Create user with OAuth (no password)
      const newRole = role === 'admin' ? 'admin' : 'citizen';
      const insert = await query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role, is_verified)
         VALUES ($1, NULL, $2, $3, $4, TRUE)
         RETURNING id, email, first_name, last_name, role, is_verified, created_at`,
        [finalEmail, firstName || provider, lastName || 'user', newRole]
      );
      user = insert.rows[0];

      // Insert into role tables
      const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
      if (user.role === 'admin') {
        await query('INSERT INTO admins (user_id, display_name) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING', [user.id, displayName]);
      } else {
        await query('INSERT INTO citizens (user_id, display_name) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING', [user.id, displayName]);
      }
    } else {
      user = userResult.rows[0];
    }

    const token = generateToken(user.id, user.email, user.role);
    return res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          isVerified: user.is_verified,
          createdAt: user.created_at
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
