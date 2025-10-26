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

// fetch url metadata
const fetchMetadata = async (url) => {
    try {
        const res = await axios.get(url, {
            timeout: 10000, // Increased timeout
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const $ = cheerio.load(res.data);

        // Enhanced description extraction with multiple fallbacks
        let description =
            $('meta[property="og:description"]').attr('content') ||
            $('meta[name="description"]').attr('content') ||
            $('meta[name="twitter:description"]').attr('content') ||
            $('meta[itemprop="description"]').attr('content') ||
            '';

        // If no meta description found, try to extract from content
        if (!description) {
            // Try to get first paragraph text
            const firstParagraph = $('p').first().text().trim();
            if (firstParagraph && firstParagraph.length > 20) {
                description = firstParagraph.substring(0, 300);
            } else {
                // Try to get text from main content areas
                const contentSelectors = [
                    '.description', '.summary', '.intro', '.lead',
                    'h1 + p', 'h2 + p', '.content p:first-of-type',
                    'main p:first-of-type', 'article p:first-of-type'
                ];

                for (const selector of contentSelectors) {
                    const text = $(selector).first().text().trim();
                    if (text && text.length > 20) {
                        description = text.substring(0, 300);
                        break;
                    }
                }
            }
        }

        // Clean up description
        if (description) {
            description = description
                .replace(/\s+/g, ' ')
                .replace(/\n/g, ' ')
                .trim()
                .substring(0, 500);
        }

        const metadata = {
            title: $('meta[property="og:title"]').attr('content') ||
                $('meta[name="twitter:title"]').attr('content') ||
                $('title').text() ||
                'Untitled',
            description: description,
            favicon: $('link[rel="icon"]').attr('href') ||
                $('link[rel="shortcut icon"]').attr('href') ||
                $('link[rel="apple-touch-icon"]').attr('href') ||
                '/favicon.ico'
        };

        // Clean up title
        if (metadata.title) {
            metadata.title = metadata.title
                .split('·')[0]
                .split('|')[0]
                .split('-')[0]
                .substring(0, 200)
                .trim();
        }

        if (metadata.favicon && !metadata.favicon.startsWith('http')) {
            const baseUrl = new URL(url).origin;
            metadata.favicon = new URL(metadata.favicon, baseUrl).toString();
        }

        console.log('Enhanced metadata fetched:', {
            url: url,
            title: metadata.title,
            descriptionLength: metadata.description?.length || 0,
            favicon: metadata.favicon
        });

        return {
            title: metadata.title,
            finalDescription: metadata.description,
            og_image: null,
            favicon: metadata.favicon,
            site_name: null
        };

    } catch (error) {
        console.error('Error fetching metadata for URL:', url, error.message);
        return {
            title: null,
            finalDescription: '',
            og_image: null,
            favicon: null,
            site_name: null
        };
    }
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
        console.log('Creating the bookmark:', { url, title, user_id });

        // Fetch metadata for rich display (images, favicon, etc.)
        const metadata = await fetchMetadata(url);

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

        const finalDescription = description || metadata.description;

        const result = await pool.query(
            `INSERT INTO bookmarks (
                user_id, url, title, description, tags, 
                og_image, favicon, site_name, metadata_fetched_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING *`,
            [
                user_id,
                url,
                finalTitle,
                finalDescription,
                tags || '',
                null,
                metadata.favicon,
                null
            ]
        );

        console.log('Bookmark created with metadata:', {
            id: result.rows[0].id,
            title: finalTitle,
            favicon: !!metadata.favicon
        });

        res.json({
            success: true,
            message: 'Bookmark saved successfully!',
            bookmark: result.rows[0]
        });
    } catch (error) {
        console.error('Error saving bookmark:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save bookmark: ' + error.message
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

        const currentBookmark = checkResult.rows[0];
        let finalTitle = title;
        let finalDescription = description;
        let metadata = {
            og_image: null,
            favicon: currentBookmark.favicon,
            site_name: null,
            finalDescription: currentBookmark.description,
            title: currentBookmark.title
        };

        // If URL has changed, fetch new metadata (including title)
        if (url !== currentBookmark.url) {
            console.log('URL changed, fetching new metadata for:', url);

            // Fetch metadata for the new URL
            metadata = await fetchMetadata(url);

            // When URL changes, always use the fetched title (like we do with description)
            // Only fall back to provided title if metadata fetch failed to get a title
            finalTitle = metadata.title || title || 'Untitled';
            finalDescription = description || metadata.finalDescription || '';

            console.log('URL changed - using fetched title:', finalTitle);
        } else {
            // URL hasn't changed, use provided title or keep existing
            finalTitle = title || currentBookmark.title;
            finalDescription = description !== undefined ? description : currentBookmark.description;
        }

        // Update with metadata fields
        const result = await pool.query(
            `UPDATE bookmarks SET 
                url = $1, 
                title = $2, 
                description = $3, 
                tags = $4, 
                og_image = $5,
                favicon = $6,
                site_name = $7,
                metadata_fetched_at = CASE WHEN $1 != $9 THEN CURRENT_TIMESTAMP ELSE metadata_fetched_at END,
                updated_at = CURRENT_TIMESTAMP 
            WHERE id = $8 AND user_id = $10 
            RETURNING *`,
            [
                url,
                finalTitle || '',
                metadata.finalDescription || description || '',
                tags || '',
                null,
                metadata.favicon,
                null,
                bookmarkId,
                currentBookmark.url,
                user_id
            ]
        );

        console.log('Bookmark updated with metadata:', {
            url,
            title: finalTitle,
            favicon: metadata.favicon,
            description: metadata.finalDescription
        });

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
