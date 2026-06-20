import express from 'express';
import db from '../database/db.js';
import sharp from 'sharp';

const router = express.Router();

// Helper to generate thumbnail
async function generateThumb(avatarBase64) {
  if (!avatarBase64) return null;
  // If not base64, just return null (or handle if it's a URL in future)
  if (!avatarBase64.startsWith('data:image')) return null;

  try {
    const buffer = Buffer.from(avatarBase64.split('base64,')[1], 'base64');
    const thumbBuffer = await sharp(buffer)
      .resize(64, 64, { fit: 'cover' })
      .jpeg({ quality: 60 })
      .toBuffer();
    return `data:image/jpeg;base64,${thumbBuffer.toString('base64')}`;
  } catch (e) {
    console.error('Thumb generation failed:', e);
    return null; // Fallback: no thumb
  }
}

// Get all users
// Default: Active users only, returns avatar_thumb (no full avatar)
// ?include=all: Active + Inactive users (for historical rendering)
router.get('/', async (req, res) => {
  try {
    const { include } = req.query;
    let query = 'SELECT id, name, avatar_thumb, is_active FROM users'; // Efficient query
    const params = [];

    if (include !== 'all') {
      query += ' WHERE is_active = 1';
    }
    query += ' ORDER BY name';

    const result = await db.execute({ sql: query, args: params });
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get full avatar for a user (on-demand loading)
router.get('/:id/avatar', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.execute({
      sql: 'SELECT avatar FROM users WHERE id = ?',
      args: [id]
    });
    
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Check if avatar exists
    if (!user.avatar) {
        return res.json({ avatar: null }); 
    }

    // Return the full avatar
    res.json({ avatar: user.avatar });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add user
router.post('/', async (req, res) => {
  const { name, avatar } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  try {
    // Generate thumb server-side
    const avatar_thumb = avatar ? await generateThumb(avatar) : null;

    const result = await db.execute({
      sql: 'INSERT INTO users (name, avatar, avatar_thumb) VALUES (?, ?, ?)',
      args: [name, avatar || null, avatar_thumb]
    });
    
    // Return the created user with thumb (no full avatar needed in response usually, but for consistency we can return whatever)
    // The previous implementation returned full object. Here we return thumb to keep response light.
    res.json({ id: String(result.lastInsertRowid), name, avatar_thumb, is_active: 1 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, avatar } = req.body;

  try {
    // Need current state to know if avatar changed
    const userResult = await db.execute({
      sql: 'SELECT * FROM users WHERE id = ?',
      args: [id]
    });
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    const newName = name !== undefined ? name : user.name;
    let newAvatar = user.avatar;
    let newAvatarThumb = user.avatar_thumb;

    if (avatar !== undefined) {
      // Avatar is being updated (could be null or new base64)
      newAvatar = avatar;
      // Regenerate thumb if avatar changed
      if (avatar) {
          newAvatarThumb = await generateThumb(avatar);
      } else {
          newAvatarThumb = null;
      }
    }

    await db.execute({
      sql: 'UPDATE users SET name = ?, avatar = ?, avatar_thumb = ? WHERE id = ?',
      args: [newName, newAvatar, newAvatarThumb, id]
    });

    // Return light object
    res.json({ success: true, user: { id, name: newName, avatar_thumb: newAvatarThumb } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove user (soft delete)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.execute({
      sql: 'UPDATE users SET is_active = 0 WHERE id = ?',
      args: [id]
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
