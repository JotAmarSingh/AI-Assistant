/**
 * Detects an unambiguous personal check-in about the present or recent past.
 * These messages belong in Timeline. They are not tasks, reminders, or durable
 * memories merely because the user did not begin with an explicit "log" verb.
 */
export const isDirectActivityCheckInStatement = (text: string): boolean => {
  const lower = text.toLowerCase().trim();
  if (!lower || lower.endsWith('?')) return false;

  const presentStatus = /^(?:i(?:'m| am)\s+(?:still\s+)?(?:at|in|on|inside|outside|ready|resting|sitting|lying|waiting|relaxing|sleeping|awake|working|doing|editing|writing|reviewing|building|developing|travelling|traveling|driving|leaving|heading|eating|drinking|feeling)\b|i\s+(?:feel|felt|reached|arrived|left|returned|came|got|started|stopped|finished|completed|worked|ate|drank|slept|woke)\b)/i.test(lower);
  const completedOrResumed = /^(?:(?:i\s+)?(?:just\s+)?(?:logged|signed|checked)\s+in\b|(?:i\s+)?(?:just\s+)?(?:came|got|reached|arrived|returned|left)\s+(?:back\b|from\b|for\b|to\b|at\b|home\b|office\b|work\b)|(?:i\s+)?(?:just\s+)?(?:resumed|restarted|continued)\b|back\s+(?:from|after|at|in)\b|(?:lunch|break|meeting|call)\s+(?:done|finished|over)\b)/i.test(lower);
  const temporalPersonalUpdate = /^(?:(?:just|now|currently|today|tonight|earlier(?:\s+today)?|last\s+night|this\s+(?:morning|afternoon|evening)|after\s+(?:lunch|break|the\s+meeting))\b[\s,;:-]*)+(?:(?:i|we)\s+(?:am|are|was|were|have|had|reached|arrived|left|returned|came|got|started|stopped|finished|completed|worked|did|made|sent|submitted|ate|drank|slept|woke|feel|felt)\b|(?:reached|arrived|returned|left|working|editing|writing|reviewing|building|developing|travelling|traveling|driving|eating|drinking)\b)/i.test(lower);

  return lower.startsWith('i was')
    || lower.startsWith("i've been")
    || lower.startsWith('i have been')
    || lower.startsWith("i'm working on")
    || lower.startsWith('i am working on')
    || lower.startsWith('just')
    || lower.startsWith('working on')
    || lower.startsWith('driving')
    || presentStatus
    || completedOrResumed
    || temporalPersonalUpdate;
};
