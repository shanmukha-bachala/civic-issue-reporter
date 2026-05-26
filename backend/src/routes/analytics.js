const express = require('express');
const { query } = require('../../config/database');
const { protect, staffOnly } = require('../middleware/auth');

const router = express.Router();

// Public summary: total issues and total unique reporters
router.get('/public-summary', async (req, res, next) => {
  try {
    const totalIssuesRes = await query('SELECT COUNT(*) AS total_issues FROM issues', []);
    const totalReportersRes = await query('SELECT COUNT(DISTINCT reporter_id) AS total_reporters FROM issues', []);
    res.json({
      success: true,
      data: {
        totalIssues: parseInt(totalIssuesRes.rows[0].total_issues || '0'),
        totalReporters: parseInt(totalReportersRes.rows[0].total_reporters || '0')
      }
    });
  } catch (error) {
    next(error);
  }
});

// Public: Top reporters by issue count
router.get('/top-reporters', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '5'), 50);
    const result = await query(
      `SELECT u.id, u.first_name, u.last_name, u.email, COUNT(i.id) AS issue_count
       FROM users u
       JOIN issues i ON i.reporter_id = u.id
       GROUP BY u.id, u.first_name, u.last_name, u.email
       ORDER BY issue_count DESC
       LIMIT $1`,
      [limit]
    );
    res.json({ success: true, data: result.rows.map(r => ({
      id: r.id,
      name: `${r.first_name || ''} ${r.last_name || ''}`.trim() || r.email,
      email: r.email,
      issueCount: parseInt(r.issue_count)
    }))});
  } catch (error) {
    next(error);
  }
});

