import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { toLocalDateKey } from '../../utils/dailyHistory';

interface CompactDateBrowserProps {
  selectedDate: string;
  isLoading: boolean;
  message?: string | null;
  onClose: () => void;
  onViewDate: (date: string) => Promise<void>;
}

const monthKey = (date: string): string => `${date.slice(0, 7)}-01`;

const moveMonth = (date: string, offset: number): string => {
  const current = new Date(`${date}T12:00:00`);
  return toLocalDateKey(new Date(current.getFullYear(), current.getMonth() + offset, 1, 12));
};

export const CompactDateBrowser: React.FC<CompactDateBrowserProps> = ({
  selectedDate,
  isLoading,
  message,
  onClose,
  onViewDate,
}) => {
  const today = toLocalDateKey();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = toLocalDateKey(yesterdayDate);
  const [chosenDate, setChosenDate] = useState(selectedDate);
  const [visibleMonth, setVisibleMonth] = useState(monthKey(selectedDate));

  const calendar = useMemo(() => {
    const first = new Date(`${visibleMonth}T12:00:00`);
    const year = first.getFullYear();
    const month = first.getMonth();
    const leading = first.getDay();
    const days = new Date(year, month + 1, 0).getDate();
    return {
      label: first.toLocaleDateString([], { month: 'long', year: 'numeric' }),
      cells: [
        ...Array.from({ length: leading }, () => null),
        ...Array.from({ length: days }, (_, index) => toLocalDateKey(new Date(year, month, index + 1, 12))),
      ],
    };
  }, [visibleMonth]);

  const chooseQuickDate = (date: string) => {
    setChosenDate(date);
    setVisibleMonth(monthKey(date));
  };

  return (
    <div id="compact-date-browser" className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm space-y-3 rounded-[26px] border border-[#44474E]/50 bg-[#1D2026] p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-[#44474E]/30 pb-3">
          <div>
            <h3 className="text-sm font-bold text-[#E2E2E6]">Choose DayTrace date</h3>
            <p className="mt-0.5 text-[10px] text-[#C4C6D0]">Previous days open as read-only history.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-[#C4C6D0]" aria-label="Close date browser"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => chooseQuickDate(yesterday)} className="rounded-xl bg-[#2E3036] py-2 text-[11px] font-semibold text-[#E2E2E6]">Yesterday</button>
          <button type="button" onClick={() => chooseQuickDate(today)} className="rounded-xl bg-[#2E3036] py-2 text-[11px] font-semibold text-[#E2E2E6]">Today</button>
        </div>

        <div className="rounded-2xl border border-[#44474E]/40 bg-[#111318] p-3">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => setVisibleMonth((current) => moveMonth(current, -1))} className="rounded-lg p-1.5 text-[#D1E1FF]" aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button>
            <p className="text-xs font-bold text-[#E2E2E6]">{calendar.label}</p>
            <button type="button" disabled={visibleMonth >= monthKey(today)} onClick={() => setVisibleMonth((current) => moveMonth(current, 1))} className="rounded-lg p-1.5 text-[#D1E1FF] disabled:opacity-25" aria-label="Next month"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[9px] text-[#C4C6D0]/65">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
            {calendar.cells.map((date, index) => date ? (
              <button
                key={date}
                type="button"
                disabled={date > today}
                onClick={() => setChosenDate(date)}
                className={`aspect-square rounded-lg text-[11px] font-semibold ${date === chosenDate ? 'bg-[#D1E1FF] text-[#003062]' : date === today ? 'border border-cyan-300/60 text-cyan-200' : 'text-[#E2E2E6] hover:bg-[#2E3036]'} disabled:opacity-20`}
              >
                {Number(date.slice(-2))}
              </button>
            ) : <span key={`blank-${index}`} />)}
          </div>
        </div>

        {message && <p className="rounded-xl bg-[#2E3036] p-2.5 text-[10px] text-[#C4C6D0]">{message}</p>}
        <button
          type="button"
          disabled={isLoading}
          onClick={async () => { await onViewDate(chosenDate); onClose(); }}
          className="w-full rounded-2xl bg-[#D1E1FF] py-2.5 text-xs font-bold text-[#003062] disabled:opacity-40"
        >
          {isLoading ? 'Loading…' : `View ${chosenDate}`}
        </button>
      </div>
    </div>
  );
};
