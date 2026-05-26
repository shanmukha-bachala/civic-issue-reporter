const express = require('express');
const { query } = require('../../config/database');
const { protect, adminOnly, staffOnly } = require('../middleware/auth');

const router = express.Router();

// @desc    Get all users (admin only)
// @route   GET /api/users
// @access  Admin only
const getUsers = async (req, res, next) => {
  try {
    const { role, department, page = 1, limit = 20, search } = req.query;

    const conditions = ['u.id IS NOT NULL'];
    const values = [];
    let paramCount = 1;

    if (role) {
      conditions.push(`u.role = $${paramCount++}`);
      values.push(role);
    }

    if (department) {
      conditions.push(`u.department_id = $${paramCount++}`);
      values.push(department);
    }

    if (search) {
      conditions.push(`(u.first_name ILIKE $${paramCount} OR u.last_name ILIKE $${paramCount} OR u.email ILIKE $${paramCount})`);
      values.push(`%${search}%`);
      paramCount++;
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const queryText = `
      SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.role, 
             u.department_id, u.is_verified, u.is_active, u.created_at, u.updated_at,
             d.name as department_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY u.created_at DESC
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `;

    values.push(parseInt(limit), offset);

    const result = await query(queryText, values);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) 
      FROM users u
      WHERE ${conditions.join(' AND ')}
    `;

    const countResult = await query(countQuery, values.slice(0, -2));
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        users: result.rows,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Admin only
const getUser = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.role, 
              u.department_id, u.is_verified, u.is_active, u.created_at, u.updated_at,
              d.name as department_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = result.rows[0];

    // Get user's issue statistics
    const statsResult = await query(
      `SELECT 
         COUNT(*) as total_reported,
         COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved,
         COUNT(CASE WHEN assigned_to = $1 THEN 1 END) as assigned_to_user
       FROM issues 
       WHERE reporter_id = $1 OR assigned_to = $1`,
      [req.params.id]
    );

    const stats = statsResult.rows[0];

    res.json({
      success: true,
      data: {
        ...user,
        statistics: {
          totalReported: parseInt(stats.total_reported),
          resolved: parseInt(stats.resolved),
          assignedToUser: parseInt(stats.assigned_to_user)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user role/department (admin only)
// @route   PUT /api/users/:id
// @access  Admin only
const updateUser = async (req, res, next) => {
  try {
    const { role, departmentId, isVerified, isActive } = req.body;

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    if (role) {
      updateFields.push(`role = $${paramCount++}`);
      values.push(role);
    }
    if (departmentId !== undefined) {
      updateFields.push(`department_id = $${paramCount++}`);
      values.push(departmentId);
    }
    if (isVerified !== undefined) {
      updateFields.push(`is_verified = $${paramCount++}`);
      values.push(isVerified);
    }
    if (isActive !== undefined) {
      updateFields.push(`is_active = $${paramCount++}`);
      values.push(isActive);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    values.push(req.params.id);
    const queryText = `UPDATE users SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
                      WHERE id = $${paramCount} 
                      RETURNING id, email, first_name, last_name, role, department_id, is_verified, is_active, updated_at`;

    const result = await query(queryText, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get staff users by department
// @route   GET /api/users/staff/:departmentId
// @access  Staff/Admin
const getStaffByDepartment = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, email, first_name, last_name, role, is_active
       FROM users 
       WHERE department_id = $1 AND role IN ('staff', 'admin') AND is_active = true
       ORDER BY first_name, last_name`,
      [req.params.departmentId]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user notifications
// @route   GET /api/users/notifications
// @access  Private
const getUserNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;

    const conditions = ['user_id = $1'];
    const values = [req.user.id];
    let paramCount = 2;

    if (unreadOnly === 'true') {
      conditions.push('is_read = false');
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const queryText = `
      SELECT n.*, i.title as issue_title
      FROM notifications n
      LEFT JOIN issues i ON n.issue_id = i.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY n.created_at DESC
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `;

    values.push(parseInt(limit), offset);

    const result = await query(queryText, values);

    // Get unread count
    const unreadCountResult = await query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
      [req.user.id]
    );

    res.json({
      success: true,
      data: {
        notifications: result.rows,
        unreadCount: parseInt(unreadCountResult.rows[0].count),
        pagination: {
          current: parseInt(page),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark notifications as read
// @route   PUT /api/users/notifications/read
// @access  Private
const markNotificationsRead = async (req, res, next) => {
  try {
    const { notificationIds } = req.body;

    if (!notificationIds || !Array.isArray(notificationIds)) {
      return res.status(400).json({
        success: false,
        error: 'Notification IDs array is required'
      });
    }

    // Create placeholders for the IN clause
    const placeholders = notificationIds.map((_, index) => `$${index + 2}`).join(', ');

    await query(
      `UPDATE notifications SET is_read = true 
       WHERE user_id = $1 AND id IN (${placeholders})`,
      [req.user.id, ...notificationIds]
    );

    res.json({
      success: true,
      message: 'Notifications marked as read'
    });
  } catch (error) {
    next(error);
  }
};

// Routes
router.get('/', protect, adminOnly, getUsers);
router.get('/notifications', protect, getUserNotifications);
router.put('/notifications/read', protect, markNotificationsRead);
router.get('/staff/:departmentId', protect, staffOnly, getStaffByDepartment);
router.get('/:id', protect, adminOnly, getUser);
router.put('/:id', protect, adminOnly, updateUser);

module.exports = router;