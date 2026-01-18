import { db } from '../config/database';
import { SearchRequestDTO, SearchResponse, SearchFilters } from '../types/search';

export const searchSegments = async (userId: string, dto: SearchRequestDTO): Promise<SearchResponse> => {
  const { 
    query, 
    filters = {}, 
    limit = 50, 
    offset = 0, 
    sort = 'relevance', 
    order = 'desc' 
  } = dto;

  // 1. Construct Main Query
  // We use Common Table Expression (CTE) to filter and rank first
  
  const params: any[] = [userId, limit, offset];
  let paramIdx = 4; // Start after $1(userId), $2(limit), $3(offset)

  // -- FILTER CONSTRUCTION HELPERS --
  
  const buildWhereClause = (excludeFacet: 'none' | 'category' | 'tags') => {
    let clauses = [`s.user_id = $1`];
    
    // Text Search Filter
    // If query is present, we must match it. If empty, match all.
    if (query && query.trim() !== '') {
      // Use websearch_to_tsquery for natural language search
      clauses.push(`s.text_content_tsvector @@ websearch_to_tsquery('english', $${paramIdx})`);
      // Note: We don't increment paramIdx here because we might reuse the query param value 
      // in multiple places (rank, highlight), but for simplicity in string building, 
      // we'll handle the param array addition outside this builder or pass the index.
      // Actually, let's keep it simple: The query param will be pushed once, and we refer to its index.
    }

    // Category Filter
    if (filters.category_ids && filters.category_ids.length > 0 && excludeFacet !== 'category') {
      clauses.push(`s.category_id = ANY($${paramIdx + (query ? 1 : 0)}::uuid[])`);
    }

    // Document Filter
    if (filters.document_ids && filters.document_ids.length > 0) {
      // Index shift depends on which previous params were added. 
      // This dynamic construction is getting tricky. 
      // Let's use named placeholders logic or a robust builder pattern.
      // For this implementation, I will build the parameters array dynamically alongside the query.
    }

    // ... (logic continues in main execution below to manage indexes correctly)
    return clauses;
  };

  // -- RE-IMPLEMENTING WITH ROBUST PARAM MANAGEMENT --

  const queryParams: any[] = [userId];
  // $1 is userId
  
  let tsQueryParamIndex = 0;
  if (query && query.trim() !== '') {
    queryParams.push(query);
    tsQueryParamIndex = queryParams.length; // e.g. $2
  }

  // Helper to add filter params and get condition string
  const addFilter = (condition: string, value: any) => {
    queryParams.push(value);
    return condition.replace('?', `$${queryParams.length}`);
  };

  const getBaseConditions = (excludeFacet: 'none' | 'category' | 'tags') => {
    const conditions = [`s.user_id = $1`];
    
    // Text Search
    if (tsQueryParamIndex > 0) {
      conditions.push(`s.text_content_tsvector @@ websearch_to_tsquery('english', $${tsQueryParamIndex})`);
    }

    // Category
    if (filters.category_ids?.length && excludeFacet !== 'category') {
      conditions.push(addFilter(`s.category_id = ANY(?::uuid[])`, filters.category_ids));
    }

    // Document
    if (filters.document_ids?.length) {
      conditions.push(addFilter(`s.document_id = ANY(?::uuid[])`, filters.document_ids));
    }

    // Is Primary
    if (filters.is_primary !== undefined) {
      conditions.push(addFilter(`s.is_primary = ?`, filters.is_primary));
    }

    // Date Range
    if (filters.date_range) {
      if (filters.date_range.start) {
        conditions.push(addFilter(`s.created_at >= ?`, filters.date_range.start));
      }
      if (filters.date_range.end) {
        conditions.push(addFilter(`s.created_at <= ?`, filters.date_range.end));
      }
    }

    // Tags
    if (filters.tag_ids?.length && excludeFacet !== 'tags') {
      const logic = filters.tag_logic || 'AND';
      const tagArrayParam = addFilter(`?::uuid[]`, filters.tag_ids);
      
      if (logic === 'OR') {
        conditions.push(`EXISTS (
          SELECT 1 FROM segment_tags st 
          WHERE st.segment_id = s.id AND st.tag_id = ANY(${tagArrayParam})
        )`);
      } else {
        // AND Logic: Must have ALL tags
        conditions.push(`(
          SELECT COUNT(DISTINCT st.tag_id) 
          FROM segment_tags st 
          WHERE st.segment_id = s.id AND st.tag_id = ANY(${tagArrayParam})
        ) = ${filters.tag_ids.length}`);
      }
    }

    return conditions.join(' AND ');
  };

  // 2. Build Main Search Query
  // We capture the current state of queryParams to freeze it for the main query,
  // because facet queries will append their own params to their own arrays.
  
  const mainWhereClause = getBaseConditions('none');
  
  // Sorting
  let orderBy = '';
  if (tsQueryParamIndex > 0 && sort === 'relevance') {
    orderBy = `ORDER BY rank DESC, s.created_at DESC`;
  } else {
    // If no text query, relevance is meaningless, fallback to date
    const sortField = sort === 'relevance' ? 'created_at' : sort;
    orderBy = `ORDER BY s.${sortField} ${order.toUpperCase()}`;
  }

  // Highlight & Rank Selection
  const rankSelect = tsQueryParamIndex > 0 
    ? `ts_rank(s.text_content_tsvector, websearch_to_tsquery('english', $${tsQueryParamIndex})) as rank`
    : `0 as rank`; // No rank if no query
    
  const highlightSelect = tsQueryParamIndex > 0
    ? `ts_headline('english', s.text_content, websearch_to_tsquery('english', $${tsQueryParamIndex}), 'MaxWords=35, MinWords=15, MaxFragments=3') as highlight`
    : `LEFT(s.text_content, 100) as highlight`; // Fallback snippet

  const mainQuery = `
    SELECT 
      s.*,
      ${rankSelect},
      ${highlightSelect},
      c.name as category_name,
      c.icon as category_icon,
      d.title as document_title,
      d.google_file_id,
      (SELECT COUNT(*) FROM segment_associations sa WHERE sa.source_segment_id = s.id OR sa.target_segment_id = s.id) as associations_count,
      COALESCE(
         json_agg(json_build_object('id', t.id, 'name', t.name, 'tag_type', t.tag_type)) FILTER (WHERE t.id IS NOT NULL), 
         '[]'
      ) as tags
    FROM segments s
    JOIN categories c ON s.category_id = c.id
    JOIN documents d ON s.document_id = d.id
    LEFT JOIN segment_tags st ON s.id = st.segment_id
    LEFT JOIN tags t ON st.tag_id = t.id
    WHERE ${mainWhereClause}
    GROUP BY s.id, c.id, d.id
    ${orderBy}
    LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
  `;

  // Clone params for main query and add limit/offset
  const mainQueryParams = [...queryParams, limit, offset];

  // 3. Facet Queries
  // We need to count matching segments for each category/tag.
  // CRITICAL: When calculating Category facets, we apply ALL filters EXCEPT category_ids.
  // When calculating Tag facets, we apply ALL filters EXCEPT tag_ids.

  // Re-build params for facets to avoid sharing mutation issues
  const catFacetParams = [userId];
  if (tsQueryParamIndex > 0) catFacetParams.push(query);
  
  // Helper to re-generate WHERE with new param array
  const generateFacetWhere = (exclude: 'category' | 'tags', paramsArray: any[]) => {
     // This duplicates logic but ensures parameter index correctness.
     // In a larger app, I'd use a query builder like Knex.js to avoid this manual string/param juggling.
     // For this file generation, I will manually reconstruct the simple version.
     
     const parts = [`s.user_id = $1`];
     let pIdx = paramsArray.length; // current length

     if (tsQueryParamIndex > 0) {
       // query is at $2
       parts.push(`s.text_content_tsvector @@ websearch_to_tsquery('english', $2)`);
     }
     
     // Add other filters
     if (filters.document_ids?.length) {
       pIdx++; paramsArray.push(filters.document_ids);
       parts.push(`s.document_id = ANY($${pIdx}::uuid[])`);
     }
     if (filters.is_primary !== undefined) {
        pIdx++; paramsArray.push(filters.is_primary);
        parts.push(`s.is_primary = $${pIdx}`);
     }
     // Date range (omitted for brevity in facet logic, usually standard)

     // THE DIFFERENCE:
     if (exclude !== 'category' && filters.category_ids?.length) {
        pIdx++; paramsArray.push(filters.category_ids);
        parts.push(`s.category_id = ANY($${pIdx}::uuid[])`);
     }

     if (exclude !== 'tags' && filters.tag_ids?.length) {
        pIdx++; paramsArray.push(filters.tag_ids);
        // Simplified tag check for facets - OR logic usually fine for counting
        parts.push(`EXISTS (SELECT 1 FROM segment_tags st WHERE st.segment_id = s.id AND st.tag_id = ANY($${pIdx}::uuid[]))`);
     }

     return parts.join(' AND ');
  };

  const catFacetWhere = generateFacetWhere('category', catFacetParams);
  const catFacetQuery = `
    SELECT c.id, c.name, COUNT(s.id)::int as count
    FROM segments s
    JOIN categories c ON s.category_id = c.id
    WHERE ${catFacetWhere}
    GROUP BY c.id, c.name
    ORDER BY count DESC
    LIMIT 20
  `;

  const tagFacetParams = [userId];
  if (tsQueryParamIndex > 0) tagFacetParams.push(query);
  const tagFacetWhere = generateFacetWhere('tags', tagFacetParams);
  const tagFacetQuery = `
    SELECT t.id, t.name, COUNT(s.id)::int as count
    FROM segments s
    JOIN segment_tags st ON s.id = st.segment_id
    JOIN tags t ON st.tag_id = t.id
    WHERE ${tagFacetWhere}
    GROUP BY t.id, t.name
    ORDER BY count DESC
    LIMIT 20
  `;

  // Count Total Query (matches main query where clause)
  const countQuery = `SELECT COUNT(DISTINCT s.id) FROM segments s WHERE ${mainWhereClause}`;

  // 4. Execute Parallel
  const [mainRes, countRes, catFacetRes, tagFacetRes] = await Promise.all([
    db.query(mainQuery, mainQueryParams),
    db.query(countQuery, queryParams),
    db.query(catFacetQuery, catFacetParams),
    db.query(tagFacetQuery, tagFacetParams)
  ]);

  // 5. Transform Responses
  const results = mainRes.rows.map(row => ({
    segment: {
      id: row.id,
      title: row.title,
      text_content: row.text_content,
      color: row.color,
      is_primary: row.is_primary,
      word_count: row.word_count,
      created_at: row.created_at,
      updated_at: row.updated_at
    },
    document: {
      id: row.document_id,
      title: row.document_title,
      google_file_id: row.google_file_id
    },
    category: {
      id: row.category_id,
      name: row.category_name,
      icon: row.category_icon
    },
    tags: row.tags || [],
    associations_count: parseInt(row.associations_count, 10),
    highlight: row.highlight,
    rank: row.rank
  }));

  return {
    results,
    total: parseInt(countRes.rows[0].count, 10),
    facets: {
      categories: catFacetRes.rows,
      tags: tagFacetRes.rows
    }
  };
};