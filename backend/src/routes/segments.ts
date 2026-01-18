import { Router, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { 
  validate, 
  createSegmentSchema, 
  updateSegmentSchema, 
  associateSegmentSchema, 
  updateMarkersSchema, 
  updateTagsSchema, 
  addSegmentTagsSchema, // New
  listSegmentsSchema, 
  segmentIdParamSchema,
  segmentIdTagIdParamSchema // New
} from '../middleware/validation';
import * as segmentService from '../services/segments';
import * as tagService from '../services/tags'; // Import Tag Service
import { AuthenticatedRequest } from '../types';
import { AppError } from '../utils/errors';

const router = Router();

router.use(requireAuth);

// ... existing routes ...

// GET /api/v1/segments
router.get('/', validate(listSegmentsSchema), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const filters = req.query as any;
    if (typeof filters.tag_ids === 'string') {
        filters.tag_ids = filters.tag_ids.split(',');
    }
    const result = await segmentService.listSegments(req.user!.id, filters);
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

// GET /api/v1/segments/:id
router.get('/:id', validate(segmentIdParamSchema), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const segment = await segmentService.getSegmentById(req.user!.id, req.params.id);
    if (!segment) throw new AppError('Segment not found', 404);
    res.json({ status: 'success', data: segment });
  } catch (err) { next(err); }
});

// GET /api/v1/segments/:id/associations
router.get('/:id/associations', validate(segmentIdParamSchema), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const associations = await segmentService.getSegmentAssociations(req.user!.id, req.params.id);
    res.json({ status: 'success', data: associations });
  } catch (err) { next(err); }
});

// POST /api/v1/segments
router.post('/', validate(createSegmentSchema), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const segment = await segmentService.createSegment(req.user!.id, req.body);
    res.status(201).json({ status: 'success', data: segment });
  } catch (err) { next(err); }
});

// POST /api/v1/segments/:id/associate
router.post('/:id/associate', validate(associateSegmentSchema), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const result = await segmentService.createAssociation(req.user!.id, req.params.id, req.body);
    res.status(201).json({ status: 'success', data: result });
  } catch (err) { next(err); }
});

// PUT /api/v1/segments/:id
router.put('/:id', validate(updateSegmentSchema), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const segment = await segmentService.updateSegment(req.user!.id, req.params.id, req.body);
    if (!segment) throw new AppError('Segment not found', 404);
    res.json({ status: 'success', data: segment });
  } catch (err) { next(err); }
});

// PUT /api/v1/segments/:id/markers
router.put('/:id/markers', validate(updateMarkersSchema), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const segment = await segmentService.updateMarkers(req.user!.id, req.params.id, req.body);
    if (!segment) throw new AppError('Segment not found', 404);
    res.json({ status: 'success', data: segment });
  } catch (err) { next(err); }
});

// PUT /api/v1/segments/:id/tags (Replace all tags)
router.put('/:id/tags', validate(updateTagsSchema), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const segment = await segmentService.updateTags(req.user!.id, req.params.id, req.body.tag_ids);
    res.json({ status: 'success', data: segment });
  } catch (err) { next(err); }
});

// POST /api/v1/segments/:segment_id/tags (Add tags)
router.post('/:segment_id/tags', validate(segmentIdParamSchema), validate(addSegmentTagsSchema), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const segment = await tagService.addTagsToSegment(req.user!.id, req.params.segment_id, req.body.tag_ids);
    res.json({ status: 'success', data: segment });
  } catch (err) { next(err); }
});

// DELETE /api/v1/segments/:segment_id/tags/:tag_id (Remove single tag)
router.delete('/:segment_id/tags/:tag_id', validate(segmentIdTagIdParamSchema), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    await tagService.removeTagFromSegment(req.user!.id, req.params.segment_id, req.params.tag_id);
    res.status(204).send();
  } catch (err) { next(err); }
});

// DELETE /api/v1/segments/:id
router.delete('/:id', validate(segmentIdParamSchema), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const deleteAssociations = req.query.delete_associations === 'true';
    const success = await segmentService.deleteSegment(req.user!.id, req.params.id, deleteAssociations);
    if (!success) throw new AppError('Segment not found', 404);
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;