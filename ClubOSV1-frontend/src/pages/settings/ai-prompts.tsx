import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useAuthState } from '@/state/useStore';
import { useRouter } from 'next/router';
import { http } from '@/api/http';
import toast from 'react-hot-toast';
import { Save, History, RefreshCw, AlertCircle, FileText, X } from 'lucide-react';
import { format } from 'date-fns';
import { tokenManager } from '@/utils/tokenManager';
import logger from '@/services/logger';


interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  category: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface TemplateHistory {
  id: string;
  old_template: string;
  new_template: string;
  changed_by_name: string;
  changed_by_email: string;
  changed_at: string;
  change_reason: string;
}

export default function AIPrompts() {
  const { user } = useAuthState();
  const router = useRouter();
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [editedTemplate, setEditedTemplate] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<TemplateHistory[]>([]);

  // Check auth
  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.push('/');
    }
  }, [user, router]);

  // Load templates
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const token = tokenManager.getToken();
      const response = await http.get(`prompt-templates`, {

      });

      if (response.data.success) {
        setTemplates(response.data.data);
        // Auto-select customer message template
        const customerTemplate = response.data.data.find((t: PromptTemplate) => 
          t.name === 'customer_message_response'
        );
        if (customerTemplate) {
          setSelectedTemplate(customerTemplate);
          setEditedTemplate(customerTemplate.template);
        }
      }
    } catch (error) {
      logger.error('Failed to load templates:', error);
      toast.error('Failed to load AI prompt templates');
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (templateId: string) => {
    try {
      const token = tokenManager.getToken();
      const response = await http.get(`prompt-templates/${templateId}/history`, {

      });

      if (response.data.success) {
        setHistory(response.data.data);
        setShowHistory(true);
      }
    } catch (error) {
      logger.error('Failed to load history:', error);
      toast.error('Failed to load template history');
    }
  };

  const saveTemplate = async () => {
    if (!selectedTemplate || !changeReason.trim()) {
      toast.error('Please provide a reason for the change');
      return;
    }

    setSaving(true);
    try {
      const token = tokenManager.getToken();
      const response = await http.put(
        `prompt-templates/${selectedTemplate.id}`,
        {
          template: editedTemplate,
          reason: changeReason
        },
        {

        }
      );

      if (response.data.success) {
        toast.success('Template updated successfully');
        setChangeReason('');
        // Reload templates
        await loadTemplates();
      }
    } catch (error) {
      logger.error('Failed to save template:', error);
      toast.error('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const resetTemplate = () => {
    if (selectedTemplate) {
      setEditedTemplate(selectedTemplate.template);
      setChangeReason('');
    }
  };

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <>
      <Head>
        <title>ClubOS - AI Prompt Templates</title>
      </Head>

      <div className="min-h-screen bg-[var(--bg-primary)] pb-12">
        <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-2">
              AI Prompt Templates
            </h1>
            <p className="text-[var(--text-secondary)] text-sm">
              Customize how AI responds to customer messages
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Template List */}
              <div className="lg:col-span-1">
                <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-secondary)] p-4">
                  <h2 className="text-lg font-semibold mb-4">Templates</h2>
                  <div className="space-y-2">
                    {templates.map(template => (
                      <button
                        key={template.id}
                        onClick={() => {
                          setSelectedTemplate(template);
                          setEditedTemplate(template.template);
                          setShowHistory(false);
                        }}
                        className={`w-full text-left p-3 rounded-lg transition-colors ${
                          selectedTemplate?.id === template.id
                            ? 'bg-[var(--accent)] text-white'
                            : 'hover:bg-[var(--bg-tertiary)]'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <FileText className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <div>
                            <div className="font-medium text-sm">
                              {template.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </div>
                            <div className={`text-xs mt-1 ${
                              selectedTemplate?.id === template.id ? 'text-white/70' : 'text-[var(--text-muted)]'
                            }`}>
                              {template.description}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Template Editor */}
              <div className="lg:col-span-2">
                {selectedTemplate ? (
                  <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-secondary)] p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-semibold">
                        {selectedTemplate.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </h2>
                      <button
                        onClick={() => loadHistory(selectedTemplate.id)}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-[var(--bg-tertiary)] rounded-lg hover:bg-[var(--bg-primary)] transition-colors"
                      >
                        <History className="w-4 h-4" />
                        History
                      </button>
                    </div>

                    {/* Warning */}
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-yellow-800 dark:text-yellow-200">
                          <p className="font-medium mb-1">Important Notes:</p>
                          <ul className="list-disc list-inside space-y-1 text-xs">
                            <li>Changes affect how AI responds to ALL customer messages</li>
                            <li>Use {'{'}customer_message{'}'} for the customer&apos;s message</li>
                            <li>Use {'{'}conversation_history{'}'} for chat history</li>
                            <li>Keep safety instructions to protect internal information</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Template Editor */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-2">Template Content</label>
                      <textarea
                        value={editedTemplate}
                        onChange={(e) => setEditedTemplate(e.target.value)}
                        className="w-full h-96 px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg font-mono text-sm resize-none focus:outline-none focus:border-[var(--accent)]"
                        spellCheck={false}
                      />
                    </div>

                    {/* Change Reason */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium mb-2">
                        Reason for Change <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={changeReason}
                        onChange={(e) => setChangeReason(e.target.value)}
                        placeholder="e.g., Updated tone to be more friendly"
                        className="w-full px-4 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg focus:outline-none focus:border-[var(--accent)]"
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                      <button
                        onClick={saveTemplate}
                        disabled={saving || !changeReason.trim() || editedTemplate === selectedTemplate.template}
                        className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
                      >
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button
                        onClick={resetTemplate}
                        disabled={editedTemplate === selectedTemplate.template}
                        className="px-4 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-primary)] disabled:opacity-50 transition-colors"
                      >
                        Reset
                      </button>
                    </div>

                    {/* History Modal */}
                    {showHistory && (
                      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-[var(--bg-secondary)] rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
                          <div className="p-6 border-b border-[var(--border-secondary)]">
                            <div className="flex items-center justify-between">
                              <h3 className="text-xl font-semibold">Template History</h3>
                              <button
                                onClick={() => setShowHistory(false)}
                                className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                          <div className="p-6 overflow-y-auto max-h-[60vh]">
                            {history.length === 0 ? (
                              <p className="text-center text-[var(--text-muted)]">No history available</p>
                            ) : (
                              <div className="space-y-4">
                                {history.map((item) => (
                                  <div key={item.id} className="border border-[var(--border-primary)] rounded-lg p-4">
                                    <div className="flex items-start justify-between mb-2">
                                      <div>
                                        <p className="text-sm font-medium">
                                          {item.changed_by_name || item.changed_by_email}
                                        </p>
                                        <p className="text-xs text-[var(--text-muted)]">
                                          {format(new Date(item.changed_at), 'MMM d, yyyy h:mm a')}
                                        </p>
                                      </div>
                                      <span className="text-xs bg-[var(--bg-tertiary)] px-2 py-1 rounded">
                                        {item.change_reason}
                                      </span>
                                    </div>
                                    <details className="mt-3">
                                      <summary className="cursor-pointer text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                                        View changes
                                      </summary>
                                      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                          <p className="text-xs font-medium mb-1 text-red-600">Previous</p>
                                          <pre className="text-xs bg-red-50 dark:bg-red-900/20 p-2 rounded overflow-x-auto">
                                            {item.old_template}
                                          </pre>
                                        </div>
                                        <div>
                                          <p className="text-xs font-medium mb-1 text-green-600">New</p>
                                          <pre className="text-xs bg-green-50 dark:bg-green-900/20 p-2 rounded overflow-x-auto">
                                            {item.new_template}
                                          </pre>
                                        </div>
                                      </div>
                                    </details>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-secondary)] p-12 text-center">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-[var(--text-muted)] opacity-50" />
                    <p className="text-[var(--text-muted)]">Select a template to edit</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}