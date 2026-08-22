import React, { useMemo, useState } from 'react';
import { Pencil, Plus, Tag, Trash2, X } from 'lucide-react';
import { useDay } from '../../context/DayContext';

interface ManageCategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ICON_OPTIONS = ['tag', 'briefcase', 'home', 'heart', 'activity', 'lightbulb', 'users', 'file-text'];

export const ManageCategoriesModal: React.FC<ManageCategoriesModalProps> = ({ isOpen, onClose }) => {
  const { state, taskCategories, createTaskCategory, updateTaskCategory, deleteTaskCategory } = useDay();
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState('#60A5FA');
  const [newIcon, setNewIcon] = useState('tag');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [reassignToId, setReassignToId] = useState('UNCATEGORISED');

  const counts = useMemo(() => new Map(taskCategories.map((category) => [
    category.id,
    state.tasks.filter((task) => task.category === category.id).length,
  ])), [state.tasks, taskCategories]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[32px] border border-[#44474E] bg-[#1D2026] p-5" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#44474E]/40 pb-3">
          <div className="flex items-center gap-2"><Tag className="h-5 w-5 text-[#D1E1FF]" /><h2 className="text-sm font-bold">Manage Categories</h2></div>
          <button onClick={onClose} className="rounded-xl p-1 text-[#C4C6D0]"><X className="h-5 w-5" /></button>
        </div>

        <form
          className="mt-4 grid grid-cols-[1fr_auto] gap-2 rounded-2xl bg-[#111318] p-3"
          onSubmit={(event) => {
            event.preventDefault();
            createTaskCategory(newLabel, newColor, newIcon);
            setNewLabel('');
          }}
        >
          <input value={newLabel} onChange={(event) => setNewLabel(event.target.value)} placeholder="New category" className="rounded-xl border border-[#44474E] bg-[#1D2026] px-3 py-2 text-xs outline-none" />
          <button disabled={!newLabel.trim()} className="rounded-xl bg-[#D1E1FF] px-3 text-[#003062] disabled:opacity-40"><Plus className="h-4 w-4" /></button>
          <div className="col-span-2 flex items-center gap-2">
            <input type="color" value={newColor} onChange={(event) => setNewColor(event.target.value)} className="h-8 w-10 rounded border-0 bg-transparent" aria-label="Category color" />
            <select value={newIcon} onChange={(event) => setNewIcon(event.target.value)} className="flex-1 rounded-xl border border-[#44474E] bg-[#1D2026] px-2 py-1.5 text-xs">
              {ICON_OPTIONS.map((icon) => <option key={icon} value={icon}>{icon}</option>)}
            </select>
          </div>
        </form>

        <div className="mt-4 space-y-2">
          {taskCategories.map((category) => (
            <div key={category.id} className="rounded-2xl border border-[#44474E]/40 bg-[#111318] p-3">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: category.color }} />
                {editingId === category.id ? (
                  <input autoFocus value={editingLabel} onChange={(event) => setEditingLabel(event.target.value)} className="min-w-0 flex-1 rounded-lg bg-[#1D2026] px-2 py-1 text-xs" />
                ) : (
                  <span className="min-w-0 flex-1 text-xs font-bold">{category.label}</span>
                )}
                <span className="text-[10px] text-[#C4C6D0]">{counts.get(category.id) || 0} tasks</span>
                {editingId === category.id ? (
                  <button onClick={() => { updateTaskCategory(category.id, { label: editingLabel }); setEditingId(null); }} className="rounded-lg bg-[#334867] px-2 py-1 text-[10px] font-bold">Save</button>
                ) : (
                  <button onClick={() => { setEditingId(category.id); setEditingLabel(category.label); }} className="p-1 text-[#C4C6D0]" title="Rename category"><Pencil className="h-3.5 w-3.5" /></button>
                )}
                {!category.isSystem && (
                  <button onClick={() => { setDeleteId(category.id); setReassignToId('UNCATEGORISED'); }} className="p-1 text-[#FCA5A5]" title="Delete category"><Trash2 className="h-3.5 w-3.5" /></button>
                )}
              </div>
              {editingId === category.id && (
                <div className="mt-2 flex gap-2">
                  <input type="color" value={category.color} onChange={(event) => updateTaskCategory(category.id, { color: event.target.value })} className="h-7 w-10 bg-transparent" />
                  <select value={category.icon} onChange={(event) => updateTaskCategory(category.id, { icon: event.target.value })} className="flex-1 rounded-lg bg-[#1D2026] px-2 text-[10px]">
                    {ICON_OPTIONS.map((icon) => <option key={icon}>{icon}</option>)}
                  </select>
                </div>
              )}
            </div>
          ))}
        </div>

        {deleteId && (
          <div className="mt-4 rounded-2xl border border-[#FCA5A5]/30 bg-[#7F1D1D]/15 p-3">
            <p className="text-xs font-bold">Move this category’s tasks before deletion</p>
            <select value={reassignToId} onChange={(event) => setReassignToId(event.target.value)} className="mt-2 w-full rounded-xl bg-[#111318] px-3 py-2 text-xs">
              {taskCategories.filter((category) => category.id !== deleteId).map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
            </select>
            <div className="mt-2 flex gap-2">
              <button className="flex-1 rounded-xl bg-[#2E3036] py-2 text-xs font-bold" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="flex-1 rounded-xl bg-[#BA1A1A] py-2 text-xs font-bold text-white" onClick={() => { deleteTaskCategory(deleteId, reassignToId); setDeleteId(null); }}>Continue</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
