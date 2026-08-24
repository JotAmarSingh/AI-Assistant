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
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Lock,
  Award,
  Gift
} from 'lucide-react';
import { useDay } from '../../context/DayContext';
import { TaskStatus, TaskCategory, TaskItem } from '../../types';
import { resolveContextualIcon, resolveCategoryIslandIcon } from '../../services/geminiService';
import { ManageCategoriesModal } from '../tasks/ManageCategoriesModal';

export const TaskBoardView: React.FC = () => {
  const { 
    state, 
    updateTaskStatus, 
    addTask, 
    editTask,
    deleteTask, 
    taskCategories 
  } = useDay();

  // Active Selected Island for Adventure Map Detail View (null = Overview Map)
  const [activeIslandId, setActiveIslandId] = useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
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

  // Dynamic Category Island Data
  const islandCategories = taskCategories.map((cat) => {
    const tasks = allTasks.filter((t) => t.category === cat.id);
    const done = tasks.filter((t) => t.status === 'DONE').length;
    const total = tasks.length;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;

    return {
      id: cat.id,
      label: cat.label.includes('Island') ? cat.label : `${cat.label} Island`,
      icon: resolveCategoryIslandIcon(cat.label),
      tasks,
      doneCount: done,
      totalCount: total,
      percent,
      color: cat.color || '#00F0FF',
      border: 'border-[#00F0FF]/40',
      bg: 'bg-[#00F0FF]/10'
    };
  });

  const activeIsland = islandCategories.find((i) => i.id === activeIslandId);

  const getTaskXpBadge = (priority?: any) => {
    if (priority === 'HIGH' || priority >= 8) {
      return { label: '+150 XP ★', xpNum: 150, badgeClass: 'bg-[#FBBF24]/20 text-[#FBBF24] border-[#FBBF24]/50' };
    }
    if (priority === 'LOW' || priority <= 3) {
      return { label: '+30 XP', xpNum: 30, badgeClass: 'bg-[#10B981]/20 text-[#10B981] border-[#10B981]/40' };
    }
    return { label: '+80 XP', xpNum: 80, badgeClass: 'bg-[#00F0FF]/20 text-[#00F0FF] border-[#00F0FF]/40' };
  };

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
        {activeIsland ? (
          <button
            onClick={() => setActiveIslandId(null)}
            className="flex items-center space-x-1.5 text-sm font-bold font-mono text-[#00F0FF] hover:underline"
          >
            <ChevronLeft className="w-5 h-5 text-[#00F0FF]" />
            <span>{activeIsland.label}</span>
          </button>
        ) : (
          <div className="flex items-center space-x-2">
            <CheckSquare className="w-4 h-4 text-[#00F0FF]" />
            <h2 className="font-mono font-bold text-sm text-[#E2E2E6]">Task Boards • Category Islands</h2>
          </div>
        )}

        <button
          onClick={() => setIsManageCategoriesOpen(true)}
          className="px-2.5 py-1 rounded-full bg-[#111827] border border-[#00F0FF]/30 text-[#00F0FF] text-[10px] font-mono font-bold hover:bg-[#00F0FF]/20 transition"
        >
          Manage Islands
        </button>
      </div>

      {/* Main Scrollable Canvas */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* VIEW 1: ISLAND ADVENTURE MAP DETAIL VIEW (When an Island is Clicked) */}
        {activeIsland ? (
          <div className="space-y-4">
            {/* Top Island Header & Banner Card */}
            <div className="p-4 rounded-[28px] bg-gradient-to-r from-[#0D1527] via-[#111827] to-[#0D1527] border border-[#00F0FF]/40 shadow-[0_0_30px_rgba(0,240,255,0.15)] space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-3xl p-2 rounded-2xl bg-[#070A10] border border-[#00F0FF]/30 shadow-md">
                    {activeIsland.icon}
                  </span>
                  <div>
                    <h3 className="font-mono font-extrabold text-base text-[#E2E2E6]">{activeIsland.label}</h3>
                    <span className="text-[10px] font-mono text-[#C4C6D0]/70">
                      {activeIsland.doneCount} / {activeIsland.totalCount} Tasks Completed
                    </span>
                  </div>
                </div>

                {/* Island Progress Gauge */}
                <div className="relative w-12 h-12 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-[#111827]"
                      strokeWidth="3.5"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-[#00F0FF]"
                      strokeDasharray={`${activeIsland.percent}, 100`}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute text-center">
                    <span className="text-[10px] font-mono font-bold text-[#00F0FF]">{activeIsland.percent}%</span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-[#C4C6D0] leading-relaxed">
                Complete all tasks on this island to earn <strong className="text-[#FBBF24]">+200 XP Bonus Reward</strong>!
              </p>
            </div>

            {/* Vertical Adventure Path with Checkpoints */}
            <div className="relative pl-6 space-y-3.5 pt-1">
              {/* Vertical Glowing Checkpoint Line */}
              <div className="absolute left-3.5 top-3 bottom-3 w-0.5 bg-gradient-to-b from-[#10B981] via-[#C084FC] to-[#FBBF24] shadow-[0_0_10px_#00F0FF]" />

              {activeIsland.tasks.map((task, idx) => {
                const isDone = task.status === 'DONE';
                const isActive = task.status === 'ACTIVE';
                const isBlocked = task.status === 'BLOCKED';
                const xpInfo = getTaskXpBadge(task.priority);
                const icon = resolveContextualIcon(task.title, task.notes || task.category);
                const isExpanded = expandedTaskId === task.id;

                return (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.08 }}
                    className="relative flex items-start space-x-3"
                  >
                    {/* Glowing Checkpoint Node Icon */}
                    <div className={`absolute -left-6 top-3 w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs shadow-lg z-10 ${
                      isDone ? 'bg-[#10B981] border-[#10B981] text-[#070A10] shadow-[0_0_12px_#10B981]' :
                      isActive ? 'bg-[#C084FC] border-[#C084FC] text-[#070A10] shadow-[0_0_15px_#C084FC] animate-pulse' :
                      isBlocked ? 'bg-[#111827] border-[#F87171] text-[#F87171]' :
                      'bg-[#0D1527] border-[#FBBF24] text-[#FBBF24]'
                    }`}>
                      {isDone ? <CheckCircle2 className="w-4 h-4 stroke-[3]" /> :
                       isActive ? <Play className="w-3.5 h-3.5 fill-current" /> :
                       isBlocked ? <Lock className="w-3.5 h-3.5" /> :
                       <span>▶</span>}
                    </div>

                    {/* Task Card Surface */}
                    <div className={`flex-1 p-3.5 rounded-[24px] border backdrop-blur-md transition shadow-md ${
                      isActive ? 'bg-[#1D122A]/90 border-[#C084FC] shadow-[0_0_20px_rgba(192,132,252,0.3)] ring-1 ring-[#C084FC]' :
                      isDone ? 'bg-[#061A14]/70 border-[#10B981]/40 opacity-80' :
                      isBlocked ? 'bg-[#181014]/80 border-[#F87171]/40' :
                      'bg-[#0D1527]/90 border-[#00F0FF]/30'
                    }`}>
                      <div 
                        onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                        className="flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                          <span className="text-base p-1.5 rounded-xl bg-[#070A10] border border-[#00F0FF]/30 shrink-0">
                            {icon}
                          </span>
                          <div>
                            <h4 className={`text-xs font-bold ${isDone ? 'line-through text-[#C4C6D0]/60' : 'text-[#E2E2E6]'}`}>
                              {task.title}
                            </h4>
                            <span className="text-[10px] text-[#C4C6D0]/60 font-mono block mt-0.5">
                              {task.status} {task.estimatedMinutes ? `• ~${task.estimatedMinutes}m` : ''}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${xpInfo.badgeClass}`}>
                            {xpInfo.label}
                          </span>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-[#00F0FF]" /> : <ChevronDown className="w-4 h-4 text-[#C4C6D0]/50" />}
                        </div>
                      </div>

                      {/* Expanded Actions Toolbar (Edit, Mark Complete, Remove, Set Active) */}
                      {isExpanded && (
                        <div className="mt-3 pt-2.5 border-t border-[#00F0FF]/15 space-y-2 text-xs">
                          {editingTaskId === task.id ? (
                            <div className="flex items-center space-x-2">
                              <input
                                type="text"
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                className="flex-1 p-2 rounded-xl bg-[#111827] border border-[#00F0FF] text-xs font-mono text-[#E2E2E6]"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (editingTitle.trim()) {
                                    editTask(task.id, { title: editingTitle.trim() });
                                  }
                                  setEditingTaskId(null);
                                }}
                                className="px-3 py-2 rounded-xl bg-[#10B981] text-[#070A10] font-mono font-bold text-xs"
                              >
                                Save
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <button
                                type="button"
                                onClick={() => updateTaskStatus(task.id, isActive ? 'NEXT' : 'ACTIVE')}
                                className={`flex-1 py-2 px-3 rounded-xl font-mono font-bold text-[11px] flex items-center justify-center space-x-1 transition ${
                                  isActive ? 'bg-[#FBBF24] text-[#070A10]' : 'bg-[#00F0FF] text-[#070A10] shadow-[0_0_10px_#00F0FF]'
                                }`}
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>{isActive ? 'Pause' : 'Set Active'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTaskId(task.id);
                                  setEditingTitle(task.title);
                                }}
                                className="py-2 px-3 rounded-xl bg-[#00F0FF]/15 border border-[#00F0FF]/40 text-[#00F0FF] font-mono font-bold text-[11px] flex items-center space-x-1"
                              >
                                <span>Edit</span>
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
                                className="p-2 rounded-xl bg-[#F87171]/15 border border-[#F87171]/40 text-[#F87171]"
                                title="Remove task"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Bottom Island Reward Chest Card */}
            <div className="p-4 rounded-[28px] bg-gradient-to-r from-[#1C160C] via-[#0D1527] to-[#1C160C] border border-[#FBBF24]/50 shadow-[0_0_25px_rgba(251,191,36,0.2)] flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-bold text-[#FBBF24] font-mono block flex items-center gap-1">
                  <Gift className="w-4 h-4 text-[#FBBF24]" />
                  Island Reward Chest
                </span>
                <p className="text-xs text-[#C4C6D0]">
                  Complete all tasks on this island to unlock <strong className="text-[#FBBF24]">+200 XP Bonus</strong>!
                </p>
                {/* Progress Bar */}
                <div className="w-44 h-1.5 bg-[#111827] rounded-full overflow-hidden border border-[#FBBF24]/40 mt-1.5">
                  <div className="h-full bg-[#FBBF24]" style={{ width: `${activeIsland.percent}%` }} />
                </div>
              </div>

              <div className="text-right font-mono font-extrabold text-sm text-[#FBBF24] px-3 py-1.5 rounded-2xl bg-[#FBBF24]/20 border border-[#FBBF24]/40 shrink-0">
                +200 XP
              </div>
            </div>
          </div>
        ) : (
          /* VIEW 2: OVERVIEW CATEGORY ISLANDS MAP */
          <div className="space-y-4">
            {/* Overall Progress Summary */}
            <div className="p-4 rounded-[28px] bg-[#0D1527] border border-[#00F0FF]/30 shadow-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] text-[#C4C6D0]/60 font-mono block uppercase">Total Completion</span>
                <span className="text-xl font-mono font-extrabold text-[#E2E2E6]">
                  {doneCount} / {totalCount} <span className="text-xs text-[#00F0FF]">Tasks</span>
                </span>
              </div>

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
                <span className="text-[9px] text-[#C4C6D0]/70 font-mono mt-0.5 font-bold">Overall Progress</span>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-[#C4C6D0]/60 font-mono block uppercase">Priority Reward</span>
                <span className="text-xs font-mono font-bold text-[#FBBF24] block mt-1">
                  High: +150 XP ★
                </span>
              </div>
            </div>

            {/* 2x2 Grid RPG Category Islands Exploration Map (Matching Reference Image) */}
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold text-[#00F0FF] uppercase block">
                CATEGORY ISLANDS MAP EXPLORATION ({islandCategories.length})
              </span>

              <div className="grid grid-cols-2 gap-3">
                {islandCategories.map((island) => (
                  <button
                    key={island.id}
                    type="button"
                    onClick={() => setActiveIslandId(island.id)}
                    className="p-3.5 rounded-[24px] bg-[#0D1527] border border-[#00F0FF]/35 hover:border-[#00F0FF] text-center flex flex-col items-center justify-between transition relative overflow-hidden shadow-lg group hover:scale-[1.02]"
                  >
                    {/* Floating 3D Island Graphic Icon */}
                    <div className="w-14 h-14 rounded-2xl bg-[#070A10] border border-[#00F0FF]/40 flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(0,240,255,0.2)] group-hover:scale-110 transition">
                      {island.icon}
                    </div>

                    <div className="mt-2.5 w-full">
                      <h4 className="font-mono font-bold text-xs text-[#E2E2E6] truncate">{island.label}</h4>
                      <span className="text-[10px] text-[#C4C6D0]/70 font-mono block mt-0.5">
                        {island.doneCount} / {island.totalCount} Tasks
                      </span>

                      {/* Island Mini Progress Bar */}
                      <div className="w-full h-1.5 bg-[#111827] rounded-full overflow-hidden border border-[#00F0FF]/30 mt-2">
                        <div className="h-full bg-[#00F0FF] transition-all duration-500" style={{ width: `${island.percent}%` }} />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Add Task Button */}
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
                      {taskCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.label.includes('Island') ? cat.label : `${cat.label} Island`}
                        </option>
                      ))}
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
