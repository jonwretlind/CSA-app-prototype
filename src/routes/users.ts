import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { body, param, query, validationResult } from 'express-validator';
import pool from '../config/database';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/users
router.get('/', requireRole('superadmin', 'group_admin'), async (req: Request, res: Response) => {
  try {
    let sql = `
      SELECT u.id, u.email, u.first_name, u.last_name, u.role,
             u.group_id, u.is_active, u.created_at, g.name AS group_name
      FROM users u
      LEFT JOIN \`groups\` g ON g.id = u.group_id
    `;
    const params: any[] = [];

    if (req.user!.role === 'group_admin') {
      sql += ' WHERE u.group_id = ?';
      params.push(req.user!.groupId);
    }

    sql += ' ORDER BY u.last_name, u.first_name';
    const [rows] = await pool.execute(sql, params) as any[];
    res.json(rows);
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/users
router.post(
  '/',
  requireRole('superadmin', 'group_admin'),
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('first_name').trim().notEmpty().withMessage('First name required'),
    body('last_name').trim().notEmpty().withMessage('Last name required'),
    body('role').isIn(['group_admin', 'user']),
    body('group_id').optional({ nullable: true }).isInt({ min: 1 })
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { email, password, first_name, last_name, role, group_id } = req.body;

    // Group admins can only create regular users in their own group
    const effectiveGroupId = req.user!.role === 'group_admin' ? req.user!.groupId : (group_id ?? null);
    const effectiveRole = req.user!.role === 'group_admin' ? 'user' : role;

    try {
      const passwordHash = await bcrypt.hash(password, 12);
      const [result] = await pool.execute(
        'INSERT INTO users (email, password_hash, first_name, last_name, role, group_id) VALUES (?, ?, ?, ?, ?, ?)',
        [email, passwordHash, first_name, last_name, effectiveRole, effectiveGroupId]
      ) as any[];

      res.status(201).json({ id: result.insertId, message: 'User created successfully' });
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY') {
        res.status(409).json({ error: 'Email already in use' });
        return;
      }
      console.error('Create user error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// GET /api/users/:id
router.get(
  '/:id',
  requireRole('superadmin', 'group_admin'),
  [param('id').isInt({ min: 1 })],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const userId = parseInt(req.params.id);
    try {
      const [rows] = await pool.execute(
        `SELECT u.id, u.email, u.first_name, u.last_name, u.role,
                u.group_id, u.is_active, u.created_at, g.name AS group_name
         FROM users u LEFT JOIN \`groups\` g ON g.id = u.group_id
         WHERE u.id = ?`,
        [userId]
      ) as any[];

      if (!rows.length) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const user = rows[0];
      if (req.user!.role === 'group_admin' && user.group_id !== req.user!.groupId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      res.json(user);
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// PUT /api/users/:id
router.put(
  '/:id',
  requireRole('superadmin', 'group_admin'),
  [
    param('id').isInt({ min: 1 }),
    body('first_name').optional().trim().notEmpty(),
    body('last_name').optional().trim().notEmpty(),
    body('role').optional().isIn(['group_admin', 'user']),
    body('group_id').optional({ nullable: true }),
    body('is_active').optional().isBoolean()
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const userId = parseInt(req.params.id);

    try {
      const [rows] = await pool.execute('SELECT id, group_id, role FROM users WHERE id = ?', [userId]) as any[];
      if (!rows.length) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const targetUser = rows[0];
      if (req.user!.role === 'group_admin' && targetUser.group_id !== req.user!.groupId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const { first_name, last_name, role, group_id, is_active } = req.body;
      const updates: string[] = [];
      const params: any[] = [];

      if (first_name !== undefined) { updates.push('first_name = ?'); params.push(first_name); }
      if (last_name !== undefined) { updates.push('last_name = ?'); params.push(last_name); }
      if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active); }

      // Only superadmin can change role and group assignment
      if (req.user!.role === 'superadmin') {
        if (role !== undefined) { updates.push('role = ?'); params.push(role); }
        if (group_id !== undefined) { updates.push('group_id = ?'); params.push(group_id); }
      }

      if (updates.length === 0) {
        res.status(400).json({ error: 'No fields to update' });
        return;
      }

      params.push(userId);
      await pool.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
      res.json({ message: 'User updated successfully' });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// DELETE /api/users/:id  (soft delete — deactivate only)
router.delete(
  '/:id',
  requireRole('superadmin'),
  [param('id').isInt({ min: 1 })],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const userId = parseInt(req.params.id);
    if (userId === req.user!.userId) {
      res.status(400).json({ error: 'Cannot deactivate your own account' });
      return;
    }

    try {
      await pool.execute('UPDATE users SET is_active = FALSE WHERE id = ?', [userId]);
      res.json({ message: 'User deactivated successfully' });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

export default router;
