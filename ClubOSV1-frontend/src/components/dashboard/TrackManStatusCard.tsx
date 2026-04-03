import React, { useState, useEffect, useCallback } from 'react';
import { Monitor, Power, RefreshCw } from 'lucide-react';
import { trackmanRemoteAPI } from '@/api/trackmanRemote';
import toast from 'react-hot-toast';
import Link from 'next/link';

export function TrackManStatusCard() {
  const [total, setTotal] = useState(0);
  const [online, setOnline] = useState(0);
  const [lastRestart, setLastRestart] = useState<string | null>(null);
  const [restarting, setRestarting] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await trackmanRemoteAPI.getDevices();
      if (res.data?.success) {
        setTotal(res.data.data.total || 0);
        setOnline(res.data.data.online || 0);
      }
    } catch { /* silent */ }

    try {
      const res = await trackmanRemoteAPI.getHistory(1);
      if (res.data?.success && res.data.data.length > 0) {
        setLastRestart(res.data.data[0].requested_at);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleRestart = async () => {
    if (!confirm(`Restart TrackMan on all ${total} PCs?`)) return;
    setRestarting(true);
    try {
      const res = await trackmanRemoteAPI.restartAll();
      if (res.data?.success) toast.success(res.data.message);
      else toast.error('Failed');
    } catch {
      toast.error('Failed to send restart');
    }
    setRestarting(false);
  };

  const timeAgo = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const diff = Date.now() - new Date(dateStr).getTime();
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  if (total === 0) return null;

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-[var(--text-primary)]">TrackMan</span>
        </div>
        <span className={`w-2 h-2 rounded-full ${online === total ? 'bg-green-500' : online > 0 ? 'bg-yellow-500' : 'bg-red-500'}`} />
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--text-secondary)]">Status</span>
        <span className="text-[var(--text-primary)] font-medium">{online}/{total} Online</span>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--text-secondary)]">Last restart</span>
        <span className="text-[var(--text-primary)]">{timeAgo(lastRestart)}</span>
      </div>

      <div className="flex gap-2">
        <button onClick={handleRestart} disabled={restarting}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all disabled:opacity-50">
          {restarting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Power className="w-3 h-3" />}
          Restart All
        </button>
        <Link href="/operations?tab=trackman"
          className="flex items-center justify-center px-3 py-1.5 text-xs bg-[var(--bg-tertiary)] hover:bg-[var(--bg-primary)] border border-[var(--border-secondary)] rounded-lg transition-all text-[var(--text-secondary)]">
          Manage
        </Link>
      </div>
    </div>
  );
}