// @desc    Get dashboard overview statistics
// @route   GET /api/analytics/dashboard
// @access  Staff/Admin
const getDashboardStats = async (req, res, next) => {
  try {
    const { timeframe = '30', department } = req.query;
    
    // Calculate date range
    const days = parseInt(timeframe);
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    // Base conditions
    let departmentCondition = '';
    const values = [fromDate.toISOString()];
    
    // For staff users, restrict to their department
    if (req.user.role === 'staff') {
      departmentCondition = 'AND department_id = $2';
      values.push(req.user.department_id);
    } else if (department) {
      departmentCondition = 'AND department_id = $2';
      values.push(department);
    }

    // Get overall statistics
    const overallStats = await query(
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
       WHERE created_at >= $1 ${departmentCondition}`,
      values
    );

    // Get issues by priority
    const priorityStats = await query(
      `SELECT 
         priority,
         COUNT(*) as count
       FROM issues 
       WHERE created_at >= $1 ${departmentCondition}
       GROUP BY priority
       ORDER BY 
         CASE priority 
           WHEN 'urgent' THEN 1 
           WHEN 'high' THEN 2 
           WHEN 'medium' THEN 3 
           WHEN 'low' THEN 4 
         END`,
      values
    );

    // Get issues by category (top 10)
    const categoryStats = await query(
      `SELECT 
         c.name as category_name,
         c.color as category_color,
         COUNT(i.id) as count
       FROM issues i
       JOIN categories c ON i.category_id = c.id
       WHERE i.created_at >= $1 ${departmentCondition}
       GROUP BY c.id, c.name, c.color
       ORDER BY count DESC
       LIMIT 10`,
      values
    );

    // Get daily issue creation trends
    const dailyTrends = await query(
      `SELECT 
         DATE(created_at) as date,
         COUNT(*) as issues_created,
         COUNT(CASE WHEN resolved_at IS NOT NULL THEN 1 END) as issues_resolved
       FROM issues 
       WHERE created_at >= $1 ${departmentCondition}
       GROUP BY DATE(created_at)
       ORDER BY date`,
      values
    );

    // Get response time statistics
    const responseTimeStats = await query(
      `SELECT 
         AVG(CASE WHEN acknowledged_at IS NOT NULL 
           THEN EXTRACT(EPOCH FROM (acknowledged_at - created_at))/3600 END) as avg_acknowledgment_hours,
         AVG(CASE WHEN resolved_at IS NOT NULL 
           THEN EXTRACT(EPOCH FROM (resolved_at - created_at))/3600 END) as avg_resolution_hours,
         PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY 
           CASE WHEN resolved_at IS NOT NULL 
             THEN EXTRACT(EPOCH FROM (resolved_at - created_at))/3600 END) as median_resolution_hours
       FROM issues 
       WHERE created_at >= $1 ${departmentCondition}`,
      values
    );

    const stats = overallStats.rows[0];
    const responseStats = responseTimeStats.rows[0];

    res.json({
      success: true,
      data: {
        timeframe: `${days} days`,
        overview: {
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
        priorityDistribution: priorityStats.rows.map(row => ({
          priority: row.priority,
          count: parseInt(row.count)
        })),
        categoryBreakdown: categoryStats.rows.map(row => ({
          name: row.category_name,
          color: row.category_color,
          count: parseInt(row.count)
        })),
        dailyTrends: dailyTrends.rows.map(row => ({
          date: row.date,
          created: parseInt(row.issues_created),
          resolved: parseInt(row.issues_resolved)
        })),
        responseMetrics: {
          averageAcknowledgmentHours: responseStats.avg_acknowledgment_hours ? 
            parseFloat(responseStats.avg_acknowledgment_hours).toFixed(2) : null,
          averageResolutionHours: responseStats.avg_resolution_hours ? 
            parseFloat(responseStats.avg_resolution_hours).toFixed(2) : null,
          medianResolutionHours: responseStats.median_resolution_hours ? 
            parseFloat(responseStats.median_resolution_hours).toFixed(2) : null
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get department performance comparison
// @route   GET /api/analytics/departments
// @access  Admin only
const getDepartmentComparison = async (req, res, next) => {
  try {
    const { timeframe = '30' } = req.query;
    
    const days = parseInt(timeframe);
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const result = await query(
      `SELECT 
         d.id,
         d.name as department_name,
         COUNT(i.id) as total_issues,
         COUNT(CASE WHEN i.status = 'resolved' THEN 1 END) as resolved_issues,
         AVG(CASE WHEN i.resolved_at IS NOT NULL 
           THEN EXTRACT(EPOCH FROM (i.resolved_at - i.created_at))/3600 END) as avg_resolution_hours,
         COUNT(CASE WHEN i.status IN ('submitted', 'acknowledged') THEN 1 END) as pending_issues
       FROM departments d
       LEFT JOIN issues i ON d.id = i.department_id AND i.created_at >= $1
       WHERE d.is_active = true
       GROUP BY d.id, d.name
       ORDER BY total_issues DESC`,
      [fromDate.toISOString()]
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        departmentId: row.id,
        departmentName: row.department_name,
        totalIssues: parseInt(row.total_issues),
        resolvedIssues: parseInt(row.resolved_issues),
        resolutionRate: row.total_issues > 0 ? 
          ((row.resolved_issues / row.total_issues) * 100).toFixed(1) : 0,
        averageResolutionHours: row.avg_resolution_hours ? 
          parseFloat(row.avg_resolution_hours).toFixed(2) : null,
        pendingIssues: parseInt(row.pending_issues)
      }))
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get geographic heat map data
// @route   GET /api/analytics/heatmap
// @access  Staff/Admin
const getHeatmapData = async (req, res, next) => {
  try {
    const { timeframe = '30', department, bounds } = req.query;
    
    const days = parseInt(timeframe);
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    let conditions = ['i.created_at >= $1'];
    let values = [fromDate.toISOString()];
    let paramCount = 2;

    // For staff users, restrict to their department
    if (req.user.role === 'staff') {
      conditions.push(`i.department_id = $${paramCount++}`);
      values.push(req.user.department_id);
    } else if (department) {
      conditions.push(`i.department_id = $${paramCount++}`);
      values.push(department);
    }

    // Add geographic bounds if provided
    if (bounds) {
      const [minLng, minLat, maxLng, maxLat] = bounds.split(',').map(Number);
      conditions.push(`i.longitude >= $${paramCount++} AND i.longitude <= $${paramCount++}`);
      conditions.push(`i.latitude >= $${paramCount++} AND i.latitude <= $${paramCount++}`);
      values.push(minLng, maxLng, minLat, maxLat);
    }

    const result = await query(
      `SELECT 
         latitude,
         longitude,
         status,
         priority,
         c.name as category_name,
         c.color as category_color
       FROM issues i
       JOIN categories c ON i.category_id = c.id
       WHERE ${conditions.join(' AND ')}`,
      values
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        lat: parseFloat(row.latitude),
        lng: parseFloat(row.longitude),
        status: row.status,
        priority: row.priority,
        category: row.category_name,
        color: row.category_color
      }))
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user performance statistics
// @route   GET /api/analytics/staff-performance
// @access  Admin only
const getStaffPerformance = async (req, res, next) => {
  try {
    const { timeframe = '30', department } = req.query;
    
    const days = parseInt(timeframe);
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    let conditions = ['i.created_at >= $1', 'u.role IN (\'staff\', \'admin\')'];
    let values = [fromDate.toISOString()];
    let paramCount = 2;

    if (department) {
      conditions.push(`u.department_id = $${paramCount++}`);
      values.push(department);
    }

    const result = await query(
      `SELECT 
         u.id,
         u.first_name,
         u.last_name,
         u.email,
         d.name as department_name,
         COUNT(i.id) as assigned_issues,
         COUNT(CASE WHEN i.status = 'resolved' THEN 1 END) as resolved_issues,
         AVG(CASE WHEN i.resolved_at IS NOT NULL 
           THEN EXTRACT(EPOCH FROM (i.resolved_at - i.created_at))/3600 END) as avg_resolution_hours
       FROM users u
       LEFT JOIN issues i ON u.id = i.assigned_to AND i.created_at >= $1
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE ${conditions.join(' AND ')}
       GROUP BY u.id, u.first_name, u.last_name, u.email, d.name
       ORDER BY assigned_issues DESC`,
      values
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        userId: row.id,
        name: `${row.first_name} ${row.last_name}`,
        email: row.email,
        department: row.department_name,
        assignedIssues: parseInt(row.assigned_issues),
        resolvedIssues: parseInt(row.resolved_issues),
        resolutionRate: row.assigned_issues > 0 ? 
          ((row.resolved_issues / row.assigned_issues) * 100).toFixed(1) : 0,
        averageResolutionHours: row.avg_resolution_hours ? 
          parseFloat(row.avg_resolution_hours).toFixed(2) : null
      }))
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Export data for reports
// @route   GET /api/analytics/export
// @access  Staff/Admin
const exportData = async (req, res, next) => {
  try {
    const { format = 'json', timeframe = '30', type = 'issues' } = req.query;
    
    const days = parseInt(timeframe);
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    let queryText = '';
    const values = [fromDate.toISOString()];
    let departmentCondition = '';

    // For staff users, restrict to their department
    if (req.user.role === 'staff') {
      departmentCondition = 'AND i.department_id = $2';
      values.push(req.user.department_id);
    }

    if (type === 'issues') {
      queryText = `
        SELECT 
          i.id,
          i.title,
          i.description,
          i.latitude,
          i.longitude,
          i.address,
          i.status,
          i.priority,
          i.created_at,
          i.resolved_at,
          c.name as category,
          d.name as department,
          CONCAT(r.first_name, ' ', r.last_name) as reporter,
          CONCAT(a.first_name, ' ', a.last_name) as assigned_to
        FROM issues i
        LEFT JOIN categories c ON i.category_id = c.id
        LEFT JOIN departments d ON i.department_id = d.id
        LEFT JOIN users r ON i.reporter_id = r.id
        LEFT JOIN users a ON i.assigned_to = a.id
        WHERE i.created_at >= $1 ${departmentCondition}
        ORDER BY i.created_at DESC
      `;
    }

    const result = await query(queryText, values);

    if (format === 'csv') {
      // Generate CSV format
      const headers = Object.keys(result.rows[0] || {});
      const csvData = [
        headers.join(','),
        ...result.rows.map(row => 
          headers.map(header => `"${row[header] || ''}"`).join(',')
        )
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="civic-issues-${type}-${Date.now()}.csv"`);
      res.send(csvData);
    } else {
      // Return JSON format
      res.json({
        success: true,
        data: {
          exportType: type,
          timeframe: `${days} days`,
          recordCount: result.rows.length,
          generatedAt: new Date().toISOString(),
          records: result.rows
        }
      });
    }
  } catch (error) {
    next(error);
  }
};

// Routes
router.get('/dashboard', protect, staffOnly, getDashboardStats);
router.get('/departments', protect, getDepartmentComparison);
router.get('/heatmap', protect, staffOnly, getHeatmapData);
router.get('/staff-performance', protect, getStaffPerformance);
router.get('/export', protect, staffOnly, exportData);

module.exports = router;