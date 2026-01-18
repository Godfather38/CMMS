import { Router, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { 
  validate, 
  createTagSchema, 
  bulkCreateTagsSchema, 
  updateTagSchema, 
  listTagsSchema, 
  autocompleteTagsSchema,
  tagIdParamSchema
} from '../middleware/validation';
import * as tagService from '../services/tags';
import { AuthenticatedRequest } from '../types';
import { AppError } from '../utils/errors';

const router = Router();

router.use(requireAuth);

// GET /api/v1/tags/autocomplete (Must be before /:id)
router.get('/autocomplete', validate(autocompleteTagsSchema), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { q, limit } = req.query as any;
    const tags = await tagService.autocompleteTags(req.user!.id, q, limit);
    res.json({ status: 'success', data: tags });
  } catch (err) { next(err); }
});

// GET /api/v1/tags
router.get('/', validate(listTagsSchema), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const filters = req.query as any;
    const tags = await tagService.listTags(req.user!.id, filters);
    res.json({ status: 'success', data: tags });
  } catch (err) { next(err); }
});

// POST /api/v1/tags
router.post('/', validate(createTagSchema), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const tag = await tagService.createTag(req.user!.id, req.body);
    res.status(201).json({ status: 'success', data: tag });
  } catch (err) { next(err); }
});

// POST /api/v1/tags/bulk
router.post('/bulk', validate(bulkCreateTagsSchema), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const tags = await tagService.bulkCreateTags(req.user!.id, req.body);
    res.status(201).json({ status: 'success', data: tags });
  } catch (err) { next(err); }
});

// PUT /api/v1/tags/:id
router.put('/:id', validate(tagIdParamSchema), validate(updateTagSchema), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const tag = await tagService.updateTag(req.user!.id, req.params.id, req.body);
    res.json({ status: 'success', data: tag });
  } catch (err) { next(err); }
});

// DELETE /api/v1/tags/:id
router.delete('/:id', validate(tagIdParamSchema), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const success = await tagService.deleteTag(req.user!.id, req.params.id);
    if (!success) throw new AppError('Tag not found', 404);
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;