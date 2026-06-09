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
      <h2 className="mb-4 text-lg font-bold text-neutral-900">Appearance</h2>
      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={darkMode}
          onChange={(e) => setDarkMode(e.target.checked)}
          className="h-5 w-5 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
        />
        <span className="text-sm text-neutral-700">Dark Mode</span>
      </label>
      <p className="mt-2 text-xs text-neutral-500">
        Toggles the <code>dark</code> class on the root element for Tailwind dark mode.
      </p>
    </div>
  );
}
