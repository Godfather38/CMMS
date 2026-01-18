import { Router, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { 
  validate, 
  createCategorySchema, 
  updateCategorySchema, 
  reorderCategoriesSchema, 
  deleteCategorySchema,
  categoryIdParamSchema
} from '../middleware/validation';
import * as categoryService from '../services/categories';
import { AuthenticatedRequest } from '../types';
import { AppError } from '../utils/errors';

const router = Router();

router.use(requireAuth);

// GET /api/v1/categories
router.get('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const categories = await categoryService.listCategories(req.user!.id);
    res.json({
      status: 'success',
      data: categories
    });
  } catch (err) { next(err); }
});

// POST /api/v1/categories
router.post('/', validate(createCategorySchema), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const category = await categoryService.createCategory(req.user!.id, req.body);
    res.status(201).json({
      status: 'success',
      data: category
    });
  } catch (err) { next(err); }
});

// PUT /api/v1/categories/reorder
router.put('/reorder', validate(reorderCategoriesSchema), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const categories = await categoryService.reorderCategories(req.user!.id, req.body.category_ids);
    res.json({
      status: 'success',
      data: categories
    });
  } catch (err) { next(err); }
});

// PUT /api/v1/categories/:id
router.put('/:id', validate(updateCategorySchema), validate(categoryIdParamSchema), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const category = await categoryService.updateCategory(req.user!.id, req.params.id, req.body);
    res.json({
      status: 'success',
      data: category
    });
  } catch (err) { next(err); }
});

// DELETE /api/v1/categories/:id
router.delete('/:id', validate(deleteCategorySchema), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const migrateTo = req.query.migrate_to as string | undefined;
    await categoryService.deleteCategory(req.user!.id, req.params.id, migrateTo);
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;