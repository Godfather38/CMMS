import { Router, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { validate, colorsSuggestSchema } from '../middleware/validation';
import * as colorService from '../services/color';
import { AuthenticatedRequest } from '../types';

const router = Router();

router.use(requireAuth);

// GET /api/v1/colors/suggest?document_id=<uuid>
// Next recommended color for a new segment in this document.
router.get('/suggest', validate(colorsSuggestSchema), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const color = await colorService.assignColor(req.user!.id, req.query.document_id as string);
    res.json({ status: 'success', data: { color } });
  } catch (err) { next(err); }
});

export default router;
