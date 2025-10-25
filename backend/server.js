import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { testConnection, pool } from './db-test.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET;

// auth middleware for jwt token verification
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // this is bearer token

    if (!token) {
        return res.status(401).json({
            error: 'Access token required!'
        });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({
                error: 'Invalid access token!'
            });
        }
        req.user = user;
        next();
    });
};

// signup api
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { email, password, name } = req.body;
        console.log('Signing up user:', { email, name });

        // check if entry already in db
        const existingUser = await pool.query(
            'SELECT * FROM users WHERE email = $1', [email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'User with same email already exists!'
            });
        }

        // hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // create user
        const result = await pool.query(
            'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name, created_at',
            [email, hashedPassword, name]
        );

        const newUser = result.rows[0];

        // generate jwt token
        const token = jwt.sign(
            { userId: newUser.id, email: newUser.email },
            JWT_SECRET,
            { expiresIn: '3d' }
        );

        res.json({
            success: true,
            message: 'User registered successfully!',
            user: newUser,
            token: token
        });
    } catch (error) {
        console.error('Error creating new user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create user!'
        });
    }
});

// login api
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // find entry in db
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1', [email]
        );

        // user not found
        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password!'
            });
        }

        const user = result.rows[0];

        // check password
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password!'
            });
        }

        // generate jwt
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '3d' }
        );

        res.json({
            success: true,
            message: 'Login successful!',
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            },
            token: token
        });
    } catch (error) {
        console.error('Error logging in user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to log in user!'
        });
    }
});

app.get('/api', (req, res) => {
    res.json({
        message: 'LinkVault API is running!'
    });
});

// Save a bookmark
app.post('/api/bookmarks', authenticateToken, async (req, res) => {
    try {
        const { url, title, description, tags } = req.body;

        const user_id = req.user.userId;
        console.log('Saving the bookmark:', { url, title, user_id });

        let finalTitle = title;
        if (!title) {
            try {
                console.log('Fetching page title for:', url);
                const response = await axios.get(url, { timeout: 5000 });
                const $ = cheerio.load(response.data);
                let fetchedTitle = $('title').text().trim();
                if (fetchedTitle) {
                    fetchedTitle = fetchedTitle.split('·')[0].split('|')[0].split('-')[0].substring(0, 100).trim();
                }

                finalTitle = fetchedTitle || 'Untitled';
                console.log('Fetched title:', finalTitle);
            } catch (error) {
                console.error('Error fetching page title:', error);
                finalTitle = 'Untitled';
            }
        }
        const result = await pool.query(
            'INSERT INTO bookmarks (user_id, url, title, description, tags) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [user_id, url, finalTitle || '', description || '', tags || '']
        );

        res.json({
            success: true,
            message: 'Bookmark saved successfully!',
            bookmark: result.rows[0]
        });
    } catch (error) {
        console.error('Error saving bookmark:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save bookmark!'
        });
    }
});

// Get all bookmarks
app.get('/api/bookmarks', authenticateToken, async (req, res) => {
    try {
        const user_id = req.user.userId;
        const { searchparam, tag } = req.query;

        let query = 'SELECT * FROM bookmarks WHERE user_id = $1';
        let params = [user_id];

        if (searchparam && searchparam.trim()) {
            query += ` AND (LOWER(title) LIKE $${params.length + 1} OR LOWER(tags) LIKE $${params.length + 1})`;
            params.push(`%${searchparam.toLowerCase()}%`);
            console.log('Searching bookmarks with param:', searchparam);
        }

        if (tag && tag.trim()) {
            query += ` AND LOWER(tags) LIKE $${params.length + 1}`;
            params.push(`%${tag.toLowerCase()}%`);
            console.log('Filtering bookmarks by tag:', tag);
        }

        query += ' ORDER BY updated_at DESC NULLS LAST, created_at DESC';

        const result = await pool.query(query, params);
        res.json({
            success: true,
            bookmarks: result.rows,
            searchTerm: searchparam || null,
            tagFilter: tag || null
        });
    } catch (error) {
        console.error('Error fetching bookmarks:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch bookmarks!'
        });
    }
});

app.get('/api/bookmarks/tags', authenticateToken, async (req, res) => {
    try {
        const user_id = req.user.userId;

        const result = await pool.query(
            'SELECT tags FROM bookmarks WHERE user_id = $1 AND tags IS NOT NULL AND tags != \'\'',
            [user_id]
        );

        const tagCounts = {};
        
        result.rows.forEach(row => {
            if (row.tags) {
                const tags = row.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
                tags.forEach(tag => {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                });
            }
        });
        const sortedTags = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a]);

        res.json({
            success: true,
            tags: sortedTags,
            tagCounts: tagCounts
        });
    } catch (error) {
        console.error('Error fetching tags:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch tags!'
        });
    }
});

// delete bookmark
app.delete('/api/bookmarks/:id', authenticateToken, async (req, res) => {
    try {
        const user_id = req.user.userId;
        const bookmarkId = req.params.id; // get bookmark id from url params

        console.log('Deleting bookmark id:', bookmarkId, 'for user id:', user_id);

        // check if there is such bookmark for user
        const checkResult = await pool.query(
            'SELECT * FROM bookmarks WHERE id = $1 AND user_id = $2',
            [bookmarkId, user_id]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Bookmark not found!'
            });
        }

        const result = await pool.query(
            'DELETE FROM bookmarks WHERE id = $1 AND user_id = $2',
            [bookmarkId, user_id]
        );

        res.json({
            success: true,
            message: 'Bookmark deleted successfully!',
            deletedBookmarkId: bookmarkId
        });
    } catch (error) {
        console.error('Error deleting bookmark:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete bookmark!'
        });
    }
});

// edit bookmark
app.put('/api/bookmarks/:id', authenticateToken, async (req, res) => {
    try {
        const user_id = req.user.userId;
        const bookmarkId = req.params.id;
        const { url, title, description, tags } = req.body;

        console.log('Updating bookmark id:', bookmarkId, 'for user id:', user_id);

        // Check if bookmark exists and belongs to user
        const checkResult = await pool.query(
            'SELECT * FROM bookmarks WHERE id = $1 AND user_id = $2',
            [bookmarkId, user_id]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Bookmark not found!'
            });
        }

        const result = await pool.query(
            'UPDATE bookmarks SET url = $1, title = $2, description = $3, tags = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 AND user_id = $6 RETURNING *',
            [url, title || '', description || '', tags || '', bookmarkId, user_id]
        );

        res.json({
            success: true,
            message: 'Bookmark updated successfully!',
            bookmark: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating bookmark:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update bookmark!'
        });
    }
});

app.listen(PORT, async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Test it: http://localhost:${PORT}/api`);
    await testConnection();
});
