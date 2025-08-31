import React, { useState, useEffect } from 'react';
import { http } from '@/api/http';
import { Phone, Users, MessageSquare, Download, FileText, RefreshCw, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';


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
      
      const response = await http.get(`openphone/conversations/count`, {
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
      
      // Handle AI Processing differently
      if (format === 'llm') {
        const response = await http.post(`openphone-processing/process-conversations`, 
          { limit: 50 }, // Process up to 50 conversations at a time
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        if (response.data.success) {
          const { processed, knowledgeExtracted, errors } = response.data.results;
          toast.success(`Processed ${processed} conversations, extracted ${knowledgeExtracted} knowledge items`);
          
          // Refresh stats after processing
          await fetchStats();
        } else {
          toast.error('Failed to process conversations');
        }
        setExporting(false);
        return;
      }
      
      const endpoint = format === 'csv' ? '/openphone/export/csv' : '/openphone/export/all';
      const params = format === 'csv' ? {} : { format };
      
      const response = await http.get(endpoint, {
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
          {/* Conversation Stats - Compact */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Conversation Data</h4>
            </div>
            
            <div className="bg-[var(--bg-tertiary)] rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--text-secondary)]">Total Conversations</span>
                <span className="text-lg font-semibold">{stats.totalConversations || stats.uniqueCustomers}</span>
              </div>
            </div>

            {/* Unprocessed Alert */}
            {stats.unprocessedCount > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-yellow-400">Unprocessed</span>
                  <span className="text-lg font-semibold text-yellow-400">{stats.unprocessedCount}</span>
                </div>
              </div>
            )}
          </div>

          {/* Export Actions - Compact Layout */}
          <div className="border-t border-[var(--border-secondary)] pt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Export Data</h4>
            </div>
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => handleExport('llm')}
                disabled={exporting}
                className="flex items-center justify-between px-3 py-2 bg-[var(--bg-primary)] hover:bg-[var(--accent)] hover:text-white text-xs rounded-md transition-all group disabled:opacity-50"
              >
                <span>AI Processing</span>
                <Download className="w-3 h-3 opacity-50 group-hover:opacity-100" />
              </button>
              
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => handleExport('json')}
                  disabled={exporting}
                  className="flex items-center justify-center gap-1 px-2 py-1.5 bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] text-xs rounded-md transition-colors disabled:opacity-50"
                >
                  <FileText className="w-3 h-3" />
                  JSON
                </button>
                
                <button
                  onClick={() => handleExport('csv')}
                  disabled={exporting}
                  className="flex items-center justify-center gap-1 px-2 py-1.5 bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] text-xs rounded-md transition-colors disabled:opacity-50"
                >
                  <FileText className="w-3 h-3" />
                  CSV
                </button>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};