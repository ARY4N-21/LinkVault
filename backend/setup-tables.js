import { pool } from "./db-test.js";

const createTables = async () => {
  try {
    console.log('🔄 Creating tables...');

    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Users table created');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS bookmarks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        title VARCHAR(500),
        description TEXT,
        tags TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
      );
    `);
    console.log('Bookmarks table created');

    console.log('All tables created successfully!');
    
  } catch (error) {
    console.error('Error creating tables:', error.message);
  } finally {
    await pool.end();
  }
};

createTables();