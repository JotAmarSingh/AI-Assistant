import React, { useState } from 'react';
import { MapPin } from 'lucide-react';
import { useDay } from '../../context/DayContext';

export const LocationLearningPrompts: React.FC = () => {
  const {
    pendingLocationLearning,
    dismissLocationLearning,
    saveLearnedLocation,
    locationNameConflict,
    resolveLocationNameConflict,
  } = useDay();
  const [isNaming, setIsNaming] = useState(false);
  const [label, setLabel] = useState('');

  if (locationNameConflict) {
    return (
      <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/75 p-4" onClick={() => resolveLocationNameConflict('CANCEL')}>
        <div className="w-full max-w-sm rounded-[28px] border border-[#44474E] bg-[#1D2026] p-5" onClick={(event) => event.stopPropagation()}>
          <h2 className="text-sm font-bold text-[#E2E2E6]">“{locationNameConflict.label}” already exists</h2>
          <p className="mt-2 text-xs text-[#C4C6D0]">Choose what DayTrace should do with the current coordinates.</p>
          <div className="mt-4 grid gap-2">
            <button className="rounded-2xl bg-[#D1E1FF] px-4 py-2.5 text-xs font-bold text-[#003062]" onClick={() => resolveLocationNameConflict('UPDATE')}>Update existing place</button>
            <button className="rounded-2xl bg-[#334867] px-4 py-2.5 text-xs font-bold text-[#D1E1FF]" onClick={() => resolveLocationNameConflict('CREATE')}>Create another place</button>
            <button autoFocus className="rounded-2xl bg-[#2E3036] px-4 py-2.5 text-xs font-bold text-[#E2E2E6]" onClick={() => resolveLocationNameConflict('CANCEL')}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  if (!pendingLocationLearning) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4" onClick={() => dismissLocationLearning(false)}>
      <div className="w-full max-w-sm rounded-[28px] border border-[#44474E] bg-[#1D2026] p-5" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-[#334867] p-2 text-[#D1E1FF]"><MapPin className="h-5 w-5" /></div>
          <div>
            <h2 className="text-sm font-bold text-[#E2E2E6]">Would you like to save this location?</h2>
            <p className="mt-1 text-xs text-[#C4C6D0]">DayTrace noticed that you stayed in a new area. It will save a privacy-friendly radius, not assume a name.</p>
          </div>
        </div>

        {isNaming ? (
          <div className="mt-4 space-y-3">
            <input
              autoFocus
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="e.g. Grandma’s House"
              className="w-full rounded-2xl border border-[#44474E] bg-[#111318] px-3 py-2.5 text-xs text-[#E2E2E6] outline-none focus:border-[#D1E1FF]"
            />
            <div className="flex gap-2">
              <button className="flex-1 rounded-2xl bg-[#2E3036] py-2.5 text-xs font-bold" onClick={() => setIsNaming(false)}>Back</button>
              <button
                className="flex-1 rounded-2xl bg-[#D1E1FF] py-2.5 text-xs font-bold text-[#003062] disabled:opacity-40"
                disabled={!label.trim()}
                onClick={() => {
                  saveLearnedLocation(label);
                  setLabel('');
                  setIsNaming(false);
                }}
              >Save place</button>
            </div>
          </div>
        ) : (
          <div className="mt-5 flex gap-2">
            <button autoFocus className="flex-1 rounded-2xl bg-[#2E3036] py-2.5 text-xs font-bold text-[#E2E2E6]" onClick={() => dismissLocationLearning(true)}>No, ignore here</button>
            <button className="flex-1 rounded-2xl bg-[#D1E1FF] py-2.5 text-xs font-bold text-[#003062]" onClick={() => setIsNaming(true)}>Yes, name it</button>
          </div>
        )}
      </div>
    </div>
  );
};
