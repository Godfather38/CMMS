import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '../components/ui';
import { SegmentCard } from '../components/segments/SegmentCard';
import { useAuthStore } from '../stores/authStore';
import { useCategories } from '../hooks/useCategories';
import { useSegments } from '../hooks/useSegments';

export const Dashboard = () => {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const { data: categories } = useCategories();
  const { data: recent, isLoading: recentLoading } = useSegments({
    sort: 'updated_at',
    order: 'desc',
    limit: 6,
  });

  const recentSegments = recent?.pages[0]?.data || [];
  const totalSegments = recent?.pages[0]?.pagination.total ?? 0;

  return (
    <div className="space-y-8">
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-gray-900">Dashboard</h2>
          <p className="mt-1 text-sm text-gray-500">
            Welcome back, {user?.display_name}. {totalSegments > 0 && `${totalSegments} segments in your library.`}
          </p>
        </div>
        <div className="mt-4 flex md:ml-4 md:mt-0">
          <Button className="shadow-sm" onClick={() => navigate('/documents')}>
            <Plus className="-ml-0.5 mr-1.5 h-5 w-5" /> New Document
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {categories?.map((cat) => (
          <Link key={cat.id} to={`/browse?category=${cat.id}`} className="block group">
            <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 transition-all hover:shadow-md hover:ring-indigo-500/30">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-2xl group-hover:bg-indigo-100 transition-colors">
                    {cat.icon}
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="truncate text-sm font-medium text-gray-500 group-hover:text-indigo-600">{cat.name}</dt>
                      <dd>
                        <div className="text-xl font-bold text-gray-900">{cat.segment_count || 0}</div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recently updated</h3>
        {recentLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        ) : recentSegments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {recentSegments.map((segment) => (
              <SegmentCard key={segment.id} segment={segment} />
            ))}
          </div>
        ) : (
          <div className="text-center py-10 bg-white rounded-lg border border-dashed border-gray-300 text-sm text-gray-500">
            No segments yet — register a document and start marking material.
          </div>
        )}
      </div>
    </div>
  );
};
