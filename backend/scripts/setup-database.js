const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const dbConfig = {
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: 'postgres', // Connect to default database first
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
};

async function setupDatabase() {
  const pool = new Pool(dbConfig);

  try {
    console.log('🔧 Setting up Civic Issues database...');

    // Create database if it doesn't exist
    const dbName = process.env.DB_NAME || 'civic_issues';
    
    try {
      await pool.query(`CREATE DATABASE ${dbName}`);
      console.log(`✅ Database '${dbName}' created successfully`);
    } catch (error) {
      if (error.code === '42P04') {
        console.log(`ℹ️  Database '${dbName}' already exists`);
      } else {
        throw error;
      }
    }

    await pool.end();

    // Connect to the new database
    const appPool = new Pool({
      ...dbConfig,
      database: dbName
    });

    // Run migrations
    console.log('📋 Running migrations...');
    
    const migrationsDir = path.join(__dirname, '../migrations');
    const migrationFiles = fs.readdirSync(migrationsDir).sort();

    for (const file of migrationFiles) {
      if (file.endsWith('.sql')) {
        console.log(`  Running ${file}...`);
        const migrationSQL = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        
        try {
          await appPool.query(migrationSQL);
          console.log(`  ✅ ${file} completed`);
        } catch (error) {
          console.error(`  ❌ Error in ${file}:`, error.message);
          throw error;
        }
      }
    }

    await appPool.end();
    console.log('🎉 Database setup completed successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Copy .env.example to .env and update your database credentials');
    console.log('2. Run: npm install');
    console.log('3. Run: npm run dev');
    console.log('');
    console.log('Default admin user:');
    console.log('  Email: admin@city.gov');
    console.log('  Password: admin123');

  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    process.exit(1);
  }
}

// Run the setup
if (require.main === module) {
  setupDatabase();
}

module.exports = setupDatabase;