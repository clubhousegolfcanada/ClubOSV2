import React, { useState, useEffect } from 'react';
import { http } from '@/api/http';
import { BookingMode } from './UnifiedBookingCard';
import PromoCodeInput from '../forms/PromoCodeInput';
import { DollarSign, Tag, Info, Calculator, TrendingUp, Shield, Gift } from 'lucide-react';
import { differenceInMinutes, parseISO } from 'date-fns';
import StatusBadge from '@/components/ui/StatusBadge';
import logger from '@/services/logger';

interface PricingCalculatorProps {
  mode: BookingMode;
  formData: any;
  onPricingUpdate: (pricing: PricingInfo) => void;
}

interface PricingInfo {
  basePrice: number;
  discountAmount: number;
  depositAmount: number;
  taxAmount: number;
  totalAmount: number;
  breakdown: PriceBreakdownItem[];
}

interface PriceBreakdownItem {
  label: string;
  amount: number;
  type: 'base' | 'discount' | 'fee' | 'tax' | 'deposit';
  description?: string;
}

interface CustomerTier {
  id: string;
  name: string;
  hourlyRate: number;
  discountPercent: number;
  requireDeposit: boolean;
  depositPercent: number;
}

// Default tier configurations (should match backend)
const defaultTiers: Record<string, CustomerTier> = {
  new: {
    id: 'new',
    name: 'New Customer',
    hourlyRate: 70,
    discountPercent: 0,
    requireDeposit: false,
    depositPercent: 0
  },
  member: {
    id: 'member',
    name: 'Member',
    hourlyRate: 50,
    discountPercent: 20,
    requireDeposit: false,
    depositPercent: 0
  },
  promo: {
    id: 'promo',
    name: 'Promo User',
    hourlyRate: 60,
    discountPercent: 10,
    requireDeposit: false,
    depositPercent: 0
  },
  frequent: {
    id: 'frequent',
    name: 'Frequent Booker',
    hourlyRate: 55,
    discountPercent: 15,
    requireDeposit: false,
    depositPercent: 0
  }
};

