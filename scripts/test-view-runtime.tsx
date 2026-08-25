import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DayProvider } from '../src/context/DayContext';
import { TaskBoardView } from '../src/components/views/TaskBoardView';
import { RemindersAnchorsView } from '../src/components/views/RemindersAnchorsView';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  },
});

const renderView = (name: string, View: React.ComponentType) => {
  const markup = renderToStaticMarkup(<DayProvider><View /></DayProvider>);
  if (!markup.includes(`id="${name}"`)) throw new Error(`${name} did not render`);
};

renderView('task-board-view', TaskBoardView);
renderView('reminders-anchors-view', RemindersAnchorsView);
console.log('View runtime smoke tests passed.');
