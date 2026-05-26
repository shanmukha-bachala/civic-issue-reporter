const express = require('express');
const { query } = require('../../config/database');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
const getCategories = async (req, res, next) => {
  try {
    const { department } = req.query;

    let queryText = `
      SELECT c.*, d.name as department_name
      FROM categories c
      LEFT JOIN departments d ON c.department_id = d.id
      WHERE c.is_active = true
    `;
    
    const values = [];
    
    if (department) {
      queryText += ' AND c.department_id = $1';
      values.push(department);
    }
    
    queryText += ' ORDER BY c.name ASC';

    const result = await query(queryText, values);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single category
// @route   GET /api/categories/:id
// @access  Public
const getCategory = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT c.*, d.name as department_name, d.contact_email, d.contact_phone
       FROM categories c
       LEFT JOIN departments d ON c.department_id = d.id
       WHERE c.id = $1 AND c.is_active = true`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Category not found'
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

// @desc    Create new category
// @route   POST /api/categories
// @access  Admin only
const createCategory = async (req, res, next) => {
  try {
    const { name, description, icon, color, departmentId } = req.body;

    if (!name || !departmentId) {
      return res.status(400).json({
        success: false,
        error: 'Name and department ID are required'
      });
    }

    // Check if department exists
    const deptResult = await query(
      'SELECT id FROM departments WHERE id = $1 AND is_active = true',
      [departmentId]
    );

    if (deptResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid department ID'
      });
    }

    const result = await query(
      `INSERT INTO categories (name, description, icon, color, department_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, description, icon, color, departmentId]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update category
// @route   PUT /api/categories/:id
// @access  Admin only
const updateCategory = async (req, res, next) => {
  try {
    const { name, description, icon, color, departmentId, isActive } = req.body;

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
    if (icon !== undefined) {
      updateFields.push(`icon = $${paramCount++}`);
      values.push(icon);
    }
    if (color !== undefined) {
      updateFields.push(`color = $${paramCount++}`);
      values.push(color);
    }
    if (departmentId) {
      updateFields.push(`department_id = $${paramCount++}`);
      values.push(departmentId);
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
    const queryText = `UPDATE categories SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
                      WHERE id = $${paramCount} 
                      RETURNING *`;

    const result = await query(queryText, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Category not found'
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
router.get('/', getCategories);
router.get('/:id', getCategory);
router.post('/', protect, adminOnly, createCategory);
router.put('/:id', protect, adminOnly, updateCategory);

module.exports = router;