export default function PricingCalculator({
  mode,
  formData,
  onPricingUpdate
}: PricingCalculatorProps) {
  const [calculating, setCalculating] = useState(false);
  const [pricing, setPricing] = useState<PricingInfo>({
    basePrice: 0,
    discountAmount: 0,
    depositAmount: 0,
    taxAmount: 0,
    totalAmount: 0,
    breakdown: []
  });
  const [promoCode, setPromoCode] = useState('');
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoType, setPromoType] = useState<'percentage' | 'fixed'>('percentage');
  const [customerTier, setCustomerTier] = useState<CustomerTier>(defaultTiers.new);
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Calculate pricing whenever form data changes
  useEffect(() => {
    if (formData.startAt && formData.endAt && (mode === 'booking' || mode === 'event' || mode === 'class')) {
      calculatePricing();
    } else if (mode === 'block' || mode === 'maintenance') {
      // No pricing for blocks/maintenance
      setPricing({
        basePrice: 0,
        discountAmount: 0,
        depositAmount: 0,
        taxAmount: 0,
        totalAmount: 0,
        breakdown: []
      });
      onPricingUpdate({
        basePrice: 0,
        discountAmount: 0,
        depositAmount: 0,
        taxAmount: 0,
        totalAmount: 0,
        breakdown: []
      });
    }
  }, [formData.startAt, formData.endAt, formData.spaceIds, formData.customerTierId, promoDiscount, mode]);

  // Fetch customer tier if customer is selected
  useEffect(() => {
    if (formData.customerId || formData.customerTierId) {
      fetchCustomerTier();
    }
  }, [formData.customerId, formData.customerTierId]);

  const fetchCustomerTier = async () => {
    try {
      if (formData.customerTierId && defaultTiers[formData.customerTierId]) {
        setCustomerTier(defaultTiers[formData.customerTierId]);
      } else if (formData.customerId) {
        // Fetch customer tier from backend
        const response = await http.get(`/api/customers/${formData.customerId}/tier`);
        if (response.data.tier) {
          const tierConfig = defaultTiers[response.data.tier] || defaultTiers.new;
          setCustomerTier(tierConfig);
        }
      }
    } catch (error) {
      logger.error('Failed to fetch customer tier:', error);
      setCustomerTier(defaultTiers.new);
    }
  };

  const calculatePricing = async () => {
    if (!formData.startAt || !formData.endAt) return;

    setCalculating(true);
    try {
      const start = typeof formData.startAt === 'string' ? parseISO(formData.startAt) : formData.startAt;
      const end = typeof formData.endAt === 'string' ? parseISO(formData.endAt) : formData.endAt;
      const durationMinutes = differenceInMinutes(end, start);
      const hours = durationMinutes / 60;

      const breakdown: PriceBreakdownItem[] = [];

      // Base price calculation
      let basePrice = 0;

      if (mode === 'booking') {
        // Regular booking pricing
        basePrice = hours * customerTier.hourlyRate;
        breakdown.push({
          label: `${hours.toFixed(1)} hours @ $${customerTier.hourlyRate}/hr`,
          amount: basePrice,
          type: 'base',
          description: `${customerTier.name} rate`
        });

        // Multi-space surcharge
        if (formData.spaceIds && formData.spaceIds.length > 1) {
          const multiSpaceSurcharge = (formData.spaceIds.length - 1) * 20 * hours;
          basePrice += multiSpaceSurcharge;
          breakdown.push({
            label: `Multi-simulator surcharge`,
            amount: multiSpaceSurcharge,
            type: 'fee',
            description: `${formData.spaceIds.length} simulators`
          });
        }
      } else if (mode === 'event') {
        // Event pricing
        basePrice = hours * 100; // Higher rate for events
        breakdown.push({
          label: `Event: ${hours.toFixed(1)} hours @ $100/hr`,
          amount: basePrice,
          type: 'base',
          description: 'Event rate'
        });

        // Add per-person fee if attendees specified
        if (formData.expectedAttendees && formData.expectedAttendees > 10) {
          const extraAttendeeFee = (formData.expectedAttendees - 10) * 5;
          basePrice += extraAttendeeFee;
          breakdown.push({
            label: `Extra attendee fee`,
            amount: extraAttendeeFee,
            type: 'fee',
            description: `${formData.expectedAttendees - 10} extra attendees @ $5 each`
          });
        }
      } else if (mode === 'class') {
        // Class pricing
        basePrice = hours * 80;
        breakdown.push({
          label: `Class: ${hours.toFixed(1)} hours @ $80/hr`,
          amount: basePrice,
          type: 'base',
          description: 'Instructor rate'
        });
      }

      // Apply tier discount
      let discountAmount = 0;
      if (customerTier.discountPercent > 0) {
        discountAmount = basePrice * (customerTier.discountPercent / 100);
        breakdown.push({
          label: `${customerTier.name} discount (${customerTier.discountPercent}%)`,
          amount: -discountAmount,
          type: 'discount',
          description: 'Tier benefit'
        });
      }

      // Apply promo code discount
      if (promoDiscount > 0) {
        let promoDiscountAmount = 0;
        if (promoType === 'percentage') {
          promoDiscountAmount = (basePrice - discountAmount) * (promoDiscount / 100);
          breakdown.push({
            label: `Promo code (${promoDiscount}% off)`,
            amount: -promoDiscountAmount,
            type: 'discount',
            description: promoCode
          });
        } else {
          promoDiscountAmount = Math.min(promoDiscount, basePrice - discountAmount);
          breakdown.push({
            label: `Promo code ($${promoDiscount} off)`,
            amount: -promoDiscountAmount,
            type: 'discount',
            description: promoCode
          });
        }
        discountAmount += promoDiscountAmount;
      }

      // Calculate deposit if required
      let depositAmount = 0;
      if (customerTier.requireDeposit || mode === 'event' || formData.requiresDeposit) {
        const depositPercent = mode === 'event' ? 50 : (customerTier.depositPercent || 25);
        depositAmount = (basePrice - discountAmount) * (depositPercent / 100);
        breakdown.push({
          label: `Deposit required (${depositPercent}%)`,
          amount: depositAmount,
          type: 'deposit',
          description: 'Due at booking'
        });
      }

      // Calculate tax (simplified - should use actual tax rate)
      const taxRate = 0.13; // 13% HST for Ontario
      const taxableAmount = basePrice - discountAmount;
      const taxAmount = taxableAmount * taxRate;
      breakdown.push({
        label: `HST (13%)`,
        amount: taxAmount,
        type: 'tax'
      });

      // Final total
      const totalAmount = basePrice - discountAmount + taxAmount;

      const newPricing: PricingInfo = {
        basePrice,
        discountAmount,
        depositAmount,
        taxAmount,
        totalAmount,
        breakdown
      };

      setPricing(newPricing);
      onPricingUpdate(newPricing);
    } catch (error) {
      logger.error('Failed to calculate pricing:', error);
    } finally {
      setCalculating(false);
    }
  };

  const handlePromoCodeApply = (code: string, discount: number) => {
    setPromoCode(code);

    // Check if it's a gift card or regular promo
    if (code.startsWith('GC-')) {
      // Gift card - fixed amount discount
      setPromoDiscount(discount);
      setPromoType('fixed');
    } else {
      // Regular promo - percentage discount
      setPromoDiscount(discount);
      setPromoType('percentage');
    }
  };

  // Don't show pricing for block/maintenance modes
  if (mode === 'block' || mode === 'maintenance') {
    return null;
  }

  return (
    <div className="px-6 pb-6">
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="bg-blue-100 dark:bg-blue-900/30 px-4 py-3 border-b border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                Pricing Summary
              </h3>
              {customerTier.id !== 'new' && (
                <StatusBadge
                  status="success"
                  label={customerTier.name}
                />
              )}
            </div>
            {calculating && (
              <div className="animate-spin">
                <Calculator className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
            )}
          </div>
        </div>

        {/* Promo Code Input */}
        {mode === 'booking' && (
          <div className="p-4 border-b border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-2">
              <Tag className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Promo Code / Gift Card
              </span>
            </div>
            <PromoCodeInput
              value={promoCode}
              onChange={handlePromoCodeApply}
            />
          </div>
        )}

        {/* Pricing Display */}
        <div className="p-4 space-y-3">
          {/* Quick Summary */}
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-gray-600 dark:text-gray-400">Subtotal</span>
            <span className="font-mono text-sm">${pricing.basePrice.toFixed(2)}</span>
          </div>

          {pricing.discountAmount > 0 && (
            <div className="flex justify-between items-baseline text-green-600 dark:text-green-400">
              <span className="text-sm">Discounts</span>
              <span className="font-mono text-sm">-${pricing.discountAmount.toFixed(2)}</span>
            </div>
          )}

          {pricing.taxAmount > 0 && (
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-gray-600 dark:text-gray-400">Tax</span>
              <span className="font-mono text-sm">${pricing.taxAmount.toFixed(2)}</span>
            </div>
          )}

          {/* Total */}
          <div className="pt-3 border-t border-blue-200 dark:border-blue-800">
            <div className="flex justify-between items-baseline">
              <span className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                Total Due
              </span>
              <span className="text-xl font-bold text-blue-600 dark:text-blue-400 font-mono">
                ${pricing.totalAmount.toFixed(2)}
              </span>
            </div>

            {pricing.depositAmount > 0 && (
              <div className="mt-2 flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                <Shield className="w-4 h-4" />
                <span>Deposit required: ${pricing.depositAmount.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Detailed Breakdown Toggle */}
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="w-full mt-3 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center justify-center gap-1"
          >
            <Info className="w-3 h-3" />
            {showBreakdown ? 'Hide' : 'Show'} detailed breakdown
          </button>

          {/* Detailed Breakdown */}
          {showBreakdown && pricing.breakdown.length > 0 && (
            <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800 space-y-2">
              {pricing.breakdown.map((item, idx) => (
                <div key={idx} className="flex justify-between items-start text-xs">
                  <div className="flex-1">
                    <div className="font-medium text-gray-700 dark:text-gray-300">
                      {item.label}
                    </div>
                    {item.description && (
                      <div className="text-gray-500 dark:text-gray-400">
                        {item.description}
                      </div>
                    )}
                  </div>
                  <span className={`font-mono ml-2 ${
                    item.type === 'discount' ? 'text-green-600 dark:text-green-400' :
                    item.type === 'deposit' ? 'text-blue-600 dark:text-blue-400' :
                    'text-gray-700 dark:text-gray-300'
                  }`}>
                    {item.amount < 0 ? '-' : ''}${Math.abs(item.amount).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Policies */}
        {mode === 'booking' && (
          <div className="px-4 pb-4">
            <div className="bg-blue-100 dark:bg-blue-900/20 rounded-lg p-3 text-xs text-blue-800 dark:text-blue-200">
              <p className="font-semibold mb-1 flex items-center gap-1">
                <Info className="w-3 h-3" />
                Cancellation Policy:
              </p>
              <ul className="space-y-0.5 ml-4">
                <li>• Free cancellation up to 24 hours before</li>
                <li>• 50% charge for same-day cancellation</li>
                <li>• Full charge for no-shows</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}