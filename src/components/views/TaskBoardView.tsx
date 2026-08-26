import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, Check, CheckCircle2, ChevronDown, ChevronUp, Edit3, Gift,
  Image as ImageIcon, Inbox, Lock, Map as MapIcon, Play, Plus, Settings2, Trash2, X,
} from 'lucide-react';
import { useDay } from '../../context/DayContext';
import { TaskCategoryDefinition, TaskItem } from '../../types';
import { resolveCategoryIslandIcon, resolveContextualIcon } from '../../services/geminiService';
import { useGeneratedVisual } from '../../hooks/useGeneratedVisual';
import { ManageCategoriesModal } from '../tasks/ManageCategoriesModal';
import { UNCATEGORISED_CATEGORY_ID } from '../../utils/initialState';

interface IslandData {
  category: TaskCategoryDefinition;
  tasks: TaskItem[];
  done: number;
  progress: number;
}

const potentialXp = (task: TaskItem) => task.priority >= 8 ? 120 : task.priority <= 3 ? 30 : 60;

const IslandArtwork: React.FC<{ island: IslandData; large?: boolean }> = ({ island, large }) => {
  const { imageUrl, isGenerating } = useGeneratedVisual('CATEGORY_ISLAND', island.category.label, island.tasks.map((task) => task.title));
  return (
    <div className={`daytrace-island-art ${large ? 'h-36 w-48' : 'h-28 w-36'}`} style={{ '--island-color': island.category.color } as React.CSSProperties}>
      <div className="daytrace-island-aura" />
      {imageUrl ? <img src={imageUrl} alt="" className="relative z-10 h-full w-full object-contain drop-shadow-[0_18px_18px_rgba(0,0,0,.55)]" /> : (
        <div className="relative z-10 flex h-full w-full flex-col items-center justify-center">
          <span className={`text-5xl ${isGenerating ? 'animate-pulse' : ''}`}>{resolveCategoryIslandIcon(island.category.label)}</span>
          <span className="mt-1 h-7 w-24 rounded-[50%] bg-gradient-to-b from-emerald-600 to-slate-950 shadow-[0_12px_16px_rgba(0,0,0,.65)]" />
          {isGenerating && <ImageIcon className="absolute right-2 top-2 h-3.5 w-3.5 animate-pulse text-cyan-300" />}
        </div>
      )}
    </div>
  );
};

