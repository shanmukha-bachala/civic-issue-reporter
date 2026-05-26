const jwt = require('jsonwebtoken');
const { query } = require('../../config/database');

// Protect routes - require valid JWT token
const protect = async (req, res, next) => {
  let token;

  // Check for token in Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from database (excluding password)
      const result = await query(
        `SELECT id, email, first_name, last_name, role, department_id, is_verified, is_active, created_at
         FROM users 
         WHERE id = $1 AND is_active = true`,
        [decoded.id]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: 'User not found or inactive'
        });
      }

      req.user = result.rows[0];
      next();
    } catch (error) {
      console.error('Token verification failed:', error.message);
      return res.status(401).json({
        success: false,
        error: 'Not authorized, token failed'
      });
    }
  } else {
    return res.status(401).json({
      success: false,
      error: 'Not authorized, no token provided'
    });
  }
};

// Admin only access
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({
      success: false,
      error: 'Access denied. Admin privileges required.'
    });
  }
};

// Staff or admin access
const staffOnly = (req, res, next) => {
  if (req.user && (req.user.role === 'staff' || req.user.role === 'admin')) {
    next();
  } else {
    res.status(403).json({
      success: false,
      error: 'Access denied. Staff privileges required.'
    });
  }
};

// Optional authentication - doesn't require token but adds user if present
const optionalAuth = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const result = await query(
        `SELECT id, email, first_name, last_name, role, department_id, is_verified, is_active, created_at
         FROM users 
         WHERE id = $1 AND is_active = true`,
        [decoded.id]
      );

      if (result.rows.length > 0) {
        req.user = result.rows[0];
      }
    } catch (error) {
      // Silently fail for optional auth
      console.log('Optional auth failed:', error.message);
    }
  }

  next();
};

// Check if user can access specific department data
const departmentAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  // Admin can access everything
  if (req.user.role === 'admin') {
    return next();
  }

  // Staff can only access their own department
  if (req.user.role === 'staff') {
    const requestedDepartmentId = req.params.departmentId || req.body.department_id;
    
    if (requestedDepartmentId && requestedDepartmentId !== req.user.department_id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Cannot access other department data.'
      });
    }
  }

  next();
};

// Check if user can modify specific resource
const resourceOwner = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  // Admin can modify everything
  if (req.user.role === 'admin') {
    return next();
  }

  // For other roles, check ownership in the route handler
  req.checkOwnership = true;
  next();
};

// Rate limiting for sensitive operations
const sensitiveOperation = (req, res, next) => {
  // Add timestamp to track sensitive operations
  req.sensitiveOperation = {
    timestamp: Date.now(),
    ip: req.ip,
    userAgent: req.get('User-Agent')
  };
  
  next();
};

module.exports = {
  protect,
  adminOnly,
  staffOnly,
  optionalAuth,
  departmentAccess,
  resourceOwner,
  sensitiveOperation
};