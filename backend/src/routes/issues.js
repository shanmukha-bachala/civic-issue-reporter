const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const Joi = require('joi');
const { query, transaction } = require('../../config/database');
const { protect, optionalAuth, staffOnly, adminOnly } = require('../middleware/auth');
const { isPointInZone, findZoneForPoint } = require('../helpers/geo');
const { summarizeEmailDescription } = require('../services/geminiSummarizer');
const { sendMail } = require('../services/mailer');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../../uploads/issues');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `issue-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB default
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// helper to process and save uploaded files to issue_attachments
const processAndSaveAttachments = async (issue, files, userId) => {
  if (!files || files.length === 0) return;
  for (const file of files) {
    const optimizedPath = path.join(path.dirname(file.path), `optimized-${file.filename}`);
    await sharp(file.path)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toFile(optimizedPath);

    await query(
      `INSERT INTO issue_attachments (issue_id, file_name, file_path, file_type, file_size, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [issue.id || issue, file.originalname, optimizedPath, file.mimetype, file.size, userId]
    );

    try { fs.unlinkSync(file.path); } catch (e) {}
  }
};

// Validation schemas
const createIssueSchema = Joi.object({
  title: Joi.string().min(5).max(255).required(),
  description: Joi.string().min(10).max(2000).required(),
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  address: Joi.string().max(500).allow('', null).optional(),
  categoryId: Joi.string().uuid().required(),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium')
});

const updateStatusSchema = Joi.object({
  status: Joi.string().valid('submitted', 'acknowledged', 'in_progress', 'resolved', 'closed').required(),
  notes: Joi.string().max(1000).optional(),
  assignedTo: Joi.string().uuid().optional()
});

const updateIssueDetailsSchema = Joi.object({
  title: Joi.string().min(5).max(255).optional(),
  description: Joi.string().min(10).max(2000).optional(),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
  categoryId: Joi.string().uuid().optional(),
  address: Joi.string().max(500).allow('', null).optional(),
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional()
}).min(1);

// @desc    Create new issue
// @route   POST /api/issues
// @access  Private
const createIssue = async (req, res, next) => {
  try {
    const { error, value } = createIssueSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const { title, description, latitude, longitude, address, categoryId, priority } = value;

    // Get category and department info
    const categoryResult = await query(
      'SELECT department_id FROM categories WHERE id = $1 AND is_active = true',
      [categoryId]
    );

    if (categoryResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid category ID'
      });
    }

    const departmentId = categoryResult.rows[0].department_id;

    // Create issue
    const issueResult = await query(
      `INSERT INTO issues (title, description, latitude, longitude, address, category_id, department_id, reporter_id, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [title, description, latitude, longitude, address, categoryId, departmentId, req.user.id, priority]
    );

    const issue = issueResult.rows[0];

    // Process uploaded files if any
    if (req.files && req.files.length > 0) {
      await processAndSaveAttachments(issue, req.files, req.user.id);
    }

    // Create initial status history record
    await query(
      `INSERT INTO issue_status_history (issue_id, old_status, new_status, changed_by)
       VALUES ($1, NULL, 'submitted', $2)`,
      [issue.id, req.user.id]
    );

    // Get complete issue data with relationships
    const completeIssue = await getIssueById(issue.id);

    // Auto-mail flow applied to all posts
    let emailStatus = 'Not Sent';
    let canManualSend = false;
    const match = findZoneForPoint(latitude, longitude);
    if (match) {
      const depRes = await query('SELECT contact_email FROM departments WHERE id = $1', [departmentId]);
      const departmentEmail = depRes.rows[0]?.contact_email || null;
      if (departmentEmail) {
        const { summary, usedFallback } = await summarizeEmailDescription({ title, description, address, latitude, longitude, categoryName: null });
        if (usedFallback) {
          // Do not auto-send when Gemini failed; allow admin manual send
          canManualSend = true;
        } else {
          const sent = await sendMail(
            departmentEmail,
            `New Issue Report: ${title}`,
            summary
          );
          if (sent) {
            emailStatus = `Sent to ${departmentEmail}`;
          }
        }
      }
    }

    // Persist email_status
    await query('UPDATE issues SET email_status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [issue.id, emailStatus]);

    const sentSuccess = emailStatus.startsWith('Sent to');
    // Insert notification for reporter ONLY on success
    if (sentSuccess) {
      const notifMessage = `Your issue '${title}' has been forwarded to ${emailStatus.replace('Sent to ', '')}.`;
      await query(
        `INSERT INTO notifications (user_id, issue_id, title, message, type)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user.id, issue.id, 'Issue Report Email Status', notifMessage, 'email_status']
      );
    }

    // Admin notifications about email delivery (always notify)
    const adminsRes = await query("SELECT id FROM users WHERE role = 'admin' AND is_active = true", []);
    const adminMsg = sentSuccess
      ? `Issue '${title}' was forwarded to the department.`
      : `Automated forwarding failed or was skipped. You can send it manually from the issue page.`;
    for (const admin of adminsRes.rows) {
      await query(
        `INSERT INTO notifications (user_id, issue_id, title, message, type)
         VALUES ($1, $2, $3, $4, $5)`,
        [admin.id, issue.id, 'Issue Report Email Status', adminMsg, 'email_status']
      );
    }

    // Reload issue to include email_status
    const completeIssueWithStatus = await getIssueById(issue.id, true);

    // Emit real-time event
    if (req.io) {
      req.io.emit('issue_created', completeIssueWithStatus);
      req.io.to(`department_${departmentId}`).emit('new_issue_assigned', completeIssueWithStatus);
      if (sentSuccess) {
        req.io.to(`user_${req.user.id}`).emit('notification', {
          issueId: issue.id,
          title: 'Issue Report Email Status',
          message: `Your issue '${title}' has been forwarded to ${emailStatus.replace('Sent to ', '')}.`,
          type: 'email_status',
        });
      }
      for (const admin of adminsRes.rows) {
        req.io.to(`user_${admin.id}`).emit('notification', {
          issueId: issue.id,
          title: 'Issue Report Email Status',
          message: adminMsg,
          type: 'email_status',
        });
      }
    }

    res.status(201).json({
      success: true,
      data: completeIssueWithStatus,
      email_status: completeIssueWithStatus.email_status,
      canManualSend
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all issues with filtering
// @route   GET /api/issues
// @access  Public (limited fields) / Private (full access)
const getIssues = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      category,
      department,
      priority,
      reporter,
      assigned,
      search,
      bbox, // bounding box for map queries: "minLng,minLat,maxLng,maxLat"
      center, // e.g. "lat,lng" to filter circular area
      radius_m, // meters
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    // Build WHERE clause
    const conditions = ['i.id IS NOT NULL'];
    const values = [];
    let paramCount = 1;

    if (status) {
      conditions.push(`i.status = $${paramCount++}`);
      values.push(status);
    }

    if (category) {
      conditions.push(`i.category_id = $${paramCount++}`);
      values.push(category);
    }

    if (department) {
      conditions.push(`i.department_id = $${paramCount++}`);
      values.push(department);
    }

    if (priority) {
      conditions.push(`i.priority = $${paramCount++}`);
      values.push(priority);
    }

    if (reporter) {
      conditions.push(`i.reporter_id = $${paramCount++}`);
      values.push(reporter);
    }

    if (assigned) {
      conditions.push(`i.assigned_to = $${paramCount++}`);
      values.push(assigned);
    }

    if (search) {
      conditions.push(`(i.title ILIKE $${paramCount} OR i.description ILIKE $${paramCount})`);
      values.push(`%${search}%`);
      paramCount++;
    }

    if (bbox) {
      const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number);
      conditions.push(`i.longitude >= $${paramCount++} AND i.longitude <= $${paramCount++}`);
      conditions.push(`i.latitude >= $${paramCount++} AND i.latitude <= $${paramCount++}`);
      values.push(minLng, maxLng, minLat, maxLat);
    }

    if (center && radius_m) {
      const [cLat, cLng] = center.split(',').map(Number);
      const r = parseFloat(radius_m);
      const degLat = r / 111320; // meters per degree latitude
      const degLng = r / (111320 * Math.cos((cLat * Math.PI) / 180));
      const minLat = cLat - degLat;
      const maxLat = cLat + degLat;
      const minLng = cLng - degLng;
      const maxLng = cLng + degLng;
      conditions.push(`i.longitude >= $${paramCount++} AND i.longitude <= $${paramCount++}`);
      conditions.push(`i.latitude >= $${paramCount++} AND i.latitude <= $${paramCount++}`);
      values.push(minLng, maxLng, minLat, maxLat);
    }

    // For non-authenticated users, only show resolved/closed issues
    if (!req.user) {
      conditions.push(`i.status IN ('resolved', 'closed')`);
    }

    // Calculate offset
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    const selectFields = req.user ? `
      i.*, 
      c.name as category_name, c.icon as category_icon, c.color as category_color,
      d.name as department_name, d.contact_email as department_contact_email, d.contact_phone as department_contact_phone,
      r.first_name as reporter_first_name, r.last_name as reporter_last_name,
      a.first_name as assigned_first_name, a.last_name as assigned_last_name, a.email as assigned_email, a.phone as assigned_phone
    ` : `
      i.id, i.title, i.latitude, i.longitude, i.status, i.priority, i.created_at, i.email_status,
      c.name as category_name, c.icon as category_icon, c.color as category_color,
      d.name as department_name
    `;

    const queryText = `
      SELECT ${selectFields}
      FROM issues i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN departments d ON i.department_id = d.id
      LEFT JOIN users r ON i.reporter_id = r.id
      LEFT JOIN users a ON i.assigned_to = a.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY i.${sortBy} ${sortOrder}
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `;

    values.push(parseInt(limit), offset);

    const result = await query(queryText, values);

    // Post-process for authenticated users to compute can_manual_send
    if (req.user) {
      for (const row of result.rows) {
        row.can_manual_send = row.email_status === 'Not Sent' && !!row.department_contact_email;
      }
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) 
      FROM issues i
      WHERE ${conditions.join(' AND ')}
    `;

    const countResult = await query(countQuery, values.slice(0, -2));
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        issues: result.rows,
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

// @desc    Get single issue
// @route   GET /api/issues/:id
// @access  Public (limited) / Private (full)
const getIssue = async (req, res, next) => {
  try {
    const issue = await getIssueById(req.params.id, !!req.user);

    if (!issue) {
      return res.status(404).json({
        success: false,
        error: 'Issue not found'
      });
    }

    res.json({
      success: true,
      data: issue
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update issue status
// @route   PUT /api/issues/:id/status
// @access  Private (staff only)
const updateIssueStatus = async (req, res, next) => {
  try {
    const { error, value } = updateStatusSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const { status, notes, assignedTo } = value;
    const issueId = req.params.id;

    // Check if issue exists and user has permission
    const issueResult = await query(
      'SELECT * FROM issues WHERE id = $1',
      [issueId]
    );

    if (issueResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Issue not found'
      });
    }

    const issue = issueResult.rows[0];

    // Check department access for staff users
    if (req.user.role === 'staff' && req.user.department_id !== issue.department_id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Cannot modify issues from other departments.'
      });
    }

    // Update issue in transaction
    await transaction(async (client) => {
      // Update issue
      const updateFields = ['status = $2', 'updated_at = CURRENT_TIMESTAMP'];
      const updateValues = [issueId, status];
      let paramCount = 3;

      if (assignedTo) {
        updateFields.push(`assigned_to = $${paramCount++}`);
        updateValues.push(assignedTo);
      }

      if (status === 'resolved') {
        updateFields.push(`resolved_at = CURRENT_TIMESTAMP`);
      }

      if (notes) {
        updateFields.push(`resolution_notes = $${paramCount++}`);
        updateValues.push(notes);
      }

      await client.query(
        `UPDATE issues SET ${updateFields.join(', ')} WHERE id = $1`,
        updateValues
      );

      // Add status history
      await client.query(
        `INSERT INTO issue_status_history (issue_id, old_status, new_status, changed_by, notes)
         VALUES ($1, $2, $3, $4, $5)`,
        [issueId, issue.status, status, req.user.id, notes]
      );

      // Create notification for reporter
      await client.query(
        `INSERT INTO notifications (user_id, issue_id, title, message, type)
         VALUES ($1, $2, $3, $4, 'status_update')`,
        [
          issue.reporter_id,
          issueId,
          `Issue Status Updated: ${issue.title}`,
          `Your issue status has been changed to "${status}".${notes ? ` Note: ${notes}` : ''}`
        ]
      );
    });

    // Get updated issue
    const updatedIssue = await getIssueById(issueId);

    // Emit real-time event
    if (req.io) {
      req.io.emit('issue_updated', updatedIssue);
      req.io.to(`user_${issue.reporter_id}`).emit('issue_status_changed', {
        issueId,
        oldStatus: issue.status,
        newStatus: status,
        notes
      });
    }

    res.json({
      success: true,
      data: updatedIssue
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to get issue by ID with all relationships
const getIssueById = async (id, includePrivate = false) => {
  const fields = includePrivate ? `
    i.*,
    c.name as category_name, c.icon as category_icon, c.color as category_color,
    d.name as department_name, d.contact_email as department_contact_email, d.contact_phone as department_contact_phone,
    r.first_name as reporter_first_name, r.last_name as reporter_last_name, r.email as reporter_email,
    a.first_name as assigned_first_name, a.last_name as assigned_last_name, a.email as assigned_email, a.phone as assigned_phone
  ` : `
    i.id, i.title, i.description, i.latitude, i.longitude, i.address, i.status, i.priority, i.created_at, i.resolved_at, i.email_status,
    c.name as category_name, c.icon as category_icon, c.color as category_color,
    d.name as department_name
  `;

  const result = await query(
    `SELECT ${fields}
     FROM issues i
     LEFT JOIN categories c ON i.category_id = c.id
     LEFT JOIN departments d ON i.department_id = d.id
     LEFT JOIN users r ON i.reporter_id = r.id
     LEFT JOIN users a ON i.assigned_to = a.id
     WHERE i.id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const issue = result.rows[0];

  // Compute manual-send flag for admins/staff (when private info available)
  if (includePrivate) {
    issue.can_manual_send = issue.email_status === 'Not Sent' && !!issue.department_contact_email;
  }

  // Get attachments if showing private data
  if (includePrivate) {
    const attachmentsResult = await query(
      'SELECT id, file_name, file_path, file_type, file_size, created_at FROM issue_attachments WHERE issue_id = $1',
      [id]
    );
    issue.attachments = attachmentsResult.rows;
  }

  return issue;
};

// Upvote helpers
const getUpvoteCount = async (issueId) => {
  const r = await query('SELECT COUNT(*)::int as count FROM issue_upvotes WHERE issue_id = $1', [issueId]);
  return r.rows[0].count || 0;
};

const priorityOrder = { low: 1, medium: 2, high: 3, urgent: 4 };
const inferPriorityFromVotes = (count) => {
  if (count >= 15) return 'urgent';
  if (count >= 10) return 'high';
  if (count >= 5) return 'medium';
  return null; // no change below 5
};

// @desc    Get upvote count (+ whether current user has upvoted)
// @route   GET /api/issues/:id/upvotes
// @access  Public (count), Private for hasUpvoted
router.get('/:id/upvotes', optionalAuth, async (req, res, next) => {
  try {
    const issueId = req.params.id;
    const count = await getUpvoteCount(issueId);
    let hasUpvoted = false;
    if (req.user) {
      const r = await query('SELECT 1 FROM issue_upvotes WHERE issue_id = $1 AND user_id = $2', [issueId, req.user.id]);
      hasUpvoted = r.rows.length > 0;
    }
    res.json({ success: true, data: { count, hasUpvoted } });
  } catch (e) { next(e); }
});

// @desc    Upvote an issue if user is within 5km radius of issue
// @route   POST /api/issues/:id/upvote
// @access  Private
router.post('/:id/upvote', protect, async (req, res, next) => {
  try {
    const issueId = req.params.id;
    const userId = req.user.id;

    // Load issue
    const ir = await query('SELECT id, latitude, longitude, priority FROM issues WHERE id = $1', [issueId]);
    if (ir.rows.length === 0) return res.status(404).json({ success: false, error: 'Issue not found' });
    const issue = ir.rows[0];

    // Load user location: prefer home, fallback to work
    const ur = await query('SELECT home_latitude, home_longitude, work_latitude, work_longitude FROM users WHERE id = $1', [userId]);
    const u = ur.rows[0] || {};
    const uLat = u.home_latitude ?? u.work_latitude;
    const uLng = u.home_longitude ?? u.work_longitude;
    if (uLat == null || uLng == null) return res.status(400).json({ success: false, error: 'Set your location in profile before upvoting' });

    // distance check (haversine)
    const toRad = (d) => (d * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(issue.latitude - uLat);
    const dLon = toRad(issue.longitude - uLng);
    const a = Math.sin(dLat/2) ** 2 + Math.cos(toRad(uLat)) * Math.cos(toRad(issue.latitude)) * Math.sin(dLon/2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const dist = R * c;
    if (dist > 5000) return res.status(403).json({ success: false, error: 'You must be within 5km to upvote this issue' });

    // Insert upvote if not exists
    await query('INSERT INTO issue_upvotes (issue_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [issueId, userId]);
    const count = await getUpvoteCount(issueId);

    // Possibly bump priority (only upwards)
    const target = inferPriorityFromVotes(count);
    if (target && priorityOrder[target] > priorityOrder[issue.priority]) {
      await query('UPDATE issues SET priority = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [issueId, target]);
    }

    res.json({ success: true, data: { count } });
  } catch (e) { next(e); }
});

// Routes
router.post('/', protect, upload.array('files', 5), createIssue);

// @desc    Report issue with auto-simulated email sending based on zones
// @route   POST /api/issues/report
// @access  Private (citizen)
router.post('/report', protect, upload.array('files', 5), async (req, res, next) => {
  try {
    const { error, value } = createIssueSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }

    const { title, description, latitude, longitude, address, categoryId, priority } = value;

    // Get category and department info
    const categoryResult = await query(
      'SELECT department_id, name as category_name FROM categories WHERE id = $1 AND is_active = true',
      [categoryId]
    );

    if (categoryResult.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid category ID' });
    }

    const departmentId = categoryResult.rows[0].department_id;
    const categoryName = categoryResult.rows[0].category_name;

    // Create issue (initially without email_status)
    const issueResult = await query(
      `INSERT INTO issues (title, description, latitude, longitude, address, category_id, department_id, reporter_id, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [title, description, latitude, longitude, address, categoryId, departmentId, req.user.id, priority]
    );

    const issue = issueResult.rows[0];

    // Process uploaded files if any
    if (req.files && req.files.length > 0) {
      await processAndSaveAttachments(issue, req.files, req.user.id);
    }

    // Create initial status history record
    await query(
      `INSERT INTO issue_status_history (issue_id, old_status, new_status, changed_by)
       VALUES ($1, NULL, 'submitted', $2)`,
      [issue.id, req.user.id]
    );

    // Zone check
    const match = findZoneForPoint(latitude, longitude);
    let emailStatus = 'Not Sent';

    let canManualSend = false;
    if (match) {
      // Fetch department contact email for this issue's department
      const depRes = await query('SELECT name, contact_email FROM departments WHERE id = $1', [departmentId]);
      const departmentEmail = depRes.rows[0]?.contact_email || null;

      // Summarize using Gemini (or fallback)
      const { summary, usedFallback } = await summarizeEmailDescription({ title, description, address, latitude, longitude, categoryName });
      if (usedFallback) {
        canManualSend = true; // allow admin manual send
      } else if (departmentEmail) {
        const sent = await sendMail(
          departmentEmail,
          `New Issue Report: ${title}`,
          summary
        );
        if (sent) {
          emailStatus = `Sent to ${departmentEmail}`;
        }
      }
    } else {
      // Outside zones: not sent
      emailStatus = 'Not Sent';
    }

    // Persist email_status only (do not store summary)
    await query('UPDATE issues SET email_status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [issue.id, emailStatus]);

    const sentSuccess = emailStatus.startsWith('Sent to');

    // Reporter notification ONLY on success
    if (sentSuccess) {
      const notifMessage = `Your issue '${title}' has been forwarded to ${emailStatus.replace('Sent to ', '')}.`;
      await query(
        `INSERT INTO notifications (user_id, issue_id, title, message, type)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user.id, issue.id, 'Issue Report Email Status', notifMessage, 'email_status']
      );
    }

    // Admin notifications about email delivery (always)
    const adminsRes = await query("SELECT id FROM users WHERE role = 'admin' AND is_active = true", []);
    const adminMsg = sentSuccess
      ? `Issue '${title}' was forwarded to the department.`
      : `Automated forwarding failed or was skipped. You can send it manually from the issue page.`;
    for (const admin of adminsRes.rows) {
      await query(
        `INSERT INTO notifications (user_id, issue_id, title, message, type)
         VALUES ($1, $2, $3, $4, $5)`,
        [admin.id, issue.id, 'Issue Report Email Status', adminMsg, 'email_status']
      );
    }

    // Load complete issue with relationships (to include email_status in response)
    const completeIssue = await getIssueById(issue.id, true);

    // Emit real-time events
    if (req.io) {
      req.io.emit('issue_created', completeIssue);
      req.io.to(`department_${departmentId}`).emit('new_issue_assigned', completeIssue);
      if (sentSuccess) {
        // Emit notification to the reporter
        req.io.to(`user_${req.user.id}`).emit('notification', {
          issueId: issue.id,
          title: 'Issue Report Email Status',
          message: `Your issue '${title}' has been forwarded to ${emailStatus.replace('Sent to ', '')}.`,
          type: 'email_status',
        });
      }
      for (const admin of adminsRes.rows) {
        req.io.to(`user_${admin.id}`).emit('notification', {
          issueId: issue.id,
          title: 'Issue Report Email Status',
          message: adminMsg,
          type: 'email_status',
        });
      }
    }

    res.status(201).json({ success: true, data: completeIssue, email_status: completeIssue.email_status, canManualSend });
  } catch (err) {
    next(err);
  }
});
router.get('/', optionalAuth, getIssues);
router.get('/:id', optionalAuth, getIssue);
router.put('/:id', protect, async (req, res, next) => {
  try {
    const { error, value } = updateIssueDetailsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }

    const issueId = req.params.id;
    // Verify ownership
    const result = await query('SELECT id, reporter_id, status FROM issues WHERE id = $1', [issueId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Issue not found' });
    }
    const issue = result.rows[0];
    if (issue.reporter_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'You can only edit your own issues' });
    }
    if (issue.status === 'closed') {
      return res.status(400).json({ success: false, error: 'Closed issues cannot be edited' });
    }

    // If categoryId provided, validate and derive department_id
    let newDepartmentId = null;
    if (value.categoryId) {
      const cat = await query('SELECT id, department_id FROM categories WHERE id = $1 AND is_active = true', [value.categoryId]);
      if (cat.rows.length === 0) {
        return res.status(400).json({ success: false, error: 'Invalid category ID' });
      }
      newDepartmentId = cat.rows[0].department_id;
    }

    const fields = [];
    const params = [issueId];
    let idx = 2;
    if (value.title !== undefined) { fields.push(`title = $${idx++}`); params.push(value.title); }
    if (value.description !== undefined) { fields.push(`description = $${idx++}`); params.push(value.description); }
    if (value.priority !== undefined) { fields.push(`priority = $${idx++}`); params.push(value.priority); }
    if (value.address !== undefined) { fields.push(`address = $${idx++}`); params.push(value.address); }
    if (value.latitude !== undefined) { fields.push(`latitude = $${idx++}`); params.push(value.latitude); }
    if (value.longitude !== undefined) { fields.push(`longitude = $${idx++}`); params.push(value.longitude); }
    if (value.categoryId !== undefined) { fields.push(`category_id = $${idx++}`); params.push(value.categoryId); }
    if (newDepartmentId) { fields.push(`department_id = $${idx++}`); params.push(newDepartmentId); }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    await query(`UPDATE issues SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, params);
    const updated = await getIssueById(issueId, true);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});
// Add attachments to existing issue (owner or staff)
router.post('/:id/attachments', protect, upload.array('files', 5), async (req, res, next) => {
  try {
    const issueId = req.params.id;
    const result = await query('SELECT * FROM issues WHERE id = $1', [issueId]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Issue not found' });
    const issue = result.rows[0];
    // Only owner can add; staff could be allowed if needed
    if (issue.reporter_id !== req.user.id && req.user.role !== 'staff' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Not allowed' });
    }
    await processAndSaveAttachments(issue, req.files || [], req.user.id);
    const updated = await getIssueById(issueId, true);
    res.status(201).json({ success: true, data: updated });
  } catch (e) {
    next(e);
  }
});

// Delete an attachment (owner only)
router.delete('/:id/attachments/:attachmentId', protect, async (req, res, next) => {
  try {
    const { id, attachmentId } = req.params;
    const result = await query('SELECT reporter_id FROM issues WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Issue not found' });
    if (result.rows[0].reporter_id !== req.user.id) return res.status(403).json({ success: false, error: 'Not allowed' });

    const att = await query('SELECT file_path FROM issue_attachments WHERE id = $1 AND issue_id = $2', [attachmentId, id]);
    if (att.rows.length === 0) return res.status(404).json({ success: false, error: 'Attachment not found' });
    const filePath = att.rows[0].file_path;

    await query('DELETE FROM issue_attachments WHERE id = $1 AND issue_id = $2', [attachmentId, id]);
    try { fs.unlinkSync(filePath); } catch (e) {}

    const updated = await getIssueById(id, true);
    res.json({ success: true, data: updated });
  } catch (e) {
    next(e);
  }
});

router.put('/:id/status', protect, staffOnly, updateIssueStatus);

// @desc    Manually send issue email to department (admin only)
// @route   POST /api/issues/:id/send-email
// @access  Admin only
router.post('/:id/send-email', protect, adminOnly, async (req, res, next) => {
  try {
    const issueId = req.params.id;
    const { message } = req.body || {};
    if (!message || typeof message !== 'string' || message.trim().length < 5) {
      return res.status(400).json({ success: false, error: 'A message of at least 5 characters is required.' });
    }

    // Load issue and department
    const ir = await query(
      `SELECT i.id, i.title, i.department_id, i.reporter_id, d.contact_email AS department_email, d.name AS department_name
       FROM issues i
       LEFT JOIN departments d ON i.department_id = d.id
       WHERE i.id = $1`,
      [issueId]
    );
    if (ir.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Issue not found' });
    }
    const issue = ir.rows[0];
    if (!issue.department_email) {
      return res.status(400).json({ success: false, error: 'Department does not have a contact email configured.' });
    }

    // Send email
    const sent = await sendMail(issue.department_email, `Manual Issue Email: ${issue.title}`, message.trim());
    if (!sent) {
      return res.status(502).json({ success: false, error: 'Failed to send email. Please check SMTP configuration.' });
    }

    // Update email_status
    await query('UPDATE issues SET email_status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [issueId, `Sent to ${issue.department_email}`]);

    // Add notifications
    const reporterMsg = `An admin has forwarded your issue '${issue.title}' to ${issue.department_email}.`;
    await query(
      `INSERT INTO notifications (user_id, issue_id, title, message, type)
       VALUES ($1, $2, $3, $4, $5)`,
      [issue.reporter_id, issueId, 'Issue Report Email Status', reporterMsg, 'email_status']
    );

    const adminsRes = await query("SELECT id FROM users WHERE role = 'admin' AND is_active = true", []);
    for (const admin of adminsRes.rows) {
      await query(
        `INSERT INTO notifications (user_id, issue_id, title, message, type)
         VALUES ($1, $2, $3, $4, $5)`,
        [admin.id, issueId, 'Issue Report Email Status', reporterMsg, 'email_status']
      );
    }

    // Emit socket notifications
    if (req.io) {
      req.io.to(`user_${issue.reporter_id}`).emit('notification', {
        issueId,
        title: 'Issue Report Email Status',
        message: reporterMsg,
        type: 'email_status',
      });
      for (const admin of adminsRes.rows) {
        req.io.to(`user_${admin.id}`).emit('notification', {
          issueId,
          title: 'Issue Report Email Status',
          message: reporterMsg,
          type: 'email_status',
        });
      }
    }

    // Return updated issue
    const updated = await getIssueById(issueId, true);
    res.json({ success: true, data: updated });
  } catch (e) {
    next(e);
  }
});

// @desc    Check if admin can manually send email for an issue
// @route   GET /api/issues/:id/can-manual-send
// @access  Admin only
router.get('/:id/can-manual-send', protect, adminOnly, async (req, res, next) => {
  try {
    const issueId = req.params.id;
    const r = await query(
      `SELECT i.id, i.email_status, i.department_id, d.contact_email
       FROM issues i
       LEFT JOIN departments d ON i.department_id = d.id
       WHERE i.id = $1`,
      [issueId]
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Issue not found' });
    }
    const row = r.rows[0];
    const canManualSend = row.email_status === 'Not Sent' && !!row.contact_email;
    return res.json({ success: true, data: { canManualSend } });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
