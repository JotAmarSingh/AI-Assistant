import React from 'react';
import {
  Baby,
  Bed,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  Car,
  Clapperboard,
  CloudOff,
  Coffee,
  Dumbbell,
  Laptop,
  MapPin,
  Phone,
  Pill,
  RefreshCw,
  Share2,
  ShoppingBasket,
  Sparkles,
  Utensils,
  type LucideIcon,
} from 'lucide-react';
import { VisualGenerationState } from '../../services/visualAssetService';
import { LocalVisualKind, resolveLocalVisualConcept } from '../../utils/visualFallback';

const ICONS: Record<LocalVisualKind, LucideIcon> = {
  medicine: Pill,
  editing: Clapperboard,
  social: Share2,
  work: BriefcaseBusiness,
  fitness: Dumbbell,
  meal: Utensils,
  drink: Coffee,
  call: Phone,
  shopping: ShoppingBasket,
  learning: BookOpen,
  travel: Car,
  rest: Bed,
  family: Baby,
  location: MapPin,
  schedule: Bell,
  general: Sparkles,
};

const PALETTES: Record<LocalVisualKind, [string, string, string]> = {
  medicine: ['#164e63', '#0f766e', '#a7f3d0'],
  editing: ['#312e81', '#7e22ce', '#e9d5ff'],
  social: ['#1e3a8a', '#0369a1', '#bae6fd'],
  work: ['#1e293b', '#334155', '#fef3c7'],
  fitness: ['#14532d', '#15803d', '#bbf7d0'],
  meal: ['#7c2d12', '#c2410c', '#ffedd5'],
  drink: ['#713f12', '#a16207', '#fef3c7'],
  call: ['#164e63', '#0369a1', '#cffafe'],
  shopping: ['#831843', '#be185d', '#fce7f3'],
  learning: ['#312e81', '#4338ca', '#e0e7ff'],
  travel: ['#0c4a6e', '#0284c7', '#e0f2fe'],
  rest: ['#1e1b4b', '#4338ca', '#ddd6fe'],
  family: ['#881337', '#e11d48', '#ffe4e6'],
  location: ['#134e4a', '#0f766e', '#ccfbf1'],
  schedule: ['#78350f', '#d97706', '#fef3c7'],
  general: ['#164e63', '#6d28d9', '#cffafe'],
};

const statusIcon = (state: VisualGenerationState): LucideIcon | null => {
  if (state === 'GENERATING' || state === 'QUEUED') return RefreshCw;
  if (['OFFLINE', 'IMAGE_ACCESS_REQUIRED', 'RATE_LIMITED', 'MODEL_UNAVAILABLE', 'REQUEST_FAILED', 'NO_API_KEY'].includes(state)) return CloudOff;
  return null;
};

export const TaskVisualFallback: React.FC<{
  subject: string;
  context?: string;
  generationState?: VisualGenerationState;
  className?: string;
}> = ({ subject, context = '', generationState = 'IDLE', className = '' }) => {
  const concept = resolveLocalVisualConcept(subject, context);
  const PrimaryIcon = ICONS[concept.primary] || Laptop;
  const SecondaryIcon = concept.secondary ? ICONS[concept.secondary] : null;
  const StatusIcon = statusIcon(generationState as VisualGenerationState);
  const [from, to, foreground] = PALETTES[concept.primary];

  return (
    <div
      className={`relative flex h-full w-full items-center justify-center overflow-hidden ${className}`}
      style={{ background: `radial-gradient(circle at 30% 20%, ${to}, ${from} 72%)`, color: foreground }}
      role="img"
      aria-label={concept.accessibleLabel}
      title={concept.accessibleLabel}
    >
      <span className="absolute -bottom-3 -right-2 h-10 w-10 rounded-full bg-white/10" />
      <PrimaryIcon className="h-[54%] w-[54%] drop-shadow-[0_2px_4px_rgba(0,0,0,.5)]" strokeWidth={2.1} />
      {SecondaryIcon && (
        <span className="absolute bottom-0.5 right-0.5 flex h-[38%] w-[38%] items-center justify-center rounded-full border border-white/30 bg-slate-950/85">
          <SecondaryIcon className="h-[62%] w-[62%]" strokeWidth={2.2} />
        </span>
      )}
      {concept.quantityBadge && (
        <span className="absolute left-0.5 top-0.5 rounded-md border border-white/25 bg-black/70 px-1 py-0.5 font-mono text-[7px] font-black leading-none text-white">
          {concept.quantityBadge}
        </span>
      )}
      {StatusIcon && (
        <span className="absolute right-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-black/75 text-cyan-200" title="Generated artwork pending">
          <StatusIcon className={`h-2.5 w-2.5 ${generationState === 'GENERATING' ? 'animate-spin' : ''}`} />
        </span>
      )}
    </div>
  );
};
