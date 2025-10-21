import React, { useState, useEffect } from 'react';
import { http } from '@/api/http';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import StatusBadge from '@/components/ui/StatusBadge';
import { AlertTriangle, Clock, DollarSign, RefreshCw, XCircle } from 'lucide-react';

interface BookingChange {
  id: string;
  change_type: 'reschedule' | 'cancel' | 'modify';
  previous_start_at?: string;
  previous_end_at?: string;
  new_start_at?: string;
  new_end_at?: string;
  fee_charged: number;
  reason?: string;
  created_at: string;
  user_name?: string;
}

interface ChangeManagementProps {
  bookingId: string;
  userId: string;
  changeCount: number;
  onReschedule?: () => void;
  onCancel?: () => void;
}

export default function ChangeManagement({
  bookingId,
  userId,
  changeCount,
  onReschedule,
  onCancel
}: ChangeManagementProps) {
  const [loading, setLoading] = useState(true);
  const [changeHistory, setChangeHistory] = useState<BookingChange[]>([]);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadChangeData();
  }, [bookingId]);

  const loadChangeData = async () => {
    setLoading(true);
    try {
      // Load change history
      const historyResponse = await http.get(`/bookings/${bookingId}/changes`);
      setChangeHistory(historyResponse.data.data || []);

      // Validate if changes are allowed
      const validationResponse = await http.post('/bookings/validate-change', {
        bookingId,
        userId
      });
      setValidationResult(validationResponse.data);
    } catch (error) {
      logger.error('Failed to load change data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getChangeIcon = (type: string) => {
    switch (type) {
      case 'reschedule':
        return <RefreshCw className="w-4 h-4" />;
      case 'cancel':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-4">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Change Status Card */}
      <div className={`p-3 rounded-lg border-2 ${
        validationResult?.allowed
          ? 'border-[var(--status-success)] bg-[var(--status-success-bg)]'
          : 'border-[var(--status-error)] bg-[var(--status-error-bg)]'
      }`}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-medium mb-2">Change Management</h3>

            {/* Change Count Status */}
            <div className="flex items-center gap-3 mb-3">
              <StatusBadge
                status={changeCount === 0 ? 'success' : changeCount === 1 ? 'warning' : 'error'}
                label={`${changeCount} ${changeCount === 1 ? 'Change' : 'Changes'}`}
              />

              {validationResult?.shouldFlag && (
                <div className="flex items-center gap-1 text-[var(--status-error)]">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm font-medium">Flagged</span>
                </div>
              )}
            </div>

            {/* Validation Message */}
            {validationResult && (
              <div className="space-y-2">
                {validationResult.allowed ? (
                  <div className="text-sm text-green-700">
                    {validationResult.requiresFee ? (
                      <p className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        ${validationResult.feeAmount} change fee will apply
                      </p>
                    ) : (
                      <p>Free change available (1 of 1 used after this)</p>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-red-700">
                    <p className="font-medium">{validationResult.reason}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {validationResult?.allowed && (
            <div className="flex gap-2">
              {onReschedule && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onReschedule}
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Reschedule
                  {validationResult.requiresFee && ` ($${validationResult.feeAmount})`}
                </Button>
              )}

              {onCancel && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onCancel}
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Policy Info */}
        <div className="mt-4 p-3 bg-white rounded border border-gray-200">
          <h4 className="text-xs font-medium text-gray-600 mb-2">Change Policy:</h4>
          <ul className="text-xs text-gray-600 space-y-1">
            <li className="flex items-start gap-1">
              <span className="text-green-600">✓</span>
              First reschedule is free
            </li>
            <li className="flex items-start gap-1">
              <span className="text-yellow-600">$</span>
              Second reschedule incurs a $10 fee
            </li>
            <li className="flex items-start gap-1">
              <span className="text-red-600">✗</span>
              Third+ reschedules require manager approval
            </li>
          </ul>
        </div>
      </div>

      {/* Change History */}
      {changeHistory.length > 0 && (
        <div className="border rounded-lg">
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="w-full p-3 flex items-center justify-between hover:bg-gray-50"
          >
            <span className="font-medium">Change History ({changeHistory.length})</span>
            <Clock className="w-4 h-4 text-gray-500" />
          </button>

          {showHistory && (
            <div className="border-t divide-y">
              {changeHistory.map((change) => (
                <div key={change.id} className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2">
                      {getChangeIcon(change.change_type)}
                      <div>
                        <p className="text-sm font-medium capitalize">
                          {change.change_type}
                        </p>

                        {change.previous_start_at && change.new_start_at && (
                          <div className="text-xs text-gray-600 mt-1">
                            <p>From: {formatDateTime(change.previous_start_at)}</p>
                            <p>To: {formatDateTime(change.new_start_at)}</p>
                          </div>
                        )}

                        {change.reason && (
                          <p className="text-xs text-gray-600 mt-1">
                            Reason: {change.reason}
                          </p>
                        )}

                        {change.user_name && (
                          <p className="text-xs text-gray-500 mt-1">
                            By: {change.user_name}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      {change.fee_charged > 0 && (
                        <p className="text-sm font-medium text-orange-600">
                          ${change.fee_charged} fee
                        </p>
                      )}
                      <p className="text-xs text-gray-500">
                        {formatDateTime(change.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Contact Support for Flagged Users */}
      {validationResult?.shouldFlag && !validationResult?.allowed && (
        <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-orange-800">Account Restricted</p>
              <p className="text-sm text-orange-700 mt-1">
                Due to multiple booking changes, further modifications require manager approval.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => window.location.href = 'tel:+1234567890'}
              >
                Contact Support
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}