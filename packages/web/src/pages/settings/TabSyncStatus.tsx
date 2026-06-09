import { useEffect, useState } from 'react';

export default function TabSyncStatus() {
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported('BroadcastChannel' in window);
  }, []);

  if (!supported) {
    return (
      <div className="flex items-center gap-2 text-sm text-warning-700 bg-warning-50 border border-warning-200 rounded-lg px-3 py-2">
        <span>[!]</span>
        <span>Multi-tab sync not supported in this browser.</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-success-700 bg-success-50 border border-success-200 rounded-lg px-3 py-2">
      <span>[OK]</span>
      <span>Multi-tab sync active. Auth state is synchronized across tabs.</span>
    </div>
  );
}
