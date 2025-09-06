import React, { useState } from 'react';
import { 
  X, Plus, Trash2, AlertCircle, CheckCircle, 
  Brain, MessageCircle, Zap, TestTube 
} from 'lucide-react';
import apiClient from '@/api/http';
import logger from '@/services/logger';

interface PatternCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PATTERN_TYPES = [
  { value: 'faq', label: 'FAQ - Frequently Asked Question' },
  { value: 'pricing', label: 'Pricing Information' },
  { value: 'hours', label: 'Hours of Operation' },
  { value: 'booking', label: 'Booking & Reservations' },
  { value: 'tech_issue', label: 'Technical Support' },
  { value: 'membership', label: 'Membership Info' },
  { value: 'access', label: 'Access & Entry' },
  { value: 'gift_cards', label: 'Gift Cards' },
  { value: 'general', label: 'General Inquiry' }
];

const TEMPLATE_VARIABLES = [
  '{{customer_name}}',
  '{{location}}',
  '{{bay_number}}',
  '{{current_time}}',
  '{{booking_link}}'
];

export const PatternCreationModal: React.FC<PatternCreationModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [formData, setFormData] = useState({
    pattern_type: 'faq',
    trigger_examples: [''],
    response_template: '',
    confidence_score: 0.7,
    auto_executable: false,
    semantic_search_enabled: true
  });
  
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [validationResult, setValidationResult] = useState<any>(null);

  if (!isOpen) return null;

  const addTriggerExample = () => {
    setFormData(prev => ({
      ...prev,
      trigger_examples: [...prev.trigger_examples, '']
    }));
  };

  const removeTriggerExample = (index: number) => {
    setFormData(prev => ({
      ...prev,
      trigger_examples: prev.trigger_examples.filter((_, i) => i !== index)
    }));
  };

  const updateTriggerExample = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      trigger_examples: prev.trigger_examples.map((ex, i) => i === index ? value : ex)
    }));
  };

  const insertVariable = (variable: string) => {
    setFormData(prev => ({
      ...prev,
      response_template: prev.response_template + ' ' + variable
    }));
  };

  const testPattern = async () => {
    if (!testMessage.trim()) {
      setError('Please enter a test message');
      return;
    }

    setTesting(true);
    setTestResult(null);
    setError('');

    try {
      const response = await apiClient.post('/patterns/test', {
        message: testMessage
      });

      setTestResult(response.data);
    } catch (err: any) {
      logger.error('Failed to test pattern:', err);
      setError('Failed to test pattern');
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async () => {
    // Validate form
    if (!formData.trigger_examples.some(ex => ex.trim())) {
      setError('Please provide at least one trigger example');
      return;
    }

    if (!formData.response_template.trim()) {
      setError('Please provide a response template');
      return;
    }

    setSaving(true);
    setError('');

    try {
      // Filter out empty trigger examples
      const cleanedData = {
        ...formData,
        trigger_examples: formData.trigger_examples.filter(ex => ex.trim())
      };

      const response = await apiClient.post('/patterns', cleanedData);
      
      if (response.data.success) {
        setValidationResult({
          success: true,
          gpt4oValidated: response.data.gpt4oValidated
        });

        // Show success for 2 seconds then close
        setTimeout(() => {
          onSuccess();
          onClose();
          resetForm();
        }, 2000);
      }
    } catch (err: any) {
      logger.error('Failed to create pattern:', err);
      
      if (err.response?.status === 409) {
        setError('A pattern with similar trigger already exists');
      } else {
        setError(err.response?.data?.error || 'Failed to create pattern');
      }
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      pattern_type: 'faq',
      trigger_examples: [''],
      response_template: '',
      confidence_score: 0.7,
      auto_executable: false,
      semantic_search_enabled: true
    });
    setTestMessage('');
    setTestResult(null);
    setError('');
    setValidationResult(null);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Create New Pattern</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Pattern Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pattern Type
            </label>
            <select
              value={formData.pattern_type}
              onChange={(e) => setFormData(prev => ({ ...prev, pattern_type: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {PATTERN_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Trigger Examples */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Trigger Examples
              <span className="text-xs text-gray-500 ml-2">
                (Questions that should trigger this pattern)
              </span>
            </label>
            <div className="space-y-2">
              {formData.trigger_examples.map((example, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={example}
                    onChange={(e) => updateTriggerExample(index, e.target.value)}
                    placeholder="e.g., How much does it cost?"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  {formData.trigger_examples.length > 1 && (
                    <button
                      onClick={() => removeTriggerExample(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={addTriggerExample}
                className="flex items-center gap-2 text-primary hover:text-primary-dark"
              >
                <Plus className="h-4 w-4" />
                Add Another Example
              </button>
            </div>
          </div>

          {/* Response Template */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Response Template
            </label>
            <textarea
              value={formData.response_template}
              onChange={(e) => setFormData(prev => ({ ...prev, response_template: e.target.value }))}
              placeholder="Enter the response template..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="text-xs text-gray-500">Insert variable:</span>
              {TEMPLATE_VARIABLES.map(variable => (
                <button
                  key={variable}
                  onClick={() => insertVariable(variable)}
                  className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
                >
                  {variable}
                </button>
              ))}
            </div>
          </div>

          {/* Confidence Score */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Initial Confidence: {Math.round(formData.confidence_score * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={formData.confidence_score * 100}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                confidence_score: parseInt(e.target.value) / 100 
              }))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0% (Manual review)</span>
              <span>50% (Suggest)</span>
              <span>100% (Auto-execute)</span>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={formData.auto_executable}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  auto_executable: e.target.checked 
                }))}
                className="h-4 w-4 text-primary rounded"
              />
              <span className="text-sm text-gray-700">
                Auto-execute when confidence is high
                {formData.auto_executable && (
                  <span className="text-yellow-600 ml-2">
                    <AlertCircle className="inline h-3 w-3 mr-1" />
                    Will send automatically after safety checks
                  </span>
                )}
              </span>
            </label>

            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={formData.semantic_search_enabled}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  semantic_search_enabled: e.target.checked 
                }))}
                className="h-4 w-4 text-primary rounded"
              />
              <span className="text-sm text-gray-700">
                Enable semantic search (AI-powered matching)
              </span>
            </label>
          </div>

          {/* Test Pattern */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <TestTube className="h-4 w-4" />
              Test Pattern Matching
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="Enter a test message..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={testPattern}
                disabled={testing}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
              >
                {testing ? 'Testing...' : 'Test'}
              </button>
            </div>

            {testResult && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <div className="text-sm">
                  <div className="flex items-center gap-2 mb-2">
                    {testResult.wouldExecute ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                    )}
                    <span className="font-medium">
                      {testResult.wouldExecute ? 'Would auto-execute' : 'Would suggest'}
                    </span>
                    <span className="text-gray-500">
                      (Confidence: {Math.round((testResult.confidence || 0) * 100)}%)
                    </span>
                  </div>
                  {testResult.result?.response && (
                    <div className="text-gray-700">
                      Response: {testResult.result.response}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}

          {validationResult?.success && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-green-700">
                <div>Pattern created successfully!</div>
                {validationResult.gpt4oValidated && (
                  <div className="text-xs mt-1">✓ Validated by GPT-4o</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || validationResult?.success}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Pattern'}
          </button>
        </div>
      </div>
    </div>
  );
};