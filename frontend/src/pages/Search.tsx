import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { cn } from '../lib/utils';
import { useSearch } from '../hooks/useSearch';
import { CategoryBadge, TagBadge } from '../components/ui';

export const Search = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [primaryOnly, setPrimaryOnly] = useState(false);

  const { data, isLoading, isFetching } = useSearch(
    {
      query,
      filters: {
        category_ids: categoryIds.length ? categoryIds : undefined,
        tag_ids: tagIds.length ? tagIds : undefined,
        is_primary: primaryOnly ? true : undefined,
      },
      limit: 50,
    },
    query.length > 0 || categoryIds.length > 0 || tagIds.length > 0
  );

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col md:flex-row gap-6">
      <div className="w-full md:w-64 flex-shrink-0 space-y-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-semibold mb-3">Categories</h3>
          <div className="space-y-1">
            {data?.facets.categories.length ? (
              data.facets.categories.map((facet) => (
                <button
                  key={facet.id}
                  onClick={() => toggle(categoryIds, setCategoryIds, facet.id)}
                  className={cn(
                    'w-full text-left px-2 py-1.5 rounded text-sm flex items-center justify-between',
                    categoryIds.includes(facet.id)
                      ? 'bg-indigo-50 text-indigo-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  )}
                >
                  <span>{facet.name}</span>
                  <span className="text-xs text-gray-400">{facet.count}</span>
                </button>
              ))
            ) : (
              <p className="text-xs text-gray-400">Search to see facets</p>
            )}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-semibold mb-3">Tags</h3>
          <div className="flex flex-wrap gap-1.5">
            {data?.facets.tags.length ? (
              data.facets.tags.map((facet) => (
                <button
                  key={facet.id}
                  onClick={() => toggle(tagIds, setTagIds, facet.id)}
                  className={cn(
                    'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors',
                    tagIds.includes(facet.id)
                      ? 'bg-indigo-600 text-white ring-indigo-600'
                      : 'bg-white text-gray-600 ring-gray-300 hover:bg-gray-50'
                  )}
                >
                  {facet.name} <span className="ml-1 opacity-60">{facet.count}</span>
                </button>
              ))
            ) : (
              <p className="text-xs text-gray-400">No tag facets</p>
            )}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={primaryOnly}
              onChange={(e) => setPrimaryOnly(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Primary segments only
          </label>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900">
            {!query && !categoryIds.length && !tagIds.length
              ? 'Type a search above to find material'
              : isLoading || isFetching
                ? 'Searching...'
                : `${data?.total || 0} results${query ? ` for "${query}"` : ''}`}
          </h2>
        </div>
        <div className="space-y-4">
          {data?.results.map((r) => (
            <Link
              key={r.segment.id}
              to={`/segments/${r.segment.id}`}
              className="group relative block bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow overflow-hidden"
            >
              <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: r.segment.color }} />
              <div className="p-4 pl-5">
                <div className="flex items-start justify-between mb-1">
                  <h3 className="text-base font-semibold text-gray-900 group-hover:text-indigo-600">
                    {r.segment.title || 'Untitled'}
                  </h3>
                  <CategoryBadge category={r.category} />
                </div>
                {/* highlight comes from PostgreSQL ts_headline; only <b> tags are produced */}
                <p
                  className="text-sm text-gray-600 font-serif [&_b]:bg-yellow-200 [&_b]:text-gray-900 [&_b]:rounded-sm [&_b]:px-0.5 [&_b]:font-semibold"
                  dangerouslySetInnerHTML={{ __html: r.highlight }}
                />
                <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1">
                      <FileText size={12} />
                      {r.document.title || 'Untitled doc'}
                    </span>
                    <div className="flex gap-1">
                      {r.tags.map((t) => (
                        <TagBadge key={t.id} tag={t} />
                      ))}
                    </div>
                  </div>
                  <span>{r.segment.word_count ?? 0} words</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};
