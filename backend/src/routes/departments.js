const express = require('express');
const { query } = require('../../config/database');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// @desc    Get all departments
// @route   GET /api/departments
// @access  Public
const getDepartments = async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM departments WHERE is_active = true ORDER BY name ASC'
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single department with statistics
// @route   GET /api/departments/:id
// @access  Public
const getDepartment = async (req, res, next) => {
  try {
    // Get department details
    const deptResult = await query(
      'SELECT * FROM departments WHERE id = $1 AND is_active = true',
      [req.params.id]
    );

    if (deptResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Department not found'
      });
    }

    const department = deptResult.rows[0];

    // Get department statistics
    const statsResult = await query(
      `SELECT 
         COUNT(*) as total_issues,
         COUNT(CASE WHEN status = 'submitted' THEN 1 END) as submitted,
         COUNT(CASE WHEN status = 'acknowledged' THEN 1 END) as acknowledged,
         COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
         COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved,
         COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed,
         AVG(CASE WHEN resolved_at IS NOT NULL 
           THEN EXTRACT(EPOCH FROM (resolved_at - created_at))/3600 END) as avg_resolution_hours
       FROM issues 
       WHERE department_id = $1`,
      [req.params.id]
    );

    const stats = statsResult.rows[0];

    // Get categories for this department
    const categoriesResult = await query(
      'SELECT * FROM categories WHERE department_id = $1 AND is_active = true ORDER BY name',
      [req.params.id]
    );

    res.json({
      success: true,
      data: {
        ...department,
        statistics: {
          totalIssues: parseInt(stats.total_issues),
          statusBreakdown: {
            submitted: parseInt(stats.submitted),
            acknowledged: parseInt(stats.acknowledged),
            inProgress: parseInt(stats.in_progress),
            resolved: parseInt(stats.resolved),
            closed: parseInt(stats.closed)
          },
          averageResolutionHours: stats.avg_resolution_hours ? parseFloat(stats.avg_resolution_hours).toFixed(2) : null
        },
        categories: categoriesResult.rows
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new department
// @route   POST /api/departments
// @access  Admin only
const createDepartment = async (req, res, next) => {
  try {
    const { name, description, contactEmail, contactPhone } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Department name is required'
      });
    }

    const result = await query(
      `INSERT INTO departments (name, description, contact_email, contact_phone)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, description, contactEmail, contactPhone]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update department
// @route   PUT /api/departments/:id
// @access  Admin only
const updateDepartment = async (req, res, next) => {
  try {
    const { name, description, contactEmail, contactPhone, isActive } = req.body;

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    if (name) {
      updateFields.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updateFields.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (contactEmail !== undefined) {
      updateFields.push(`contact_email = $${paramCount++}`);
      values.push(contactEmail);
    }
    if (contactPhone !== undefined) {
      updateFields.push(`contact_phone = $${paramCount++}`);
      values.push(contactPhone);
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
    const queryText = `UPDATE departments SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
                      WHERE id = $${paramCount} 
                      RETURNING *`;

    const result = await query(queryText, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Department not found'
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

// Routes
router.get('/', getDepartments);
router.get('/:id', getDepartment);
router.post('/', protect, adminOnly, createDepartment);
router.put('/:id', protect, adminOnly, updateDepartment);

module.exports = router;