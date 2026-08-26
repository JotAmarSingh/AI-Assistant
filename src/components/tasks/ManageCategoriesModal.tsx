import React, { useMemo, useState } from 'react';
import { Pencil, Plus, Tag, Trash2, X, Check } from 'lucide-react';
import { useDay } from '../../context/DayContext';
import { resolveCategoryIslandIcon } from '../../services/geminiService';

interface ManageCategoriesModalProps {
  onClose: () => void;
  isOpen?: boolean;
}

export const ManageCategoriesModal: React.FC<ManageCategoriesModalProps> = ({ onClose, isOpen = true }) => {
  const { state, taskCategories, createTaskCategory, updateTaskCategory, deleteTaskCategory } = useDay();
  const [newLabel, setNewLabel] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const counts = useMemo(() => new Map(taskCategories.map((category) => [
    category.id,
    state.tasks.filter((task) => task.category === category.id).length,
  ])), [state.tasks, taskCategories]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#070A10]/80 backdrop-blur-md p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[28px] border border-[#00F0FF]/40 bg-[#0D1527] p-5 shadow-2xl space-y-4" onClick={(event) => event.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#00F0FF]/30 pb-3">
          <div className="flex items-center space-x-2">
            <Tag className="h-4 w-4 text-[#00F0FF]" />
            <h2 className="text-sm font-bold font-mono text-[#E2E2E6]">Manage Category Islands</h2>
          </div>
          <button onClick={onClose} className="rounded-xl p-1 text-[#C4C6D0] hover:text-[#00F0FF] transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Create New Category Form */}
        <form
          className="flex items-center space-x-2 rounded-2xl bg-[#111827] border border-[#00F0FF]/30 p-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!newLabel.trim()) return;
            createTaskCategory(newLabel.trim(), '#00F0FF', 'tag');
            setNewLabel('');
          }}
        >
          <input 
            value={newLabel} 
            onChange={(event) => setNewLabel(event.target.value)} 
            placeholder="New Category (e.g. Family, Travel)..." 
            className="flex-1 rounded-xl bg-transparent px-3 py-2 text-xs font-mono text-[#E2E2E6] placeholder-[#C4C6D0]/40 outline-none" 
          />
          <button 
            type="submit"
            disabled={!newLabel.trim()} 
            className="rounded-xl bg-[#00F0FF] text-[#070A10] px-3 py-2 font-mono font-bold text-xs disabled:opacity-40 shadow-[0_0_10px_#00F0FF]"
          >
            <Plus className="h-4 w-4" />
          </button>
        </form>

        {/* Sleek Compact Single-Line Category List */}
        <div className="space-y-2">
          {taskCategories.map((category) => {
            const isEditing = editingId === category.id;
            const taskCount = counts.get(category.id) || 0;
            const icon = resolveCategoryIslandIcon(category.label);

            return (
              <div key={category.id} className="rounded-2xl border border-[#00F0FF]/25 bg-[#111827] px-3 py-2.5 flex items-center justify-between shadow-sm">
                <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                  <span className="text-base p-1 rounded-xl bg-[#070A10] border border-[#00F0FF]/30 shrink-0 font-mono">
                    {icon}
                  </span>

                  {isEditing ? (
                    <input
                      value={editingLabel}
                      onChange={(e) => setEditingLabel(e.target.value)}
                      className="rounded-lg bg-[#070A10] border border-[#00F0FF] px-2 py-1 text-xs text-[#E2E2E6] font-mono outline-none"
                    />
                  ) : (
                    <div className="min-w-0">
                      <span className="text-xs font-bold font-mono text-[#E2E2E6] block truncate">
                        {category.label}
                      </span>
                      <span className="text-[10px] text-[#C4C6D0]/60 font-mono block">
                        {taskCount} tasks
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-1 shrink-0">
                  {isEditing ? (
                    <button
                      onClick={() => {
                        if (editingLabel.trim()) {
                          updateTaskCategory(category.id, { label: editingLabel.trim() });
                        }
                        setEditingId(null);
                      }}
                      className="p-1.5 rounded-lg bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingId(category.id);
                        setEditingLabel(category.label);
                      }}
                      className="p-1.5 rounded-lg text-[#C4C6D0] hover:text-[#00F0FF] hover:bg-[#00F0FF]/15 transition"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}

                  <button
                    onClick={() => deleteTaskCategory(category.id, 'UNCATEGORISED')}
                    className="p-1.5 rounded-lg text-[#F87171] hover:bg-[#F87171]/20 transition"
                    title="Delete category"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
