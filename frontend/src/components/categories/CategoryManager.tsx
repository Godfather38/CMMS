import { useEffect, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button, Input, Modal } from '../ui';
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useReorderCategories,
  useDeleteCategory,
} from '../../hooks/useCategories';
import { apiErrorMessage } from '../../services/api';
import type { Category } from '../../types';

const SortableCategoryItem = ({
  category,
  onEdit,
  onDelete,
}: {
  category: Category;
  onEdit: (c: Category) => void;
  onDelete: (c: Category) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg group',
        isDragging && 'shadow-lg border-indigo-300'
      )}
    >
      <div className="flex items-center gap-3">
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 p-1">
          <GripVertical size={16} />
        </button>
        <div className="flex items-center gap-3">
          <span className="text-xl w-8 text-center">{category.icon}</span>
          <span className="font-medium text-gray-900">{category.name}</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
          {category.segment_count || 0} segments
        </span>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" onClick={() => onEdit(category)} className="h-8 px-2">Edit</Button>
          <Button
            variant="ghost"
            onClick={() => onDelete(category)}
            className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
};

export const CategoryManager = () => {
  const { data: categories = [] } = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const reorderCategories = useReorderCategories();
  const deleteCategory = useDeleteCategory();

  const [items, setItems] = useState<Category[]>([]);
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  useEffect(() => {
    setItems(categories);
  }, [categories]);

  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [migrateTo, setMigrateTo] = useState('');

  const openModal = (cat: Category | null) => {
    setEditCategory(cat);
    setName(cat?.name || '');
    setIcon(cat?.icon || '');
    setDescription(cat?.description || '');
    setError(null);
    setIsModalOpen(true);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((current) => {
        const oldIndex = current.findIndex((i) => i.id === active.id);
        const newIndex = current.findIndex((i) => i.id === over.id);
        const next = arrayMove(current, oldIndex, newIndex);
        reorderCategories.mutate(next.map((i) => i.id));
        return next;
      });
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setError(null);
    const payload = { name: name.trim(), icon: icon || undefined, description: description || undefined };
    try {
      if (editCategory) {
        await updateCategory.mutateAsync({ id: editCategory.id, data: payload });
      } else {
        await createCategory.mutateAsync(payload);
      }
      setIsModalOpen(false);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setError(null);
    try {
      await deleteCategory.mutateAsync({
        id: deleteTarget.id,
        migrateTo: (deleteTarget.segment_count || 0) > 0 ? migrateTo : undefined,
      });
      setDeleteTarget(null);
      setMigrateTo('');
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const migrationOptions = items.filter((c) => c.id !== deleteTarget?.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Categories</h3>
        <Button onClick={() => openModal(null)}>
          <Plus size={16} className="mr-2" /> Add Category
        </Button>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {items.map((cat) => (
              <SortableCategoryItem
                key={cat.id}
                category={cat}
                onEdit={openModal}
                onDelete={(c) => {
                  setDeleteTarget(c);
                  setMigrateTo('');
                  setError(null);
                }}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Modal open={isModalOpen} onOpenChange={setIsModalOpen} title={editCategory ? 'Edit Category' : 'New Category'}>
        <div className="space-y-4 py-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. One-Liner" className="mt-1" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Icon</label>
            <Input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="Emoji" className="mt-1 w-20 text-center text-xl" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" className="mt-1" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!name.trim() || createCategory.isPending || updateCategory.isPending}>
              Save
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)} title="Delete Category">
        <div className="space-y-4 py-2">
          {(deleteTarget?.segment_count || 0) > 0 ? (
            <>
              <p className="text-sm text-gray-600">
                <strong>{deleteTarget?.name}</strong> contains {deleteTarget?.segment_count} segments. Choose a category
                to move them to:
              </p>
              <select
                value={migrateTo}
                onChange={(e) => setMigrateTo(e.target.value)}
                className="w-full rounded-md border border-gray-300 text-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select category...</option>
                {migrationOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <p className="text-sm text-gray-600">
              Delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              disabled={((deleteTarget?.segment_count || 0) > 0 && !migrateTo) || deleteCategory.isPending}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
