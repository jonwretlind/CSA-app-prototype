import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import pool from '../config/database';
import { authenticate } from '../middleware/auth';

const router = Router();

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 1 }).withMessage('Password required')
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { email, password } = req.body;

    try {
      const [rows] = await pool.execute(
        'SELECT id, email, password_hash, first_name, last_name, role, group_id, is_active FROM users WHERE email = ?',
        [email]
      ) as any[];

      if (!rows.length) {
        // Constant-time response to prevent user enumeration
        await bcrypt.compare('dummy', '$2b$12$dummyhashtopreventtimingattacks12345678901');
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      const user = rows[0];

      if (!user.is_active) {
        res.status(401).json({ error: 'Account is deactivated' });
        return;
      }

      const passwordValid = await bcrypt.compare(password, user.password_hash);
      if (!passwordValid) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          role: user.role,
          groupId: user.group_id
        },
        process.env.JWT_SECRET!,
        { expiresIn: (process.env.JWT_EXPIRES_IN || '24h') as `${number}${'s'|'m'|'h'|'d'}` }
      );

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
          group_id: user.group_id
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// GET /api/auth/me
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, email, first_name, last_name, role, group_id, created_at FROM users WHERE id = ? AND is_active = TRUE',
      [req.user!.userId]
    ) as any[];

    if (!rows.length) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/change-password
router.post(
  '/change-password',
  authenticate,
  [
    body('current_password').isLength({ min: 1 }).withMessage('Current password required'),
    body('new_password')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters')
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { current_password, new_password } = req.body;

    try {
      const [rows] = await pool.execute(
        'SELECT password_hash FROM users WHERE id = ?',
        [req.user!.userId]
      ) as any[];

      if (!rows.length) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const passwordValid = await bcrypt.compare(current_password, rows[0].password_hash);
      if (!passwordValid) {
        res.status(401).json({ error: 'Current password is incorrect' });
        return;
      }

      const newHash = await bcrypt.hash(new_password, 12);
      await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.user!.userId]);

      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

export default router;
