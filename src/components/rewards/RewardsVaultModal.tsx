import React, { useEffect, useRef, useState } from 'react';
import { 
  Gift, 
  Flame, 
  Sparkles, 
  Check, 
  X, 
  Trophy, 
  Lock, 
  CheckCircle2, 
  Plus, 
  Clock, 
  Coins, 
  Zap,
  ShoppingBag,
  History,
  PartyPopper
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useDay } from '../../context/DayContext';
import { RewardItem, RewardTier, ClaimedRewardHistory } from '../../types';
import { DEFAULT_REWARDS } from '../../services/rewardsCatalog';
import { soundEffects } from '../../services/soundEffects';

interface RewardsVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RewardsVaultModal: React.FC<RewardsVaultModalProps> = ({ isOpen, onClose }) => {
  const { state, claimReward, addCustomReward } = useDay();
  const [selectedTier, setSelectedTier] = useState<RewardTier | 'ALL' | 'HISTORY'>('ALL');
  const [isAddCustomOpen, setIsAddCustomOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCost, setNewCost] = useState('100');
  const [newTier, setNewTier] = useState<RewardTier>('MICRO');
  const [newDesc, setNewDesc] = useState('');
  const [claimedNotice, setClaimedNotice] = useState<string | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const confettiTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setClaimedNotice(null);
      confetti.reset();
    }
    return () => {
      if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
      if (confettiTimerRef.current !== null) window.clearTimeout(confettiTimerRef.current);
      confetti.reset();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const gamification = state.gamification || {
    points: 0,
    currentStreakDays: 0,
    longestStreakDays: 0,
    totalFocusMinutes: 0,
    totalTasksCompleted: 0,
    totalReviewsCompleted: 0,
    claimedRewards: [],
    customRewards: [],
  };

  const allRewards: RewardItem[] = [
    ...DEFAULT_REWARDS,
    ...(gamification.customRewards || []),
  ];

  const filteredRewards = selectedTier === 'ALL'
    ? allRewards
    : allRewards.filter((r) => r.tier === selectedTier);

  const handleClaim = (reward: RewardItem) => {
    if (gamification.points < reward.pointsCost) return;

    const success = claimReward(reward.id);
    if (success) {
      soundEffects.playTaskDone();
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#D1E1FF', '#86EFAC', '#FBBF24', '#F472B6', '#A78BFA'],
        });
        if (confettiTimerRef.current !== null) window.clearTimeout(confettiTimerRef.current);
        confettiTimerRef.current = window.setTimeout(() => confetti.reset(), 2200);
      } catch {
        // ignore
      }
      setClaimedNotice(`🎉 Claimed: ${reward.title}! Enjoy your well-earned reward!`);
      if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = window.setTimeout(() => setClaimedNotice(null), 4000);
    }
  };

  const handleCreateCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    addCustomReward({
      title: newTitle.trim(),
      pointsCost: parseInt(newCost, 10) || 100,
      tier: newTier,
      description: newDesc.trim() || 'Custom personal reward goal',
      icon: 'custom',
      category: 'Custom Goal',
      isCustom: true,
    });

    setNewTitle('');
    setNewDesc('');
    setIsAddCustomOpen(false);
  };

  const getRewardEmoji = (icon: string) => {
    switch (icon) {
      case 'candy': return '🍬';
      case 'chocolate': return '🍫';
      case 'donut': return '🍩';
      case 'coffee': return '☕';
      case 'pizza': return '🍕';
      case 'movie': return '🎬';
      case 'gaming': return '🎮';
      case 'sushi': return '🍣';
      case 'iphone': return '📱';
      case 'headphones': return '🎧';
      case 'shoes': return '👟';
      case 'trip': return '✈️';
      default: return '🎁';
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-[#1D2026] text-[#E2E2E6] border border-[#44474E]/60 rounded-[32px] p-6 max-w-md w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[#44474E]/30">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-2xl bg-[#FBBF24]/10 text-[#FBBF24]">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-[#E2E2E6]">Streak & Rewards Vault</h2>
              <p className="text-[11px] text-[#C4C6D0]/70">Earn DayCoins from focus & unlock real rewards</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#C4C6D0] hover:text-[#E2E2E6] p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Gamification Stats Dashboard Banner */}
        <div className="p-4 rounded-3xl bg-gradient-to-br from-[#1E293B] to-[#111318] border border-[#D1E1FF]/30 shadow-inner relative overflow-hidden">
          <div className="grid grid-cols-3 gap-2 text-center relative z-10">
            {/* Streak */}
            <div className="p-2.5 rounded-2xl bg-[#0F172A]/80 border border-[#334155]">
              <div className="flex items-center justify-center space-x-1 text-[#F87171] mb-0.5">
                <Flame className="w-4 h-4 fill-current" />
                <span className="text-base font-extrabold font-mono">{gamification.currentStreakDays}</span>
              </div>
              <span className="text-[10px] text-[#94A3B8] font-semibold block uppercase tracking-wider">Day Streak</span>
            </div>

            {/* Points / DayCoins */}
            <div className="p-2.5 rounded-2xl bg-[#0F172A]/80 border border-[#FBBF24]/40">
              <div className="flex items-center justify-center space-x-1 text-[#FBBF24] mb-0.5">
                <Coins className="w-4 h-4" />
                <span className="text-base font-extrabold font-mono">{gamification.points}</span>
              </div>
              <span className="text-[10px] text-[#FBBF24] font-semibold block uppercase tracking-wider">DayCoins</span>
            </div>

            {/* Focus Logged */}
            <div className="p-2.5 rounded-2xl bg-[#0F172A]/80 border border-[#334155]">
              <div className="flex items-center justify-center space-x-1 text-[#86EFAC] mb-0.5">
                <Clock className="w-4 h-4" />
                <span className="text-base font-extrabold font-mono">{gamification.totalFocusMinutes}m</span>
              </div>
              <span className="text-[10px] text-[#94A3B8] font-semibold block uppercase tracking-wider">Focus Time</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#94A3B8] mt-3 pt-2 border-t border-[#334155]/60 z-10">
            <span>✅ Completed Tasks: <strong className="text-[#E2E2E6]">{gamification.totalTasksCompleted}</strong></span>
            <span>🏆 Total Claimed: <strong className="text-[#FBBF24]">{(gamification.claimedRewards || []).length}</strong></span>
          </div>
        </div>

        {/* Claim Notice Feedback */}
        {claimedNotice && (
          <div className="p-3 rounded-2xl bg-[#064E3B]/40 border border-[#059669] text-xs text-[#86EFAC] font-bold flex items-center space-x-2 animate-in fade-in">
            <PartyPopper className="w-4 h-4 shrink-0 text-[#86EFAC]" />
            <span>{claimedNotice}</span>
          </div>
        )}

        {/* Tier Tabs Navigation */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: 'ALL', label: 'All Items' },
            { id: 'MICRO', label: '🍬 Micro Treats' },
            { id: 'WEEKLY', label: '🍕 Weekly Milestones' },
            { id: 'GRAND', label: '📱 Grand Goals' },
            { id: 'HISTORY', label: '📜 History' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTier(tab.id as any)}
              className={`py-1.5 px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition border ${
                selectedTier === tab.id
                  ? 'bg-[#334867] border-[#D1E1FF] text-[#D1E1FF]'
                  : 'bg-[#111318] border-[#44474E]/30 text-[#C4C6D0] hover:bg-[#2E3036]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Rewards List View */}
        {selectedTier !== 'HISTORY' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#D1E1FF] uppercase tracking-wider">Available Rewards</span>
              <button
                onClick={() => setIsAddCustomOpen(!isAddCustomOpen)}
                className="text-[11px] font-bold text-[#D1E1FF] hover:underline flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Custom Reward</span>
              </button>
            </div>

            {/* Custom Reward Creator Form */}
            {isAddCustomOpen && (
              <form onSubmit={handleCreateCustom} className="p-3.5 rounded-2xl bg-[#111318] border border-[#D1E1FF]/40 space-y-3">
                <span className="text-xs font-bold text-[#E2E2E6] block">Add Your Custom Goal / Reward</span>
                <input
                  type="text"
                  placeholder="e.g. Saturday Spa Day, Buy Book..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#1D2026] border border-[#44474E]/40 text-xs text-[#E2E2E6] focus:outline-hidden focus:border-[#D1E1FF]"
                  required
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    placeholder="Points Cost (e.g. 150)"
                    value={newCost}
                    onChange={(e) => setNewCost(e.target.value)}
                    className="p-2.5 rounded-xl bg-[#1D2026] border border-[#44474E]/40 text-xs text-[#E2E2E6] focus:outline-hidden focus:border-[#D1E1FF]"
                    required
                  />
                  <select
                    value={newTier}
                    onChange={(e) => setNewTier(e.target.value as RewardTier)}
                    className="p-2.5 rounded-xl bg-[#1D2026] border border-[#44474E]/40 text-xs text-[#E2E2E6] focus:outline-hidden focus:border-[#D1E1FF]"
                  >
                    <option value="MICRO">Micro Treat</option>
                    <option value="WEEKLY">Weekly Milestone</option>
                    <option value="GRAND">Grand Goal</option>
                  </select>
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsAddCustomOpen(false)}
                    className="py-1.5 px-3 rounded-xl bg-[#2E3036] text-xs text-[#C4C6D0]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="py-1.5 px-4 rounded-xl bg-[#D1E1FF] text-[#003062] text-xs font-bold shadow-sm"
                  >
                    Add Goal
                  </button>
                </div>
              </form>
            )}

            {/* Grid of Reward Cards */}
            <div className="grid grid-cols-1 gap-2.5">
              {filteredRewards.map((reward) => {
                const canAfford = gamification.points >= reward.pointsCost;
                const progress = Math.min(100, Math.round((gamification.points / reward.pointsCost) * 100));

                return (
                  <div
                    key={reward.id}
                    className={`p-3.5 rounded-2xl border transition flex items-center justify-between ${
                      canAfford
                        ? 'bg-[#1D2026] border-[#D1E1FF]/50 shadow-md'
                        : 'bg-[#111318]/90 border-[#44474E]/30 opacity-80'
                    }`}
                  >
                    <div className="flex items-start space-x-3 truncate mr-2">
                      <div className="w-10 h-10 rounded-2xl bg-[#2E3036] flex items-center justify-center text-xl shrink-0 border border-[#44474E]/40">
                        {getRewardEmoji(reward.icon)}
                      </div>
                      <div className="truncate">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-xs text-[#E2E2E6] truncate">{reward.title}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-[#334867] text-[#D1E1FF]">
                            {reward.tier}
                          </span>
                        </div>
                        <p className="text-[10px] text-[#C4C6D0]/70 truncate max-w-xs">{reward.description}</p>
                        
                        {!canAfford && (
                          <div className="flex items-center space-x-2 mt-1">
                            <div className="w-24 h-1 bg-[#2E3036] rounded-full overflow-hidden">
                              <div className="bg-[#FBBF24] h-full" style={{ width: `${progress}%` }} />
                            </div>
                            <span className="text-[9px] text-[#FBBF24] font-mono">{progress}%</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end shrink-0 space-y-1">
                      <span className="text-xs font-extrabold font-mono text-[#FBBF24] flex items-center space-x-0.5">
                        <Coins className="w-3 h-3 mr-0.5" />
                        <span>{reward.pointsCost}</span>
                      </span>

                      <button
                        onClick={() => handleClaim(reward)}
                        disabled={!canAfford}
                        className={`py-1.5 px-3 rounded-xl text-xs font-bold flex items-center space-x-1 transition shadow-sm ${
                          canAfford
                            ? 'bg-[#D1E1FF] hover:bg-[#B6D4FE] text-[#003062] active:scale-95'
                            : 'bg-[#2E3036] text-[#C4C6D0]/40 cursor-not-allowed'
                        }`}
                      >
                        {canAfford ? (
                          <>
                            <Gift className="w-3.5 h-3.5" />
                            <span>Claim</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5" />
                            <span>Locked</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* History / Trophies View */
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-[#D1E1FF] uppercase tracking-wider flex items-center space-x-1.5">
              <History className="w-4 h-4 text-[#D1E1FF]" />
              <span>Claimed Reward Trophies</span>
            </h4>

            {gamification.claimedRewards && gamification.claimedRewards.length > 0 ? (
              <div className="space-y-2">
                {gamification.claimedRewards.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-2xl bg-[#111318] border border-[#44474E]/30 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className="text-xl">{getRewardEmoji(item.icon)}</div>
                      <div>
                        <span className="text-xs font-bold text-[#E2E2E6] block">{item.title}</span>
                        <span className="text-[10px] text-[#C4C6D0]/60">{new Date(item.claimedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-[#86EFAC]">Claimed</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center rounded-2xl bg-[#111318] border border-[#44474E]/20 text-[#C4C6D0]/70 text-xs">
                No rewards claimed yet. Complete focus blocks & daily reviews to earn DayCoins!
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
