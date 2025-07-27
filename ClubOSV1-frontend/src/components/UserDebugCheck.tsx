import React, { useState } from 'react';
import axios from 'axios';
import { AlertCircle, CheckCircle, XCircle, Database } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export const UserDebugCheck: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkUserStatus = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.get(`${API_URL}/debug/check-user`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setDebugInfo(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[var(--bg-secondary)] rounded-lg p-4 border border-[var(--border-secondary)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-[var(--accent)]" />
          <h4 className="font-medium text-[var(--text-primary)]">Database Status</h4>
        </div>
        <button
          onClick={checkUserStatus}
          disabled={loading}
          className="px-3 py-1.5 bg-[var(--accent)] text-white rounded text-sm hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {loading ? 'Checking...' : 'Check Database'}
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded p-3 mb-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {debugInfo && (
        <div className="space-y-3">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-[var(--text-muted)]">Total Users:</span>
              <span className="ml-2 font-medium">{debugInfo.databaseStats.totalUsers}</span>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Your Status:</span>
              <span className="ml-2">
                {debugInfo.databaseCheck.userExistsByEmail ? (
                  <span className="text-green-400">✅ Found</span>
                ) : (
                  <span className="text-red-400">❌ Missing</span>
                )}
              </span>
            </div>
          </div>

          {/* Environment Info */}
          <div className="text-xs text-[var(--text-muted)] pt-2 border-t border-[var(--border-secondary)]">
            Environment: {debugInfo.environment.nodeEnv} | Database: {debugInfo.environment.databaseUrl}
          </div>
        </div>
      )}
    </div>
  );
};