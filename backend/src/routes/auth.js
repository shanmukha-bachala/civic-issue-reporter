const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const { query, transaction } = require('../../config/database');
const { protect, sensitiveOperation } = require('../middleware/auth');

const router = express.Router();

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  firstName: Joi.string().min(1).max(50).required(),
  lastName: Joi.string().max(50).allow('', null).optional(),
  phone: Joi.string().optional(),
  role: Joi.string().valid('citizen', 'admin').default('citizen'),
  latitude: Joi.number().min(-90).max(90).optional(), // admin work area
  longitude: Joi.number().min(-180).max(180).optional(),
  homeLatitude: Joi.number().min(-90).max(90).optional(), // citizen home
  homeLongitude: Joi.number().min(-180).max(180).optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// Generate JWT token
const generateToken = (id, email, role) => {
  return jwt.sign(
    { id, email, role }, 
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
  try {
    const { error } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const { email, password, firstName, lastName, phone, role, latitude, longitude, homeLatitude, homeLongitude } = req.body;

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'User already exists with this email'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const result = await query(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone, role, work_latitude, work_longitude, home_latitude, home_longitude, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false)
       RETURNING id, email, first_name, last_name, role, work_latitude, work_longitude, home_latitude, home_longitude, is_verified, created_at`,
      [email.toLowerCase(), hashedPassword, firstName, lastName || '', phone, role, latitude || null, longitude || null, homeLatitude || null, homeLongitude || null]
    );

    const user = result.rows[0];

    // Insert into role-specific table
    const displayName = `${firstName} ${lastName}`.trim() || email.toLowerCase();
    if (user.role === 'admin') {
      await query(
        'INSERT INTO admins (user_id, display_name) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING',
        [user.id, displayName]
      );
    } else if (user.role === 'citizen') {
      await query(
        'INSERT INTO citizens (user_id, display_name) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING',
        [user.id, displayName]
      );
    }

    // Generate token
    const token = generateToken(user.id, user.email, user.role);

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          workLatitude: user.work_latitude,
          workLongitude: user.work_longitude,
          homeLatitude: user.home_latitude,
          homeLongitude: user.home_longitude,
          isVerified: user.is_verified,
          createdAt: user.created_at
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { error } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const { email, password } = req.body;

    // Get user with password
    const result = await query(
      `SELECT u.id, u.email, u.password_hash, u.first_name, u.last_name, u.role, 
              u.department_id, u.work_latitude, u.work_longitude, u.home_latitude, u.home_longitude, u.is_verified, u.is_active, u.created_at,
              d.name as department_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.email = $1 AND u.is_active = true`,
      [email.toLowerCase()]
    );

    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Generate token
    const token = generateToken(user.id, user.email, user.role);

    // Update last login time
    await query(
      'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          departmentId: user.department_id,
          departmentName: user.department_name,
          workLatitude: user.work_latitude,
          workLongitude: user.work_longitude,
          homeLatitude: user.home_latitude,
          homeLongitude: user.home_longitude,
          isVerified: user.is_verified,
          createdAt: user.created_at
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.role, 
              u.department_id, u.work_latitude, u.work_longitude, u.home_latitude, u.home_longitude, u.is_verified, u.is_active, u.created_at, u.updated_at,
              d.name as department_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    const user = result.rows[0];

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        role: user.role,
        departmentId: user.department_id,
        departmentName: user.department_name,
        workLatitude: user.work_latitude,
        workLongitude: user.work_longitude,
        homeLatitude: user.home_latitude,
        homeLongitude: user.home_longitude,
        isVerified: user.is_verified,
        isActive: user.is_active,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res, next) => {
  try {
    const { firstName, lastName, phone, latitude, longitude, homeLatitude, homeLongitude } = req.body;

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    if (firstName) {
      updateFields.push(`first_name = $${paramCount++}`);
      values.push(firstName);
    }
    if (lastName) {
      updateFields.push(`last_name = $${paramCount++}`);
      values.push(lastName);
    }
    if (phone !== undefined) {
      updateFields.push(`phone = $${paramCount++}`);
      values.push(phone);
    }

    if (latitude !== undefined) {
      updateFields.push(`work_latitude = $${paramCount++}`);
      values.push(latitude);
    }
    if (longitude !== undefined) {
      updateFields.push(`work_longitude = $${paramCount++}`);
      values.push(longitude);
    }
    if (homeLatitude !== undefined) {
      updateFields.push(`home_latitude = $${paramCount++}`);
      values.push(homeLatitude);
    }
    if (homeLongitude !== undefined) {
      updateFields.push(`home_longitude = $${paramCount++}`);
      values.push(homeLongitude);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    values.push(req.user.id);
    const query_text = `UPDATE users SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
                       WHERE id = $${paramCount} 
                       RETURNING id, email, first_name, last_name, phone, role, work_latitude, work_longitude, home_latitude, home_longitude, is_verified, updated_at`;

    const result = await query(query_text, values);
    const user = result.rows[0];

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        role: user.role,
        workLatitude: user.work_latitude,
        workLongitude: user.work_longitude,
        homeLatitude: user.home_latitude,
        homeLongitude: user.home_longitude,
        isVerified: user.is_verified,
        updatedAt: user.updated_at
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Change password
// @route   PUT /api/auth/password
// @access  Private
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters'
      });
    }

    // Get user's current password
    const result = await query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    const user = result.rows[0];

    // Check current password
    if (!(await bcrypt.compare(currentPassword, user.password_hash))) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    await query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, req.user.id]
    );

    res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Refresh JWT token
// @route   POST /api/auth/refresh
// @access  Private
const refreshToken = (req, res) => {
  const token = generateToken(req.user.id, req.user.email, req.user.role);
  
  res.json({
    success: true,
    data: { token }
  });
};

// Routes
router.post('/register', register);
router.post('/login', sensitiveOperation, login);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/password', protect, sensitiveOperation, changePassword);
router.post('/refresh', protect, refreshToken);

module.exports = router;