import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  XCircle,
  Edit2,
  Save,
  AlertCircle,
  Eye,
  EyeOff,
  CheckSquare,
  Square,
  Filter,
  MessageSquare,
  Zap,
  TrendingUp
} from 'lucide-react';
import apiClient from '@/api/http';
import logger from '@/services/logger';

interface StagedPattern {
  id: number;
  pattern_type: string;
  trigger_text: string;
  response_template: string;
  confidence_score: number;
  trigger_examples: string[];
  trigger_keywords: string[];
  template_variables: any;
  conversation_preview: string;
  conversation_metadata: any;
  status: 'pending' | 'approved' | 'rejected' | 'edited';
  reviewed_by_name?: string;
  reviewed_at?: string;
  review_notes?: string;
}

interface PatternApprovalModalProps {
  jobId: string;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export const PatternApprovalModal: React.FC<PatternApprovalModalProps> = ({
  jobId,
  isOpen,
  onClose,
  onComplete
}) => {
  const [patterns, setPatterns] = useState<StagedPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [selectedPatterns, setSelectedPatterns] = useState<Set<number>>(new Set());
  const [editingPattern, setEditingPattern] = useState<number | null>(null);
  const [editedValues, setEditedValues] = useState<{
    trigger_text: string;
    response_template: string;
    confidence_score: number;
  }>({ trigger_text: '', response_template: '', confidence_score: 0.7 });
  const [showPreview, setShowPreview] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && jobId) {
      fetchPatterns();
    }
  }, [isOpen, jobId, filter]);

  const fetchPatterns = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/patterns/import/staging/${jobId}`, {
        params: { status: filter === 'all' ? 'all' : filter }
      });
      setPatterns(response.data.patterns || []);
    } catch (error) {
      logger.error('Failed to fetch staged patterns:', error);
      setPatterns([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    const pendingPatterns = patterns.filter(p => p.status === 'pending');
    if (selectedPatterns.size === pendingPatterns.length) {
      setSelectedPatterns(new Set());
    } else {
      setSelectedPatterns(new Set(pendingPatterns.map(p => p.id)));
    }
  };

  const handleSelectPattern = (id: number) => {
    const newSelected = new Set(selectedPatterns);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedPatterns(newSelected);
  };

  const handleApprove = async (patternIds?: number[]) => {
    const idsToApprove = patternIds || Array.from(selectedPatterns);
    if (idsToApprove.length === 0) return;

    setSaving(true);
    try {
      const response = await apiClient.post('/patterns/import/approve', {
        patternIds: idsToApprove
      });

      if (response.data.success) {
        // Refresh patterns
        await fetchPatterns();
        setSelectedPatterns(new Set());
        
        // Check if all patterns are reviewed
        const remainingPending = patterns.filter(p => 
          p.status === 'pending' && !idsToApprove.includes(p.id)
        );
        
        if (remainingPending.length === 0) {
          onComplete();
        }
      }
    } catch (error) {
      logger.error('Failed to approve patterns:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async (patternIds?: number[], reason?: string) => {
    const idsToReject = patternIds || Array.from(selectedPatterns);
    if (idsToReject.length === 0) return;

    setSaving(true);
    try {
      const response = await apiClient.post('/patterns/import/reject', {
        patternIds: idsToReject,
        reason: reason || 'Rejected during review'
      });

      if (response.data.success) {
        await fetchPatterns();
        setSelectedPatterns(new Set());
      }
    } catch (error) {
      logger.error('Failed to reject patterns:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (pattern: StagedPattern) => {
    setEditingPattern(pattern.id);
    setEditedValues({
      trigger_text: pattern.trigger_text,
      response_template: pattern.response_template,
      confidence_score: pattern.confidence_score
    });
  };

  const handleSaveEdit = async () => {
    if (!editingPattern) return;

    setSaving(true);
    try {
      await apiClient.put(`/patterns/import/staging/${editingPattern}`, editedValues);
      await fetchPatterns();
      setEditingPattern(null);
    } catch (error) {
      logger.error('Failed to save pattern edit:', error);
    } finally {
      setSaving(false);
    }
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'faq': 'bg-blue-100 text-blue-800',
      'pricing': 'bg-green-100 text-green-800',
      'hours': 'bg-purple-100 text-purple-800',
      'booking': 'bg-yellow-100 text-yellow-800',
      'tech_issue': 'bg-red-100 text-red-800',
      'membership': 'bg-indigo-100 text-indigo-800',
      'access': 'bg-orange-100 text-orange-800',
      'gift_cards': 'bg-pink-100 text-pink-800',
      'general': 'bg-gray-100 text-gray-800'
    };
    return colors[type] || colors['general'];
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const filteredPatterns = patterns;
  const pendingCount = patterns.filter(p => p.status === 'pending').length;
  const approvedCount = patterns.filter(p => p.status === 'approved').length;
  const rejectedCount = patterns.filter(p => p.status === 'rejected').length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Review Imported Patterns</h2>
              <p className="text-sm text-gray-600 mt-1">
                Review and approve patterns before they go live
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-4 mt-4">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                filter === 'all'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All ({patterns.length})
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                filter === 'pending'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
              }`}
            >
              Pending ({pendingCount})
            </button>
            <button
              onClick={() => setFilter('approved')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                filter === 'approved'
                  ? 'bg-green-500 text-white'
                  : 'bg-green-50 text-green-700 hover:bg-green-100'
              }`}
            >
              Approved ({approvedCount})
            </button>
            <button
              onClick={() => setFilter('rejected')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                filter === 'rejected'
                  ? 'bg-red-500 text-white'
                  : 'bg-red-50 text-red-700 hover:bg-red-100'
              }`}
            >
              Rejected ({rejectedCount})
            </button>
          </div>
        </div>

        {/* Bulk Actions */}
        {filter === 'pending' && pendingCount > 0 && (
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
              >
                {selectedPatterns.size === pendingCount ? (
                  <CheckSquare className="h-4 w-4" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                Select All
              </button>
              {selectedPatterns.size > 0 && (
                <span className="text-sm text-gray-500">
                  {selectedPatterns.size} selected
                </span>
              )}
            </div>
            
            {selectedPatterns.size > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleApprove()}
                  disabled={saving}
                  className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  Approve Selected
                </button>
                <button
                  onClick={() => handleReject()}
                  disabled={saving}
                  className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  Reject Selected
                </button>
              </div>
            )}
          </div>
        )}

        {/* Pattern List */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredPatterns.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No patterns to review</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPatterns.map(pattern => (
                <div
                  key={pattern.id}
                  className={`border rounded-lg p-4 ${
                    pattern.status === 'approved'
                      ? 'border-green-200 bg-green-50'
                      : pattern.status === 'rejected'
                      ? 'border-red-200 bg-red-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  {/* Pattern Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      {pattern.status === 'pending' && (
                        <button
                          onClick={() => handleSelectPattern(pattern.id)}
                          className="mt-1"
                        >
                          {selectedPatterns.has(pattern.id) ? (
                            <CheckSquare className="h-5 w-5 text-primary" />
                          ) : (
                            <Square className="h-5 w-5 text-gray-400" />
                          )}
                        </button>
                      )}
                      
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTypeColor(pattern.pattern_type)}`}>
                            {pattern.pattern_type}
                          </span>
                          <span className={`text-sm font-medium ${getConfidenceColor(pattern.confidence_score)}`}>
                            {(pattern.confidence_score * 100).toFixed(0)}% confidence
                          </span>
                          {pattern.status !== 'pending' && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              pattern.status === 'approved'
                                ? 'bg-green-100 text-green-800'
                                : pattern.status === 'rejected'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {pattern.status}
                            </span>
                          )}
                        </div>
                        
                        {pattern.reviewed_by_name && (
                          <p className="text-xs text-gray-500 mt-1">
                            Reviewed by {pattern.reviewed_by_name} on {new Date(pattern.reviewed_at!).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    {pattern.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => showPreview === pattern.id ? setShowPreview(null) : setShowPreview(pattern.id)}
                          className="p-1.5 text-gray-400 hover:text-gray-600"
                          title="Toggle conversation preview"
                        >
                          {showPreview === pattern.id ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => handleEdit(pattern)}
                          className="p-1.5 text-blue-500 hover:text-blue-700"
                          title="Edit pattern"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleApprove([pattern.id])}
                          className="p-1.5 text-green-500 hover:text-green-700"
                          title="Approve"
                          disabled={saving}
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleReject([pattern.id])}
                          className="p-1.5 text-red-500 hover:text-red-700"
                          title="Reject"
                          disabled={saving}
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Pattern Content */}
                  {editingPattern === pattern.id ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Trigger Text
                        </label>
                        <input
                          type="text"
                          value={editedValues.trigger_text}
                          onChange={(e) => setEditedValues(prev => ({ ...prev, trigger_text: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Response Template
                        </label>
                        <textarea
                          value={editedValues.response_template}
                          onChange={(e) => setEditedValues(prev => ({ ...prev, response_template: e.target.value }))}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Confidence Score
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={editedValues.confidence_score}
                          onChange={(e) => setEditedValues(prev => ({ ...prev, confidence_score: parseFloat(e.target.value) }))}
                          className="w-full"
                        />
                        <span className="text-xs text-gray-500">
                          {(editedValues.confidence_score * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveEdit}
                          disabled={saving}
                          className="px-3 py-1.5 bg-primary text-white text-sm rounded-lg hover:bg-primary-dark disabled:opacity-50"
                        >
                          <Save className="h-4 w-4 inline mr-1" />
                          Save
                        </button>
                        <button
                          onClick={() => setEditingPattern(null)}
                          className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div>
                        <span className="text-xs font-medium text-gray-500">Trigger:</span>
                        <p className="text-sm text-gray-900">{pattern.trigger_text}</p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-gray-500">Response:</span>
                        <p className="text-sm text-gray-900 whitespace-pre-wrap">{pattern.response_template}</p>
                      </div>
                    </div>
                  )}

                  {/* Conversation Preview */}
                  {showPreview === pattern.id && pattern.conversation_preview && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs font-medium text-gray-700 mb-2">Original Conversation:</p>
                      <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                        {pattern.conversation_preview}
                      </pre>
                    </div>
                  )}

                  {/* Review Notes */}
                  {pattern.review_notes && (
                    <div className="mt-3 p-2 bg-yellow-50 rounded">
                      <p className="text-xs text-yellow-800">
                        <strong>Note:</strong> {pattern.review_notes}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
          <div className="text-sm text-gray-600">
            {pendingCount > 0 && (
              <span>{pendingCount} patterns awaiting review</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};