import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Input, Modal } from '../ui';
import { useTags, useCreateTag, useUpdateTag, useDeleteTag } from '../../hooks/useTags';
import { apiErrorMessage } from '../../services/api';
import type { Tag } from '../../types';

const TAG_TYPES = ['subject', 'technique', 'theme', 'status'];

export const TagManager = () => {
  const { data: tags = [], isLoading } = useTags();
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();

  const [modalOpen, setModalOpen] = useState(false);
  const [editTag, setEditTag] = useState<Tag | null>(null);
  const [name, setName] = useState('');
  const [tagType, setTagType] = useState('');
  const [error, setError] = useState<string | null>(null);

  const openModal = (tag: Tag | null) => {
    setEditTag(tag);
    setName(tag?.name || '');
    setTagType(tag?.tag_type || '');
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setError(null);
    try {
      if (editTag) {
        await updateTag.mutateAsync({ id: editTag.id, data: { name: name.trim(), tag_type: tagType || null } });
      } else {
        await createTag.mutateAsync({ name: name.trim(), tag_type: tagType || undefined });
      }
      setModalOpen(false);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Tags</h3>
        <Button onClick={() => openModal(null)}>
          <Plus size={16} className="mr-2" /> Add Tag
        </Button>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-gray-400 animate-pulse">Loading tags...</div>
        ) : tags.length ? (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usage</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tags.map((tag) => (
                <tr key={tag.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{tag.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tag.tag_type || '—'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tag.usage_count ?? 0}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onClick={() => openModal(tag)} className="text-indigo-600 hover:text-indigo-900 mr-3">
                      Edit
                    </button>
                    <button
                      onClick={() => deleteTag.mutate(tag.id)}
                      className="text-red-500 hover:text-red-700 inline-flex items-center"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-6 text-sm text-gray-500 text-center">No tags yet. Create one to start labeling material.</div>
        )}
      </div>

      <Modal open={modalOpen} onOpenChange={setModalOpen} title={editTag ? 'Edit Tag' : 'New Tag'}>
        <div className="space-y-4 py-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. observational"
              className="mt-1"
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Type (optional)</label>
            <select
              value={tagType}
              onChange={(e) => setTagType(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 text-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Uncategorized</option>
              {TAG_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!name.trim() || createTag.isPending || updateTag.isPending}>
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
