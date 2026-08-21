import React, { useState } from 'react';
import { 
  MapPin, 
  Navigation, 
  Sparkles, 
  Check, 
  X, 
  ShieldCheck, 
  Building2, 
  Home, 
  Dumbbell, 
  Radio, 
  Clock, 
  Compass, 
  CheckCircle2, 
  Zap 
} from 'lucide-react';
import { useDay } from '../../context/DayContext';
import { GeofenceLocation } from '../../types';

interface GeofenceManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GeofenceManagerModal: React.FC<GeofenceManagerModalProps> = ({ isOpen, onClose }) => {
  const { state, simulateGeofenceEnter, updateUserSettings } = useDay();
  const [selectedSimLocation, setSelectedSimLocation] = useState<string>('');

  if (!isOpen) return null;

  const locations: GeofenceLocation[] = state.geofenceLocations || [
    {
      id: 'geo-office',
      name: 'Office',
      latitude: 37.7899,
      longitude: -122.4008,
      radiusMeters: 250,
      arrivalMessage: 'Welcome to Office. Reviewing priority tasks for today.',
      departureMessage: 'Departing Office. Time to wrap up tasks and start evening transition!',
      targetDepartureTime: '18:30',
    },
    {
      id: 'geo-home',
      name: 'Home',
      latitude: 37.7749,
      longitude: -122.4194,
      radiusMeters: 200,
      arrivalMessage: 'Arrived Home. Shift mode to family and recharge.',
      departureMessage: 'Leaving Home for the day.',
    },
    {
      id: 'geo-gym',
      name: 'Gym',
      latitude: 37.7833,
      longitude: -122.4167,
      radiusMeters: 150,
      arrivalMessage: 'Arrived at Gym. Time to power through workout routine!',
      departureMessage: 'Workout complete. Log hydration and post-workout meal.',
    },
  ];

  const currentLocation = state.current.location || 'Home';

  const handleSimulate = (locName: string) => {
    simulateGeofenceEnter(locName);
  };

  const getLocationIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('office') || lower.includes('work')) return Building2;
    if (lower.includes('home')) return Home;
    if (lower.includes('gym')) return Dumbbell;
    return MapPin;
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
            <div className="p-2 rounded-2xl bg-[#86EFAC]/10 text-[#86EFAC]">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-[#E2E2E6]">Smart Geofence Automation</h2>
              <p className="text-[11px] text-[#C4C6D0]/70">Auto-trigger location routines & departure alarms</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#C4C6D0] hover:text-[#E2E2E6] p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Active Location Radar Card */}
        <div className="p-4 rounded-3xl bg-[#111318] border border-[#44474E]/40 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[#334867] text-[#D1E1FF] flex items-center justify-center relative">
              <MapPin className="w-5 h-5" />
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[#86EFAC] rounded-full animate-ping" />
            </div>
            <div>
              <span className="text-[10px] text-[#C4C6D0]/70 uppercase tracking-wider font-semibold block">Current Verified Location</span>
              <span className="text-sm font-bold text-[#E2E2E6]">{currentLocation}</span>
            </div>
          </div>

          <span className="text-[10px] text-[#86EFAC] font-mono bg-[#064E3B]/40 px-2.5 py-1 rounded-full border border-[#059669]/40">
            Active Geofence
          </span>
        </div>

        {/* 1-Click Simulation Buttons */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#D1E1FF] uppercase tracking-wider">Simulate Arrival / Departure Routine</span>
            <span className="text-[10px] text-[#C4C6D0]/60">Triggers automation</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {locations.map((loc) => {
              const Icon = getLocationIcon(loc.name);
              const isCurrent = currentLocation.toLowerCase() === loc.name.toLowerCase();

              return (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => handleSimulate(loc.name)}
                  className={`p-3 rounded-2xl flex flex-col items-center justify-center space-y-1.5 border transition ${
                    isCurrent
                      ? 'bg-[#334867] border-[#D1E1FF] text-[#D1E1FF] shadow-sm'
                      : 'bg-[#111318] border-[#44474E]/30 text-[#C4C6D0] hover:bg-[#2E3036]'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-bold">{loc.name}</span>
                  <span className="text-[9px] opacity-70">
                    {isCurrent ? 'Here Now' : 'Simulate'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Configured Geofence Profiles */}
        <div className="space-y-2.5 pt-1">
          <span className="text-xs font-bold text-[#D1E1FF] uppercase tracking-wider block">Configured Geofences & Routines</span>

          <div className="space-y-2">
            {locations.map((loc) => {
              const Icon = getLocationIcon(loc.name);
              return (
                <div
                  key={loc.id}
                  className="p-3 rounded-2xl bg-[#111318] border border-[#44474E]/30 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Icon className="w-4 h-4 text-[#D1E1FF]" />
                      <span className="text-xs font-bold text-[#E2E2E6]">{loc.name} Zone</span>
                    </div>
                    <span className="text-[10px] text-[#C4C6D0]/70 font-mono">Radius: {loc.radiusMeters}m</span>
                  </div>

                  {loc.arrivalMessage && (
                    <p className="text-[11px] text-[#C4C6D0]/80 pl-6 border-l-2 border-[#D1E1FF]/40">
                      <strong>Arrival:</strong> {loc.arrivalMessage}
                    </p>
                  )}

                  {loc.departureMessage && (
                    <p className="text-[11px] text-[#C4C6D0]/80 pl-6 border-l-2 border-[#F87171]/40">
                      <strong>Departure:</strong> {loc.departureMessage}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
