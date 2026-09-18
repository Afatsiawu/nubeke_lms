import { useEffect, useState, useCallback } from 'react';
import { Cloud, CloudOff, RefreshCw, AlertCircle } from 'lucide-react';
import { getPendingCount, syncQueue, isOnline } from '@/lib/offline-queue';

type SyncState = 'online' | 'offline' | 'syncing' | 'error';

export function SyncStatus() {
  const [state, setState] = useState<SyncState>('online');
  const [pendingCount, setPendingCount] = useState(0);
  const [syncErrors, setSyncErrors] = useState<string[]>([]);

  const refreshPending = useCallback(async () => {
    const count = await getPendingCount();
    setPendingCount(count);
    return count;
  }, []);

  const doSync = useCallback(async () => {
    setState('syncing');
    setSyncErrors([]);
    const result = await syncQueue();
    await refreshPending();
    if (result.failed > 0 && result.synced === 0) {
      setState('error');
      setSyncErrors(result.errors);
    } else if (result.failed > 0) {
      setSyncErrors(result.errors);
      setState('online');
    } else {
      setState('online');
    }
  }, [refreshPending]);

  useEffect(() => {
    refreshPending();

    const handleOnline = () => {
      setState('syncing');
      doSync();
    };
    const handleOffline = () => setState('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (!isOnline()) {
      setState('offline');
    }

    const interval = setInterval(() => {
      refreshPending();
      if (isOnline() && (state === 'online' || state === 'error')) {
        getPendingCount().then((count) => {
          if (count > 0) {
            doSync();
          }
        });
      }
    }, 15000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [refreshPending, doSync, state]);

  const config: Record<SyncState, { icon: typeof Cloud; color: string; bg: string; label: string }> = {
    online: { icon: Cloud, color: 'text-forest-600', bg: 'bg-forest-50', label: 'Synced' },
    offline: { icon: CloudOff, color: 'text-kente-700', bg: 'bg-kente-50', label: 'Working offline' },
    syncing: { icon: RefreshCw, color: 'text-forest-600', bg: 'bg-forest-50', label: 'Syncing…' },
    error: { icon: AlertCircle, color: 'text-rust-600', bg: 'bg-rust-50', label: 'Sync error' },
  };

  const { icon: Icon, color, bg, label } = config[state];

  return (
    <div className="flex flex-col gap-1">
      <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${bg} ${color}`}>
        <Icon className={`h-3.5 w-3.5 ${state === 'syncing' ? 'animate-spin' : ''}`} />
        <span>{label}</span>
        {pendingCount > 0 && (state === 'offline' || state === 'error') && (
          <span className="opacity-75">· {pendingCount} pending</span>
        )}
        {state === 'error' && (
          <button onClick={doSync} className="ml-1 underline hover:no-underline">Retry</button>
        )}
      </div>
      {syncErrors.length > 0 && state === 'error' && (
        <div className="text-xs text-rust-600 max-w-[200px] truncate" title={syncErrors.join('; ')}>
          {syncErrors[0]}
        </div>
      )}
    </div>
  );
}
