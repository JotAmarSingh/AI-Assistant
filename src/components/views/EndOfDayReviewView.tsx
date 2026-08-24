import React, { useState } from 'react';
import { 
  BarChart3, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  CornerDownRight, 
  AlertCircle, 
  Calendar, 
  Copy, 
  Check
} from 'lucide-react';
import { useDay } from '../../context/DayContext';
import { generateOfflineEndOfDayReview } from '../../utils/offlineParser';
import { soundEffects } from '../../services/soundEffects';

export const EndOfDayReviewView: React.FC = () => {
  const { state, updateUserSettings } = useDay();
  const [isGenerating, setIsGenerating] = useState(false);
  const [reviewData, setReviewData] = useState<{
    summaryNarrative: string;
    plannedVsActual: { event: string; planned: string; actual: string; variance: string; notes?: string }[];
    recurringPatterns: string[];
    tomorrowAnchors: { id: string; time: string; title: string; category?: string }[];
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const settings = state.userSettings || {};

  const completedTasks = state.tasks.filter((t) => t.status === 'DONE');
  const pendingTasks = state.tasks.filter((t) => t.status === 'NEXT' || t.status === 'ACTIVE' || t.status === 'CAPTURED');
  const waitingTasks = state.tasks.filter((t) => t.status === 'WAITING');
  const blockedTasks = state.tasks.filter((t) => t.status === 'BLOCKED');

  const handleGenerateAIReview = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/ai/end-of-day-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyState: state }),
      });
      if (res.ok) {
        const data = await res.json();
        setReviewData(data);
        return;
      }
      throw new Error('Server returned non-ok status');
    } catch (e) {
      console.warn('Using offline deterministic review generator', e);
      const offlineReview = generateOfflineEndOfDayReview(state);
      setReviewData({
        summaryNarrative: offlineReview.summaryNarrative,
        plannedVsActual: offlineReview.plannedVsActual,
        recurringPatterns: offlineReview.recurringPatterns,
        tomorrowAnchors: offlineReview.tomorrowAnchors.map((a) => ({
          id: a.id,
          time: a.time,
          title: a.title,
          category: a.category,
        })),
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const getFullMarkdownReport = () => {
    let md = `# End-of-Day Review: ${state.date}\n\n`;
    md += `## 1. Executive Summary\n${reviewData?.summaryNarrative || 'Daily accountability review and state synthesis.'}\n\n`;
    md += `## 2. Completed Tasks (${completedTasks.length})\n`;
    completedTasks.forEach((t) => (md += `- [x] **${t.title}** (${t.category})\n`));
    md += `\n## 3. Carry Forward Tasks (${pendingTasks.length})\n`;
    pendingTasks.forEach((t) => (md += `- [ ] **${t.title}** (${t.category}) - Priority ${t.priority}/10\n`));
    md += `\n## 4. Waiting on Others (${waitingTasks.length})\n`;
    waitingTasks.forEach((t) => (md += `- ⏳ **${t.title}** (Owner: ${t.owner}) - ${t.notes || ''}\n`));
    md += `\n## 5. Blocked Dependencies (${blockedTasks.length})\n`;
    blockedTasks.forEach((t) => (md += `- 🔒 **${t.title}** (Blocked by: ${t.blockedBy || 'Prerequisite'}, Trigger: ${t.trigger || 'Event'})\n`));
    md += `\n## 6. Daily Timeline Highlights\n`;
    state.timeline.forEach((e) => (md += `- **${e.time}**: ${e.description} (${e.location || 'Logged'})\n`));
    return md;
  };

  const handleCopyReport = () => {
    navigator.clipboard.writeText(getFullMarkdownReport());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id="end-of-day-review-view" className="flex-1 flex flex-col h-full bg-[#111318] text-[#E2E2E6] overflow-hidden relative">
      {/* Scrollable Canvas */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Header Action Card */}
        <div className="bg-[#1D2026] text-[#E2E2E6] rounded-[28px] p-5 shadow-lg border border-[#44474E]/40 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-[#D1E1FF]" />
              <h3 className="font-bold text-sm tracking-tight text-[#E2E2E6]">End-of-Day Review</h3>
            </div>
            <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-[#2E3036] text-[#D1E1FF] border border-[#44474E]/30">
              {state.date}
            </span>
          </div>

          <p className="text-xs text-[#C4C6D0] leading-relaxed">
            Generate an objective, comprehensive review without moralizing delays. Evaluates completed tasks, carry-forwards, waiting streams, and planned vs actual variance.
          </p>

          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 pt-1">
            <button
              onClick={handleGenerateAIReview}
              disabled={isGenerating}
              className="flex-1 py-3 px-4 bg-[#D1E1FF] hover:bg-white text-[#003062] font-bold rounded-2xl text-xs flex items-center justify-center space-x-2 transition shadow-md disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-[#003062]" />
              <span>{isGenerating ? 'Synthesizing with Gemini...' : 'Generate AI Daily Review'}</span>
            </button>

            <button
              onClick={handleCopyReport}
              className="py-3 px-3.5 bg-[#2E3036] hover:bg-[#44474E]/50 text-[#E2E2E6] rounded-2xl text-xs font-semibold flex items-center justify-center space-x-1 transition border border-[#44474E]/40"
              title="Copy Markdown Report"
            >
              {copied ? <Check className="w-4 h-4 text-[#D1E1FF]" /> : <Copy className="w-4 h-4" />}
              <span className="text-xs ml-1 font-bold">Copy Report</span>
            </button>
          </div>
        </div>

        {/* AI Synthesis Narrative */}
        {reviewData?.summaryNarrative && (
          <div className="bg-[#1D2026] border border-[#D1E1FF]/30 rounded-[28px] p-4 space-y-2 shadow-md">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#D1E1FF]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Executive Synthesis</span>
            </div>
            <p className="text-xs text-[#E2E2E6] leading-relaxed">
              {reviewData.summaryNarrative}
            </p>
          </div>
        )}

        {/* Breakdown Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-[#1D2026] border border-[#44474E]/40 p-3.5 rounded-[24px] text-center shadow-md">
            <div className="text-xl font-bold text-[#D1E1FF]">{completedTasks.length}</div>
            <div className="text-[10px] uppercase font-mono text-[#C4C6D0]/70">Completed</div>
          </div>
          <div className="bg-[#1D2026] border border-[#44474E]/40 p-3.5 rounded-[24px] text-center shadow-md">
            <div className="text-xl font-bold text-[#D1E1FF]">{pendingTasks.length}</div>
            <div className="text-[10px] uppercase font-mono text-[#C4C6D0]/70">Carry Forward</div>
          </div>
          <div className="bg-[#1D2026] border border-[#44474E]/40 p-3.5 rounded-[24px] text-center shadow-md">
            <div className="text-xl font-bold text-[#FDE047]">{waitingTasks.length}</div>
            <div className="text-[10px] uppercase font-mono text-[#C4C6D0]/70">Waiting</div>
          </div>
          <div className="bg-[#1D2026] border border-[#44474E]/40 p-3.5 rounded-[24px] text-center shadow-md">
            <div className="text-xl font-bold text-[#F87171]">{blockedTasks.length}</div>
            <div className="text-[10px] uppercase font-mono text-[#C4C6D0]/70">Blocked</div>
          </div>
        </div>

        {/* Completed Today */}
        <section className="bg-[#1D2026] border border-[#44474E]/40 rounded-[28px] p-4 space-y-2.5 shadow-md">
          <div className="flex items-center space-x-2 text-xs font-bold text-[#E2E2E6]">
            <CheckCircle2 className="w-4 h-4 text-[#D1E1FF]" />
            <span>Tasks Completed Today ({completedTasks.length})</span>
          </div>
          {completedTasks.length === 0 ? (
            <div className="text-xs text-[#C4C6D0]/60">No tasks completed today yet.</div>
          ) : (
            <div className="space-y-1.5">
              {completedTasks.map((t) => (
                <div key={t.id} className="flex items-center justify-between text-xs py-1.5 border-b border-[#44474E]/30 last:border-none">
                  <span className="font-medium line-through text-[#C4C6D0]/60">{t.title}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#2E3036] text-[#C4C6D0] border border-[#44474E]/30">
                    {t.category}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Carry Forward Tasks */}
        <section className="bg-[#1D2026] border border-[#44474E]/40 rounded-[28px] p-4 space-y-2.5 shadow-md">
          <div className="flex items-center space-x-2 text-xs font-bold text-[#E2E2E6]">
            <Clock className="w-4 h-4 text-[#D1E1FF]" />
            <span>Carry Forward to Tomorrow ({pendingTasks.length})</span>
          </div>
          <p className="text-[11px] text-[#C4C6D0]/70">Actionable items moving into tomorrow's plan.</p>
          <div className="space-y-1.5">
            {pendingTasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-xs py-1.5 border-b border-[#44474E]/30 last:border-none">
                <span className="font-medium text-[#E2E2E6]">{t.title}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#334867] text-[#D1E1FF] border border-[#D1E1FF]/30">
                  Pri {t.priority}/10
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Waiting & Blocked Streams */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-[#1D2026] border border-[#44474E]/40 rounded-[28px] p-4 space-y-2.5 shadow-md">
            <div className="text-xs font-bold text-[#FDE047] flex items-center space-x-1.5">
              <CornerDownRight className="w-3.5 h-3.5" />
              <span>Waiting on Others ({waitingTasks.length})</span>
            </div>
            {waitingTasks.length === 0 ? (
              <div className="text-xs text-[#C4C6D0]/60">None</div>
            ) : (
              waitingTasks.map((t) => (
                <div key={t.id} className="text-xs space-y-0.5 pt-1 border-t border-[#44474E]/30 first:border-none first:pt-0">
                  <div className="font-semibold text-[#E2E2E6]">{t.title}</div>
                  <div className="text-[10px] text-[#FDE047] font-mono">Owner: {t.owner} • {t.notes || 'In progress'}</div>
                </div>
              ))
            )}
          </div>

          <div className="bg-[#1D2026] border border-[#44474E]/40 rounded-[28px] p-4 space-y-2.5 shadow-md">
            <div className="text-xs font-bold text-[#F87171] flex items-center space-x-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Blocked Prerequisites ({blockedTasks.length})</span>
            </div>
            {blockedTasks.length === 0 ? (
              <div className="text-xs text-[#C4C6D0]/60">None</div>
            ) : (
              blockedTasks.map((t) => (
                <div key={t.id} className="text-xs space-y-0.5 pt-1 border-t border-[#44474E]/30 first:border-none first:pt-0">
                  <div className="font-semibold text-[#E2E2E6]">{t.title}</div>
                  <div className="text-[10px] text-[#F87171] font-mono">Blocked by: {t.blockedBy || 'Task'}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Planned vs Actual Variance */}
        {reviewData?.plannedVsActual && reviewData.plannedVsActual.length > 0 && (
          <section className="bg-[#1D2026] border border-[#44474E]/40 rounded-[28px] p-4 space-y-2.5 shadow-md">
            <div className="text-xs font-bold text-[#E2E2E6]">
              Planned vs Actual Variance
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-[#44474E]/40 text-[10px] uppercase font-mono text-[#C4C6D0]">
                    <th className="py-2">Event</th>
                    <th className="py-2">Planned</th>
                    <th className="py-2">Actual</th>
                    <th className="py-2">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#44474E]/30 text-[11px]">
                  {reviewData.plannedVsActual.map((row, idx) => (
                    <tr key={idx}>
                      <td className="py-2 font-medium text-[#E2E2E6]">{row.event}</td>
                      <td className="py-2 font-mono text-[#C4C6D0]">{row.planned}</td>
                      <td className="py-2 font-mono text-[#E2E2E6]">{row.actual}</td>
                      <td className="py-2 font-mono text-[#F87171] font-semibold">{row.variance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Tomorrow's Anchors */}
        {reviewData?.tomorrowAnchors && reviewData.tomorrowAnchors.length > 0 && (
          <section className="bg-[#1D2026] border border-[#44474E]/40 rounded-[28px] p-4 space-y-2.5 shadow-md">
            <div className="flex items-center space-x-2 text-xs font-bold text-[#E2E2E6]">
              <Calendar className="w-4 h-4 text-[#D1E1FF]" />
              <span>Tomorrow's Planning Anchors ({reviewData.tomorrowAnchors.length})</span>
            </div>
            <div className="space-y-1.5">
              {reviewData.tomorrowAnchors.map((anc) => (
                <div key={anc.id} className="flex items-center justify-between text-xs py-1.5 border-b border-[#44474E]/30 last:border-none">
                  <span className="font-medium text-[#E2E2E6]">{anc.title}</span>
                  <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-[#334867] text-[#D1E1FF] font-semibold border border-[#D1E1FF]/30">
                    {anc.time}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

