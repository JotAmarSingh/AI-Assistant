import React from 'react';
import { motion } from 'framer-motion';
import { 
  ShoppingBag, 
  CheckSquare, 
  AlertTriangle, 
  Brain, 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  Sparkles,
  ArrowRight,
  Trash2
} from 'lucide-react';
import { SmartAICard } from '../../types';

interface SmartAICardViewProps {
  card: SmartAICard;
  onConfirmReschedule?: (cardId: string, routineTitle: string, freeSlot: { startTime: string; endTime: string }) => void;
  onAddRoadmapTasks?: (cardId: string, steps: { title: string; estimatedMinutes?: number }[]) => void;
  onDeleteMemory?: (memoryId: string) => void;
  onDismissCard?: (cardId: string) => void;
  onSelectFollowUp?: (question: string) => void;
}

export const SmartAICardView: React.FC<SmartAICardViewProps> = ({
  card,
  onConfirmReschedule,
  onAddRoadmapTasks,
  onDeleteMemory,
  onDismissCard,
  onSelectFollowUp
}) => {
  const { type, title, subtitle, data } = card;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      className="w-full rounded-[28px] bg-[#0D1527] border border-[#00F0FF]/40 p-4 shadow-[0_0_25px_rgba(0,240,255,0.12)] space-y-3 relative overflow-hidden"
    >
      {/* Top Ambient Glow */}
      <div className="absolute -top-12 -right-12 w-24 h-24 bg-[#00F0FF]/15 rounded-full blur-2xl pointer-events-none" />

      {/* Card Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className={`p-2 rounded-xl ${
            type === 'PRICE_COMPARISON' ? 'bg-[#00F0FF]/20 text-[#00F0FF]' :
            type === 'MULTI_STEP_ROADMAP' ? 'bg-[#0088FF]/20 text-[#0088FF]' :
            type === 'CONFLICT_WARNING' ? 'bg-[#FBBF24]/20 text-[#FBBF24]' :
            type === 'EXPERT_ADVICE' ? 'bg-[#00F0FF]/20 text-[#00F0FF]' :
            'bg-[#C084FC]/20 text-[#C084FC]'
          }`}>
            {type === 'PRICE_COMPARISON' && <ShoppingBag className="w-4 h-4" />}
            {type === 'MULTI_STEP_ROADMAP' && <CheckSquare className="w-4 h-4" />}
            {type === 'CONFLICT_WARNING' && <AlertTriangle className="w-4 h-4" />}
            {type === 'EXPERT_ADVICE' && <Sparkles className="w-4 h-4" />}
            {type === 'PERSISTENT_MEMORY' && <Brain className="w-4 h-4" />}
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#E2E2E6] font-mono tracking-tight">{title}</h4>
            {subtitle && <p className="text-[10px] text-[#C4C6D0]/70">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center space-x-1.5">
          {card.engineMode === 'ONLINE_CLOUD' ? (
            <span className="flex items-center space-x-1 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#10B981]/15 text-[#34D399] border border-[#10B981]/40 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] animate-pulse" />
              <span>ONLINE CLOUD</span>
            </span>
          ) : (
            <span className="flex items-center space-x-1 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#8B5CF6]/15 text-[#C084FC] border border-[#8B5CF6]/40 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C084FC]" />
              <span>OFFLINE ON-DEVICE</span>
            </span>
          )}

          {onDismissCard && (
            <button
              onClick={() => onDismissCard(card.id)}
              className="text-[10px] text-[#C4C6D0]/50 hover:text-[#E2E2E6] font-bold px-1.5 py-1 transition"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* PRICE COMPARISON CARD */}
      {type === 'PRICE_COMPARISON' && data.comparisonRows && (
        <div className="space-y-2.5">
          <div className="space-y-1.5">
            {data.comparisonRows.map((row, idx) => (
              <div key={idx} className="flex items-center justify-between p-2.5 rounded-2xl bg-[#111827] border border-[#00F0FF]/20 text-xs">
                <div>
                  <span className="font-bold text-[#E2E2E6] block">{row.seller}</span>
                  {row.rating && <span className="text-[10px] text-[#FBBF24]">★ {row.rating}</span>}
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-bold text-[#00F0FF]">{row.price}</span>
                  {row.link && (
                    <a
                      href={row.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-[#00F0FF]/15 text-[#00F0FF] hover:bg-[#00F0FF]/30 transition"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          {data.safetyWarning && (
            <div className="p-2.5 rounded-2xl bg-[#FBBF24]/10 border border-[#FBBF24]/30 text-[11px] text-[#FBBF24] flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Pediatric & Age Safety Audit</span>
                <span className="text-[10px] text-[#E2E2E6]/90">{data.safetyWarning}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MULTI STEP ROADMAP CARD */}
      {type === 'MULTI_STEP_ROADMAP' && data.steps && (
        <div className="space-y-2">
          <div className="space-y-1.5">
            {data.steps.map((step, idx) => (
              <div key={step.id || idx} className="flex items-center justify-between p-2 rounded-xl bg-[#111827] border border-[#0088FF]/20 text-xs">
                <div className="flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-full bg-[#0088FF]/20 text-[#0088FF] text-[10px] font-mono font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="font-medium text-[#E2E2E6]">{step.title}</span>
                </div>
                {step.estimatedMinutes && (
                  <span className="text-[10px] font-mono text-[#C4C6D0]/60">~{step.estimatedMinutes}m</span>
                )}
              </div>
            ))}
          </div>

          {onAddRoadmapTasks && (
            <button
              onClick={() => onAddRoadmapTasks(card.id, data.steps || [])}
              className="w-full py-2.5 px-3 rounded-2xl bg-[#0088FF] hover:bg-[#2597FF] text-white text-xs font-bold font-mono flex items-center justify-center space-x-1.5 transition shadow-lg mt-2"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Add All Sub-Tasks to Task Board (`NEXT`)</span>
            </button>
          )}
        </div>
      )}

      {/* CONFLICT WARNING CARD */}
      {type === 'CONFLICT_WARNING' && data.suggestedFreeSlot && (
        <div className="p-3 rounded-2xl bg-[#FBBF24]/10 border border-[#FBBF24]/40 space-y-2.5">
          <div className="flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 text-[#FBBF24] shrink-0 mt-0.5" />
            <div className="text-xs text-[#E2E2E6]">
              <span className="font-bold text-[#FBBF24] block">Schedule Conflict Detected</span>
              <span>"{data.conflictingTitle || 'New Event'}" overlaps with your regular <strong className="text-[#00F0FF]">{data.routineTitle || 'Routine'}</strong> session ({data.conflictingTime}).</span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-[#070A10] border border-[#00F0FF]/30 flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] text-[#C4C6D0]/60 block uppercase font-bold">Next Open Free Slot</span>
              <span className="font-mono font-bold text-[#00F0FF]">
                {data.suggestedFreeSlot.startTime} - {data.suggestedFreeSlot.endTime}
              </span>
            </div>
            {onConfirmReschedule && (
              <button
                onClick={() => onConfirmReschedule(card.id, data.routineTitle || 'Routine', data.suggestedFreeSlot!)}
                className="py-1.5 px-3 rounded-xl bg-[#FBBF24] hover:bg-[#FCD34D] text-[#070A10] text-xs font-bold font-mono flex items-center space-x-1 transition shadow-md"
              >
                <span>Confirm Reschedule</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* PERSISTENT MEMORY CARD */}
      {type === 'PERSISTENT_MEMORY' && data.memoryFact && (
        <div className="flex items-center justify-between p-3 rounded-2xl bg-[#C084FC]/10 border border-[#C084FC]/30 text-xs">
          <div className="flex items-center space-x-2">
            <Brain className="w-4 h-4 text-[#C084FC]" />
            <div>
              <span className="text-[9px] font-bold text-[#C084FC] uppercase block">{data.memoryCategory || 'PERSONAL CONTEXT'}</span>
              <span className="font-semibold text-[#E2E2E6]">{data.memoryFact}</span>
            </div>
          </div>
          {onDeleteMemory && (
            <button
              onClick={() => onDeleteMemory(card.id)}
              className="p-1.5 text-[#C4C6D0]/50 hover:text-[#F87171] transition"
              title="Forget fact"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* EXPERT ADVICE / KNOWLEDGE ANSWER CARD */}
      {type === 'EXPERT_ADVICE' && (
        <div className={`p-3.5 rounded-2xl text-xs text-[#E2E2E6] space-y-2 border ${
          card.engineMode === 'ONLINE_CLOUD'
            ? 'bg-[#00F0FF]/10 border-[#00F0FF]/40'
            : 'bg-[#8B5CF6]/10 border-[#8B5CF6]/40'
        }`}>
          <div className="flex items-center space-x-2 border-b border-white/10 pb-2">
            <Sparkles className={`w-4 h-4 shrink-0 ${card.engineMode === 'ONLINE_CLOUD' ? 'text-[#00F0FF]' : 'text-[#C084FC]'}`} />
            <span className={`font-mono font-bold text-xs ${card.engineMode === 'ONLINE_CLOUD' ? 'text-[#00F0FF]' : 'text-[#C084FC]'}`}>
              {card.engineMode === 'ONLINE_CLOUD' ? 'Gemini Online Response' : 'DayTrace On-Device Assistant'}
            </span>
          </div>
          <div className="text-xs leading-relaxed whitespace-pre-wrap font-sans text-[#E2E2E6]">
            {data.safetyWarning || (data as any).answer || 'Answer generated.'}
          </div>
        </div>
      )}

      {/* Interactive Follow-up Questions (ChatGPT style) */}
      {((card.followUpQuestions && card.followUpQuestions.length > 0) || (data.followUpQuestions && data.followUpQuestions.length > 0)) && (
        <div className="pt-2.5 border-t border-[#00F0FF]/20 space-y-2">
          <div className="flex items-center space-x-1.5 text-[10px] font-mono text-[#00F0FF] uppercase tracking-wider font-bold">
            <Sparkles className="w-3 h-3 text-[#00F0FF]" />
            <span>Suggested Follow-Ups</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(card.followUpQuestions || data.followUpQuestions || []).map((fq, fidx) => (
              <button
                key={fidx}
                onClick={() => onSelectFollowUp?.(fq)}
                className="px-2.5 py-1.5 rounded-xl bg-[#0D1527] hover:bg-[#00F0FF]/20 border border-[#00F0FF]/30 hover:border-[#00F0FF] text-[11px] text-[#E2E2E6] hover:text-[#00F0FF] transition flex items-center space-x-1.5 text-left shadow-sm active:scale-95"
              >
                <span>💬</span>
                <span className="font-medium">{fq}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};
