import React, { useState, useEffect, useCallback } from 'react';
import { Search, User, Mail, Phone, Plus, Check, ChevronDown } from 'lucide-react';
import { http } from '@/api/http';
import { useDebounce } from '@/hooks/useDebounce';
import logger from '@/utils/logger';

interface CustomerData {
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerTier: string;
}

interface CustomerQuickSearchProps {
  value: CustomerData;
  onChange: (data: CustomerData) => void;
}

export default function CustomerQuickSearch({
  value,
  onChange
}: CustomerQuickSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Search customers when search term changes
  useEffect(() => {
    if (debouncedSearchTerm.length >= 2) {
      searchCustomers(debouncedSearchTerm);
    } else {
      setCustomers([]);
      setShowDropdown(false);
    }
  }, [debouncedSearchTerm]);

  const searchCustomers = async (query: string) => {
    setSearching(true);
    try {
      const response = await http.get('/customers/search', {
        params: { q: query }
      });
      const results = response.data.data || [];
      setCustomers(results);
      setShowDropdown(results.length > 0);
    } catch (error) {
      logger.error('[CustomerQuickSearch] Search failed:', error);
      setCustomers([]);
    } finally {
      setSearching(false);
    }
  };

  const selectCustomer = (customer: any) => {
    onChange({
      customerId: customer.id,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone || '',
      customerTier: customer.tier || 'new'
    });
    setSearchTerm('');
    setShowDropdown(false);
    setShowNewCustomer(false);
  };

  const handleNewCustomer = () => {
    setShowNewCustomer(true);
    setShowDropdown(false);
    onChange({
      customerId: '',
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      customerTier: 'new'
    });
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'member': return 'bg-blue-100 text-blue-700';
      case 'promo': return 'bg-purple-100 text-purple-700';
      case 'frequent': return 'bg-gold-100 text-gold-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // If customer is selected, show their info
  if (value.customerId && !showNewCustomer) {
    return (
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-400" />
              <span className="font-medium">{value.customerName}</span>
              {value.customerTier && value.customerTier !== 'new' && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTierColor(value.customerTier)}`}>
                  {value.customerTier}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                onChange({
                  customerId: '',
                  customerName: '',
                  customerEmail: '',
                  customerPhone: '',
                  customerTier: 'new'
                });
              }}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Change
            </button>
          </div>
          <div className="space-y-1 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Mail className="w-3 h-3" />
              <span>{value.customerEmail}</span>
            </div>
            {value.customerPhone && (
              <div className="flex items-center gap-2">
                <Phone className="w-3 h-3" />
                <span>{value.customerPhone}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show new customer form
  if (showNewCustomer) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">New Customer</h4>
          <button
            type="button"
            onClick={() => {
              setShowNewCustomer(false);
              onChange({
                customerId: '',
                customerName: '',
                customerEmail: '',
                customerPhone: '',
                customerTier: 'new'
              });
            }}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Search existing
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={value.customerName}
              onChange={(e) => onChange({ ...value, customerName: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
              placeholder="Enter customer name"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={value.customerEmail}
              onChange={(e) => onChange({ ...value, customerEmail: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
              placeholder="customer@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <input
              type="tel"
              value={value.customerPhone}
              onChange={(e) => onChange({ ...value, customerPhone: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
              placeholder="(555) 555-5555"
            />
          </div>
        </div>
      </div>
    );
  }

  // Show search interface
  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => customers.length > 0 && setShowDropdown(true)}
          className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
          placeholder="Search customer by name, email, or phone..."
        />
        {searching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--accent)]"></div>
          </div>
        )}
      </div>

      {/* Search results dropdown */}
      {showDropdown && (
        <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border max-h-64 overflow-y-auto">
          {customers.map((customer) => (
            <button
              key={customer.id}
              type="button"
              onClick={() => selectCustomer(customer)}
              className="w-full px-4 py-3 hover:bg-gray-50 text-left border-b last:border-0 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {customer.name}
                    {customer.tier && customer.tier !== 'new' && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTierColor(customer.tier)}`}>
                        {customer.tier}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">{customer.email}</div>
                  {customer.phone && (
                    <div className="text-sm text-gray-500">{customer.phone}</div>
                  )}
                </div>
                <Check className="w-4 h-4 text-green-600 opacity-0" />
              </div>
            </button>
          ))}
          <button
            type="button"
            onClick={handleNewCustomer}
            className="w-full px-4 py-3 hover:bg-blue-50 text-left flex items-center gap-2 text-blue-600 font-medium"
          >
            <Plus className="w-4 h-4" />
            Add New Customer
          </button>
        </div>
      )}

      {/* No results */}
      {searchTerm.length >= 2 && !searching && customers.length === 0 && showDropdown && (
        <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border">
          <div className="px-4 py-3 text-center text-gray-500">
            No customers found
          </div>
          <button
            type="button"
            onClick={handleNewCustomer}
            className="w-full px-4 py-3 hover:bg-blue-50 text-left flex items-center gap-2 text-blue-600 font-medium border-t"
          >
            <Plus className="w-4 h-4" />
            Add New Customer
          </button>
        </div>
      )}
    </div>
  );
}