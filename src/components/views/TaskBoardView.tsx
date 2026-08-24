import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  CheckCircle2, 
  Trash2, 
  Star, 
  Sparkles, 
  Building2, 
  Trees, 
  BookOpen, 
  Home, 
  CheckSquare, 
  Clock, 
  Play, 
  ChevronRight,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useDay } from '../../context/DayContext';
import { TaskStatus, TaskCategory, TaskItem } from '../../types';
import { resolveContextualIcon } from '../../services/geminiService';
import { ManageCategoriesModal } from '../tasks/ManageCategoriesModal';

export const TaskBoardView: React.FC = () => {
  const { 
    state, 
    updateTaskStatus, 
    addTask, 
    deleteTask, 
    taskCategories 
  } = useDay();

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);

  // Quick New Task Form State
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<string>('OFFICE');
  const [newPriority, setNewPriority] = useState<'HIGH' | 'NORMAL' | 'LOW'>('HIGH');

  const allTasks = state.tasks || [];
  const completedTasks = allTasks.filter((t) => t.status === 'DONE');
  const totalCount = allTasks.length;
  const doneCount = completedTasks.length;
  const progressRatio = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  // Category Island Data
  const islandCategories = [
    { id: 'OFFICE', label: 'Work Island', icon: Building2, color: '#00F0FF', border: 'border-[#00F0FF]/40', bg: 'bg-[#00F0FF]/10' },
    { id: 'HEALTH', label: 'Health Island', icon: Trees, color: '#10B981', border: 'border-[#10B981]/40', bg: 'bg-[#10B981]/10' },
    { id: 'LEARNING', label: 'Learning Island', icon: BookOpen, color: '#C084FC', border: 'border-[#C084FC]/40', bg: 'bg-[#C084FC]/10' },
    { id: 'PERSONAL', label: 'Personal Island', icon: Home, color: '#FBBF24', border: 'border-[#FBBF24]/40', bg: 'bg-[#FBBF24]/10' },
  ];

  const getTaskXpBadge = (priority?: any) => {
    if (priority === 'HIGH' || priority >= 8) {
      return { label: '+150 XP ★', badgeClass: 'bg-[#FBBF24]/20 text-[#FBBF24] border-[#FBBF24]/50' };
    }
    if (priority === 'LOW' || priority <= 3) {
      return { label: '+30 XP', badgeClass: 'bg-[#10B981]/20 text-[#10B981] border-[#10B981]/40' };
    }
    return { label: '+80 XP', badgeClass: 'bg-[#00F0FF]/20 text-[#00F0FF] border-[#00F0FF]/40' };
  };

  const filteredTasks = allTasks.filter((t) => {
    if (selectedCategory === 'ALL') return true;
    return t.category === selectedCategory;
  });

  const handleCreateTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    addTask({
      title: newTitle.trim(),
      category: newCategory,
      owner: 'ME',
      status: 'NEXT',
      priority: newPriority === 'HIGH' ? 9 : newPriority === 'LOW' ? 2 : 5,
    });

    setNewTitle('');
    setIsAddModalOpen(false);
  };

  return (
    <div id="task-board-view" className="flex-1 flex flex-col h-full bg-[#070A10] text-[#E2E2E6] overflow-hidden relative">
      {/* Top Header Bar */}
      <div className="shrink-0 px-4 py-3 bg-[#0D1527]/95 backdrop-blur-md border-b border-[#00F0FF]/30 flex items-center justify-between z-20 shadow-md">
        <div className="flex items-center space-x-2">
          <CheckSquare className="w-4 h-4 text-[#00F0FF]" />
          <h2 className="font-mono font-bold text-sm text-[#E2E2E6]">Task Boards • Category Islands</h2>
        </div>
        <button
          onClick={() => setIsManageCategoriesOpen(true)}
          className="px-2.5 py-1 rounded-full bg-[#111827] border border-[#00F0FF]/30 text-[#00F0FF] text-[10px] font-mono font-bold hover:bg-[#00F0FF]/20 transition"
        >
          Manage Islands
        </button>
      </div>

      {/* Main Scrollable Canvas */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Central Overall Progress Card (Clean Dark Contrast, Zero Background Glare) */}
        <div className="p-4 rounded-[28px] bg-[#0D1527] border border-[#00F0FF]/30 shadow-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-[#C4C6D0]/60 font-mono block uppercase">Total Completion</span>
            <span className="text-xl font-mono font-extrabold text-[#E2E2E6]">
              {doneCount} / {totalCount} <span className="text-xs text-[#00F0FF]">Tasks</span>
            </span>
          </div>

          {/* Central Progress Ring */}
          <div className="flex flex-col items-center">
            <div className="relative w-14 h-14 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-[#111827]"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-[#10B981]"
                  strokeDasharray={`${progressRatio}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute text-center">
                <span className="text-xs font-mono font-extrabold text-[#10B981]">{progressRatio}%</span>
              </div>
            </div>
            <span className="text-[9px] text-[#C4C6D0]/70 font-mono mt-0.5">Overall Progress</span>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-[#C4C6D0]/60 font-mono block uppercase">Priority Reward</span>
            <span className="text-xs font-mono font-bold text-[#FBBF24] block mt-1">
              High: +150 XP ★
            </span>
          </div>
        </div>

        {/* 3D RPG Category Islands Selector Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {islandCategories.map((island) => {
            const IslandIcon = island.icon;
            const islandTasksCount = allTasks.filter((t) => t.category === island.id && t.status !== 'DONE').length;
            const isSelected = selectedCategory === island.id;

            return (
              <button
                key={island.id}
                type="button"
                onClick={() => setSelectedCategory(isSelected ? 'ALL' : island.id)}
                className={`p-3 rounded-2xl border text-left transition relative overflow-hidden ${
                  isSelected ? 'bg-[#0D1527] border-[#00F0FF] shadow-[0_0_15px_rgba(0,240,255,0.3)] ring-1 ring-[#00F0FF]' : `${island.bg} ${island.border}`
                }`}
              >
                <div className="flex items-center justify-between">
                  <IslandIcon className="w-5 h-5" style={{ color: island.color }} />
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-[#070A10] text-[#E2E2E6]">
                    {islandTasksCount} tasks
                  </span>
                </div>
                <span className="text-xs font-bold text-[#E2E2E6] font-mono block mt-2">{island.label}</span>
              </button>
            );
          })}
        </div>

        {/* Task List Feed (Minimal Expandable Accordion with Task-Specific Clipart & Icons) */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between pb-1 border-b border-[#00F0FF]/20">
            <span className="text-xs font-mono font-bold text-[#00F0FF]">
              {selectedCategory === 'ALL' ? 'ALL ISLAND TASKS' : `${selectedCategory} ISLAND TASKS`} ({filteredTasks.length})
            </span>
            {selectedCategory !== 'ALL' && (
              <button
                onClick={() => setSelectedCategory('ALL')}
                className="text-[10px] text-[#C4C6D0]/60 hover:text-[#00F0FF] font-mono font-bold"
              >
                Reset Filter
              </button>
            )}
          </div>

          <AnimatePresence>
            {filteredTasks.map((task) => {
              const isExpanded = expandedTaskId === task.id;
              const isDone = task.status === 'DONE';
              const isActive = task.status === 'ACTIVE';
              const isNext = task.status === 'NEXT';
              const xpInfo = getTaskXpBadge(task.priority);
              
              // Task-Defined Specific Clipart Icon
              const icon = resolveContextualIcon(task.title, task.notes || task.category);

              return (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`rounded-2xl border transition shadow-sm overflow-hidden ${
                    isDone ? 'bg-[#111827]/60 border-[#334867]/40 opacity-75' :
                    isActive ? 'bg-[#0D1527] border-[#00F0FF] shadow-[0_0_15px_rgba(0,240,255,0.2)]' :
                    'bg-[#0D1527]/90 border-[#00F0FF]/30'
                  }`}
                >
                  {/* Collapsed Single-Line Bar (Default Minimal View) */}
                  <div
                    onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                    className="p-3.5 flex items-center justify-between cursor-pointer select-none"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateTaskStatus(task.id, isDone ? 'NEXT' : 'DONE');
                        }}
                        className={`w-5 h-5 rounded-lg border flex items-center justify-center transition shrink-0 ${
                          isDone ? 'bg-[#10B981] border-[#10B981] text-[#070A10]' : 'border-[#00F0FF]/50 hover:bg-[#00F0FF]/20'
                        }`}
                      >
                        {isDone && <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />}
                      </button>

                      <div className="min-w-0">
                        <span className={`text-xs font-semibold block truncate ${isDone ? 'line-through text-[#C4C6D0]/50' : 'text-[#E2E2E6]'}`}>
                          {task.title}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      {/* Priority XP Reward Badge */}
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${xpInfo.badgeClass}`}>
                        {xpInfo.label}
                      </span>

                      {/* Task-Specific Clipart Icon (Minimal Subtle Badge) */}
                      <span className="text-xs p-1 rounded-lg bg-[#070A10] border border-[#00F0FF]/20 font-mono shadow-xs">
                        {icon}
                      </span>

                      {isExpanded ? <ChevronUp className="w-4 h-4 text-[#00F0FF]" /> : <ChevronDown className="w-4 h-4 text-[#C4C6D0]/50" />}
                    </div>
                  </div>

                  {/* Expanded Card Details (On Tap) */}
                  {isExpanded && (
                    <div className="px-4 pb-3.5 pt-1 border-t border-[#00F0FF]/15 space-y-2.5 bg-[#070A10]/60 text-xs">
                      {task.notes && (
                        <p className="text-[11px] text-[#C4C6D0] leading-relaxed">
                          {task.notes}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-[10px] font-mono text-[#C4C6D0]/70 pt-1">
                        <span>Category: <strong className="text-[#00F0FF]">{task.category}</strong></span>
                        <span>Owner: <strong className="text-[#E2E2E6]">{task.owner || 'ME'}</strong></span>
                        {task.estimatedMinutes && <span>Est: ~{task.estimatedMinutes}m</span>}
                      </div>

                      {/* Action Buttons Toolbar */}
                      <div className="flex items-center space-x-2 pt-2 border-t border-[#00F0FF]/10">
                        <button
                          type="button"
                          onClick={() => updateTaskStatus(task.id, isActive ? 'NEXT' : 'ACTIVE')}
                          className={`flex-1 py-2 px-3 rounded-xl font-mono font-bold text-[11px] flex items-center justify-center space-x-1 transition ${
                            isActive ? 'bg-[#FBBF24] text-[#070A10]' : 'bg-[#00F0FF] text-[#070A10] shadow-[0_0_10px_#00F0FF]'
                          }`}
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>{isActive ? 'Pause Task' : 'Set Active Focus'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => updateTaskStatus(task.id, isDone ? 'NEXT' : 'DONE')}
                          className="py-2 px-3 rounded-xl bg-[#10B981]/20 border border-[#10B981]/40 text-[#10B981] font-mono font-bold text-[11px] flex items-center space-x-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{isDone ? 'Undo' : 'Done'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteTask(task.id)}
                          className="p-2 rounded-xl bg-[#F87171]/15 border border-[#F87171]/40 text-[#F87171] hover:bg-[#F87171]/30 transition"
                          title="Delete task"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Floating Quick Add Task Button */}
      <button
        onClick={() => setIsAddModalOpen(true)}
        className="fixed right-5 bottom-20 p-3.5 rounded-full bg-[#00F0FF] text-[#070A10] shadow-[0_0_25px_#00F0FF] transition hover:scale-105 z-30"
        title="Add New Task"
      >
        <Plus className="w-5 h-5 font-extrabold" />
      </button>

      {/* Quick Add Task Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 bg-[#070A10]/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm rounded-[28px] bg-[#0D1527] border border-[#00F0FF]/40 p-5 space-y-4 shadow-2xl"
            >
              <h3 className="text-sm font-bold font-mono text-[#00F0FF]">Add Task to Category Island</h3>
              <form onSubmit={handleCreateTaskSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[10px] font-mono text-[#C4C6D0] uppercase mb-1">Task Title</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Breakfast (2 chapati with curd and dal)"
                    className="w-full p-2.5 rounded-xl bg-[#111827] border border-[#00F0FF]/30 text-[#E2E2E6]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-mono text-[#C4C6D0] uppercase mb-1">Island Category</label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-[#111827] border border-[#00F0FF]/30 text-[#E2E2E6]"
                    >
                      <option value="OFFICE">Work Island</option>
                      <option value="HEALTH">Health Island</option>
                      <option value="LEARNING">Learning Island</option>
                      <option value="PERSONAL">Personal Island</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-[#C4C6D0] uppercase mb-1">Priority (XP)</label>
                    <select
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value as any)}
                      className="w-full p-2.5 rounded-xl bg-[#111827] border border-[#00F0FF]/30 text-[#E2E2E6]"
                    >
                      <option value="HIGH">High (+150 XP ★)</option>
                      <option value="NORMAL">Normal (+80 XP)</option>
                      <option value="LOW">Low (+30 XP)</option>
                    </select>
                  </div>
                </div>

                <div className="flex space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl bg-[#111827] text-[#C4C6D0] font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-[#00F0FF] text-[#070A10] font-bold font-mono shadow-[0_0_15px_#00F0FF]"
                  >
                    Create Task
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manage Categories Modal */}
      {isManageCategoriesOpen && (
        <ManageCategoriesModal onClose={() => setIsManageCategoriesOpen(false)} />
      )}
    </div>
  );
};
