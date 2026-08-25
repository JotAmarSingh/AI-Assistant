import React, { useEffect, useState } from 'react';
import { BellRing, Clock3, MapPin, Mic2, ShieldCheck } from 'lucide-react';
import {
  isNativeAndroid,
  openNativeExactAlarmSettings,
  requestNativeGeofencePermissions,
  requestNativeMicrophonePermission,
  requestNativeNotificationPermission,
} from '../../services/nativeBridge';

const FIRST_RUN_PERMISSION_KEY = 'daytrace_first_run_permissions_v1';

export const FirstRunPermissionsModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [progress, setProgress] = useState('');

  useEffect(() => {
    setIsOpen(isNativeAndroid() && localStorage.getItem(FIRST_RUN_PERMISSION_KEY) !== 'seen');
  }, []);

  const finish = () => {
    localStorage.setItem(FIRST_RUN_PERMISSION_KEY, 'seen');
    setIsOpen(false);
  };

  const setupPermissions = async () => {
    setIsRequesting(true);
    setProgress('Requesting notifications…');
    await requestNativeNotificationPermission();
    setProgress('Requesting microphone…');
    await requestNativeMicrophonePermission();
    setProgress('Requesting location and background location…');
    await requestNativeGeofencePermissions();
    setProgress('Opening exact-alarm access…');
    finish();
    await openNativeExactAlarmSettings();
  };

  if (!isOpen) return null;

  return (
    <div id="first-run-permissions" className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#1D2026] text-[#E2E2E6] border border-[#D1E1FF]/35 rounded-[34px] p-5 shadow-2xl space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-2xl bg-[#334867] text-[#D1E1FF]"><ShieldCheck className="w-5 h-5" /></div>
          <div><h2 className="text-base font-bold">Enable DayTrace on this Pixel</h2><p className="text-[11px] text-[#C4C6D0] mt-1">One-time Android setup for reminders, saved places, lock-screen prompts and voice.</p></div>
        </div>

        <div className="space-y-2">
          {[
            [BellRing, 'Notifications', 'Show tasks and prompts on the lock screen'],
            [Clock3, 'Exact alarms', 'Deliver reminders at the requested time'],
            [MapPin, 'Location', 'Recognize saved places and location triggers'],
            [Mic2, 'Microphone', 'Voice input and meeting recording'],
          ].map(([Icon, title, detail]) => {
            const RowIcon = Icon as typeof BellRing;
            return <div key={String(title)} className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-[#111318] border border-[#44474E]/30"><RowIcon className="w-4 h-4 text-[#D1E1FF] shrink-0" /><div><span className="text-xs font-semibold block">{String(title)}</span><span className="text-[10px] text-[#C4C6D0]">{String(detail)}</span></div></div>;
          })}
        </div>

        <p className="text-[10px] text-[#C4C6D0] leading-relaxed">DayTrace already restores scheduled alarms after reboot. Android wakes the registered alarm or geofence receiver when needed, so the app does not waste battery by staying permanently awake.</p>
        {progress && <p className="text-[11px] text-[#D1E1FF] text-center">{progress}</p>}
        <button type="button" disabled={isRequesting} onClick={() => void setupPermissions()} className="w-full py-3 rounded-2xl bg-[#D1E1FF] text-[#003062] text-xs font-bold disabled:opacity-50">{isRequesting ? 'Complete the Android prompts…' : 'Set Up Permissions'}</button>
        <button type="button" disabled={isRequesting} onClick={finish} className="w-full py-2 rounded-2xl text-[#C4C6D0] text-xs font-semibold">Not now — configure in Settings</button>
      </div>
    </div>
  );
};
