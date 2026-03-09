import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import pool from '../config/database';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/assessments/categories
router.get('/categories', async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM gift_categories ORDER BY sort_order') as any[];
    res.json(rows);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/assessments/dashboard — personal dashboard data
router.get('/dashboard', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  try {
    // Most recent assessment details
    const [latestAssessment] = await pool.execute(
      'SELECT id, created_at FROM assessments WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [userId]
    ) as any[];

    let latestScores: any[] = [];
    if (latestAssessment.length) {
      const [scores] = await pool.execute(
        `SELECT ar.gift_category_id, ar.score, gc.name, gc.short_name,
                gc.spiritual_state_label, gc.natural_state_label, gc.sort_order
         FROM assessment_responses ar
         JOIN gift_categories gc ON gc.id = ar.gift_category_id
         WHERE ar.assessment_id = ?
         ORDER BY gc.sort_order`,
        [latestAssessment[0].id]
      ) as any[];
      latestScores = scores;
    }

    // History for trend chart (last 10 assessments, oldest first)
    const [history] = await pool.execute(
      `SELECT a.id, a.created_at,
              ROUND(AVG(ar.score), 1) AS avg_score
       FROM assessments a
       JOIN assessment_responses ar ON ar.assessment_id = a.id
       WHERE a.user_id = ?
       GROUP BY a.id
       ORDER BY a.created_at DESC
       LIMIT 10`,
      [userId]
    ) as any[];

    // Total count
    const [countRows] = await pool.execute(
      'SELECT COUNT(*) AS count FROM assessments WHERE user_id = ?',
      [userId]
    ) as any[];

    res.json({
      latest: latestAssessment[0] || null,
      latest_scores: latestScores,
      history: (history as any[]).reverse(),
      total_assessments: countRows[0].count
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/assessments/group-dashboard
router.get('/group-dashboard', requireRole('superadmin', 'group_admin'), async (req: Request, res: Response) => {
  const groupId = req.user!.role === 'group_admin'
    ? req.user!.groupId
    : (req.query.group_id ? parseInt(req.query.group_id as string) : null);

  if (!groupId) {
    res.status(400).json({ error: 'group_id required' });
    return;
  }

  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.first_name, u.last_name,
              MAX(a.created_at) AS last_assessment,
              ROUND(AVG(ar.score), 1) AS avg_score,
              COUNT(DISTINCT a.id) AS assessment_count
       FROM users u
       LEFT JOIN assessments a ON a.user_id = u.id
       LEFT JOIN assessment_responses ar ON ar.assessment_id = a.id
       WHERE u.group_id = ? AND u.is_active = TRUE
       GROUP BY u.id
       ORDER BY u.last_name, u.first_name`,
      [groupId]
    ) as any[];
    res.json(rows);
  } catch (error) {
    console.error('Group dashboard error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/assessments — list current user's assessments
router.get('/', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

  try {
    const [rows] = await pool.execute(
      `SELECT a.id, a.created_at, a.notes,
              ROUND(AVG(ar.score), 1) AS avg_score
       FROM assessments a
       LEFT JOIN assessment_responses ar ON ar.assessment_id = a.id
       WHERE a.user_id = ?
       GROUP BY a.id
       ORDER BY a.created_at DESC
       LIMIT ?`,
      [userId, limit]
    ) as any[];
    res.json(rows);
  } catch (error) {
    console.error('List assessments error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/assessments
router.post(
  '/',
  [
    body('responses')
      .isArray({ min: 7, max: 7 })
      .withMessage('Must provide exactly 7 gift category responses'),
    body('responses.*.gift_category_id').isInt({ min: 1 }),
    body('responses.*.score').isInt({ min: 1, max: 10 }),
    body('responses.*.note').optional({ nullable: true }).trim().isLength({ max: 500 }),
    body('notes').optional({ nullable: true }).trim().isLength({ max: 1000 })
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const userId = req.user!.userId;
    const { responses, notes } = req.body;

    // Ensure all 7 categories are unique
    const categoryIds: number[] = responses.map((r: any) => r.gift_category_id);
    if (new Set(categoryIds).size !== 7) {
      res.status(400).json({ error: 'Each gift category must appear exactly once' });
      return;
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [result] = await conn.execute(
        'INSERT INTO assessments (user_id, notes) VALUES (?, ?)',
        [userId, notes || null]
      ) as any[];

      const assessmentId = result.insertId;

      for (const response of responses) {
        await conn.execute(
          'INSERT INTO assessment_responses (assessment_id, gift_category_id, score, note) VALUES (?, ?, ?, ?)',
          [assessmentId, response.gift_category_id, response.score, response.note || null]
        );
      }

      await conn.commit();
      res.status(201).json({ id: assessmentId, message: 'Assessment saved successfully' });
    } catch (error) {
      await conn.rollback();
      console.error('Create assessment error:', error);
      res.status(500).json({ error: 'Server error' });
    } finally {
      conn.release();
    }
  }
);

// GET /api/assessments/:id
router.get(
  '/:id',
  [param('id').isInt({ min: 1 })],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const assessmentId = parseInt(req.params.id);
    const userId = req.user!.userId;

    try {
      const [assessRows] = await pool.execute(
        'SELECT * FROM assessments WHERE id = ?',
        [assessmentId]
      ) as any[];

      if (!assessRows.length) {
        res.status(404).json({ error: 'Assessment not found' });
        return;
      }

      const assessment = assessRows[0];

      // Regular users can only view their own assessments
      if (req.user!.role === 'user' && assessment.user_id !== userId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const [responseRows] = await pool.execute(
        `SELECT ar.id, ar.gift_category_id, ar.score,
                gc.name, gc.short_name, gc.natural_state_label,
                gc.spiritual_state_label, gc.core_struggle, gc.sort_order
         FROM assessment_responses ar
         JOIN gift_categories gc ON gc.id = ar.gift_category_id
         WHERE ar.assessment_id = ?
         ORDER BY gc.sort_order`,
        [assessmentId]
      ) as any[];

      res.json({ ...assessment, responses: responseRows });
    } catch (error) {
      console.error('Get assessment error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

export default router;
