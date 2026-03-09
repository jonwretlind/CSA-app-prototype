import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import pool from '../config/database';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/groups
router.get('/', requireRole('superadmin', 'group_admin'), async (req: Request, res: Response) => {
  try {
    let sql = `
      SELECT g.id, g.name, g.description, g.created_at,
             COUNT(u.id) AS member_count
      FROM \`groups\` g
      LEFT JOIN users u ON u.group_id = g.id AND u.is_active = TRUE
    `;
    const params: any[] = [];

    if (req.user!.role === 'group_admin') {
      sql += ' WHERE g.id = ?';
      params.push(req.user!.groupId);
    }

    sql += ' GROUP BY g.id ORDER BY g.name';
    const [rows] = await pool.execute(sql, params) as any[];
    res.json(rows);
  } catch (error) {
    console.error('List groups error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/groups
router.post(
  '/',
  requireRole('superadmin'),
  [
    body('name').trim().notEmpty().isLength({ max: 255 }),
    body('description').optional({ nullable: true }).trim()
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { name, description } = req.body;
    try {
      const [result] = await pool.execute(
        'INSERT INTO `groups` (name, description) VALUES (?, ?)',
        [name, description || null]
      ) as any[];
      res.status(201).json({ id: result.insertId, message: 'Group created successfully' });
    } catch (error) {
      console.error('Create group error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// GET /api/groups/:id
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

    const groupId = parseInt(req.params.id);
    if (req.user!.role === 'group_admin' && req.user!.groupId !== groupId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    try {
      const [groupRows] = await pool.execute('SELECT * FROM `groups` WHERE id = ?', [groupId]) as any[];
      if (!groupRows.length) {
        res.status(404).json({ error: 'Group not found' });
        return;
      }

      const [memberRows] = await pool.execute(
        'SELECT id, email, first_name, last_name, role, is_active FROM users WHERE group_id = ? ORDER BY last_name, first_name',
        [groupId]
      ) as any[];

      res.json({ ...groupRows[0], members: memberRows });
    } catch (error) {
      console.error('Get group error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// PUT /api/groups/:id
router.put(
  '/:id',
  requireRole('superadmin'),
  [
    param('id').isInt({ min: 1 }),
    body('name').optional().trim().notEmpty().isLength({ max: 255 }),
    body('description').optional({ nullable: true }).trim()
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const groupId = parseInt(req.params.id);
    const { name, description } = req.body;

    const updates: string[] = [];
    const params: any[] = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    try {
      params.push(groupId);
      await pool.execute(`UPDATE \`groups\` SET ${updates.join(', ')} WHERE id = ?`, params);
      res.json({ message: 'Group updated successfully' });
    } catch (error) {
      console.error('Update group error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// DELETE /api/groups/:id
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

    const groupId = parseInt(req.params.id);
    try {
      // Unassign users before deleting the group
      await pool.execute('UPDATE users SET group_id = NULL WHERE group_id = ?', [groupId]);
      await pool.execute('DELETE FROM `groups` WHERE id = ?', [groupId]);
      res.json({ message: 'Group deleted successfully' });
    } catch (error) {
      console.error('Delete group error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

export default router;
