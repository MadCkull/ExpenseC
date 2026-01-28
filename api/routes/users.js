import express from 'express';
import db from '../database/db.js';

const router = express.Router();

// Get all users
router.get('/', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM users WHERE is_active = 1 ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add user
router.post('/', async (req, res) => {
  const { name, avatar } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  try {
    const result = await db.execute({
      sql: 'INSERT INTO users (name, avatar) VALUES (?, ?)',
      args: [name, avatar || null]
    });
    res.json({ id: String(result.lastInsertRowid), name, avatar, is_active: 1 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, avatar } = req.body;

  try {
    const userResult = await db.execute({
      sql: 'SELECT * FROM users WHERE id = ?',
      args: [id]
    });
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    const newName = name !== undefined ? name : user.name;
    const newAvatar = avatar !== undefined ? avatar : user.avatar;

    await db.execute({
      sql: 'UPDATE users SET name = ?, avatar = ? WHERE id = ?',
      args: [newName, newAvatar, id]
    });
    res.json({ success: true, user: { id, name: newName, avatar: newAvatar } });
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
