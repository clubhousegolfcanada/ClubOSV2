import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useAuthState } from '@/state/useStore';
import toast from 'react-hot-toast';
import axios from 'axios';
import { Download, AlertCircle, RefreshCw, Brain, MessageSquare, BarChart3, Settings } from 'lucide-react';
import { FeedbackResponse } from '@/components/FeedbackResponse';
import { KnowledgeRouterPanel } from '@/components/admin/KnowledgeRouterPanel';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type FeedbackItem = {
  id: string;
  feedback: string;
  response: string;
  query: string;
  timestamp: string;
  userId?: string;
  location?: string;
  improved: boolean;
  category?: string;
  rating?: number;
  metadata?: any;
};

const Knowledge: React.FC = () => {
  const { user } = useAuthState();
  const [activeTab, setActiveTab] = useState<'knowledge' | 'feedback' | 'analytics'>('knowledge');
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  // Check admin access
  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-[var(--text-muted)]" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-[var(--text-secondary)]">You need admin privileges to access the Knowledge Center.</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (activeTab === 'feedback') {
      fetchFeedback();
    }
  }, [activeTab]);

  const fetchFeedback = async () => {
    try {
      setFeedbackLoading(true);
      const token = localStorage.getItem('clubos_token');
      const response = await axios.get(`${API_URL}/feedback/not-useful`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setFeedback(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch feedback:', error);
      toast.error('Failed to load feedback');
    } finally {
      setFeedbackLoading(false);
    }
  };

  const exportFeedback = async () => {
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.get(`${API_URL}/feedback/export`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `clubos_feedback_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Feedback exported successfully');
    } catch (error) {
      console.error('Failed to export feedback:', error);
      toast.error('Failed to export feedback');
    }
  };

  return (
    <>
      <Head>
        <title>Knowledge Center - ClubOS</title>
        <meta name="description" content="Manage AI knowledge, feedback, and SOP system" />
      </Head>

      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Knowledge Center</h1>
            <p className="text-[var(--text-secondary)]">
              Manage assistant knowledge, user feedback, and system analytics
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="mb-8">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveTab('knowledge')}
                className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                  activeTab === 'knowledge'
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Brain className="w-4 h-4" />
                Knowledge Management
              </button>

              <button
                onClick={() => setActiveTab('feedback')}
                className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                  activeTab === 'feedback'
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                Feedback
              </button>

              <button
                onClick={() => setActiveTab('analytics')}
                className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                  activeTab === 'analytics'
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Analytics
              </button>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'knowledge' ? (
            <div className="space-y-6">
              <KnowledgeRouterPanel />
            </div>
          ) : activeTab === 'feedback' ? (
            <div className="space-y-6">
              {/* Feedback Header */}
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-semibold">Feedback Analysis</h2>
                  <p className="text-[var(--text-secondary)] mt-1">
                    Review and improve AI responses based on user feedback
                  </p>
                </div>
                <button
                  onClick={exportFeedback}
                  className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>

              {/* Feedback Content */}
              {feedbackLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin" />
                  <span className="ml-2">Loading feedback...</span>
                </div>
              ) : feedback.length > 0 ? (
                <div className="space-y-4">
                  {feedback.map((item) => (
                    <div key={item.id} className="bg-[var(--bg-secondary)] rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <p className="text-sm text-[var(--text-secondary)] mb-1">Query:</p>
                          <p className="font-medium mb-2">{item.query}</p>
                          <p className="text-sm text-[var(--text-secondary)] mb-1">User Feedback:</p>
                          <p className="text-[var(--text-muted)] mb-3">{item.feedback}</p>
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">
                          {new Date(item.timestamp).toLocaleDateString()}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-[var(--text-secondary)] mb-1">AI Response:</p>
                        <FeedbackResponse responseData={item.response} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="card text-center py-12">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">No Feedback Available</h3>
                  <p className="text-[var(--text-secondary)]">
                    All user feedback has been addressed or no feedback has been received yet.
                  </p>
                </div>
              )}
            </div>
          ) : activeTab === 'analytics' ? (
            <div className="space-y-6">
              <div className="card text-center py-12">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">Analytics Coming Soon</h3>
                <p className="text-[var(--text-secondary)]">
                  Knowledge analytics and performance metrics will be available here.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
};

export default Knowledge;