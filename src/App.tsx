import React, { useState } from 'react';
import { DayProvider, useDay } from './context/DayContext';
import { AndroidStatusBar } from './components/android/AndroidStatusBar';
import { AndroidNotificationCenter } from './components/android/AndroidNotificationCenter';
import { AndroidTopAppBar } from './components/android/AndroidTopAppBar';
import { AndroidNavigationBar, AndroidTab } from './components/android/AndroidNavigationBar';
import { TodayHubView } from './components/views/TodayHubView';
import { TimetableView } from './components/views/TimetableView';
import { TaskBoardView } from './components/views/TaskBoardView';
import { TimelineView } from './components/views/TimelineView';
import { RemindersAnchorsView } from './components/views/RemindersAnchorsView';
import { EndOfDayReviewView } from './components/views/EndOfDayReviewView';
import { PeriodicPromptModal } from './components/android/PeriodicPromptModal';
import { PomodoroFocusModal } from './components/focus/PomodoroFocusModal';
import { FloatingFocusHUD } from './components/focus/FloatingFocusHUD';
import { VoiceCaptureModal } from './components/voice/VoiceCaptureModal';
import { RewardsVaultModal } from './components/rewards/RewardsVaultModal';
import { GeofenceManagerModal } from './components/geofence/GeofenceManagerModal';

const MainScreen: React.FC = () => {
  const { 
    isPeriodicPromptOpen, 
    setIsPeriodicPromptOpen,
    isFocusModalOpen,
    setIsFocusModalOpen,
    isVoiceModalOpen,
    setIsVoiceModalOpen,
    isRewardsModalOpen,
    setIsRewardsModalOpen,
    isGeofenceModalOpen,
    setIsGeofenceModalOpen,
    notificationToast,
    dismissToast,
    activeTriggeredAlert,
    dismissTriggeredAlert,
    handleAlertAction,
    selectedDate,
    isViewingToday,
    historicalDateMessage,
  } = useDay();
  const [activeTab, setActiveTab] = useState<AndroidTab>('hub');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const renderActiveView = () => {
    switch (activeTab) {
      case 'hub':
        return <TodayHubView onNavigateToTimetable={() => setActiveTab('timetable')} />;
      case 'timetable':
        return <TimetableView />;
      case 'board':
        return <TaskBoardView />;
      case 'timeline':
        return <TimelineView />;
      case 'reminders':
        return <RemindersAnchorsView />;
      case 'review':
        return <EndOfDayReviewView />;
      default:
        return <TodayHubView onNavigateToTimetable={() => setActiveTab('timetable')} />;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative">
      {/* Android System Status Bar (Interactive notification drawer trigger) */}
      <AndroidStatusBar onOpenNotifications={() => setIsNotificationsOpen(true)} />

      {/* Android Material 3 Top App Bar */}
      <AndroidTopAppBar onNavigateTab={(tab) => setActiveTab(tab)} />

      {/* Primary Dynamic Screen View */}
      <main
        className="flex-1 flex flex-col overflow-hidden relative"
        onClickCapture={(event) => {
          if (!isViewingToday) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        {!isViewingToday && (
          <div className="shrink-0 px-3 py-1.5 bg-[#334867] border-b border-[#D1E1FF]/30 text-[11px] text-[#D1E1FF] text-center font-semibold">
            Viewing {selectedDate} • read-only history{historicalDateMessage ? ` • ${historicalDateMessage}` : ''}
          </div>
        )}
        {renderActiveView()}
      </main>

      {/* Floating Focus Countdown HUD (visible when focus session is running) */}
      <FloatingFocusHUD onOpenModal={() => setIsFocusModalOpen(true)} />

      {/* Android Bottom Navigation Bar */}
      <AndroidNavigationBar activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* 30-Minute Recurring Accountability Dialogue Modal */}
      <PeriodicPromptModal
        isOpen={isPeriodicPromptOpen}
        onClose={() => setIsPeriodicPromptOpen(false)}
      />

      {/* Deep Work & Pomodoro Modal */}
      <PomodoroFocusModal
        isOpen={isFocusModalOpen}
        onClose={() => setIsFocusModalOpen(false)}
      />

      {/* Voice Memo Quick Capture Modal */}
      <VoiceCaptureModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
      />

      {/* Streak & Rewards Vault Modal */}
      <RewardsVaultModal
        isOpen={isRewardsModalOpen}
        onClose={() => setIsRewardsModalOpen(false)}
      />

      {/* Smart Geofence Automation Modal */}
      <GeofenceManagerModal
        isOpen={isGeofenceModalOpen}
        onClose={() => setIsGeofenceModalOpen(false)}
      />

      {/* Android Notification Center Pull-Down Drawer */}
      <AndroidNotificationCenter
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />

      {/* Interactive Heads-Up Triggered Alert Card (When trigger fires while screen interactive) */}
      {activeTriggeredAlert && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[92%] bg-[#1D2026] text-[#E2E2E6] border-2 border-[#D1E1FF] rounded-3xl p-4 shadow-2xl space-y-3 animate-in fade-in slide-in-from-top-3">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#D1E1FF] px-2 py-0.5 rounded-full bg-[#334867]">
                ⚡ Triggered Alert
              </span>
              <h3 className="text-sm font-bold text-[#E2E2E6] mt-1.5">{activeTriggeredAlert.title}</h3>
              <p className="text-[11px] text-[#C4C6D0]">{activeTriggeredAlert.subtitle}</p>
            </div>
            <button
              onClick={dismissTriggeredAlert}
              className="text-[#C4C6D0] hover:text-white p-1"
            >
              ✕
            </button>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-1 border-t border-[#44474E]/30">
            <button
              onClick={() => handleAlertAction('SNOOZE')}
              className="py-1.5 px-3 rounded-2xl bg-[#2E3036] hover:bg-[#334867] text-xs font-semibold text-[#E2E2E6] transition"
            >
              Snooze (10m)
            </button>
            <button
              onClick={() => handleAlertAction('DONE')}
              className="py-1.5 px-3.5 rounded-2xl bg-[#D1E1FF] hover:bg-white text-[#003062] text-xs font-bold transition shadow-sm"
            >
              ✓ Done
            </button>
          </div>
        </div>
      )}

      {/* Global System Toast Banner */}
      {notificationToast && (
        <div 
          onClick={dismissToast}
          className="fixed top-14 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[90%] bg-[#1D2026] text-[#E2E2E6] border border-[#D1E1FF]/40 rounded-2xl px-4 py-2.5 shadow-2xl text-xs font-semibold flex items-center justify-between cursor-pointer animate-in fade-in slide-in-from-top-2"
        >
          <span>{notificationToast}</span>
          <span className="text-[10px] text-[#C4C6D0]/60 ml-2">Tap to dismiss</span>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <DayProvider>
      <div className="w-full h-screen min-h-screen bg-[#111318] text-[#E2E2E6] flex flex-col overflow-hidden relative font-sans">
        <MainScreen />
      </div>
    </DayProvider>
  );
}
