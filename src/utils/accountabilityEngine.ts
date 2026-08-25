import {
  AccountabilityState,
  ContextTrigger,
  DailyState,
  EnergyLevel,
  InterruptionClassification,
  TaskItem,
} from '../types';

const TERMINAL_STATUSES = new Set(['DONE', 'CANCELLED']);
const ACTIONABLE_STATUSES = new Set(['ACTIVE', 'NEXT', 'CAPTURED', 'SCHEDULED']);
const MAX_LEDGER_ITEMS = 250;

export const isPersistentCommitment = (task: TaskItem): boolean =>
  task.persistent !== false && !TERMINAL_STATUSES.has(task.status);

const parseClockMinutes = (value?: string): number | null => {
  if (!value) return null;
  const match = value.match(/(?:^|\s)([01]?\d|2[0-3]):([0-5]\d)/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

const eventStartMinutes = (value?: string): number | null => {
  if (!value) return null;
  const first = value.split(/[–—-]/)[0]?.trim();
  return parseClockMinutes(first);
};

const taskWords = (value: string): Set<string> => new Set(
  value.toLowerCase().match(/[a-z0-9]+/g)?.filter((word) => word.length > 2) || [],
);

const overlapScore = (left: string, right: string): number => {
  const leftWords = taskWords(left);
  return [...taskWords(right)].filter((word) => leftWords.has(word)).length;
};

export const inferTaskResources = (task: TaskItem): string[] => {
  if (task.requiredResources?.length) return task.requiredResources.map((item) => item.toUpperCase());
  const text = `${task.title} ${task.context || ''} ${task.notes || ''}`.toLowerCase();
  const resources: string[] = [];
  if (/video|reel|premiere|render|edit/.test(text)) resources.push('VIDEO_EDITOR');
  if (/design|photoshop|thumbnail|creative/.test(text)) resources.push('DESIGN_APP');
  if (/call|phone|whatsapp/.test(text)) resources.push('PHONE');
  if (/write|report|email|crm|computer|laptop/.test(text)) resources.push('COMPUTER');
  if (/buy|collect|deliver|visit|pickup|pick up/.test(text)) resources.push('TRAVEL');
  return [...new Set(resources)];
};

export const detectBusyResources = (state: DailyState): Set<string> => {
  const text = `${state.current.activity} ${state.tasks.find((task) => task.id === state.current.focusTaskId)?.title || ''}`.toLowerCase();
  const busy = new Set<string>();
  if (/render(?:ing)?|export(?:ing)?|encoding/.test(text)) busy.add('VIDEO_EDITOR');
  if (/meeting|on a call|phone call/.test(text)) {
    busy.add('PHONE');
    busy.add('ATTENTION');
  }
  if (/driving|travelling|traveling|in transit/.test(text)) {
    busy.add('TRAVEL');
    busy.add('COMPUTER');
  }
  return busy;
};

export const detectImmediateOverride = (input: string): {
  kind: 'HEALTH' | 'FAMILY';
  title: string;
  rationale: string;
} | null => {
  const text = input.toLowerCase();
  if (/\b(hungry|haven'?t eaten|headache|migraine|fever|vomit|unwell|sick|ill|dizzy|exhausted|chest pain|difficulty breathing)\b/.test(text)) {
    return {
      kind: 'HEALTH',
      title: /hungry|haven'?t eaten/.test(text) ? 'Eat and recover before the next work block' : 'Pause work and address your health first',
      rationale: 'A reported health or food need overrides productivity pressure.',
    };
  }
  if (/\b(wife|husband|son|daughter|child|family)\b/.test(text)
    && /\b(urgent|emergency|unwell|sick|hospital|needs? help|hurt|unsafe|pick up now)\b/.test(text)) {
    return {
      kind: 'FAMILY',
      title: 'Handle the urgent family need first',
      rationale: 'A genuine urgent family need overrides the current productivity plan.',
    };
  }
  return null;
};

export const classifyInterruption = (input: string): InterruptionClassification | null => {
  const text = input.toLowerCase();
  if (!/\b(interrupt(?:ed|ion)?|stopped|couldn'?t|could not|delayed|distracted|rain|emergency|unexpected|asked me to|had to leave|came back)\b/.test(text)) return null;
  if (/\b(emergency|unwell|sick|hospital|rain|power cut|internet (?:went|was) down|urgent family|child|son|daughter.*hurt)\b/.test(text)) return 'UNAVOIDABLE';
  if (/\b(game|gaming|codm|bgmi|scroll|social media|procrastinat|random video|reels)\b/.test(text)) return 'AVOIDABLE';
  if (/\b(planned|scheduled|meeting|lunch|meal|appointment)\b/.test(text)) return 'EXPECTED';
  return 'UNEXPECTED';
};

export const detectContextEvent = (input: string): ContextTrigger | null => {
  const text = input.toLowerCase();
  if (/\b(?:leaving|left)\s+(?:the\s+)?(?:desk|workstation)\b/.test(text)) return 'LEAVING_DESK';
  if (/\b(?:render|rendering|export|encoding)\s+(?:has\s+)?(?:start(?:s|ed)?|begun|is running|initiated)\b|\bstarted\s+(?:the\s+)?render/.test(text)) return 'RENDERING_STARTED';
  if (/\b(?:render|rendering|export|encoding)\s+(?:has\s+)?(?:finish(?:es|ed)?|complete(?:s|d)?|done)\b/.test(text)) return 'RENDERING_FINISHED';
  if (/\b(?:finished|done with|leaving)\s+(?:the\s+)?(?:work|office work)\b|\bwork\s+(?:is\s+)?(?:finished|done)\b/.test(text)) return 'WORK_FINISHED';
  if (/\b(lunch|lunch break|lunch window)\b/.test(text)) return 'LUNCH_WINDOW';
  if (/\bclient\b.*\b(?:due|deadline)\b.*\btonight\b|\bdue tonight\b.*\bclient\b/.test(text)) return 'CLIENT_DUE_TONIGHT';
  return null;
};

const energyPenalty = (task: TaskItem, energy: EnergyLevel): number => {
  const minutes = task.estimatedMinutes || 30;
  if ((energy === 'TIRED' || energy === 'LOW_ENERGY' || energy === 'EMOTIONAL') && minutes > 45) return -22;
  if (energy === 'HIGH_FOCUS' && minutes >= 45) return 10;
  if (energy === 'RUSHED' && minutes <= 20) return 12;
  return 0;
};

export const scoreTaskForNextAction = (
  task: TaskItem,
  state: DailyState,
  now = new Date(),
  availableMinutes?: number,
): { score: number; reasons: string[]; unavailableReason?: string } => {
  if (!ACTIONABLE_STATUSES.has(task.status) || task.owner !== 'ME') {
    return { score: Number.NEGATIVE_INFINITY, reasons: [], unavailableReason: 'Not currently actionable by the user' };
  }
  if (task.postponedUntil && Date.parse(task.postponedUntil) > now.getTime()) {
    return { score: Number.NEGATIVE_INFINITY, reasons: [], unavailableReason: 'Deliberately postponed' };
  }
  const busy = detectBusyResources(state);
  const required = inferTaskResources(task);
  const blockedResource = required.find((resource) => busy.has(resource));
  const isCurrentTask = task.id === state.current.focusTaskId || task.status === 'ACTIVE';
  if (blockedResource && !isCurrentTask) {
    return { score: Number.NEGATIVE_INFINITY, reasons: [], unavailableReason: `${blockedResource} is currently busy` };
  }

  let score = (task.priority || 5) * 10;
  const reasons = [`priority ${task.priority || 5}`];
  if (isCurrentTask) {
    score += 55;
    reasons.push('protect active focus');
  }
  if (task.commitmentLevel === 'CRITICAL') {
    score += 35;
    reasons.push('critical commitment');
  } else if (task.commitmentLevel === 'IMPORTANT') {
    score += 15;
    reasons.push('important commitment');
  }
  if ((task.carryForwardCount || 0) > 0) {
    score += Math.min(24, (task.carryForwardCount || 0) * 6);
    reasons.push(`carried ${task.carryForwardCount} day${task.carryForwardCount === 1 ? '' : 's'}`);
  }
  const deadline = task.dueAt || task.scheduledAt;
  if (deadline) {
    const until = Date.parse(deadline) - now.getTime();
    if (Number.isFinite(until)) {
      if (until <= 0) {
        score += 65;
        reasons.push('overdue');
      } else if (until <= 2 * 60 * 60 * 1000) {
        score += 50;
        reasons.push('due within two hours');
      } else if (until <= 24 * 60 * 60 * 1000) {
        score += 28;
        reasons.push('due today');
      }
    }
  }
  if (task.location && task.location !== 'ANY') {
    if (task.location.toLowerCase() === state.current.location.toLowerCase()) {
      score += 14;
      reasons.push(`fits ${state.current.location}`);
    } else {
      score -= 12;
    }
  }
  if (availableMinutes && task.estimatedMinutes) {
    if (task.estimatedMinutes <= availableMinutes) {
      score += 14;
      reasons.push(`fits ${availableMinutes} minutes`);
    } else {
      score -= 35;
    }
  }
  score += energyPenalty(task, state.current.energy);
  return { score, reasons };
};

export const selectNextBestAction = (
  state: DailyState,
  options: { now?: Date; availableMinutes?: number; input?: string } = {},
): DailyState['nextBestAction'] => {
  const override = options.input ? detectImmediateOverride(options.input) : null;
  if (override) {
    return {
      taskId: null,
      title: override.title,
      rationale: override.rationale,
      category: override.kind === 'HEALTH' ? 'HEALTH' : 'HOME',
      urgencyReason: `${override.kind} override`,
    };
  }
  const ranked = state.tasks
    .map((task) => ({ task, ...scoreTaskForNextAction(task, state, options.now, options.availableMinutes) }))
    .filter((item) => Number.isFinite(item.score))
    .sort((left, right) => right.score - left.score);
  const selected = ranked[0];
  if (!selected) return null;
  return {
    taskId: selected.task.id,
    title: selected.task.title,
    rationale: selected.reasons.slice(0, 3).join(' • '),
    category: selected.task.category,
    estimatedMinutes: selected.task.estimatedMinutes,
    urgencyReason: selected.reasons.find((reason) => /overdue|due|critical/.test(reason)),
    secondaryRecommendations: ranked.slice(1, 3).map((item) => item.task.title),
  };
};

export const buildPlannedVsActual = (state: DailyState): AccountabilityState['plannedVsActual'] =>
  (state.timetable || []).map((slot) => {
    const actual = [...(state.timeline || [])]
      .filter((event) => overlapScore(slot.title, event.description) > 0)
      .sort((left, right) => (eventStartMinutes(left.startTime || left.time) || 0) - (eventStartMinutes(right.startTime || right.time) || 0))[0];
    const plannedStart = parseClockMinutes(slot.startTime);
    const actualStart = eventStartMinutes(actual?.startTime || actual?.time);
    const varianceMinutes = plannedStart !== null && actualStart !== null ? actualStart - plannedStart : undefined;
    return {
      id: `plan-${state.date}-${slot.id}`,
      date: state.date,
      title: slot.title,
      plannedStart: slot.startTime,
      plannedEnd: slot.endTime,
      actualStart: actual?.startTime || (actual ? actual.time.split(/[–—-]/)[0]?.trim() : undefined),
      actualEnd: actual?.endTime || (actual?.time.includes('–') ? actual.time.split('–')[1]?.trim() : undefined),
      varianceMinutes,
      status: slot.status === 'COMPLETED' || actual?.type === 'TASK_COMPLETED'
        ? 'COMPLETED' as const
        : slot.status === 'ACTIVE' || actual
          ? 'IN_PROGRESS' as const
          : slot.status === 'SKIPPED'
            ? 'MISSED' as const
            : 'PENDING' as const,
    };
  });

export const analyzeAccountabilityHabits = (states: DailyState[]): string[] => {
  if (!states.length) return [];
  const signals = states.flatMap((state) => state.accountability?.habitSignals || []);
  const interruptions = states.flatMap((state) => state.timeline || []).filter((event) => event.type === 'INTERRUPTION');
  const avoidable = interruptions.filter((event) => event.classification === 'AVOIDABLE').length;
  const unavoidable = interruptions.filter((event) => event.classification === 'UNAVOIDABLE').length;
  const completions = states.flatMap((state) => state.tasks || []).filter((task) => task.status === 'DONE').length;
  const tiredDays = states.filter((state) => ['TIRED', 'LOW_ENERGY', 'EMOTIONAL'].includes(state.current.energy)).length;
  const carried = states.flatMap((state) => state.tasks || []).filter((task) => (task.carryForwardCount || 0) > 0).length;
  const contextSwitches = signals.filter((signal) => signal.type === 'FOCUS_SWITCH').length;
  const resourceConflicts = signals.filter((signal) => signal.type === 'RESOURCE_CONSTRAINT').length;
  const insights: string[] = [];
  if (avoidable + unavoidable > 0) insights.push(`${avoidable} avoidable and ${unavoidable} unavoidable interruption${avoidable + unavoidable === 1 ? '' : 's'} recorded.`);
  if (tiredDays > 0) insights.push(`Low energy was recorded on ${tiredDays} of ${states.length} reviewed day${states.length === 1 ? '' : 's'}; compare this with sleep and meal timing before changing workload.`);
  if (carried > 0) insights.push(`${carried} commitment${carried === 1 ? '' : 's'} carried forward; review scope, timing or required resources.`);
  if (contextSwitches > 0) insights.push(`${contextSwitches} attempted context switch${contextSwitches === 1 ? '' : 'es'} captured while another focus task was active.`);
  if (resourceConflicts > 0) insights.push(`${resourceConflicts} resource conflict${resourceConflicts === 1 ? '' : 's'} detected; recommendations avoided the busy tool.`);
  if (signals.filter((signal) => signal.type === 'HEALTH_OVERRIDE').length > 0) insights.push('Health or food overrides occurred; DayTrace correctly stopped productivity pressure during those reports.');
  insights.push(`${completions} completed task record${completions === 1 ? '' : 's'} across the reviewed period.`);
  return insights.slice(0, 5);
};

export const recalculateAccountabilityState = (
  state: DailyState,
  options: { input?: string; at?: string; interruption?: InterruptionClassification | null } = {},
): DailyState => {
  const at = options.at || new Date().toISOString();
  const existing = state.accountability || { corrections: [], carryForwardHistory: [], habitSignals: [], plannedVsActual: [] };
  const signals = [...existing.habitSignals];
  const override = options.input ? detectImmediateOverride(options.input) : null;
  if (override) signals.push({ id: `signal-${Date.now()}-health`, at, type: 'HEALTH_OVERRIDE', value: override.rationale });
  if (options.interruption) signals.push({
    id: `signal-${Date.now()}-interrupt`,
    at,
    type: 'INTERRUPTION',
    value: options.input || 'Interruption reported',
    classification: options.interruption,
  });
  if (options.input && /\b(?:render|export|encoding)\b.*\b(?:started|running|finished|completed|done)\b/i.test(options.input)) {
    signals.push({ id: `signal-${Date.now()}-resource`, at, type: 'RESOURCE_CONSTRAINT', value: options.input });
  }
  if (options.input && state.current.focusTaskId && /^(?:add|create|start|working on|i (?:am )?working on)\b/i.test(options.input)) {
    signals.push({ id: `signal-${Date.now()}-switch`, at, type: 'FOCUS_SWITCH', value: options.input });
  }
  if (options.input && /\b(?:finished|completed|done|submitted|published)\b/i.test(options.input)) {
    signals.push({ id: `signal-${Date.now()}-complete`, at, type: 'COMPLETION', value: options.input });
  }
  if (options.input && /\b(?:tired|exhausted|drained|low energy|high focus|distracted|rushed)\b/i.test(options.input)) {
    signals.push({ id: `signal-${Date.now()}-energy`, at, type: 'ENERGY', value: state.current.energy });
  }
  const nextState = {
    ...state,
    accountability: {
      ...existing,
      habitSignals: signals.slice(-MAX_LEDGER_ITEMS),
      plannedVsActual: buildPlannedVsActual(state),
      lastRecalculatedAt: at,
    },
  };
  return { ...nextState, nextBestAction: selectNextBestAction(nextState, { input: options.input }) };
};

export const conciseAccountabilityReply = (
  changed: string[],
  nextAction: DailyState['nextBestAction'],
): string => {
  const unique = [...new Set(changed.map((item) => item.trim()).filter(Boolean))];
  const lines = unique.slice(0, 5).map((item) => `• ${item.replace(/[.]+$/, '')}`);
  if (nextAction) lines.push(`Next: ${nextAction.title}${nextAction.rationale ? ` — ${nextAction.rationale}` : ''}`);
  return lines.length ? lines.join('\n') : 'No DayTrace data changed.';
};
