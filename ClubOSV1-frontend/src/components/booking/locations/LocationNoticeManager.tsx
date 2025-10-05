'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, AlertCircle, Info, AlertTriangle, X, Calendar, Clock } from 'lucide-react';
import { locationNoticeService } from '../../../services/booking/locationNoticeService';
import { useNotifications } from '../../../hooks/useNotifications';

interface LocationNotice {
  id: string;
  locationId: string;
  title?: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  isActive: boolean;
  showOnBookingPage: boolean;
  showInConfirmations: boolean;
  showUntil?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

interface LocationNoticeManagerProps {
  locationId: string;
  locationName: string;
}

export const LocationNoticeManager: React.FC<LocationNoticeManagerProps> = ({
  locationId,
  locationName
}) => {
  const [notices, setNotices] = useState<LocationNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingNotice, setEditingNotice] = useState<LocationNotice | null>(null);
  const { showError, showSuccess } = useNotifications();

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    severity: 'info' as 'info' | 'warning' | 'critical',
    showOnBookingPage: true,
    showInConfirmations: true,
    showUntil: ''
  });

  useEffect(() => {
    loadNotices();
  }, [locationId]);

  const loadNotices = async () => {
    try {
      setLoading(true);
      const data = await locationNoticeService.getLocationNotices(locationId);
      setNotices(data);
    } catch (error) {
      showError('Failed to load notices');
      console.error('Error loading notices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.message.trim()) {
      showError('Message is required');
      return;
    }

    try {
      if (editingNotice) {
        await locationNoticeService.updateNotice(locationId, editingNotice.id, formData);
        showSuccess('Notice updated successfully');
      } else {
        await locationNoticeService.createNotice(locationId, formData);
        showSuccess('Notice created successfully');
      }

      resetForm();
      await loadNotices();
    } catch (error) {
      showError(editingNotice ? 'Failed to update notice' : 'Failed to create notice');
      console.error('Error saving notice:', error);
    }
  };

  const handleDelete = async (noticeId: string) => {
    if (!confirm('Are you sure you want to delete this notice?')) {
      return;
    }

    try {
      await locationNoticeService.deleteNotice(noticeId);
      showSuccess('Notice deleted successfully');
      await loadNotices();
    } catch (error) {
      showError('Failed to delete notice');
      console.error('Error deleting notice:', error);
    }
  };

  const handleEdit = (notice: LocationNotice) => {
    setEditingNotice(notice);
    setFormData({
      title: notice.title || '',
      message: notice.message,
      severity: notice.severity,
      showOnBookingPage: notice.showOnBookingPage,
      showInConfirmations: notice.showInConfirmations,
      showUntil: notice.showUntil ? notice.showUntil.split('T')[0] : ''
    });
    setShowAddForm(true);
  };

  const handleToggleActive = async (notice: LocationNotice) => {
    try {
      await locationNoticeService.updateNotice(locationId, notice.id, {
        is_active: !notice.isActive
      });
      showSuccess(`Notice ${notice.isActive ? 'deactivated' : 'activated'}`);
      await loadNotices();
    } catch (error) {
      showError('Failed to update notice status');
      console.error('Error toggling notice:', error);
    }
  };

  const resetForm = () => {
    setShowAddForm(false);
    setEditingNotice(null);
    setFormData({
      title: '',
      message: '',
      severity: 'info',
      showOnBookingPage: true,
      showInConfirmations: true,
      showUntil: ''
    });
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getSeverityBg = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      default:
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Location Notices</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage notices for {locationName}
          </p>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Notice
          </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">
              {editingNotice ? 'Edit Notice' : 'New Notice'}
            </h4>
            <button
              onClick={resetForm}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Title (Optional)
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
                placeholder="e.g., Maintenance Notice"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
                rows={3}
                placeholder="e.g., Side screens are down - play at your own risk"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Severity</label>
              <select
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value as any })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
              >
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.showOnBookingPage}
                  onChange={(e) => setFormData({ ...formData, showOnBookingPage: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Show on booking page</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.showInConfirmations}
                  onChange={(e) => setFormData({ ...formData, showInConfirmations: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Include in confirmation messages</span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Show Until (Optional)
              </label>
              <input
                type="date"
                value={formData.showUntil}
                onChange={(e) => setFormData({ ...formData, showUntil: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave empty to show indefinitely
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                {editingNotice ? 'Update' : 'Create'} Notice
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Notices List */}
      <div className="space-y-2">
        {notices.length === 0 ? (
          <div className="card p-8 text-center text-gray-500 dark:text-gray-400">
            No notices for this location
          </div>
        ) : (
          notices.map((notice) => (
            <div
              key={notice.id}
              className={`card p-4 border ${getSeverityBg(notice.severity)} ${
                !notice.isActive ? 'opacity-50' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 pt-1">
                  {getSeverityIcon(notice.severity)}
                </div>

                <div className="flex-1 min-w-0">
                  {notice.title && (
                    <h5 className="font-semibold mb-1">{notice.title}</h5>
                  )}
                  <p className="text-sm mb-2">{notice.message}</p>

                  <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                    {notice.showOnBookingPage && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Booking Page
                      </span>
                    )}
                    {notice.showInConfirmations && (
                      <span className="flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        Confirmations
                      </span>
                    )}
                    {notice.showUntil && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Until {new Date(notice.showUntil).toLocaleDateString()}
                      </span>
                    )}
                    {notice.createdByName && (
                      <span>By {notice.createdByName}</span>
                    )}
                  </div>
                </div>

                <div className="flex-shrink-0 flex items-center gap-1">
                  <button
                    onClick={() => handleToggleActive(notice)}
                    className={`px-2 py-1 text-xs rounded ${
                      notice.isActive
                        ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {notice.isActive ? 'Active' : 'Inactive'}
                  </button>
                  <button
                    onClick={() => handleEdit(notice)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(notice.id)}
                    className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};