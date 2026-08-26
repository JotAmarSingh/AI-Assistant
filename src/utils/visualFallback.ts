export type LocalVisualKind =
  | 'medicine'
  | 'editing'
  | 'social'
  | 'work'
  | 'fitness'
  | 'meal'
  | 'drink'
  | 'call'
  | 'shopping'
  | 'learning'
  | 'travel'
  | 'rest'
  | 'family'
  | 'location'
  | 'schedule'
  | 'general';

export interface LocalVisualConcept {
  primary: LocalVisualKind;
  secondary?: LocalVisualKind;
  quantityBadge?: string;
  accessibleLabel: string;
}

const RULES: Array<{ kind: LocalVisualKind; pattern: RegExp; label: string }> = [
  { kind: 'medicine', pattern: /\b(medicine|medication|chemist|pharmacy|tablet|capsule|pill|dose|prescription|supplement)\b/i, label: 'medicine' },
  { kind: 'editing', pattern: /\b(edit|editing|editor|reel|video|render|thumbnail|podcast|footage)\b/i, label: 'media editing' },
  { kind: 'social', pattern: /\b(social media|instagram|facebook|youtube|linkedin|post|content|channel|page)\b/i, label: 'social media' },
  { kind: 'fitness', pattern: /\b(gym|push-?ups?|pull-?ups?|yoga|workout|exercise|run|running|walk|fitness|weights?|dumbbells?)\b/i, label: 'fitness' },
  { kind: 'meal', pattern: /\b(breakfast|lunch|dinner|meal|food|chapati|roti|curd|dal|salad|fruit|cook|cooking)\b/i, label: 'food or meal' },
  { kind: 'drink', pattern: /\b(coffee|tea|espresso|water|drink)\b/i, label: 'drink' },
  { kind: 'call', pattern: /\b(call|phone|whatsapp|message|email|reply|contact)\b/i, label: 'communication' },
  { kind: 'shopping', pattern: /\b(buy|purchase|shopping|grocery|groceries|pick\s*up|bring|get from)\b/i, label: 'shopping or pickup' },
  { kind: 'learning', pattern: /\b(read|study|learn|course|book|lesson|class|research)\b/i, label: 'learning' },
  { kind: 'travel', pattern: /\b(travel|drive|car|bike|bus|leave|depart|commute|visit)\b/i, label: 'travel' },
  { kind: 'rest', pattern: /\b(sleep|bed|rest|nap|wake|woke)\b/i, label: 'rest' },
  { kind: 'family', pattern: /\b(family|wife|husband|son|daughter|child|children|kid|baby|mother|father|parent)\b/i, label: 'family' },
  { kind: 'location', pattern: /\b(location|place|desk|home|office|studio|shop)\b/i, label: 'location' },
  { kind: 'schedule', pattern: /\b(remind|reminder|schedule|appointment|calendar|deadline|meeting)\b/i, label: 'schedule' },
  { kind: 'work', pattern: /\b(client|customer|professional|business|project|work|task|job|crm|workflow)\b/i, label: 'work' },
];

export const resolveLocalVisualConcept = (subject: string, context = ''): LocalVisualConcept => {
  const text = `${subject} ${context}`.replace(/\s+/g, ' ').trim();
  const matches = RULES.filter((rule) => rule.pattern.test(text));
  const primary = matches[0] || { kind: 'general' as const, label: 'task' };
  const secondary = matches.find((rule) => rule.kind !== primary.kind);
  const quantities = Array.from(subject.matchAll(/\b\d+\b/g)).slice(0, 2).map((match) => match[0]);

  return {
    primary: primary.kind,
    secondary: secondary?.kind,
    quantityBadge: quantities.length ? quantities.join('•') : undefined,
    accessibleLabel: `Task-specific local ${primary.label} artwork${secondary ? ` with ${secondary.label} context` : ''}`,
  };
};
