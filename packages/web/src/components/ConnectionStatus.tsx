interface ConnectionStatusProps {
  connectionState: string;
  onReconnect: () => void;
}

export default function ConnectionStatus({ connectionState, onReconnect }: ConnectionStatusProps) {
  const config: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    connected: { bg: 'bg-success-50', text: 'text-success-700', dot: 'bg-success-500', label: 'Connected' },
    connecting: { bg: 'bg-info-50', text: 'text-info-700', dot: 'bg-info-500', label: 'Connecting...' },
    reconnecting: { bg: 'bg-warning-50', text: 'text-warning-700', dot: 'bg-warning-500', label: 'Reconnecting...' },
    disconnected: { bg: 'bg-danger-50', text: 'text-danger-700', dot: 'bg-danger-500', label: 'Disconnected' },
  };

  const c = config[connectionState] ?? config.disconnected;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold ${c.bg} ${c.text}`}>
      <span className={`w-2 h-2 rounded-full ${c.dot}`} />
      <span>{c.label}</span>
      {connectionState === 'disconnected' && (
        <button onClick={onReconnect} className="ml-1 underline hover:no-underline">
          Reconnect
        </button>
      )}
    </div>
  );
}
