import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError, z } from 'zod';
import { BadRequestError } from '../utils/errors';

export const validate = (schema: AnyZodObject) => (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      const messages = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
      next(new BadRequestError(`Validation failed: ${messages.join(', ')}`));
    } else {
      next(error);
    }
  }
};

// --- Schemas ---

export const createDocumentSchema = z.object({
  body: z.object({
    google_file_id: z.string().min(1, 'Google File ID is required'),
    copy_to_folder: z.boolean().optional(),
  }),
});

export const createFromSelectionSchema = z.object({
  body: z.object({
    source_google_file_id: z.string().min(1),
    selected_text: z.string().min(1, 'Selection cannot be empty'),
    title: z.string().min(1, 'Title is required'),
  }),
});

export const listDocumentsSchema = z.object({
  query: z.object({
    category_id: z.string().uuid().optional(),
    tag_id: z.string().uuid().optional(),
    search: z.string().optional(),
    limit: z.coerce.number().min(1).max(200).default(50),
    offset: z.coerce.number().min(0).default(0),
  }),
});

export const documentIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

// --- SEGMENT SCHEMAS ---

export const createSegmentSchema = z.object({
  body: z.object({
    document_id: z.string().uuid(),
    category_id: z.string().uuid(),
    start_offset: z.number().min(0),
    end_offset: z.number().min(0),
    text_content: z.string().min(1),
    title: z.string().optional(),
    tag_ids: z.array(z.string().uuid()).optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  }).refine(data => data.end_offset > data.start_offset, {
    message: "End offset must be greater than start offset",
    path: ["end_offset"]
  }),
});

export const associateSegmentSchema = z.object({
  body: z.object({
    target_document_id: z.string().uuid(),
    start_offset: z.number().min(0),
    end_offset: z.number().min(0),
    text_content: z.string().min(1),
    association_type: z.enum(['derivative', 'callback', 'reference']),
  }).refine(data => data.end_offset > data.start_offset, {
    message: "End offset must be greater than start offset",
    path: ["end_offset"]
  }),
});

export const updateSegmentSchema = z.object({
  body: z.object({
    title: z.string().optional(),
    category_id: z.string().uuid().optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    is_primary: z.boolean().optional(),
  }),
});

export const updateMarkersSchema = z.object({
  body: z.object({
    start_offset: z.number().min(0),
    end_offset: z.number().min(0),
  }).refine(data => data.end_offset > data.start_offset, {
    message: "End offset must be greater than start offset",
    path: ["end_offset"]
  }),
});

export const updateTagsSchema = z.object({
  body: z.object({
    tag_ids: z.array(z.string().uuid()),
  }),
});

export const listSegmentsSchema = z.object({
  query: z.object({
    category_id: z.string().uuid().optional(),
    tag_ids: z.string().optional(), // Expecting comma-separated string from URL params
    search: z.string().optional(),
    document_id: z.string().uuid().optional(),
    is_primary: z.enum(['true', 'false']).optional(),
    limit: z.coerce.number().min(1).max(200).default(50),
    offset: z.coerce.number().min(0).default(0),
    sort: z.enum(['created_at', 'updated_at', 'title', 'word_count']).default('created_at'),
    order: z.enum(['asc', 'desc']).default('desc'),
  }),
});

export const segmentIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

// --- CATEGORY SCHEMAS ---

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    icon: z.string().max(50).optional(),
  }),
});

export const updateCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional(),
    icon: z.string().max(50).optional(),
  }),
});

export const reorderCategoriesSchema = z.object({
  body: z.object({
    category_ids: z.array(z.string().uuid()).min(1),
  }),
});

export const deleteCategorySchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  query: z.object({
    migrate_to: z.string().uuid().optional(),
  }),
});

export const categoryIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

// --- TAG SCHEMAS ---

export const createTagSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    tag_type: z.string().max(50).optional(),
  }),
});

export const bulkCreateTagsSchema = z.object({
  body: z.object({
    names: z.array(z.string().min(1).max(100)).min(1),
    tag_type: z.string().max(50).optional(),
  }),
});

export const updateTagSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    tag_type: z.string().max(50).optional().nullable(),
  }),
});

export const addSegmentTagsSchema = z.object({
  body: z.object({
    tag_ids: z.array(z.string().uuid()).min(1),
  }),
});

export const listTagsSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    type: z.string().optional(),
  }),
});

export const autocompleteTagsSchema = z.object({
  query: z.object({
    q: z.string().min(1),
    limit: z.coerce.number().min(1).max(50).default(10),
  }),
});

export const tagIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const segmentIdTagIdParamSchema = z.object({
  params: z.object({
    segment_id: z.string().uuid(),
    tag_id: z.string().uuid(),
  }),
});

// --- SEARCH SCHEMAS ---

export const searchSchema = z.object({
  body: z.object({
    query: z.string(), // Empty string allowed for "browse all" with filters
    filters: z.object({
      category_ids: z.array(z.string().uuid()).optional(),
      tag_ids: z.array(z.string().uuid()).optional(),
      tag_logic: z.enum(['AND', 'OR']).default('AND').optional(),
      document_ids: z.array(z.string().uuid()).optional(),
      date_range: z.object({
        start: z.string().datetime().optional(), // ISO 8601
        end: z.string().datetime().optional()
      }).optional(),
      is_primary: z.boolean().optional(),
    }).optional(),
    limit: z.number().min(1).max(200).default(50).optional(),
    offset: z.number().min(0).default(0).optional(),
    sort: z.enum(['relevance', 'created_at', 'updated_at']).default('relevance').optional(),
    order: z.enum(['asc', 'desc']).default('desc').optional(),
  }),
});

// --- SYNC SCHEMAS ---

export const syncDocumentSchema = z.object({
  params: z.object({
    document_id: z.string().uuid(),
  }),
});

// No body/params needed for full sync or status currently, 
// but we can add empty validators if we want strictness.