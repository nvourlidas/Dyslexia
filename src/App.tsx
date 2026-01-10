import { useState } from 'react';
import { getInitialTheme, toggleTheme, type ThemeMode } from './theme/theme';

export default function App() {
  const [mode, setMode] = useState<ThemeMode>(getInitialTheme());

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="mx-auto max-w-5xl p-6">
        <div className="flex items-center justify-between rounded-xl border border-border bg-panel p-4">
          <div>
            <div className="text-lg font-semibold">CRM Web</div>
            <div className="text-sm text-muted">Theme: {mode}</div>
          </div>

          <button
            className="rounded-lg border border-border bg-panel2 px-3 py-2 text-sm hover:opacity-90"
            onClick={() => setMode(toggleTheme(mode))}
          >
            Toggle theme
          </button>
        </div>
      </div>
    </div>
  );
}
