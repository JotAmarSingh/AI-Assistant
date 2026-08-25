import React, { useState } from 'react';
import { MapPin, Navigation, Pencil, Radio, Trash2, X } from 'lucide-react';
import { useDay } from '../../context/DayContext';
import { requestNativeGeofencePermissions } from '../../services/nativeBridge';

interface GeofenceManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GeofenceManagerModal: React.FC<GeofenceManagerModalProps> = ({ isOpen, onClose }) => {
  const {
    state,
    simulateGeofenceEnter,
    updateUserSettings,
    saveCurrentLocation,
    updateSavedLocation,
    deleteSavedLocation,
    unignoreLocation,
  } = useDay();
  const [newLocationName, setNewLocationName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  if (!isOpen) return null;

  const locations = state.geofenceLocations || [];
  const ignored = state.ignoredLocationClusters || [];
  const settings = state.userSettings;

  const handleSaveCurrent = async () => {
    if (!newLocationName.trim()) return;
    setIsSaving(true);
    setMessage(null);
    try {
      const result = await saveCurrentLocation(newLocationName);
      setMessage(result);
      if (!result.includes('already exists')) setNewLocationName('');
    } catch (error: any) {
      setMessage(error?.message || 'Could not read the current location. Check Android location permission.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLocationRemindersToggle = async (enabled: boolean) => {
    if (!enabled) {
      updateUserSettings({ geofenceEnabled: false });
      return;
    }
    setMessage(null);
    try {
      const permissions = await requestNativeGeofencePermissions();
      if (!permissions.foregroundGranted) {
        setMessage('Location permission is required. DayTrace left location reminders off.');
        return;
      }
      if (!permissions.backgroundGranted) {
        setMessage('Choose “Allow all the time” for DayTrace in Android location settings, then enable reminders again.');
        return;
      }
      updateUserSettings({ geofenceEnabled: true });
      setMessage('Location reminders are enabled, including while DayTrace is closed.');
    } catch (error: any) {
      setMessage(error?.message || 'Could not request Android location permission.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[32px] border border-[#44474E] bg-[#1D2026] p-5 text-[#E2E2E6]" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#44474E]/40 pb-3">
          <div className="flex items-center gap-2"><Radio className="h-5 w-5 text-[#86EFAC]" /><div><h2 className="text-sm font-bold">Smart Locations</h2><p className="text-[10px] text-[#C4C6D0]">Private radius-based context and reminders</p></div></div>
          <button onClick={onClose} className="p-1 text-[#C4C6D0]"><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-4 space-y-2 rounded-2xl bg-[#111318] p-3">
          <label className="flex items-center justify-between gap-3 text-xs font-bold">
            <span>Location reminders</span>
            <input type="checkbox" checked={!!settings.geofenceEnabled} onChange={(event) => void handleLocationRemindersToggle(event.target.checked)} />
          </label>
          <label className="flex items-center justify-between gap-3 text-xs font-bold">
            <span><span className="block">Learn new locations</span><span className="text-[10px] font-normal text-[#C4C6D0]">Optional, balanced-power dwell detection</span></span>
            <input type="checkbox" checked={!!settings.locationLearningEnabled} onChange={(event) => updateUserSettings({ locationLearningEnabled: event.target.checked })} />
          </label>
          <label className="block text-[10px] text-[#C4C6D0]">Dwell before asking: {settings.locationDwellMinutes || 10} minutes
            <input className="mt-1 w-full" type="range" min="5" max="30" step="5" value={settings.locationDwellMinutes || 10} onChange={(event) => updateUserSettings({ locationDwellMinutes: Number(event.target.value) })} />
          </label>
        </div>

        <div className="mt-4 rounded-2xl border border-[#D1E1FF]/25 bg-[#111318] p-3">
          <p className="text-xs font-bold">Add current location</p>
          <div className="mt-2 flex gap-2">
            <input value={newLocationName} onChange={(event) => setNewLocationName(event.target.value)} placeholder="e.g. Grandma’s House" className="min-w-0 flex-1 rounded-xl border border-[#44474E] bg-[#1D2026] px-3 py-2 text-xs outline-none" />
            <button disabled={!newLocationName.trim() || isSaving} onClick={handleSaveCurrent} className="rounded-xl bg-[#D1E1FF] px-3 text-[#003062] disabled:opacity-40"><Navigation className="h-4 w-4" /></button>
          </div>
          {message && <p className="mt-2 text-[10px] text-[#D1E1FF]">{message}</p>}
        </div>

        <div className="mt-4 space-y-2">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#D1E1FF]">Saved places</h3>
          {locations.length === 0 && <div className="rounded-2xl border border-dashed border-[#44474E] p-5 text-center text-xs text-[#C4C6D0]">No locations saved. DayTrace does not assume Home, Office or Gym.</div>}
          {locations.map((location) => (
            <div key={location.id} className="rounded-2xl bg-[#111318] p-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#D1E1FF]" />
                {editingId === location.id ? (
                  <input autoFocus value={editingName} onChange={(event) => setEditingName(event.target.value)} className="min-w-0 flex-1 rounded-lg bg-[#1D2026] px-2 py-1 text-xs" />
                ) : <span className="min-w-0 flex-1 text-xs font-bold">{location.name}</span>}
                {editingId === location.id ? (
                  <button onClick={() => { updateSavedLocation(location.id, { name: editingName.trim() || location.name }); setEditingId(null); }} className="rounded-lg bg-[#334867] px-2 py-1 text-[10px] font-bold">Save</button>
                ) : (
                  <button onClick={() => { setEditingId(location.id); setEditingName(location.name); }} className="p-1 text-[#C4C6D0]"><Pencil className="h-3.5 w-3.5" /></button>
                )}
                <button onClick={() => deleteSavedLocation(location.id)} className="p-1 text-[#FCA5A5]"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <label className="flex-1 text-[10px] text-[#C4C6D0]">Radius {location.radiusMeters}m
                  <input className="mt-1 w-full" type="range" min="100" max="500" step="50" value={location.radiusMeters} onChange={(event) => updateSavedLocation(location.id, { radiusMeters: Number(event.target.value) })} />
                </label>
                <button onClick={() => simulateGeofenceEnter(location.name)} className="rounded-xl bg-[#334867] px-2.5 py-1.5 text-[10px] font-bold text-[#D1E1FF]">Mark here now</button>
              </div>
            </div>
          ))}
        </div>

        {ignored.length > 0 && (
          <div className="mt-4 space-y-2">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#D1E1FF]">Ignored areas</h3>
            {ignored.map((cluster, index) => (
              <div key={cluster.id} className="flex items-center justify-between rounded-xl bg-[#111318] px-3 py-2 text-[10px] text-[#C4C6D0]">
                <span>Ignored area {index + 1} • {cluster.radiusMeters}m radius</span>
                <button onClick={() => unignoreLocation(cluster.id)} className="font-bold text-[#D1E1FF]">Allow prompt again</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
