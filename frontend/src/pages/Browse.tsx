import { useSearchParams } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useCategories } from '../hooks/useCategories';
import { useTags } from '../hooks/useTags';
import { useSegments } from '../hooks/useSegments';
import { SegmentList } from '../components/segments/SegmentList';

export const Browse = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryId = searchParams.get('category') || undefined;
  const tagIds = searchParams.get('tags')?.split(',').filter(Boolean) || [];
  const sort = searchParams.get('sort') || 'created_at';
  const order = searchParams.get('order') || 'desc';

  const { data: categories } = useCategories();
  const { data: tags } = useTags();
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useSegments({
    categoryId,
    tagIds,
    sort,
    order,
    limit: 20,
  });

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  const toggleTag = (tagId: string) => {
    const next = tagIds.includes(tagId) ? tagIds.filter((t) => t !== tagId) : [...tagIds, tagId];
    updateParam('tags', next.length ? next.join(',') : null);
  };

  const activeCategory = categories?.find((c) => c.id === categoryId);

  return (
    <div className="h-full flex flex-col md:flex-row gap-6">
      <div className="w-full md:w-64 flex-shrink-0 space-y-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-semibold mb-3">Category</h3>
          <div className="space-y-1">
            <button
              onClick={() => updateParam('category', null)}
              className={cn(
                'w-full text-left px-2 py-1.5 rounded text-sm',
                !categoryId ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              All categories
            </button>
            {categories?.map((cat) => (
              <button
                key={cat.id}
                onClick={() => updateParam('category', cat.id)}
                className={cn(
                  'w-full text-left px-2 py-1.5 rounded text-sm flex items-center justify-between',
                  categoryId === cat.id ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                )}
              >
                <span>
                  {cat.icon} {cat.name}
                </span>
                <span className="text-xs text-gray-400">{cat.segment_count || 0}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-semibold mb-3">Tags</h3>
          <div className="flex flex-wrap gap-1.5">
            {tags?.length ? (
              tags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className={cn(
                    'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors',
                    tagIds.includes(tag.id)
                      ? 'bg-indigo-600 text-white ring-indigo-600'
                      : 'bg-white text-gray-600 ring-gray-300 hover:bg-gray-50'
                  )}
                >
                  {tag.name}
                  {tag.usage_count !== undefined && <span className="ml-1 opacity-60">{tag.usage_count}</span>}
                </button>
              ))
            ) : (
              <p className="text-xs text-gray-400">No tags yet</p>
            )}
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-semibold mb-3">Sort</h3>
          <select
            value={`${sort}:${order}`}
            onChange={(e) => {
              const [s, o] = e.target.value.split(':');
              const next = new URLSearchParams(searchParams);
              next.set('sort', s);
              next.set('order', o);
              setSearchParams(next);
            }}
            className="w-full rounded-md border border-gray-300 text-sm py-1.5 px-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="created_at:desc">Newest first</option>
            <option value="created_at:asc">Oldest first</option>
            <option value="updated_at:desc">Recently updated</option>
            <option value="title:asc">Title A→Z</option>
            <option value="word_count:desc">Longest first</option>
          </select>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900">
            {activeCategory ? `${activeCategory.icon} ${activeCategory.name}` : 'All Material'}
          </h2>
        </div>
        <SegmentList
          data={data?.pages}
          isLoading={isLoading}
          fetchNextPage={fetchNextPage}
          hasNextPage={!!hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
        />
      </div>
    </div>
  );
};
