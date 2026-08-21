import React from 'react';
import { Zap, CalendarClock, CheckSquare, Clock, BellRing, BarChart3 } from 'lucide-react';
import { useDay } from '../../context/DayContext';

export type AndroidTab = 'hub' | 'timetable' | 'board' | 'timeline' | 'reminders' | 'review';

interface AndroidNavigationBarProps {
  activeTab: AndroidTab;
  onSelectTab: (tab: AndroidTab) => void;
}

export const AndroidNavigationBar: React.FC<AndroidNavigationBarProps> = ({ activeTab, onSelectTab }) => {
  const { state } = useDay();

  const nextTasksCount = state.tasks.filter((t) => t.status === 'NEXT' || t.status === 'ACTIVE').length;
  const pendingRemindersCount = state.reminders.filter((r) => !r.isDone).length;
  const activeRoutineCount = (state.timetable || []).filter((s) => s.status === 'ACTIVE').length;

  const tabs: { id: AndroidTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }[] = [
    { id: 'hub', label: 'Today', icon: Zap },
    { id: 'timetable', label: 'Timetable', icon: CalendarClock, badge: activeRoutineCount > 0 ? activeRoutineCount : undefined },
    { id: 'board', label: 'Tasks', icon: CheckSquare, badge: nextTasksCount },
    { id: 'timeline', label: 'Timeline', icon: Clock },
    { id: 'reminders', label: 'Anchors', icon: BellRing, badge: pendingRemindersCount > 0 ? pendingRemindersCount : undefined },
    { id: 'review', label: 'Review', icon: BarChart3 },
  ];

  return (
    <nav
      id="android-bottom-navigation-bar"
      className="w-full bg-[#111318] border-t border-[#44474E]/30 px-1 py-1 flex items-center justify-around z-30 select-none pb-safe"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            id={`nav-tab-${tab.id}`}
            onClick={() => onSelectTab(tab.id)}
            className="flex flex-col items-center justify-center flex-1 py-0.5 relative group focus:outline-none"
          >
            {/* Pill highlight for active tab (Material 3 style) */}
            <div
              className={`w-11 h-7 rounded-full flex items-center justify-center transition-all duration-200 relative ${
                isActive
                  ? 'bg-[#334867] text-[#D1E1FF] shadow-sm scale-100'
                  : 'text-[#C4C6D0] group-hover:bg-[#2E3036]/60 group-hover:text-[#E2E2E6]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  className={`absolute -top-1 -right-1 text-[9px] font-bold px-1.5 py-0.1 rounded-full border ${
                    isActive
                      ? 'bg-[#D1E1FF] text-[#003062] border-[#111318]'
                      : 'bg-[#334867] text-[#D1E1FF] border-[#111318]'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </div>
            <span
              className={`text-[10px] font-medium mt-0.5 tracking-tight transition-colors ${
                isActive
                  ? 'text-[#D1E1FF] font-bold'
                  : 'text-[#C4C6D0]/80 group-hover:text-[#E2E2E6]'
              }`}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};


