import { FixedEvent, ScheduleConflict, TimelineEvent } from '../types';

export const detectScheduleConflicts = (
  newEventTitle: string,
  newEventTime: string, // e.g. "17:00" or "17:00 - 18:00"
  durationMinutes: number = 60,
  existingAnchors: FixedEvent[] = [],
  existingTimeline: TimelineEvent[] = []
): ScheduleConflict => {
  if (!newEventTime || !newEventTime.includes(':')) {
    return { hasConflict: false };
  }

  const [startH, startM] = newEventTime.split(':')[0].split('-')[0].trim().split(':').map(Number);
  if (isNaN(startH)) return { hasConflict: false };

  const newStartMin = startH * 60 + (startM || 0);
  const newEndMin = newStartMin + durationMinutes;

  // Check overlap against existing anchors
  for (const anchor of existingAnchors) {
    if (!anchor.time || !anchor.time.includes(':')) continue;
    const [aH, aM] = anchor.time.split(':').map(Number);
    const anchorStartMin = aH * 60 + (aM || 0);
    const anchorEndMin = anchor.endTime && anchor.endTime.includes(':') 
      ? Number(anchor.endTime.split(':')[0]) * 60 + Number(anchor.endTime.split(':')[1])
      : anchorStartMin + 60;

    // Overlap condition
    if (newStartMin < anchorEndMin && newEndMin > anchorStartMin) {
      // Find next free window of durationMinutes
      const freeWindow = findNextFreeSlot(newEndMin, durationMinutes, existingAnchors);
      return {
        hasConflict: true,
        routineTitle: anchor.title,
        conflictTime: `${anchor.time} - ${toTimeString(anchorEndMin)}`,
        suggestedFreeWindow: freeWindow,
        reason: `New item "${newEventTitle}" conflicts with fixed anchor "${anchor.title}".`
      };
    }
  }

  return { hasConflict: false };
};

const findNextFreeSlot = (
  afterMin: number,
  durationMin: number,
  anchors: FixedEvent[]
): { startTime: string; endTime: string } => {
  let candidateStart = afterMin;
  const dayEnd = 23 * 60; // 11 PM

  while (candidateStart + durationMin <= dayEnd) {
    const candidateEnd = candidateStart + durationMin;
    let conflictFound = false;

    for (const a of anchors) {
      if (!a.time || !a.time.includes(':')) continue;
      const [aH, aM] = a.time.split(':').map(Number);
      const aStart = aH * 60 + (aM || 0);
      const aEnd = a.endTime && a.endTime.includes(':')
        ? Number(a.endTime.split(':')[0]) * 60 + Number(a.endTime.split(':')[1])
        : aStart + 60;

      if (candidateStart < aEnd && candidateEnd > aStart) {
        conflictFound = true;
        candidateStart = aEnd + 15; // move past anchor + 15 min buffer
        break;
      }
    }

    if (!conflictFound) {
      return {
        startTime: toTimeString(candidateStart),
        endTime: toTimeString(candidateEnd)
      };
    }
  }

  // Fallback to evening
  return { startTime: '18:00', endTime: '19:00' };
};

const toTimeString = (minutes: number): string => {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};
