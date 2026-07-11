import { Link } from 'react-router-dom';
import { FileText, Link as LinkIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Segment } from '../../types';

export const SegmentCard = ({ segment }: { segment: Segment }) => (
  <Link
    to={`/segments/${segment.id}`}
    className="group relative flex flex-col bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow overflow-hidden"
  >
    <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: segment.color }} />
    <div className="p-4 pl-5 flex flex-col h-full">
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-base font-semibold text-gray-900 line-clamp-1 group-hover:text-indigo-600">
          {segment.title || 'Untitled'}
        </h3>
        <span className="text-xl">{segment.category?.icon}</span>
      </div>
      <p className="text-sm text-gray-600 line-clamp-3 mb-4 flex-grow font-serif">{segment.text_content}</p>
      <div className="mt-auto space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {segment.tags?.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center rounded-full bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10"
            >
              {tag.name}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between text-xs text-gray-400 border-t border-gray-50 pt-3">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <FileText size={12} />
              {segment.document?.title || 'Untitled doc'}
            </span>
            <span className="flex items-center gap-1">
              <LinkIcon size={12} />
              {Number(segment.associations_count || 0)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span>{segment.word_count ?? 0} words</span>
            <span>{formatDistanceToNow(new Date(segment.created_at), { addSuffix: true })}</span>
          </div>
        </div>
      </div>
    </div>
  </Link>
);
