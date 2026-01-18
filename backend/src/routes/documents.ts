import { Router, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { validate, listDocumentsSchema, createDocumentSchema, createFromSelectionSchema, documentIdParamSchema } from '../middleware/validation';
import * as docService from '../services/documents';
import { AuthenticatedRequest } from '../types';
import { AppError } from '../utils/errors';

const router = Router();

// Apply Auth middleware to all routes
router.use(requireAuth);

// GET /api/v1/documents
router.get('/', validate(listDocumentsSchema), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const filters = req.query as any;
    const result = await docService.listDocuments(req.user!.id, filters);
    
    res.json({
      status: 'success',
      data: result.data,
      pagination: {
        total: result.total,
        limit: filters.limit,
        offset: filters.offset
      }
    });
  } catch (err) { next(err); }
});

// GET /api/v1/documents/:id
router.get('/:id', validate(documentIdParamSchema), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const doc = await docService.getDocumentById(req.user!.id, req.params.id);
    if (!doc) throw new AppError('Document not found', 404);

    res.json({
      status: 'success',
      data: doc
    });
  } catch (err) { next(err); }
});

// POST /api/v1/documents
router.post('/', validate(createDocumentSchema), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const doc = await docService.registerDocument(req.user!, req.body);
    res.status(201).json({
      status: 'success',
      data: doc
    });
  } catch (err) { next(err); }
});

// POST /api/v1/documents/from-selection
router.post('/from-selection', validate(createFromSelectionSchema), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const doc = await docService.createDocumentFromSelection(req.user!, req.body);
    res.status(201).json({
      status: 'success',
      data: doc
    });
  } catch (err) { next(err); }
});

// DELETE /api/v1/documents/:id
router.delete('/:id', validate(documentIdParamSchema), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const hardDelete = req.query.hard === 'true';
    const success = await docService.deleteDocument(req.user!.id, req.params.id, hardDelete);
    
    if (!success) throw new AppError('Document not found', 404);

    res.status(204).send();
  } catch (err) { next(err); }
});

// POST /api/v1/documents/:id/sync
router.post('/:id/sync', validate(documentIdParamSchema), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    // Sync logic implementation deferred to Sync Prompt, but endpoint exists.
    // Check existence first
    const doc = await docService.getDocumentById(req.user!.id, req.params.id);
    if (!doc) throw new AppError('Document not found', 404);

    res.status(200).json({
      status: 'success',
      message: 'Sync triggered (stub)',
      data: { document_id: req.params.id, synced_at: new Date() }
    });
  } catch (err) { next(err); }
});

export default router;