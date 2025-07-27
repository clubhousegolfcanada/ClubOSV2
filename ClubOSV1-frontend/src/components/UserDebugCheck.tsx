import React, { useState } from 'react';
import axios from 'axios';
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';

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
    <div className="card">
      <h3 className="text-lg font-semibold mb-4">User Database Check</h3>
      
      <button
        onClick={checkUserStatus}
        disabled={loading}
        className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 mb-4"
      >
        {loading ? 'Checking...' : 'Check User Status'}
      </button>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {debugInfo && (
        <div className="space-y-4">
          {/* Token Info */}
          <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Your Token Info
            </h4>
            <div className="text-sm space-y-1">
              <p>ID: <span className="font-mono text-xs">{debugInfo.tokenInfo.id}</span></p>
              <p>Email: {debugInfo.tokenInfo.email}</p>
              <p>Role: {debugInfo.tokenInfo.role}</p>
            </div>
          </div>

          {/* Database Check */}
          <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
            <h4 className="font-medium mb-2 flex items-center gap-2">
              {debugInfo.databaseCheck.userExistsByEmail ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
              Database Check
            </h4>
            <div className="text-sm space-y-1">
              <p>User exists by ID: {debugInfo.databaseCheck.userExistsById ? '✅ Yes' : '❌ No'}</p>
              <p>User exists by email: {debugInfo.databaseCheck.userExistsByEmail ? '✅ Yes' : '❌ No'}</p>
              {debugInfo.databaseCheck.userByEmailData && (
                <div className="mt-2 p-2 bg-[var(--bg-tertiary)] rounded">
                  <p className="text-xs text-[var(--text-muted)]">Database User ID:</p>
                  <p className="font-mono text-xs">{debugInfo.databaseCheck.userByEmailData.id}</p>
                </div>
              )}
            </div>
          </div>

          {/* Database Stats */}
          <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
            <h4 className="font-medium mb-2">Database Stats</h4>
            <p className="text-sm">Total users: {debugInfo.databaseStats.totalUsers}</p>
            {debugInfo.databaseStats.totalUsers === 0 && (
              <p className="text-sm text-yellow-400 mt-2">
                ⚠️ No users in database! The database might be empty or not properly connected.
              </p>
            )}
          </div>

          {/* Environment */}
          <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
            <h4 className="font-medium mb-2">Environment</h4>
            <div className="text-sm space-y-1">
              <p>Node ENV: {debugInfo.environment.nodeEnv}</p>
              <p>Database: {debugInfo.environment.databaseUrl}</p>
              <p>Railway: {debugInfo.environment.isRailway ? 'Yes' : 'No'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};