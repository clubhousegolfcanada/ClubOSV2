import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Phone, Users, MessageSquare, Download, FileText, RefreshCw, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface ConversationStats {
  uniqueCustomers: number;
  totalConversations: number;
  totalMessages: number;
  unprocessedCount: number;
}

export const OpenPhoneConversations: React.FC = () => {
  const [stats, setStats] = useState<ConversationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('clubos_token');
      
      const response = await axios.get(`${API_URL}/openphone/conversations/count`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setStats(response.data.data);
        setError(null);
      } else {
        setError(response.data.error || 'Failed to load statistics');
      }
    } catch (err: any) {
      console.error('Failed to fetch conversation stats:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to load statistics';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'json' | 'llm' | 'csv') => {
    try {
      setExporting(true);
      const token = localStorage.getItem('clubos_token');
      
      const endpoint = format === 'csv' ? '/openphone/export/csv' : '/openphone/export/all';
      const params = format === 'csv' ? {} : { format };
      
      const response = await axios.get(`${API_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
        responseType: format === 'csv' ? 'blob' : 'json'
      });
      
      if (format === 'csv') {
        // Download CSV file
        const blob = new Blob([response.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `openphone_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast.success('CSV exported successfully');
      } else {
        // Download JSON file
        const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `openphone_${format}_export_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast.success(`${format.toUpperCase()} export successful`);
      }
    } catch (err: any) {
      console.error('Export failed:', err);
      toast.error('Failed to export conversations');
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="bg-[var(--bg-secondary)] rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Phone className="w-5 h-5" />
            OpenPhone Conversations
          </h3>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-20 bg-[var(--bg-tertiary)] rounded"></div>
          <div className="h-20 bg-[var(--bg-tertiary)] rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[var(--bg-secondary)] rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Phone className="w-5 h-5" />
            OpenPhone Conversations
          </h3>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-[var(--text-muted)]">
          <AlertCircle className="w-12 h-12 mb-2 text-red-400" />
          <p className="text-sm text-center">{error}</p>
          <button
            onClick={fetchStats}
            className="mt-4 px-4 py-2 text-sm bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg-secondary)] rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Phone className="w-5 h-5" />
          OpenPhone Conversations
        </h3>
        <button
          onClick={fetchStats}
          className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
          title="Refresh statistics"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {stats && (
        <div className="space-y-4">
          {/* Statistics Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[var(--bg-tertiary)] rounded-lg p-4">
              <div className="flex items-center gap-2 text-[var(--text-muted)] mb-1">
                <Users className="w-4 h-4" />
                <span className="text-xs">Unique Customers</span>
              </div>
              <p className="text-2xl font-bold">{stats.uniqueCustomers}</p>
            </div>
            
            <div className="bg-[var(--bg-tertiary)] rounded-lg p-4">
              <div className="flex items-center gap-2 text-[var(--text-muted)] mb-1">
                <MessageSquare className="w-4 h-4" />
                <span className="text-xs">Total Messages</span>
              </div>
              <p className="text-2xl font-bold">{stats.totalMessages}</p>
            </div>
          </div>

          {/* Unprocessed Alert */}
          {stats.unprocessedCount > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
              <p className="text-sm text-yellow-400">
                {stats.unprocessedCount} unprocessed conversation{stats.unprocessedCount !== 1 ? 's' : ''}
              </p>
            </div>
          )}

          {/* Export Actions */}
          <div className="border-t border-[var(--border-secondary)] pt-4">
            <h4 className="text-sm font-medium mb-3">Export Conversations</h4>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => handleExport('llm')}
                disabled={exporting}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                Export for AI Processing
              </button>
              
              <button
                onClick={() => handleExport('json')}
                disabled={exporting}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-primary)] transition-colors disabled:opacity-50"
              >
                <FileText className="w-4 h-4" />
                Export Raw JSON
              </button>
              
              <button
                onClick={() => handleExport('csv')}
                disabled={exporting}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-primary)] transition-colors disabled:opacity-50"
              >
                <FileText className="w-4 h-4" />
                Export as Spreadsheet
              </button>
            </div>
          </div>

          {/* Info Text */}
          <div className="text-xs text-[var(--text-muted)] text-center">
            All conversations from {stats.uniqueCustomers} customers
          </div>
        </div>
      )}
    </div>
  );
};