const TaskSticker: React.FC<{ task: TaskItem; categoryLabel: string }> = ({ task, categoryLabel }) => {
  const { imageUrl, isGenerating } = useGeneratedVisual('TASK_STICKER', task.title, [categoryLabel]);
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-cyan-300/25 bg-[#060b18]">
      {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-contain p-1" /> : <span className={`text-xl ${isGenerating ? 'animate-pulse' : ''}`}>{resolveContextualIcon(task.title, categoryLabel)}</span>}
    </div>
  );
};

export const TaskBoardView: React.FC = () => {
  const { state, updateTaskStatus, addTask, editTask, deleteTask, taskCategories, claimMilestone } = useDay();
  const [activeIslandId, setActiveIslandId] = useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState(UNCATEGORISED_CATEGORY_ID);
  const [newPriority, setNewPriority] = useState(5);
  const [newDueAt, setNewDueAt] = useState('');
  const allTasks = state.tasks || [];

  const categories = useMemo(() => {
    const byId = new Map(taskCategories.map((category) => [category.id, category]));
    allTasks.forEach((task) => {
      if (byId.has(task.category)) return;
      const now = new Date().toISOString();
      byId.set(task.category, {
        id: task.category,
        label: task.category.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
        color: '#22D3EE', icon: 'sparkles', createdAt: now, updatedAt: now,
      });
    });
    return Array.from(byId.values());
  }, [allTasks, taskCategories]);

  const islands = useMemo<IslandData[]>(() => categories.map((category) => {
    const tasks = allTasks.filter((task) => task.category === category.id);
    const done = tasks.filter((task) => task.status === 'DONE').length;
    return { category, tasks, done, progress: tasks.length ? Math.round((done / tasks.length) * 100) : 0 };
  }).filter((island) => island.tasks.length > 0 || !island.category.isSystem), [allTasks, categories]);
  const activeIsland = islands.find((island) => island.category.id === activeIslandId) || null;
  const totalDone = allTasks.filter((task) => task.status === 'DONE').length;
  const overallProgress = allTasks.length ? Math.round((totalDone / allTasks.length) * 100) : 0;

  useEffect(() => { if (activeIslandId && !activeIsland) setActiveIslandId(null); }, [activeIsland, activeIslandId]);
  useEffect(() => { if (!categories.some((item) => item.id === newCategory)) setNewCategory(categories[0]?.id || UNCATEGORISED_CATEGORY_ID); }, [categories, newCategory]);

  const createTask = (event: React.FormEvent) => {
    event.preventDefault();
    if (!newTitle.trim()) return;
    addTask({
      title: newTitle.trim(), category: newCategory, owner: 'ME', status: 'NEXT', priority: newPriority,
      ...(newDueAt ? { dueAt: new Date(newDueAt).toISOString(), scheduledAt: new Date(newDueAt).toISOString() } : {}),
    });
    setNewTitle(''); setNewDueAt(''); setIsAddOpen(false);
  };

  const updateChecklist = (task: TaskItem, checklistId: string) => {
    const checklist = (task.checklist || []).map((item) => item.id === checklistId ? { ...item, isDone: !item.isDone } : item);
    editTask(task.id, { checklist });
    if (checklist.length && checklist.every((item) => item.isDone) && task.status !== 'DONE') updateTaskStatus(task.id, 'DONE');
  };

  const sortedTasks = activeIsland ? [...activeIsland.tasks].sort((left, right) => {
    if (left.status === 'DONE' && right.status !== 'DONE') return 1;
    if (right.status === 'DONE' && left.status !== 'DONE') return -1;
    return right.priority - left.priority;
  }) : [];
  const rewardId = activeIsland ? `island:${activeIsland.category.id}:${activeIsland.tasks.map((task) => task.id).sort().join('.')}` : '';
  const rewardClaimed = !!rewardId && (state.gamification?.milestoneClaims || []).some((claim) => claim.id === rewardId);
  const rewardReady = !!activeIsland && activeIsland.tasks.length > 0 && activeIsland.done === activeIsland.tasks.length && !rewardClaimed;

  return (
    <div id="task-board-view" className="daytrace-scene flex h-full flex-1 flex-col overflow-hidden text-slate-100">
      <header className="z-20 flex shrink-0 items-center justify-between border-b border-cyan-300/20 bg-[#050918]/90 px-4 py-3 backdrop-blur-xl">
        {activeIsland ? <button id="island-back-btn" type="button" onClick={() => setActiveIslandId(null)} className="flex min-w-0 items-center gap-2 text-left"><ArrowLeft className="h-5 w-5 text-cyan-300" /><div className="min-w-0"><h2 className="truncate text-sm font-black">{activeIsland.category.label}</h2><p className="text-[10px] text-slate-400">Category Island</p></div></button> : <div><h2 className="text-base font-black">Task Islands</h2><p className="text-[10px] text-slate-400">Your categories grow from real tasks</p></div>}
        <div className="flex gap-2">
          <button id="manage-categories-btn" type="button" onClick={() => setIsManageOpen(true)} className="flex items-center gap-1.5 rounded-xl border border-cyan-300/25 bg-slate-900/70 px-3 py-2 text-[10px] font-bold text-cyan-200" aria-label="Add or manage categories"><Settings2 className="h-4 w-4" /><span>Categories</span></button>
          <button id="add-task-btn" type="button" onClick={() => setIsAddOpen(true)} className="rounded-xl bg-cyan-300 p-2 text-slate-950 shadow-[0_0_18px_rgba(34,211,238,.45)]" aria-label="Add task"><Plus className="h-4 w-4" /></button>
        </div>
      </header>

      <div className="relative flex-1 overflow-y-auto overscroll-contain px-4 pb-8 pt-4">
        <div className="daytrace-water pointer-events-none absolute inset-0 opacity-60" />
        {activeIsland ? (
          <div className="relative z-10 mx-auto max-w-lg space-y-4">
            <section className="rounded-[30px] border border-cyan-300/25 bg-slate-950/70 p-4 backdrop-blur-xl">
              <div className="flex items-center gap-3"><IslandArtwork island={activeIsland} large /><div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-cyan-300">Island progress</p><h3 className="mt-1 truncate text-lg font-black">{activeIsland.category.label}</h3><p className="mt-1 text-xs text-slate-300">{activeIsland.done}/{activeIsland.tasks.length} tasks done</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${activeIsland.progress}%` }} /></div><p className="mt-1 text-right font-mono text-xs font-black text-cyan-300">{activeIsland.progress}%</p></div></div>
            </section>
            {sortedTasks.length === 0 ? <section className="rounded-[28px] border border-dashed border-cyan-300/25 bg-slate-950/60 p-8 text-center"><Inbox className="mx-auto h-9 w-9 text-cyan-300/60" /><h3 className="mt-3 text-sm font-bold">This island has no tasks</h3><button type="button" onClick={() => { setNewCategory(activeIsland.category.id); setIsAddOpen(true); }} className="mt-4 rounded-2xl bg-cyan-300 px-4 py-2.5 text-xs font-black text-slate-950">Add a task</button></section> : (
              <section className="relative space-y-3 pl-7"><div className="absolute bottom-4 left-3 top-4 w-px bg-gradient-to-b from-emerald-400 via-violet-400 to-amber-300 shadow-[0_0_10px_#22d3ee]" />
                {sortedTasks.map((task) => {
                  const expanded = expandedTaskId === task.id; const done = task.status === 'DONE'; const active = task.status === 'ACTIVE'; const blocked = task.status === 'BLOCKED';
                  return <article key={task.id} className={`relative rounded-[24px] border p-3.5 backdrop-blur-xl ${active ? 'border-violet-400 bg-violet-950/50' : done ? 'border-emerald-400/35 bg-emerald-950/35' : 'border-cyan-300/20 bg-slate-950/75'}`}>
                    <div className={`absolute -left-8 top-5 flex h-7 w-7 items-center justify-center rounded-full border-2 ${done ? 'border-emerald-300 bg-emerald-400 text-slate-950' : active ? 'animate-pulse border-violet-300 bg-violet-500' : blocked ? 'border-rose-300 bg-slate-950 text-rose-300' : 'border-amber-300 bg-slate-950 text-amber-300'}`}>{done ? <Check className="h-4 w-4" /> : blocked ? <Lock className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-current" />}</div>
                    <button id={`task-card-${task.id}`} type="button" onClick={() => setExpandedTaskId(expanded ? null : task.id)} className="flex w-full items-center gap-3 text-left" aria-expanded={expanded}><TaskSticker task={task} categoryLabel={activeIsland.category.label} /><div className="min-w-0 flex-1"><h4 className={`text-sm font-bold ${done ? 'text-slate-400 line-through' : 'text-white'}`}>{task.title}</h4><p className="mt-0.5 text-[10px] uppercase text-slate-400">{task.status}{task.dueAt ? ` • ${new Date(task.dueAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}</p></div><div className="shrink-0 text-right"><span className="block text-[10px] font-black text-amber-300">{task.xpAwardedAt ? `${task.xpAwarded || potentialXp(task)} XP` : `+${potentialXp(task)} XP`}</span>{expanded ? <ChevronUp className="ml-auto mt-1 h-4 w-4 text-cyan-300" /> : <ChevronDown className="ml-auto mt-1 h-4 w-4 text-slate-500" />}</div></button>
                    {expanded && <div className="mt-3 space-y-3 border-t border-cyan-300/15 pt-3">{(task.checklist || []).length > 0 && <div className="space-y-2 rounded-2xl bg-slate-950/60 p-3">{task.checklist!.map((item) => <label key={item.id} className="flex cursor-pointer items-start gap-2 text-xs text-slate-300"><input type="checkbox" checked={item.isDone} onChange={() => updateChecklist(task, item.id)} className="mt-0.5 accent-cyan-300" /><span className={item.isDone ? 'line-through opacity-60' : ''}>{item.text}</span></label>)}</div>}{task.notes && <p className="rounded-xl bg-slate-900/70 p-2.5 text-xs text-slate-300">{task.notes}</p>}<div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><button type="button" onClick={() => updateTaskStatus(task.id, active ? 'NEXT' : 'ACTIVE')} className="task-action text-violet-200"><Play className="h-3.5 w-3.5" />{active ? 'Pause' : 'Start'}</button><button type="button" onClick={() => updateTaskStatus(task.id, done ? 'NEXT' : 'DONE')} className="task-action text-emerald-200"><CheckCircle2 className="h-3.5 w-3.5" />{done ? 'Reopen' : 'Complete'}</button><button type="button" onClick={() => setEditingTask(task)} className="task-action text-cyan-200"><Edit3 className="h-3.5 w-3.5" />Edit</button><button type="button" onClick={() => deleteTask(task.id)} className="task-action text-rose-200"><Trash2 className="h-3.5 w-3.5" />Delete</button></div></div>}
                  </article>;
                })}
              </section>
            )}
            <section className={`rounded-[28px] border p-4 backdrop-blur-xl ${rewardReady ? 'border-amber-300/55 bg-amber-950/35' : 'border-slate-700 bg-slate-950/70'}`}><div className="flex items-center gap-3"><div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${rewardReady ? 'bg-amber-300/15 text-amber-300' : 'bg-slate-900 text-slate-500'}`}>{rewardClaimed ? <CheckCircle2 className="h-7 w-7" /> : rewardReady ? <Gift className="h-8 w-8 animate-pulse" /> : <Lock className="h-6 w-6" />}</div><div className="min-w-0 flex-1"><h3 className="text-sm font-black">Island Reward</h3><p className="text-[11px] text-slate-400">{rewardClaimed ? 'Reward claimed for this task set.' : rewardReady ? 'All current island tasks are complete.' : 'Complete every task on this island to unlock it.'}</p></div><button type="button" disabled={!rewardReady} onClick={() => claimMilestone(rewardId, `${activeIsland.category.label} Island complete`, 200)} className="rounded-2xl bg-amber-300 px-3 py-2 text-xs font-black text-slate-950 disabled:bg-slate-800 disabled:text-slate-500">{rewardClaimed ? 'Claimed' : '+200 XP'}</button></div></section>
          </div>
        ) : (
          <div className="relative z-10 mx-auto max-w-lg space-y-5">
            <section className="flex items-center justify-between rounded-[28px] border border-cyan-300/20 bg-slate-950/70 p-4"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-slate-400">Overall progress</p><p className="mt-1 text-2xl font-black">{totalDone}<span className="text-sm text-slate-400">/{allTasks.length}</span></p></div><div className="flex h-16 w-16 items-center justify-center rounded-full border-[5px] border-cyan-300/60 bg-slate-950"><span className="text-sm font-black text-cyan-300">{overallProgress}%</span></div><div className="text-right"><p className="text-[10px] text-slate-400">XP earned</p><p className="text-lg font-black text-amber-300">{state.gamification?.points || 0}</p></div></section>
            {islands.length === 0 ? <section className="flex min-h-[420px] flex-col items-center justify-center rounded-[34px] border border-dashed border-cyan-300/25 bg-slate-950/45 p-7 text-center"><MapIcon className="h-14 w-14 text-cyan-300" /><h3 className="mt-5 text-base font-black">Your task world is empty</h3><p className="mt-2 max-w-xs text-xs leading-relaxed text-slate-400">Add your first real task. DayTrace will create its category island without blocking the task.</p><button type="button" onClick={() => setIsAddOpen(true)} className="mt-5 flex items-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-xs font-black text-slate-950"><Plus className="h-4 w-4" />Add first task</button></section> : <section className="grid grid-cols-2 gap-x-3 gap-y-6 pb-8">{islands.map((island, index) => <button id={`category-island-${island.category.id}`} key={island.category.id} type="button" onClick={() => setActiveIslandId(island.category.id)} className={`daytrace-island-card flex min-h-52 flex-col items-center justify-end rounded-[30px] border border-cyan-300/15 bg-slate-950/45 p-3 text-center ${index % 2 ? 'translate-y-8' : ''}`}><IslandArtwork island={island} /><div className="relative z-10 -mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/85 px-3 py-2"><h3 className="truncate text-sm font-black">{island.category.label}</h3><p className="text-[10px] text-slate-400">{island.tasks.length} task{island.tasks.length === 1 ? '' : 's'} • {island.progress}%</p></div></button>)}</section>}
          </div>
        )}
      </div>

      {isAddOpen && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 p-3 sm:items-center" onClick={() => setIsAddOpen(false)}><form onSubmit={createTask} onClick={(event) => event.stopPropagation()} className="w-full max-w-md space-y-4 rounded-[30px] border border-cyan-300/25 bg-[#090e1d] p-5"><div className="flex items-center justify-between"><div><h3 className="font-black">Add task</h3><p className="text-[10px] text-slate-400">Artwork generates in the background when online.</p></div><button type="button" onClick={() => setIsAddOpen(false)}><X className="h-5 w-5" /></button></div><label className="form-label">Task name<input autoFocus value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Task name" className="form-control" /></label><label className="form-label">Category<div className="mt-1 flex gap-2"><select value={newCategory} onChange={(event) => setNewCategory(event.target.value)} className="form-control min-w-0 flex-1">{categories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><button type="button" onClick={() => setIsManageOpen(true)} className="shrink-0 rounded-xl border border-cyan-300/35 bg-cyan-300/10 px-3 text-[10px] font-black text-cyan-200"><Plus className="mx-auto h-4 w-4" />New</button></div></label><div className="grid grid-cols-2 gap-3"><label className="form-label">Priority<select value={newPriority} onChange={(event) => setNewPriority(Number(event.target.value))} className="form-control"><option value={3}>Low</option><option value={5}>Normal</option><option value={9}>High</option></select></label><label className="form-label">Due and reminder<input type="datetime-local" value={newDueAt} onChange={(event) => setNewDueAt(event.target.value)} className="form-control text-xs" /></label></div><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setIsAddOpen(false)} className="rounded-2xl bg-slate-800 py-3 text-xs font-bold">Cancel</button><button type="submit" disabled={!newTitle.trim()} className="rounded-2xl bg-cyan-300 py-3 text-xs font-black text-slate-950 disabled:opacity-40">Create task</button></div></form></div>}
      {editingTask && <TaskEditSheet task={editingTask} categories={categories} onClose={() => setEditingTask(null)} onSave={(updates) => { editTask(editingTask.id, updates); setEditingTask(null); }} />}
      <ManageCategoriesModal isOpen={isManageOpen} onClose={() => setIsManageOpen(false)} />
    </div>
  );
};

const TaskEditSheet: React.FC<{ task: TaskItem; categories: TaskCategoryDefinition[]; onClose: () => void; onSave: (updates: Partial<TaskItem>) => void }> = ({ task, categories, onClose, onSave }) => {
  const [title, setTitle] = useState(task.title); const [category, setCategory] = useState(task.category); const [priority, setPriority] = useState(task.priority); const [notes, setNotes] = useState(task.notes || ''); const [checklist, setChecklist] = useState(task.checklist || []); const [newItem, setNewItem] = useState('');
  const [dueAt, setDueAt] = useState(task.dueAt && Number.isFinite(Date.parse(task.dueAt)) ? new Date(task.dueAt).toISOString().slice(0, 16) : '');
  return <div className="fixed inset-0 z-[105] flex items-end justify-center bg-black/85 p-3 sm:items-center" onClick={onClose}><form onSubmit={(event) => { event.preventDefault(); if (title.trim()) onSave({ title: title.trim(), category, priority, notes: notes.trim() || undefined, checklist, ...(dueAt ? { dueAt: new Date(dueAt).toISOString(), scheduledAt: new Date(dueAt).toISOString() } : { dueAt: undefined, scheduledAt: undefined }) }); }} onClick={(event) => event.stopPropagation()} className="max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto rounded-[30px] border border-cyan-300/25 bg-[#090e1d] p-5"><div className="flex justify-between"><h3 className="font-black">Edit task</h3><button type="button" onClick={onClose}><X className="h-5 w-5" /></button></div><label className="form-label">Title<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} className="form-control" /></label><div className="grid grid-cols-2 gap-2"><label className="form-label">Category<select value={category} onChange={(event) => setCategory(event.target.value)} className="form-control">{categories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="form-label">Priority<input type="range" min="1" max="10" value={priority} onChange={(event) => setPriority(Number(event.target.value))} className="mt-4 w-full accent-cyan-300" /><span className="block text-center text-xs text-cyan-300">{priority}/10</span></label></div><label className="form-label">Due and reminder<input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="form-control" /></label><label className="form-label">Notes<textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} className="form-control" /></label><div className="rounded-2xl border border-cyan-300/15 bg-slate-950/60 p-3"><p className="form-label">Checklist</p><div className="mt-2 space-y-2">{checklist.map((item) => <div key={item.id} className="flex items-center gap-2"><button type="button" onClick={() => setChecklist((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, isDone: !candidate.isDone } : candidate))} className={`flex h-6 w-6 items-center justify-center rounded-lg border ${item.isDone ? 'border-emerald-300 bg-emerald-300 text-slate-950' : 'border-slate-600'}`}>{item.isDone && <Check className="h-3.5 w-3.5" />}</button><span className={`min-w-0 flex-1 text-xs ${item.isDone ? 'line-through opacity-60' : ''}`}>{item.text}</span><button type="button" onClick={() => setChecklist((current) => current.filter((candidate) => candidate.id !== item.id))} className="text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div><div className="mt-2 flex gap-2"><input value={newItem} onChange={(event) => setNewItem(event.target.value)} placeholder="Checklist item" className="form-control min-w-0 flex-1" /><button type="button" onClick={() => { if (!newItem.trim()) return; setChecklist((current) => [...current, { id: `check-${Date.now()}`, text: newItem.trim(), isDone: false }]); setNewItem(''); }} className="rounded-xl bg-cyan-300 px-3 text-slate-950"><Plus className="h-4 w-4" /></button></div></div><div className="grid grid-cols-2 gap-2"><button type="button" onClick={onClose} className="rounded-2xl bg-slate-800 py-3 text-xs font-bold">Cancel</button><button type="submit" disabled={!title.trim()} className="rounded-2xl bg-cyan-300 py-3 text-xs font-black text-slate-950">Save changes</button></div></form></div>;
};
