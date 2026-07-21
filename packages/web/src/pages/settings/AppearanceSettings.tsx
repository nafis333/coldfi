import { useState, useEffect } from 'react';

const STORAGE_KEY = 'coldfi:darkMode';

export default function AppearanceSettings() {
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored === 'true';
    return document.documentElement.classList.contains('dark');
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem(STORAGE_KEY, String(darkMode));
  }, [darkMode]);

  return (
    <div>
      <h2 className="mb-4 text-lg font-bold text-neutral-900 dark:text-white">Appearance</h2>
      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-neutral-200 dark:border-neutral-700 p-4 hover:bg-neutral-50 dark:hover:bg-neutral-700/30 transition-colors">
        <input
          type="checkbox"
          checked={darkMode}
          onChange={(e) => setDarkMode(e.target.checked)}
          className="h-5 w-5 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
        />
        <div>
          <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Dark Mode</span>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">Use dark theme for the application</p>
        </div>
      </label>
    </div>
  );
}