import { useEffect, useState } from 'react';
import { Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type SyncState = 'online' | 'offline' | 'syncing';

export function SyncStatus() {
  const [state, setState] = useState<SyncState>('online');
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const checkOnline = () => {
      if (navigator.onLine) {
        setState((prev) => (prev === 'syncing' ? 'syncing' : 'online'));
      } else {
        setState('offline');
      }
    };

    checkOnline();
    window.addEventListener('online', () => setState('syncing'));
    window.addEventListener('offline', () => setState('offline'));

    const interval = setInterval(checkOnline, 30000);
    return () => {
      window.removeEventListener('online', () => setState('syncing'));
      window.removeEventListener('offline', () => setState('offline'));
      clearInterval(interval);
    };
  }, []);

  const config = {
    online: { icon: Cloud, color: 'text-forest-600', bg: 'bg-forest-50', label: 'Synced' },
    offline: { icon: CloudOff, color: 'text-kente-700', bg: 'bg-kente-50', label: 'Working offline' },
    syncing: { icon: RefreshCw, color: 'text-forest-600', bg: 'bg-forest-50', label: 'Syncing…' },
  };

  const { icon: Icon, color, bg, label } = config[state];

  return (
    <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${bg} ${color}`}>
      <Icon className={`h-3.5 w-3.5 ${state === 'syncing' ? 'animate-spin' : ''}`} />
      <span>{label}</span>
      {pendingCount > 0 && state === 'offline' && <span className="opacity-75">· {pendingCount} pending</span>}
    </div>
  );
}
