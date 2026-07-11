import { Button } from '../ui';
import { SegmentCard } from './SegmentCard';
import type { Segment, Pagination } from '../../types';

interface SegmentPage {
  data: Segment[];
  pagination: Pagination;
}

export const SegmentList = ({
  data,
  isLoading,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
}: {
  data: SegmentPage[] | undefined;
  isLoading: boolean;
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
}) => {
  if (isLoading)
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-pulse">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-48 bg-gray-200 rounded-lg"></div>
        ))}
      </div>
    );
  const allSegments = data?.flatMap((page) => page.data) || [];
  if (allSegments.length === 0)
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
        <h3 className="mt-2 text-sm font-semibold text-gray-900">No segments found</h3>
        <p className="mt-1 text-sm text-gray-500">Create segments via the API or extension, then browse them here.</p>
      </div>
    );
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {allSegments.map((segment) => (
          <SegmentCard key={segment.id} segment={segment} />
        ))}
      </div>
      {hasNextPage && (
        <div className="flex justify-center pt-4">
          <Button variant="secondary" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? 'Loading...' : 'Load More'}
          </Button>
        </div>
      )}
    </div>
  );
};
