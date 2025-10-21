import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, User, DollarSign, Filter, Download, Edit2, X, CheckCircle, AlertCircle, MoreVertical } from 'lucide-react';
import { format } from 'date-fns';
import { http } from '@/api/http';
import Button from '@/components/ui/Button';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import { useNotifications } from '@/state/hooks';
import { useAuthState } from '@/state/useStore';
import logger from '@/services/logger';

interface Booking {
  id: string;
  locationId: string;
  locationName: string;
  spaceIds: string[];
  spaces?: Array<{ id: string; name: string }>;
  userId?: string;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  customerTierId: string;
  tierName?: string;
  tierColor?: string;
  startAt: string;
  endAt: string;
  duration: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no-show';
  totalAmount: number;
  paymentStatus?: 'pending' | 'completed' | 'failed' | 'refunded';
  stripePaymentId?: string;
  isAdminBlock: boolean;
  blockReason?: string;
  customerNotes?: string;
  adminNotes?: string;
  createdAt: string;
}

interface BookingListViewProps {
  date?: Date;
  locationId?: string;
  onEditBooking?: (booking: Booking) => void;
  onRefund?: (booking: Booking) => void;
}

const BookingListView: React.FC<BookingListViewProps> = ({
  date = new Date(),
  locationId,
  onEditBooking,
  onRefund
}) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBookings, setSelectedBookings] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'time' | 'customer' | 'amount'>('time');
  const [showActions, setShowActions] = useState<string | null>(null);
  const { notify } = useNotifications();
  const { user } = useAuthState();
  const isAdmin = user?.role === 'admin';
  const isStaff = user?.role === 'admin' || user?.role === 'operator';

  useEffect(() => {
    loadBookings();
  }, [date, locationId]);

  const loadBookings = async () => {
    setLoading(true);
    try {
      const response = await http.get('/bookings/day', {
        params: {
          date: format(date, 'yyyy-MM-dd'),
          locationId: locationId || 'all'
        }
      });

      if (response.data.success) {
        setBookings(response.data.data);
      }
    } catch (error) {
      logger.error('Failed to load bookings:', error);
      notify('error', 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedBookings.size === filteredBookings.length) {
      setSelectedBookings(new Set());
    } else {
      setSelectedBookings(new Set(filteredBookings.map(b => b.id)));
    }
  };

  const handleSelectBooking = (bookingId: string) => {
    const newSelection = new Set(selectedBookings);
    if (newSelection.has(bookingId)) {
      newSelection.delete(bookingId);
    } else {
      newSelection.add(bookingId);
    }
    setSelectedBookings(newSelection);
  };

  const handleCancelBooking = async (booking: Booking) => {
    try {
      const response = await http.delete(`/bookings/${booking.id}`);
      if (response.data.success) {
        notify('success', 'Booking cancelled successfully');
        loadBookings();
      }
    } catch (error) {
      notify('error', 'Failed to cancel booking');
    }
  };

  const handleExportCSV = () => {
    const csv = [
      ['ID', 'Customer', 'Email', 'Phone', 'Location', 'Space', 'Start', 'End', 'Duration', 'Amount', 'Status', 'Payment', 'Notes'],
      ...filteredBookings.map(b => [
        b.id,
        b.userName || 'N/A',
        b.userEmail || 'N/A',
        b.userPhone || 'N/A',
        b.locationName,
        b.spaces?.map(s => s.name).join(', ') || 'N/A',
        format(new Date(b.startAt), 'yyyy-MM-dd HH:mm'),
        format(new Date(b.endAt), 'HH:mm'),
        `${b.duration} min`,
        `$${b.totalAmount.toFixed(2)}`,
        b.status,
        b.paymentStatus || 'N/A',
        b.customerNotes || ''
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookings-${format(date, 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    notify('success', 'Bookings exported successfully');
  };

  const getStatusBadge = (status: Booking['status']) => {
    const statusMap = {
      pending: { status: 'warning', label: 'Pending' },
      confirmed: { status: 'success', label: 'Confirmed' },
      cancelled: { status: 'error', label: 'Cancelled' },
      completed: { status: 'default', label: 'Completed' },
      'no-show': { status: 'error', label: 'No Show' }
    };
    const config = statusMap[status];
    return <StatusBadge status={config.status as any} label={config.label} />;
  };

  const getPaymentBadge = (paymentStatus?: string) => {
    if (!paymentStatus) return null;
    const statusMap = {
      pending: { status: 'warning', label: 'Payment Pending' },
      completed: { status: 'success', label: 'Paid' },
      failed: { status: 'error', label: 'Payment Failed' },
      refunded: { status: 'default', label: 'Refunded' }
    };
    const config = statusMap[paymentStatus as keyof typeof statusMap];
    return <StatusBadge status={config.status as any} label={config.label} />;
  };

  // Filter bookings
  const filteredBookings = bookings
    .filter(b => filterStatus === 'all' || b.status === filterStatus)
    .sort((a, b) => {
      if (sortBy === 'time') {
        return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
      } else if (sortBy === 'customer') {
        return (a.userName || '').localeCompare(b.userName || '');
      } else {
        return b.totalAmount - a.totalAmount;
      }
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <EmptyState
        icon={Calendar}
        title="No bookings found"
        description={`No bookings scheduled for ${format(date, 'MMMM d, yyyy')}`}
        action={{
          label: 'Create Booking',
          onClick: () => notify('info', 'Opening booking form...')
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="card p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[var(--text-muted)]" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="cancelled">Cancelled</option>
                <option value="completed">Completed</option>
                <option value="no-show">No Show</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--text-secondary)]">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                <option value="time">Time</option>
                <option value="customer">Customer</option>
                <option value="amount">Amount</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {selectedBookings.size > 0 && (
              <span className="text-sm text-[var(--accent)] font-medium">
                {selectedBookings.size} selected
              </span>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportCSV}
              icon={Download}
            >
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-primary)]">
                <th className="text-left p-4">
                  <input
                    type="checkbox"
                    checked={selectedBookings.size === filteredBookings.length && filteredBookings.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-[var(--border-primary)]"
                  />
                </th>
                <th className="text-left p-4 text-sm font-medium text-[var(--text-secondary)]">Time</th>
                <th className="text-left p-4 text-sm font-medium text-[var(--text-secondary)]">Customer</th>
                <th className="text-left p-4 text-sm font-medium text-[var(--text-secondary)]">Location</th>
                <th className="text-left p-4 text-sm font-medium text-[var(--text-secondary)]">Space</th>
                <th className="text-left p-4 text-sm font-medium text-[var(--text-secondary)]">Amount</th>
                <th className="text-left p-4 text-sm font-medium text-[var(--text-secondary)]">Status</th>
                <th className="text-left p-4 text-sm font-medium text-[var(--text-secondary)]">Payment</th>
                <th className="text-left p-4 text-sm font-medium text-[var(--text-secondary)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.map((booking) => (
                <tr
                  key={booking.id}
                  className="border-b border-[var(--border-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <td className="p-4">
                    <input
                      type="checkbox"
                      checked={selectedBookings.has(booking.id)}
                      onChange={() => handleSelectBooking(booking.id)}
                      className="rounded border-[var(--border-primary)]"
                    />
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[var(--text-muted)]" />
                      <div>
                        <div className="font-medium text-[var(--text-primary)]">
                          {format(new Date(booking.startAt), 'h:mm a')}
                        </div>
                        <div className="text-xs text-[var(--text-secondary)]">
                          {booking.duration} min
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div>
                      <div className="font-medium text-[var(--text-primary)]">
                        {booking.userName || 'Guest'}
                      </div>
                      <div className="text-xs text-[var(--text-secondary)]">
                        {booking.userEmail || booking.userPhone || 'No contact'}
                      </div>
                      {booking.tierName && (
                        <span
                          className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full"
                          style={{
                            backgroundColor: `${booking.tierColor}20`,
                            color: booking.tierColor
                          }}
                        >
                          {booking.tierName}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[var(--text-muted)]" />
                      <span className="text-sm text-[var(--text-primary)]">
                        {booking.locationName}
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-[var(--text-primary)]">
                      {booking.spaces?.map(s => s.name).join(', ') || 'N/A'}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4 text-[var(--text-muted)]" />
                      <span className="font-medium text-[var(--text-primary)]">
                        {booking.totalAmount.toFixed(2)}
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    {getStatusBadge(booking.status)}
                  </td>
                  <td className="p-4">
                    {getPaymentBadge(booking.paymentStatus)}
                  </td>
                  <td className="p-4 relative">
                    <button
                      onClick={() => setShowActions(showActions === booking.id ? null : booking.id)}
                      className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {showActions === booking.id && (
                      <div className="absolute right-0 mt-2 w-48 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg shadow-lg z-10">
                        {isStaff && (
                          <>
                            <button
                              onClick={() => {
                                onEditBooking?.(booking);
                                setShowActions(null);
                              }}
                              className="w-full text-left px-4 py-2 hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-2"
                            >
                              <Edit2 className="w-4 h-4" />
                              Edit Booking
                            </button>
                            {booking.status !== 'cancelled' && (
                              <button
                                onClick={() => {
                                  handleCancelBooking(booking);
                                  setShowActions(null);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-2 text-[var(--status-error)]"
                              >
                                <X className="w-4 h-4" />
                                Cancel Booking
                              </button>
                            )}
                          </>
                        )}
                        {isAdmin && booking.paymentStatus === 'completed' && (
                          <button
                            onClick={() => {
                              onRefund?.(booking);
                              setShowActions(null);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-2"
                          >
                            <DollarSign className="w-4 h-4" />
                            Process Refund
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="card p-4 bg-[var(--bg-tertiary)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm text-[var(--text-secondary)]">
            Showing {filteredBookings.length} of {bookings.length} bookings
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-[var(--text-secondary)]">Total Revenue: </span>
              <span className="font-bold text-[var(--accent)]">
                ${filteredBookings.reduce((sum, b) => sum + b.totalAmount, 0).toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-[var(--text-secondary)]">Occupancy: </span>
              <span className="font-bold text-[var(--text-primary)]">
                {Math.round((filteredBookings.length / 34) * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingListView;