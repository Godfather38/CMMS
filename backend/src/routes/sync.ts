import { Router, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { validate, syncDocumentSchema } from '../middleware/validation';
import * as syncService from '../services/sync';
import { AuthenticatedRequest } from '../types';

const router = Router();

router.use(requireAuth);

// POST /api/v1/sync/full
router.post('/full', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const result = await syncService.syncAllDocuments(req.user!.id);
    res.json({
      status: 'success',
      data: result
    });
  } catch (err) { next(err); }
});

// GET /api/v1/sync/status
router.get('/status', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const status = await syncService.getSyncStatus(req.user!.id);
    res.json({
      status: 'success',
      data: status
    });
  } catch (err) { next(err); }
});

// POST /api/v1/sync/document/:document_id
router.post('/document/:document_id', validate(syncDocumentSchema), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const result = await syncService.syncDocument(req.user!.id, req.params.document_id);
    res.json({
      status: 'success',
      data: result
    });
  } catch (err) { next(err); }
});

export default router;