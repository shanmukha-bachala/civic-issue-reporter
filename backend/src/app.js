const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const { errorHandler, notFound } = require('./middleware/errorMiddleware');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const issueRoutes = require('./routes/issues');
const categoryRoutes = require('./routes/categories');
const departmentRoutes = require('./routes/departments');
const analyticsRoutes = require('./routes/analytics');
const oauthRoutes = require('./routes/oauth');
const { query } = require('../config/database');

const app = express();
const server = createServer(app);

// Shared CORS options
const corsOptions = {
  origin: process.env.FRONTEND_URLS ? process.env.FRONTEND_URLS.split(',') : ["http://localhost:3000", "http://localhost:3001"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"]
};

const io = new Server(server, { cors: corsOptions });

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute for dev
  max: 200, // Allow more requests in dev
  message: JSON.stringify({ error: 'Too many requests from this IP, please try again later.' }),
  statusCode: 429,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS'
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(morgan('combined'));
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Make io accessible to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Ensure required tables/columns exist (safety in case migrations not run)
(async () => {
  try {
    await query(`CREATE TABLE IF NOT EXISTS citizens (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      display_name VARCHAR(150),
      address TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );`);
    await query(`CREATE TABLE IF NOT EXISTS admins (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      display_name VARCHAR(150),
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );`);
    // Users table columns for locations
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS work_latitude DECIMAL(10,8);`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS work_longitude DECIMAL(11,8);`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS home_latitude DECIMAL(10,8);`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS home_longitude DECIMAL(11,8);`);
    // Upvotes table for issues
    await query(`CREATE TABLE IF NOT EXISTS issue_upvotes (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(issue_id, user_id)
    );`);
    await query(`CREATE INDEX IF NOT EXISTS idx_issue_upvotes_issue ON issue_upvotes(issue_id);`);
    // Email status column for issues (for simulated email status)
    await query(`ALTER TABLE issues ADD COLUMN IF NOT EXISTS email_status TEXT;`);
    console.log('✅ Ensured required tables/columns exist');
  } catch (e) {
    console.error('⚠️ Could not ensure schema:', e.message);
  }
})();

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/auth/oauth', oauthRoutes);
app.use('/api/notifications', require('./routes/notifications'));

// Dev-only debug endpoint
if ((process.env.NODE_ENV || 'development') !== 'production') {
  app.get('/api/debug/env', async (req, res) => {
    try {
      const dbPing = await query('SELECT 1 as ok');
      const corsOrigins = (process.env.FRONTEND_URLS ? process.env.FRONTEND_URLS.split(',') : ["http://localhost:3000","http://localhost:3001"]);
      res.json({
        success: true,
        data: {
          nodeEnv: process.env.NODE_ENV || 'development',
          corsOrigins,
          dbOk: dbPing?.rows?.[0]?.ok === 1
        }
      });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });
}

// Static file serving for uploads
app.use('/uploads', express.static('uploads'));

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join rooms based on user role and location
  socket.on('join', (data) => {
    if (data.userType === 'citizen' && data.location) {
      socket.join(`location_${data.location.lat}_${data.location.lng}`);
    } else if (data.userType === 'staff' && data.department) {
      socket.join(`department_${data.department}`);
    }
  });

  // Handle issue updates
  socket.on('issue_update', (data) => {
    socket.broadcast.emit('issue_updated', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;