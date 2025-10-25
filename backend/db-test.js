import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Create connection to database
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Test the connection
const testConnection = async () => {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('Database connected successfully!');
    console.log('Current time:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('Database connection failed:', error.message);
    return false;
  }
};

export { pool, testConnection };