import React, { useState } from 'react';
import { DayProvider, useDay } from './context/DayContext';
import { AndroidDeviceWrapper } from './components/android/AndroidDeviceWrapper';
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
    dismissToast
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
      <main className="flex-1 flex flex-col overflow-hidden relative">
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
      <AndroidDeviceWrapper>
        <MainScreen />
      </AndroidDeviceWrapper>
    </DayProvider>
  );
}
