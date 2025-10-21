import React, { useState, useEffect, useRef } from 'react';
import { Search, User, Phone, Mail, Calendar, TrendingUp, X, Loader2, AlertCircle, Check } from 'lucide-react';
import { http } from '@/api/http';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { formatDistanceToNow } from 'date-fns';
import { useNotifications } from '@/state/hooks';

export interface CustomerData {
  id: string;
  hubspotId?: string;
  name: string;
  email: string;
  phone: string;
  tier: 'new' | 'member' | 'promo' | 'frequent';
  totalBookings: number;
  lastVisit?: Date;
  lifetimeValue: number;
  notes?: string;
  favoriteLocation?: string;
  preferredSimulator?: string;
  tags?: string[];
}

interface CustomerSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCustomer: (customer: CustomerData) => void;
}

const CustomerSearchModal: React.FC<CustomerSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectCustomer
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { notify } = useNotifications();

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (searchTerm.length < 3) {
      setCustomers([]);
      return;
    }

    const timer = setTimeout(() => {
      searchCustomers();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const searchCustomers = async () => {
    setSearching(true);
    setError(null);

    try {
      // Search in HubSpot via backend
      const response = await http.get('/hubspot/search', {
        params: {
          query: searchTerm,
          type: 'contact'
        }
      });

      if (response.data.success) {
        // Transform HubSpot data to our format
        const transformedCustomers: CustomerData[] = response.data.contacts.map((contact: any) => ({
          id: contact.id,
          hubspotId: contact.hubspotId,
          name: contact.properties.firstname + ' ' + contact.properties.lastname,
          email: contact.properties.email || '',
          phone: contact.properties.phone || contact.properties.mobilephone || '',
          tier: determineTier(contact.properties),
          totalBookings: parseInt(contact.properties.total_bookings || '0'),
          lastVisit: contact.properties.last_booking_date ? new Date(contact.properties.last_booking_date) : undefined,
          lifetimeValue: parseFloat(contact.properties.lifetime_value || '0'),
          notes: contact.properties.notes,
          favoriteLocation: contact.properties.favorite_location,
          preferredSimulator: contact.properties.preferred_simulator,
          tags: contact.properties.tags ? contact.properties.tags.split(',') : []
        }));

        setCustomers(transformedCustomers);
      }
    } catch (err: any) {
      logger.error('Customer search error:', err);

      // Fallback to local database search if HubSpot fails
      try {
        const localResponse = await http.get('/users/search', {
          params: { query: searchTerm }
        });

        if (localResponse.data.success) {
          setCustomers(localResponse.data.users);
        }
      } catch (localErr) {
        setError('Unable to search customers. Please try again.');
        notify('error', 'Search failed. Please check your connection.');
      }
    } finally {
      setSearching(false);
    }
  };

  const determineTier = (properties: any): CustomerData['tier'] => {
    const bookings = parseInt(properties.total_bookings || '0');
    if (bookings === 0) return 'new';
    if (bookings >= 10) return 'frequent';
    if (properties.has_membership === 'true') return 'member';
    if (properties.promo_user === 'true') return 'promo';
    return 'new';
  };

  const getTierColor = (tier: CustomerData['tier']) => {
    switch (tier) {
      case 'member': return 'warning'; // Yellow
      case 'promo': return 'success'; // Green
      case 'frequent': return 'info'; // Purple
      default: return 'default'; // Blue
    }
  };

  const getTierLabel = (tier: CustomerData['tier']) => {
    switch (tier) {
      case 'member': return 'Member';
      case 'promo': return 'Promo';
      case 'frequent': return 'Frequent';
      default: return 'New';
    }
  };

  const handleSelectCustomer = (customer: CustomerData) => {
    setSelectedCustomer(customer);
  };

  const confirmSelection = () => {
    if (selectedCustomer) {
      onSelectCustomer(selectedCustomer);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fadeIn">
      <div className="bg-[var(--bg-primary)] rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border-primary)]">
          <div className="flex items-center gap-3">
            <Search className="w-6 h-6 text-[var(--accent)]" />
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Search Customers</h2>
            <StatusBadge status="info" label="HubSpot Connected" />
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-6 border-b border-[var(--border-primary)]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, email, or phone number..."
              className="w-full pl-10 pr-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-[var(--text-primary)]"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 animate-spin text-[var(--accent)]" />
            )}
          </div>
          {searchTerm.length > 0 && searchTerm.length < 3 && (
            <p className="text-sm text-[var(--text-secondary)] mt-2">
              Type at least 3 characters to search...
            </p>
          )}
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-[var(--status-error)]/10 border border-[var(--status-error)]/20 rounded-lg">
              <p className="text-sm text-[var(--status-error)] flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </p>
            </div>
          )}

          {customers.length === 0 && searchTerm.length >= 3 && !searching && (
            <EmptyState
              icon={User}
              title="No customers found"
              description={`No results for "${searchTerm}". Try a different search term.`}
              size="sm"
            />
          )}

          {customers.length > 0 && (
            <div className="space-y-3">
              {customers.map((customer) => (
                <div
                  key={customer.id}
                  onClick={() => handleSelectCustomer(customer)}
                  className={`
                    p-4 rounded-lg border-2 cursor-pointer transition-all duration-200
                    ${selectedCustomer?.id === customer.id
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                      : 'border-[var(--border-primary)] bg-[var(--bg-secondary)] hover:border-[var(--accent)]/50'
                    }
                  `}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Customer Header */}
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-[var(--accent)]/20 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-[var(--accent)]" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-[var(--text-primary)]">
                            {customer.name}
                          </h3>
                          <StatusBadge
                            status={getTierColor(customer.tier) as any}
                            label={getTierLabel(customer.tier)}
                          />
                        </div>
                      </div>

                      {/* Contact Info */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                          <Mail className="w-4 h-4" />
                          <span>{customer.email || 'No email'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                          <Phone className="w-4 h-4" />
                          <span>{customer.phone || 'No phone'}</span>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex flex-wrap gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-[var(--text-muted)]" />
                          <span className="text-[var(--text-secondary)]">
                            {customer.totalBookings} bookings
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-[var(--text-muted)]" />
                          <span className="text-[var(--text-secondary)]">
                            ${customer.lifetimeValue.toFixed(2)} lifetime
                          </span>
                        </div>
                        {customer.lastVisit && (
                          <div className="text-[var(--text-secondary)]">
                            Last visit: {formatDistanceToNow(customer.lastVisit, { addSuffix: true })}
                          </div>
                        )}
                      </div>

                      {/* Tags */}
                      {customer.tags && customer.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {customer.tags.map((tag, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 text-xs bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Selection Indicator */}
                    {selectedCustomer?.id === customer.id && (
                      <div className="ml-4">
                        <div className="w-6 h-6 bg-[var(--accent)] rounded-full flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-[var(--border-primary)]">
          <div className="text-sm text-[var(--text-secondary)]">
            {customers.length > 0 && `Found ${customers.length} customer${customers.length > 1 ? 's' : ''}`}
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={confirmSelection}
              disabled={!selectedCustomer}
            >
              Select Customer
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerSearchModal;