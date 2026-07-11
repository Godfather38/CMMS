import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Plus, Trash2, X, CornerDownRight, CornerUpLeft } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn, DEFAULT_PALETTE } from '../lib/utils';
import { Button, Modal, Input } from '../components/ui';
import {
  useSegment,
  useSegmentAssociations,
  useUpdateSegment,
  useUpdateSegmentColor,
  useAddSegmentTags,
  useRemoveSegmentTag,
  useDeleteSegment,
} from '../hooks/useSegments';
import { useCategories } from '../hooks/useCategories';
import { useTags, useCreateTag } from '../hooks/useTags';
import { apiErrorMessage } from '../services/api';

const ASSOCIATION_LABELS: Record<string, string> = {
  derivative: 'Derivative',
  callback: 'Callback',
  reference: 'Reference',
};

export const SegmentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: segment, isLoading } = useSegment(id);
  const { data: associations } = useSegmentAssociations(id);
  const { data: categories } = useCategories();
  const { data: allTags } = useTags();

  const updateSegment = useUpdateSegment();
  const updateColor = useUpdateSegmentColor();
  const addTags = useAddSegmentTags();
  const removeTag = useRemoveSegmentTag();
  const deleteSegment = useDeleteSegment();
  const createTag = useCreateTag();

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading...</div>;
  if (!segment) return <div className="p-8 text-center text-gray-500">Segment not found.</div>;

  const currentTagIds = new Set(segment.tags?.map((t) => t.id));
  const availableTags = allTags?.filter((t) => !currentTagIds.has(t.id)) || [];

  const run = async (action: Promise<unknown>) => {
    setError(null);
    try {
      await action;
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const saveTitle = () => {
    if (titleDraft.trim() && titleDraft !== segment.title) {
      run(updateSegment.mutateAsync({ id: segment.id, data: { title: titleDraft.trim() } }));
    }
    setEditingTitle(false);
  };

  const handleCreateAndAddTag = async () => {
    const name = newTagName.trim();
    if (!name) return;
    setError(null);
    try {
      const res = await createTag.mutateAsync({ name });
      await addTags.mutateAsync({ segmentId: segment.id, tagIds: [res.data.data.id] });
      setNewTagName('');
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <Link to="/browse" className="flex items-center text-sm text-gray-500 hover:text-gray-900">
          <ArrowLeft size={16} className="mr-1" /> Back
        </Link>
        {segment.document?.google_file_id && !segment.document.google_file_id.startsWith('dev-') && (
          <a
            href={`https://docs.google.com/document/d/${segment.document.google_file_id}/edit`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center text-sm text-indigo-600 hover:text-indigo-800"
          >
            Open in Google Docs <ExternalLink size={14} className="ml-1" />
          </a>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          {editingTitle ? (
            <div className="flex gap-2 mb-2">
              <Input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
                autoFocus
              />
              <Button onClick={saveTitle}>Save</Button>
              <Button variant="ghost" onClick={() => setEditingTitle(false)}>Cancel</Button>
            </div>
          ) : (
            <h1
              className="text-2xl font-bold text-gray-900 mb-2 cursor-pointer hover:text-indigo-700"
              title="Click to rename"
              onClick={() => {
                setTitleDraft(segment.title || '');
                setEditingTitle(true);
              }}
            >
              {segment.title || 'Untitled'}
            </h1>
          )}
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
            <select
              value={segment.category?.id || segment.category_id}
              onChange={(e) => run(updateSegment.mutateAsync({ id: segment.id, data: { category_id: e.target.value } }))}
              className="rounded-md border border-gray-200 text-xs py-1 px-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
            <span>•</span>
            <span>{segment.word_count ?? 0} words</span>
            <span>•</span>
            <span>Updated {formatDistanceToNow(new Date(segment.updated_at), { addSuffix: true })}</span>
            {!segment.is_primary && (
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                Derivative
              </span>
            )}
          </div>
        </div>

        <div className="p-6 bg-gray-50/50">
          <div className="relative pl-6">
            <div className="absolute left-0 top-0 bottom-0 w-1 rounded-full" style={{ backgroundColor: segment.color }} />
            <p className="text-lg text-gray-800 leading-relaxed font-serif whitespace-pre-wrap">{segment.text_content}</p>
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 space-y-4">
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Color</h4>
            <div className="flex items-center gap-2 flex-wrap">
              {DEFAULT_PALETTE.map((color) => (
                <button
                  key={color}
                  onClick={() => run(updateColor.mutateAsync({ id: segment.id, color }))}
                  className={cn(
                    'h-7 w-7 rounded-full border-2 transition-transform hover:scale-110',
                    segment.color?.toUpperCase() === color.toUpperCase()
                      ? 'border-gray-900 scale-110'
                      : 'border-transparent'
                  )}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
              <span className="text-xs text-gray-400 ml-2">Changing color recolors all linked segments</span>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Tags</h4>
            <div className="flex flex-wrap items-center gap-1.5">
              {segment.tags?.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10"
                >
                  {tag.name}
                  <button
                    onClick={() => run(removeTag.mutateAsync({ segmentId: segment.id, tagId: tag.id }))}
                    className="text-indigo-400 hover:text-indigo-800"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              <button
                onClick={() => setTagPickerOpen(true)}
                className="inline-flex items-center gap-1 rounded-md border border-dashed border-gray-300 px-2 py-1 text-xs text-gray-500 hover:border-indigo-400 hover:text-indigo-600"
              >
                <Plus size={12} /> Add tag
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Associations {associations ? `(${associations.length})` : ''}
        </h3>
        {associations?.length ? (
          <ul className="space-y-3">
            {associations.map((assoc) => (
              <li key={assoc.id}>
                <Link
                  to={`/segments/${assoc.related_segment_id}`}
                  className="flex items-start gap-3 rounded-lg border border-gray-100 p-3 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors"
                >
                  {assoc.direction === 'outgoing' ? (
                    <CornerDownRight className="h-4 w-4 mt-1 text-gray-400 flex-shrink-0" />
                  ) : (
                    <CornerUpLeft className="h-4 w-4 mt-1 text-gray-400 flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: assoc.related_segment?.color }}
                      />
                      <span className="font-medium text-sm text-gray-900 truncate">
                        {assoc.related_segment?.title || 'Untitled'}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 uppercase tracking-wide">
                        {ASSOCIATION_LABELS[assoc.association_type] || assoc.association_type}
                      </span>
                      <span className="text-[10px] text-gray-400">{assoc.direction}</span>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-1 font-serif">
                      {assoc.related_segment?.text_content}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400">No linked segments yet.</p>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-red-100 p-6">
        <h3 className="text-sm font-semibold text-red-600 mb-3">Danger Zone</h3>
        <Button variant="danger" onClick={() => setDeleteOpen(true)}>
          <Trash2 size={16} className="mr-2" /> Delete Segment
        </Button>
      </div>

      <Modal open={tagPickerOpen} onOpenChange={setTagPickerOpen} title="Add Tags">
        <div className="space-y-4 py-2">
          <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
            {availableTags.length ? (
              availableTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => run(addTags.mutateAsync({ segmentId: segment.id, tagIds: [tag.id] }))}
                  className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-300 hover:bg-indigo-50 hover:text-indigo-700 hover:ring-indigo-300"
                >
                  <Plus size={10} className="mr-1" /> {tag.name}
                </button>
              ))
            ) : (
              <p className="text-xs text-gray-400">All existing tags are already applied.</p>
            )}
          </div>
          <div className="flex gap-2 border-t border-gray-100 pt-4">
            <Input
              placeholder="New tag name..."
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateAndAddTag()}
            />
            <Button onClick={handleCreateAndAddTag} disabled={!newTagName.trim() || createTag.isPending}>
              Create
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete Segment">
        <div className="space-y-4 py-2">
          <p className="text-sm text-gray-600">
            This removes the segment from CMMS (the text stays in your Google Doc). Derivative copies in sets can
            optionally be deleted too.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="secondary"
              onClick={() =>
                run(
                  deleteSegment
                    .mutateAsync({ id: segment.id, deleteAssociations: false })
                    .then(() => navigate('/browse'))
                )
              }
            >
              Delete (keep copies)
            </Button>
            <Button
              variant="danger"
              onClick={() =>
                run(
                  deleteSegment
                    .mutateAsync({ id: segment.id, deleteAssociations: true })
                    .then(() => navigate('/browse'))
                )
              }
            >
              Delete + copies
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
