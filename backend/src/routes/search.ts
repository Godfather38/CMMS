import { Router, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { validate, searchSchema } from '../middleware/validation';
import * as searchService from '../services/search';
import { AuthenticatedRequest } from '../types';

const router = Router();

router.use(requireAuth);

// POST /api/v1/search
router.post('/', validate(searchSchema), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const results = await searchService.searchSegments(req.user!.id, req.body);
    res.json({
      status: 'success',
      data: results
    });
  } catch (err) { next(err); }
});

export default router;