import React, { useState } from 'react';
import { Plus, CheckCircle2, Play, PauseCircle, Clock, CornerDownRight, Trash2, User, Lock, Unlock, Timer, BrainCircuit, Settings2 } from 'lucide-react';
import { useDay } from '../../context/DayContext';
import { TaskStatus, TaskCategory, TaskOwner } from '../../types';
import { taskIsVisibleOnBoard } from '../../utils/dailyHistory';
import { ManageCategoriesModal } from '../tasks/ManageCategoriesModal';

export const TaskBoardView: React.FC = () => {
  const { state, updateTaskStatus, addTask, deleteTask, editTask, startFocusTimer, setIsFocusModalOpen, taskCategories } = useDay();
  const [selectedFilter, setSelectedFilter] = useState<TaskStatus | 'ALL'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<TaskCategory | 'ALL'>('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);

  // New task form state
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<TaskCategory>('OFFICE');
  const [newOwner, setNewOwner] = useState<TaskOwner>('ME');
  const [newStatus, setNewStatus] = useState<TaskStatus>('NEXT');
  const [newPriority, setNewPriority] = useState<number>(7);
  const [newEstimatedMinutes, setNewEstimatedMinutes] = useState<number>(30);
  const [newBlockedBy, setNewBlockedBy] = useState('');
  const [newTrigger, setNewTrigger] = useState('');
  const [newNotes, setNewNotes] = useState('');

  const dateVisibleTasks = state.tasks.filter((task) =>
    taskIsVisibleOnBoard(task, state.date, state.date)
  );

  const filterOptions: { status: TaskStatus | 'ALL'; label: string; count: number }[] = [
    { status: 'ALL', label: 'All', count: dateVisibleTasks.length },
    { status: 'ACTIVE', label: 'Active', count: dateVisibleTasks.filter((t) => t.status === 'ACTIVE').length },
    { status: 'NEXT', label: 'Next', count: dateVisibleTasks.filter((t) => t.status === 'NEXT').length },
    { status: 'WAITING', label: 'Waiting', count: dateVisibleTasks.filter((t) => t.status === 'WAITING').length },
    { status: 'BLOCKED', label: 'Blocked', count: dateVisibleTasks.filter((t) => t.status === 'BLOCKED').length },
    { status: 'CAPTURED', label: 'Ideas', count: dateVisibleTasks.filter((t) => t.status === 'CAPTURED').length },
    { status: 'DONE', label: 'Done', count: dateVisibleTasks.filter((t) => t.status === 'DONE').length },
  ];

  const categories: TaskCategory[] = taskCategories.map((category) => category.id);
  const categoryLabel = (id: string) => taskCategories.find((category) => category.id === id)?.label || id;

  const owners: TaskOwner[] = ['ME', 'IT_TEAM', 'CLIENT', 'BOSS', 'SPOUSE', 'RECRUITER', 'OTHER'];

  const filteredTasks = dateVisibleTasks.filter((t) => {
    const statusMatch = selectedFilter === 'ALL' || t.status === selectedFilter;
    const catMatch = selectedCategory === 'ALL' || t.category === selectedCategory;
    return statusMatch && catMatch;
  });

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    addTask({
      title: newTitle.trim(),
      category: newCategory,
      owner: newOwner,
      status: newStatus,
      priority: newPriority,
      estimatedMinutes: newEstimatedMinutes,
      blockedBy: newBlockedBy.trim() || undefined,
      trigger: newTrigger.trim() || undefined,
      notes: newNotes.trim() || undefined,
    });

    // Reset form
    setNewTitle('');
    setNewBlockedBy('');
    setNewTrigger('');
    setNewNotes('');
    setIsAddModalOpen(false);
  };

  const getStatusBadgeStyle = (status: TaskStatus) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-[#334867] text-[#D1E1FF] border-[#D1E1FF]/50 animate-pulse';
      case 'NEXT':
        return 'bg-[#2E3036] text-[#D1E1FF] border-[#44474E]/60';
      case 'WAITING':
        return 'bg-[#2E3036] text-[#FDE047] border-[#FDE047]/40';
      case 'BLOCKED':
        return 'bg-[#2E3036] text-[#F87171] border-[#F87171]/40';
      case 'CAPTURED':
        return 'bg-[#2E3036] text-[#C4C6D0] border-[#44474E]/40';
      case 'DONE':
        return 'bg-[#1A1C1E] text-[#C4C6D0]/40 border-[#44474E]/20 line-through';
      default:
        return 'bg-[#2E3036] text-[#C4C6D0] border-[#44474E]/30';
    }
  };

  return (
    <div id="task-board-view" className="flex-1 flex flex-col h-full bg-[#111318] text-[#E2E2E6] overflow-hidden relative">
      {/* Top Filter Chips */}
      <div className="p-3 bg-[#111318] border-b border-[#44474E]/30 space-y-2 z-10">
        {/* Status Filter Scroll */}
        <div className="flex space-x-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {filterOptions.map((opt) => (
            <button
              key={opt.status}
              onClick={() => setSelectedFilter(opt.status)}
              className={`px-3 py-1.5 rounded-2xl text-xs font-semibold whitespace-nowrap transition flex items-center space-x-1.5 ${
                selectedFilter === opt.status
                  ? 'bg-[#334867] text-[#D1E1FF] shadow-sm border border-[#D1E1FF]/30'
                  : 'bg-[#2E3036] text-[#C4C6D0] hover:text-[#E2E2E6] hover:bg-[#334867]/60 border border-[#44474E]/40'
              }`}
            >
              <span>{opt.label}</span>
              <span className="text-[10px] opacity-70">({opt.count})</span>
            </button>
          ))}
        </div>

        {/* Category Filter Scroll */}
        <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none text-[11px]">
          <span className="text-[#C4C6D0]/60 font-mono text-[10px] shrink-0">Cat:</span>
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-2.5 py-0.5 rounded-full font-medium shrink-0 transition ${
              selectedCategory === 'ALL'
                ? 'bg-[#D1E1FF] text-[#003062] font-bold'
                : 'text-[#C4C6D0] hover:text-[#E2E2E6]'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-0.5 rounded-full font-medium shrink-0 transition ${
                selectedCategory === cat
                  ? 'bg-[#D1E1FF] text-[#003062] font-bold'
                  : 'text-[#C4C6D0] hover:text-[#E2E2E6]'
              }`}
            >
              {categoryLabel(cat)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setIsManageCategoriesOpen(true)}
            className="ml-auto flex shrink-0 items-center gap-1 rounded-full bg-[#334867] px-2.5 py-1 font-bold text-[#D1E1FF]"
          >
            <Settings2 className="h-3 w-3" /> Manage
          </button>
        </div>
      </div>

      {/* Task List Canvas */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-[#C4C6D0]/60">
            <CheckCircle2 className="w-10 h-10 mb-2 opacity-30 text-[#D1E1FF]" />
            <div className="text-sm font-semibold text-[#E2E2E6]">No tasks in this view</div>
            <div className="text-xs text-[#C4C6D0] mt-1">
              {selectedFilter === 'ALL' ? 'Add tasks manually or tell the AI assistant in the Today Hub.' : 'Try selecting another status tab above.'}
            </div>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <div
              key={task.id}
              className={`bg-[#1D2026] border rounded-[28px] p-4 shadow-md space-y-3 transition ${
                task.status === 'ACTIVE'
                  ? 'border-[#D1E1FF]/60 shadow-blue-950/40 ring-1 ring-[#D1E1FF]/30'
                  : 'border-[#44474E]/40 hover:border-[#44474E]/70'
              }`}
            >
              {/* Header: Title & Priority */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h4 className={`text-sm font-semibold text-[#E2E2E6] leading-snug ${
                    task.status === 'DONE' ? 'line-through text-[#C4C6D0]/40' : ''
                  }`}>
                    {task.title}
                  </h4>
                </div>

                <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${getStatusBadgeStyle(task.status)}`}>
                  {task.status}
                </span>
              </div>

              {/* Tags: Category, Owner, Estimated Time */}
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <select
                  value={task.category}
                  onChange={(event) => editTask(task.id, { category: event.target.value })}
                  className="rounded-full border border-[#44474E]/30 bg-[#2E3036] px-2.5 py-0.5 font-medium text-[#D1E1FF] outline-none"
                  aria-label={`Category for ${task.title}`}
                >
                  {taskCategories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
                </select>

                <span className={`px-2.5 py-0.5 rounded-full font-mono flex items-center space-x-1 ${
                  task.owner === 'ME'
                    ? 'bg-[#2E3036] text-[#C4C6D0]'
                    : 'bg-[#334867] text-[#D1E1FF] border border-[#D1E1FF]/30'
                }`}>
                  <User className="w-3 h-3" />
                  <span>Owner: {task.owner}</span>
                </span>

                {task.estimatedMinutes && (
                  <span className="text-[#C4C6D0] font-mono text-[10px] flex items-center bg-[#2E3036] px-2 py-0.5 rounded-full">
                    <Clock className="w-3 h-3 mr-1 text-[#D1E1FF]" />
                    {task.estimatedMinutes}m
                  </span>
                )}

                <span className="text-[#C4C6D0] font-mono text-[10px] bg-[#2E3036] px-2 py-0.5 rounded-full">
                  Pri: {task.priority}/10
                </span>
              </div>

              {/* Dependency & Blocker Alerts */}
              {task.blockedBy && (
                <div className="p-2.5 rounded-2xl bg-[#2E3036] border border-[#F87171]/40 text-[11px] text-[#F87171] flex items-start space-x-2">
                  <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#F87171]" />
                  <div>
                    <span className="font-semibold">Blocked by:</span> {task.blockedBy}
                  </div>
                </div>
              )}

              {task.trigger && (
                <div className="p-2.5 rounded-2xl bg-[#2E3036] border border-[#D1E1FF]/40 text-[11px] text-[#D1E1FF] flex items-start space-x-2">
                  <CornerDownRight className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#D1E1FF]" />
                  <div>
                    <span className="font-semibold">Trigger:</span> {task.trigger}
                  </div>
                </div>
              )}

              {task.notes && (
                <div className="text-[11px] text-[#C4C6D0] italic bg-[#111318]/50 p-2 rounded-xl border border-[#44474E]/20">
                  "{task.notes}"
                </div>
              )}

              {/* Card Action Controls */}
              <div className="flex items-center justify-between pt-1 border-t border-[#44474E]/30">
                <div className="flex items-center space-x-1.5">
                  {task.status !== 'DONE' && (
                    <button
                      onClick={() => {
                        startFocusTimer('POMODORO_25', task.id, task.title);
                        setIsFocusModalOpen(true);
                      }}
                      className="py-1.5 px-2.5 rounded-2xl bg-[#003062] hover:bg-[#334867] text-[#D1E1FF] text-xs font-semibold flex items-center space-x-1 transition border border-[#D1E1FF]/40"
                      title="Start 25-minute Pomodoro Block on this task"
                    >
                      <Timer className="w-3.5 h-3.5 text-[#D1E1FF]" />
                      <span>Focus</span>
                    </button>
                  )}

                  {task.status !== 'DONE' && (
                    <button
                      onClick={() => updateTaskStatus(task.id, 'DONE')}
                      className="py-1.5 px-3 rounded-2xl bg-[#2E3036] hover:bg-[#334867] text-[#D1E1FF] text-xs font-semibold flex items-center space-x-1 transition border border-[#44474E]/40"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#D1E1FF]" />
                      <span>Complete</span>
                    </button>
                  )}

                  {task.status === 'NEXT' && (
                    <button
                      onClick={() => updateTaskStatus(task.id, 'ACTIVE')}
                      className="py-1.5 px-3 rounded-2xl bg-[#D1E1FF] hover:bg-white text-[#003062] text-xs font-bold flex items-center space-x-1 transition shadow-sm"
                    >
                      <Play className="w-3 h-3 fill-[#003062]" />
                      <span>Start</span>
                    </button>
                  )}

                  {task.status === 'ACTIVE' && (
                    <button
                      onClick={() => updateTaskStatus(task.id, 'NEXT')}
                      className="py-1.5 px-3 rounded-2xl bg-[#2E3036] hover:bg-[#334867] border border-[#44474E]/40 text-[#E2E2E6] text-xs font-semibold flex items-center space-x-1 transition"
                    >
                      <PauseCircle className="w-3.5 h-3.5 text-[#C4C6D0]" />
                      <span>Pause</span>
                    </button>
                  )}

                  {task.status === 'BLOCKED' && (
                    <button
                      onClick={() => updateTaskStatus(task.id, 'NEXT')}
                      className="py-1.5 px-3 rounded-2xl bg-[#2E3036] hover:bg-[#334867] text-[#D1E1FF] text-xs font-semibold flex items-center space-x-1 transition border border-[#44474E]/40"
                      title="Force unblock"
                    >
                      <Unlock className="w-3 h-3 text-[#D1E1FF]" />
                      <span>Unblock</span>
                    </button>
                  )}
                </div>

                <button
                  onClick={() => deleteTask(task.id)}
                  className="p-2 text-[#C4C6D0] hover:text-[#F87171] hover:bg-[#2E3036] rounded-xl transition"
                  title="Delete task"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Floating Action Button (+ Add Task) */}
      <button
        id="fab-add-task-btn"
        onClick={() => setIsAddModalOpen(true)}
        className="absolute bottom-4 right-4 w-14 h-14 rounded-2xl bg-[#D1E1FF] hover:bg-white text-[#003062] flex items-center justify-center shadow-2xl shadow-blue-950/60 transition transform active:scale-95 z-20 font-bold"
        title="Add New Task"
      >
        <Plus className="w-6 h-6 stroke-[2.5]" />
      </button>

      {/* Add Task Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)}>
          <div
            className="bg-[#1D2026] text-[#E2E2E6] border border-[#44474E]/50 rounded-[36px] p-6 shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#44474E]/30">
              <h3 className="font-bold text-base text-[#E2E2E6]">Create Actionable Item</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-[#C4C6D0] hover:text-[#E2E2E6] font-semibold text-sm">✕</button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3.5">
              {/* Task Title */}
              <div>
                <label className="block text-xs font-semibold text-[#C4C6D0] mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g., Test CRM workflow"
                  className="w-full py-2.5 px-3 rounded-2xl bg-[#111318] border border-[#44474E]/40 text-xs text-[#E2E2E6] placeholder-[#C4C6D0]/40 focus:ring-2 focus:ring-[#D1E1FF] focus:outline-none"
                />
              </div>

              {/* Category & Owner Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-[#C4C6D0] mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as TaskCategory)}
                    className="w-full py-2.5 px-3 rounded-2xl bg-[#111318] border border-[#44474E]/40 text-xs text-[#E2E2E6] focus:ring-2 focus:ring-[#D1E1FF] focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>{categoryLabel(c)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#C4C6D0] mb-1">Next Action Owner</label>
                  <select
                    value={newOwner}
                    onChange={(e) => setNewOwner(e.target.value as TaskOwner)}
                    className="w-full py-2.5 px-3 rounded-2xl bg-[#111318] border border-[#44474E]/40 text-xs text-[#E2E2E6] focus:ring-2 focus:ring-[#D1E1FF] focus:outline-none"
                  >
                    {owners.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status & Priority */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-[#C4C6D0] mb-1">Initial Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as TaskStatus)}
                    className="w-full py-2.5 px-3 rounded-2xl bg-[#111318] border border-[#44474E]/40 text-xs text-[#E2E2E6] focus:ring-2 focus:ring-[#D1E1FF] focus:outline-none"
                  >
                    <option value="NEXT">NEXT (Actionable)</option>
                    <option value="ACTIVE">ACTIVE (In Progress)</option>
                    <option value="WAITING">WAITING (Owned by other)</option>
                    <option value="BLOCKED">BLOCKED (Prerequisite)</option>
                    <option value="CAPTURED">CAPTURED (Idea backlog)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#C4C6D0] mb-1">Priority (1-10)</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={newPriority}
                    onChange={(e) => setNewPriority(Number(e.target.value))}
                    className="w-full py-2.5 px-3 rounded-2xl bg-[#111318] border border-[#44474E]/40 text-xs text-[#E2E2E6] focus:ring-2 focus:ring-[#D1E1FF] focus:outline-none"
                  />
                </div>
              </div>

              {/* Dependency & Blocker Inputs */}
              <div>
                <label className="block text-xs font-semibold text-[#C4C6D0] mb-1">
                  Blocked By (Optional Dependency)
                </label>
                <input
                  type="text"
                  value={newBlockedBy}
                  onChange={(e) => setNewBlockedBy(e.target.value)}
                  placeholder="e.g., Implement workflow in CRM (IT_TEAM)"
                  className="w-full py-2.5 px-3 rounded-2xl bg-[#111318] border border-[#44474E]/40 text-xs text-[#E2E2E6] placeholder-[#C4C6D0]/40 focus:ring-2 focus:ring-[#D1E1FF] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#C4C6D0] mb-1">
                  Trigger Event (When this happens, task moves to NEXT)
                </label>
                <input
                  type="text"
                  value={newTrigger}
                  onChange={(e) => setNewTrigger(e.target.value)}
                  placeholder="e.g., IT confirms CRM workflow is live"
                  className="w-full py-2.5 px-3 rounded-2xl bg-[#111318] border border-[#44474E]/40 text-xs text-[#E2E2E6] placeholder-[#C4C6D0]/40 focus:ring-2 focus:ring-[#D1E1FF] focus:outline-none"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full py-3 bg-[#D1E1FF] hover:bg-white text-[#003062] font-bold rounded-2xl text-xs transition shadow-lg mt-3"
              >
                Create Task Record
              </button>
            </form>
          </div>
        </div>
      )}

      <ManageCategoriesModal isOpen={isManageCategoriesOpen} onClose={() => setIsManageCategoriesOpen(false)} />
    </div>
  );
};
