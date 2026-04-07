import React, { useState, useEffect, useCallback } from 'react';
import { Monitor, RefreshCw, Power, PowerOff, Plus, Trash2, Settings, Clock, CheckCircle, XCircle, AlertCircle, Copy } from 'lucide-react';
import { trackmanRemoteAPI } from '@/api/trackmanRemote';
import toast from 'react-hot-toast';

interface Device {
  id: string;
  hostname: string;
  display_name: string;
  location: string;
  bay_number: number | null;
  last_seen_at: string | null;
  last_restart_at: string | null;
  status: string;
  tps_version: string | null;
  is_online: boolean;
}

interface RestartEvent {
  id: string;
  status: string;
  source: string;
  requested_at: string;
  completed_at: string | null;
  result_message: string | null;
  hostname: string;
  display_name: string;
  location: string;
  requested_by_name: string | null;
}

interface AutoRestartSettings {
  enabled: boolean;
  cron: string;
  notify_slack: boolean;
}

export function TrackManPanel() {
  const [devices, setDevices] = useState<Record<string, Device[]>>({});
  const [total, setTotal] = useState(0);
  const [online, setOnline] = useState(0);
  const [history, setHistory] = useState<RestartEvent[]>([]);
  const [settings, setSettings] = useState<AutoRestartSettings>({ enabled: true, cron: '0 3 * * *', notify_slack: true });
  const [loading, setLoading] = useState(true);
  const [restarting, setRestarting] = useState(false);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [newDevice, setNewDevice] = useState({ hostname: '', display_name: '', location: 'Bedford', bay_number: '' });
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'devices' | 'history'>('devices');
  const [locationConfigs, setLocationConfigs] = useState<{ name: string; bays: number }[]>([]);

  const fetchLocations = useCallback(async () => {
    try {
      const res = await trackmanRemoteAPI.getLocations();
      if (res.data?.success) setLocationConfigs(res.data.data || []);
    } catch { /* silent */ }
  }, []);

  const fetchDevices = useCallback(async () => {
    try {
      const res = await trackmanRemoteAPI.getDevices();
      if (res.data?.success) {
        setDevices(res.data.data.devices || {});
        setTotal(res.data.data.total || 0);
        setOnline(res.data.data.online || 0);
      }
    } catch { /* silent */ }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await trackmanRemoteAPI.getHistory(30);
      if (res.data?.success) setHistory(res.data.data || []);
    } catch { /* silent */ }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await trackmanRemoteAPI.getSettings();
      if (res.data?.success) setSettings(res.data.data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    Promise.all([fetchDevices(), fetchHistory(), fetchSettings(), fetchLocations()]).finally(() => setLoading(false));
    const interval = setInterval(fetchDevices, 30000);
    return () => clearInterval(interval);
  }, [fetchDevices, fetchHistory, fetchSettings]);

  const handleRestartAll = async () => {
    if (!confirm(`Restart TrackMan on all ${total} PCs? They will restart within 60 seconds.`)) return;
    setRestarting(true);
    try {
      const res = await trackmanRemoteAPI.restartAll();
      if (res.data?.success) {
        toast.success(res.data.message || 'Restart commands sent');
        setTimeout(fetchHistory, 2000);
      } else {
        toast.error(res.data?.error || 'Failed');
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to send restart');
    }
    setRestarting(false);
  };

  const handleRestartLocation = async (location: string) => {
    const count = (devices[location] || []).length;
    if (!confirm(`Restart TrackMan on ${count} PCs at ${location}?`)) return;
    try {
      const res = await trackmanRemoteAPI.restartLocation(location);
      if (res.data?.success) toast.success(`Restart sent to ${location}`);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed');
    }
  };

  const handleRestartDevice = async (deviceId: string, name: string) => {
    if (!confirm(`Restart TrackMan on ${name}?`)) return;
    try {
      const res = await trackmanRemoteAPI.restartDevices([deviceId]);
      if (res.data?.success) toast.success(`Restart sent to ${name}`);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed');
    }
  };

  const handleAddDevice = async () => {
    if (!newDevice.hostname || !newDevice.display_name) {
      toast.error('Hostname and display name required');
      return;
    }
    try {
      const res = await trackmanRemoteAPI.registerDevice({
        hostname: newDevice.hostname,
        display_name: newDevice.display_name,
        location: newDevice.location,
        bay_number: newDevice.bay_number ? parseInt(newDevice.bay_number) : undefined,
      });
      if (res.data?.success) {
        setNewApiKey(res.data.data.api_key);
        toast.success('Device registered');
        fetchDevices();
        setNewDevice({ hostname: '', display_name: '', location: 'Bedford', bay_number: '' });
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to register');
    }
  };

  const handleRemoveDevice = async (id: string, name: string) => {
    if (!confirm(`Remove ${name}? The PC will stop reporting.`)) return;
    try {
      await trackmanRemoteAPI.removeDevice(id);
      toast.success(`${name} removed`);
      fetchDevices();
    } catch {
      toast.error('Failed to remove');
    }
  };

  const handleSaveSettings = async () => {
    try {
      const res = await trackmanRemoteAPI.updateSettings(settings);
      if (res.data?.success) toast.success('Settings saved');
    } catch {
      toast.error('Failed to save');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const timeAgo = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const diff = Date.now() - new Date(dateStr).getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const cronToHuman = (expr: string) => {
    const parts = expr.split(' ');
    if (parts.length !== 5) return expr;
    const [min, hour] = parts;
    const h = parseInt(hour);
    const m = parseInt(min);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `Daily at ${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      completed: 'bg-green-900/50 text-green-400 border-green-700',
      pending: 'bg-yellow-900/50 text-yellow-400 border-yellow-700',
      acknowledged: 'bg-blue-900/50 text-blue-400 border-blue-700',
      failed: 'bg-red-900/50 text-red-400 border-red-700',
      expired: 'bg-gray-800 text-gray-500 border-gray-700',
    };
    return `inline-block px-2 py-0.5 text-xs rounded border ${colors[status] || colors.expired}`;
  };

  const sourceBadge = (source: string) => {
    return source === 'cron'
      ? 'inline-block px-2 py-0.5 text-xs rounded bg-purple-900/50 text-purple-400 border border-purple-700'
      : 'inline-block px-2 py-0.5 text-xs rounded bg-blue-900/50 text-blue-400 border border-blue-700';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-[var(--text-secondary)]">Loading TrackMan devices...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Monitor className="w-5 h-5 text-blue-400" />
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">TrackMan Remote</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              {online}/{total} Online
              <span className={`ml-2 inline-block w-2 h-2 rounded-full ${online === total && total > 0 ? 'bg-green-500' : online > 0 ? 'bg-yellow-500' : 'bg-red-500'}`} />
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[var(--bg-tertiary)] hover:bg-[var(--bg-primary)] border border-[var(--border-secondary)] rounded-lg transition-all">
            <Settings className="w-4 h-4" /> Schedule
          </button>
          <button onClick={() => setShowAddDevice(!showAddDevice)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[var(--bg-tertiary)] hover:bg-[var(--bg-primary)] border border-[var(--border-secondary)] rounded-lg transition-all">
            <Plus className="w-4 h-4" /> Add Device
          </button>
          <button onClick={handleRestartAll} disabled={restarting || total === 0}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all disabled:opacity-50">
            {restarting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
            Restart All
          </button>
        </div>
      </div>

      {/* Auto-restart settings */}
      {showSettings && (
        <div className="p-4 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg space-y-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Auto-Restart Schedule</h3>
          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={settings.enabled}
                onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                className="rounded accent-blue-500" />
              Enabled
            </label>
            <div className="flex items-center gap-2">
              <label className="text-sm text-[var(--text-secondary)]">Restart at:</label>
              <select value={(() => { const parts = settings.cron.split(' '); return parts.length === 5 ? parts[1] : '3'; })()}
                onChange={(e) => setSettings({ ...settings, cron: `0 ${e.target.value} * * *` })}
                className="px-2 py-1 text-sm bg-[var(--bg-primary)] border border-[var(--border)] rounded text-[var(--text-primary)]">
                {Array.from({ length: 24 }, (_, i) => {
                  const ampm = i >= 12 ? 'PM' : 'AM';
                  const h12 = i === 0 ? 12 : i > 12 ? i - 12 : i;
                  return <option key={i} value={String(i)}>{h12}:00 {ampm}</option>;
                })}
              </select>
              <span className="text-xs text-[var(--text-secondary)]">Daily</span>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={settings.notify_slack}
                onChange={(e) => setSettings({ ...settings, notify_slack: e.target.checked })}
                className="rounded accent-blue-500" />
              Slack notify
            </label>
            <button onClick={handleSaveSettings}
              className="px-3 py-1 text-sm bg-green-600 hover:bg-green-500 text-white rounded transition-all">
              Save
            </button>
          </div>
        </div>
      )}

      {/* Add device form */}
      {showAddDevice && (
        <div className="p-4 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg space-y-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Register New Device</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Location</label>
              <select value={newDevice.location}
                onChange={(e) => {
                  const loc = e.target.value;
                  setNewDevice({ ...newDevice, location: loc, bay_number: '1',
                    hostname: `${loc.toUpperCase().replace(/\s+/g, '-')}-BOX1`,
                    display_name: 'Box 1' });
                }}
                className="w-full px-3 py-2 text-sm bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-[var(--text-primary)]">
                {locationConfigs.map(l => <option key={l.name} value={l.name}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Box</label>
              <select value={newDevice.bay_number}
                onChange={(e) => {
                  const bay = e.target.value;
                  setNewDevice({ ...newDevice, bay_number: bay,
                    hostname: `${newDevice.location.toUpperCase().replace(/\s+/g, '-')}-BOX${bay}`,
                    display_name: `Box ${bay}` });
                }}
                className="w-full px-3 py-2 text-sm bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-[var(--text-primary)]">
                {Array.from({ length: (locationConfigs.find(l => l.name === newDevice.location)?.bays || 2) }, (_, i) => (
                  <option key={i + 1} value={String(i + 1)}>Box {i + 1}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Display Name</label>
              <input type="text" value={newDevice.display_name}
                onChange={(e) => setNewDevice({ ...newDevice, display_name: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-[var(--text-primary)]" />
            </div>
            <div className="flex items-end">
              <button onClick={handleAddDevice}
                className="w-full px-3 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all">
                Register
              </button>
            </div>
          </div>
          {newApiKey && (
            <div className="p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg">
              <p className="text-xs text-yellow-400 font-semibold mb-1">API Key (copy now - shown only once):</p>
              <div className="flex items-center gap-2">
                <code className="text-xs text-yellow-200 bg-black/30 px-2 py-1 rounded flex-1 break-all">{newApiKey}</code>
                <button onClick={() => copyToClipboard(newApiKey)}
                  className="p-1.5 hover:bg-yellow-800/50 rounded transition-all">
                  <Copy className="w-4 h-4 text-yellow-400" />
                </button>
              </div>
              <p className="text-xs text-yellow-500 mt-1">Paste this into the TrackMan Agent installer on the PC.</p>
            </div>
          )}
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 bg-[var(--bg-secondary)] p-1 rounded-lg w-fit">
        <button onClick={() => setActiveTab('devices')}
          className={`px-3 py-1.5 text-sm rounded-md transition-all ${activeTab === 'devices' ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] font-medium' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
          Devices
        </button>
        <button onClick={() => { setActiveTab('history'); fetchHistory(); }}
          className={`px-3 py-1.5 text-sm rounded-md transition-all ${activeTab === 'history' ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] font-medium' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
          History
        </button>
      </div>

      {/* Devices tab */}
      {activeTab === 'devices' && (
        <div className="space-y-4">
          {Object.entries(devices).map(([location, deviceList]) => (
            <div key={location} className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)]">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">{location}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-secondary)]">
                    {deviceList.filter(d => d.is_online).length}/{deviceList.length} online
                  </span>
                  <button onClick={() => handleRestartLocation(location)}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded transition-all">
                    <Power className="w-3 h-3" /> Restart
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-[var(--border)]">
                {deviceList.map(device => (
                  <div key={device.id} className="bg-[var(--bg-primary)] p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${device.is_online ? 'bg-green-500' : 'bg-gray-600'}`} />
                        <span className="text-sm font-medium text-[var(--text-primary)]">{device.display_name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleRestartDevice(device.id, device.display_name)}
                          className="p-1 hover:bg-blue-600/20 rounded transition-all" title="Restart">
                          <Power className="w-3.5 h-3.5 text-blue-400" />
                        </button>
                        <button onClick={() => handleRemoveDevice(device.id, device.display_name)}
                          className="p-1 hover:bg-red-600/20 rounded transition-all" title="Remove">
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] space-y-0.5">
                      <div className="flex justify-between">
                        <span>Hostname</span>
                        <span className="text-[var(--text-primary)] font-mono">{device.hostname}</span>
                      </div>
                      {device.bay_number && (
                        <div className="flex justify-between">
                          <span>Box</span><span>{device.bay_number}</span>
                        </div>
                      )}
                      {device.tps_version && (
                        <div className="flex justify-between">
                          <span>TPS Version</span><span>{device.tps_version}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Last seen</span><span>{timeAgo(device.last_seen_at)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Last restart</span><span>{timeAgo(device.last_restart_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {total === 0 && (
            <div className="text-center py-12 text-[var(--text-secondary)]">
              <Monitor className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No TrackMan devices registered yet.</p>
              <p className="text-sm mt-1">Click "Add Device" to register your first PC.</p>
            </div>
          )}
        </div>
      )}

      {/* History tab */}
      {activeTab === 'history' && (
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-secondary)]">
                  <th className="text-left px-4 py-2 font-medium">Time</th>
                  <th className="text-left px-4 py-2 font-medium">Device</th>
                  <th className="text-left px-4 py-2 font-medium">Location</th>
                  <th className="text-left px-4 py-2 font-medium">Source</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                  <th className="text-left px-4 py-2 font-medium">Message</th>
                </tr>
              </thead>
              <tbody>
                {history.map(event => (
                  <tr key={event.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-2 text-xs text-[var(--text-secondary)] whitespace-nowrap">
                      {new Date(event.requested_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-[var(--text-primary)]">{event.display_name}</td>
                    <td className="px-4 py-2 text-[var(--text-secondary)]">{event.location}</td>
                    <td className="px-4 py-2">
                      <span className={sourceBadge(event.source)}>{event.source}</span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={statusBadge(event.status)}>{event.status}</span>
                    </td>
                    <td className="px-4 py-2 text-xs text-[var(--text-secondary)] max-w-[200px] truncate">
                      {event.result_message || '—'}
                    </td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                      No restart history yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
