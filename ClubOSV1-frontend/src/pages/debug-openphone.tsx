import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useAuthState } from '@/state/useStore';
import { useRouter } from 'next/router';
import { Database, Phone, RefreshCw, Send, AlertCircle, CheckCircle } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export default function DebugOpenPhone() {
  const { user } = useAuthState();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [dbData, setDbData] = useState<any>(null);
  const [connectionData, setConnectionData] = useState<any>(null);
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('Test message from ClubOS');

  // Check auth
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      router.push('/');
    }
  }, [user, router]);

  const checkDatabase = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.get(`${API_URL}/debug-openphone/database-check`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setDbData(response.data.data);
      
      // Check for missing columns
      if (response.data.data?.missingColumns?.length > 0) {
        toast(`⚠️ Missing columns: ${response.data.data.missingColumns.join(', ')}`, {
          icon: '⚠️',
          duration: 5000
        });
      } else {
        toast.success('Database check complete');
      }
    } catch (error: any) {
      toast.error('Database check failed: ' + error.message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.get(`${API_URL}/debug-openphone/test-connection`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setConnectionData(response.data);
      if (response.data.success) {
        toast.success('OpenPhone connection successful');
      }
    } catch (error: any) {
      setConnectionData(error.response?.data || { success: false, error: error.message });
      toast.error('Connection test failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const syncConversations = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.post(`${API_URL}/debug-openphone/sync-conversations`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(`Synced ${response.data.data.conversationsSynced} conversations`);
      checkDatabase(); // Refresh database view
    } catch (error: any) {
      toast.error('Sync failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const importHistory = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.post(`${API_URL}/openphone/import-history`, 
        { daysBack: 30 }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(response.data.message || 'Import complete');
      checkDatabase(); // Refresh database view
    } catch (error: any) {
      toast.error('Import failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const sendTestMessage = async () => {
    if (!testPhone) {
      toast.error('Please enter a phone number');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.post(
        `${API_URL}/debug-openphone/test-send`,
        { to: testPhone, text: testMessage },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Test message sent!');
      console.log('Send response:', response.data);
    } catch (error: any) {
      toast.error('Send failed: ' + (error.response?.data?.error || error.message));
      console.error('Send error:', error.response?.data || error);
    } finally {
      setLoading(false);
    }
  };

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <>
      <Head>
        <title>ClubOS - OpenPhone Debug</title>
      </Head>

      <div className="min-h-screen bg-[var(--bg-primary)]">
        <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-6">
            OpenPhone Debug Panel
          </h1>

          <div className="grid gap-6">
            {/* Database Check */}
            <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-secondary)] p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Database Status
                </h2>
                <button
                  onClick={checkDatabase}
                  disabled={loading}
                  className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  Check Database
                </button>
              </div>
              
              {dbData && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-[var(--text-muted)]">Total Conversations:</span>
                      <span className="ml-2 font-semibold">{dbData.totalConversations}</span>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)]">Invalid Phone Numbers:</span>
                      <span className="ml-2 font-semibold text-red-500">{dbData.invalidPhoneNumbers}</span>
                    </div>
                  </div>
                  
                  {/* Table Structure Info */}
                  {(dbData.missingColumns?.length > 0 || dbData.tableColumns) && (
                    <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                        Table Structure Issues
                      </p>
                      {dbData.missingColumns?.length > 0 && (
                        <p className="text-xs text-yellow-700 dark:text-yellow-300">
                          Missing columns: {dbData.missingColumns.join(', ')}
                        </p>
                      )}
                      {dbData.tableColumns && (
                        <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                          Existing columns: {dbData.tableColumns.join(', ')}
                        </p>
                      )}
                    </div>
                  )}
                  
                  {dbData.conversations.length > 0 && (
                    <div>
                      <h3 className="font-medium mb-2">Recent Conversations:</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-[var(--border-secondary)]">
                              <th className="text-left py-2">Phone</th>
                              <th className="text-left py-2">Customer</th>
                              <th className="text-left py-2">Messages</th>
                              <th className="text-left py-2">Created</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dbData.conversations.map((conv: any) => (
                              <tr key={conv.id} className="border-b border-[var(--border-secondary)]">
                                <td className="py-2">{conv.phone_number || 'NULL'}</td>
                                <td className="py-2">{conv.customer_name || 'NULL'}</td>
                                <td className="py-2">{conv.message_count || 0}</td>
                                <td className="py-2">{new Date(conv.created_at).toLocaleDateString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Connection Test */}
            <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-secondary)] p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Phone className="w-5 h-5" />
                  OpenPhone Connection
                </h2>
                <button
                  onClick={testConnection}
                  disabled={loading}
                  className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  Test Connection
                </button>
              </div>
              
              {connectionData && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {connectionData.success ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )}
                    <span className={connectionData.success ? 'text-green-500' : 'text-red-500'}>
                      {connectionData.success ? 'Connected' : 'Connection Failed'}
                    </span>
                  </div>
                  
                  {connectionData.error && (
                    <div className="text-red-500 text-sm">{connectionData.error}</div>
                  )}
                  
                  {connectionData.data && (
                    <div className="text-sm space-y-1">
                      <div>API Key: {connectionData.data.hasApiKey ? '✓ Configured' : '✗ Missing'}</div>
                      <div>Default Number: {connectionData.data.defaultNumber || 'Not configured'}</div>
                      {connectionData.data.phoneNumbers && (
                        <div>Available Numbers: {connectionData.data.phoneNumbers.length}</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sync & Test */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Sync Conversations */}
              <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-secondary)] p-6">
                <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
                  <RefreshCw className="w-5 h-5" />
                  Sync Conversations
                </h2>
                <p className="text-sm text-[var(--text-muted)] mb-4">
                  Pull recent conversations from OpenPhone API
                </p>
                <button
                  onClick={syncConversations}
                  disabled={loading}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Sync Recent (10)
                </button>
                <button
                  onClick={importHistory}
                  disabled={loading}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 mt-2"
                >
                  Import History (30 days)
                </button>
              </div>

              {/* Send Test Message */}
              <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-secondary)] p-6">
                <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
                  <Send className="w-5 h-5" />
                  Send Test Message
                </h2>
                <div className="space-y-3">
                  <input
                    type="tel"
                    placeholder="Phone number (e.g., +1234567890)"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Message text"
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-sm"
                  />
                  <button
                    onClick={sendTestMessage}
                    disabled={loading || !testPhone}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    Send Test
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}