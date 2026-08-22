import React, { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useDay } from '../../context/DayContext';

export const DestructiveConfirmationModal: React.FC = () => {
  const {
    destructiveConfirmation,
    confirmDestructiveAction,
    cancelDestructiveAction,
  } = useDay();

  useEffect(() => {
    if (!destructiveConfirmation) return;
    const cancelOnBack = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Backspace') {
        event.preventDefault();
        cancelDestructiveAction();
      }
    };
    window.addEventListener('keydown', cancelOnBack);
    return () => window.removeEventListener('keydown', cancelOnBack);
  }, [cancelDestructiveAction, destructiveConfirmation]);

  if (!destructiveConfirmation) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      onClick={cancelDestructiveAction}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="destructive-dialog-title"
        aria-describedby="destructive-dialog-description"
        className="w-full max-w-sm rounded-[28px] border border-[#FCA5A5]/40 bg-[#1D2026] p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-[#7F1D1D]/35 p-2 text-[#FCA5A5]">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="destructive-dialog-title" className="text-sm font-bold text-[#E2E2E6]">
              {destructiveConfirmation.title}
            </h2>
            <p id="destructive-dialog-description" className="mt-1.5 text-xs leading-relaxed text-[#C4C6D0]">
              {destructiveConfirmation.description}
            </p>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            autoFocus
            onClick={cancelDestructiveAction}
            className="flex-1 rounded-2xl bg-[#2E3036] px-4 py-2.5 text-xs font-bold text-[#E2E2E6]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirmDestructiveAction}
            className="flex-1 rounded-2xl bg-[#BA1A1A] px-4 py-2.5 text-xs font-bold text-white"
          >
            {destructiveConfirmation.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
