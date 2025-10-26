import React, { useEffect, useState } from 'react';
import { DollarSign, Tag, Info } from 'lucide-react';
import { http } from '@/api/http';
import logger from '@/utils/logger';

interface BookingPricingPanelProps {
  duration: number; // in minutes
  customerTier: string;
  promoCode: string;
  onPromoCodeChange: (code: string) => void;
  onPricingUpdate: (pricing: {
    basePrice: number;
    discount: number;
    total: number;
  }) => void;
}

export default function BookingPricingPanel({
  duration,
  customerTier,
  promoCode,
  onPromoCodeChange,
  onPricingUpdate
}: BookingPricingPanelProps) {
  const [validatingPromo, setValidatingPromo] = useState(false);
  const [promoValid, setPromoValid] = useState<boolean | null>(null);
  const [promoDiscount, setPromoDiscount] = useState(0);

  // Calculate base price
  const hours = Math.ceil(duration / 60);
  const basePrice = hours * 60; // $60 per hour

  // Calculate tier discount
  const getTierDiscount = () => {
    switch (customerTier) {
      case 'member': return 0.10; // 10% off
      case 'frequent': return 0.15; // 15% off
      case 'promo': return 0.20; // 20% off
      default: return 0;
    }
  };

  const tierDiscountPercent = getTierDiscount();
  const tierDiscountAmount = basePrice * tierDiscountPercent;

  // Calculate total
  const subtotal = basePrice - tierDiscountAmount - promoDiscount;
  const tax = subtotal * 0.13; // 13% tax
  const total = Math.round((subtotal + tax) * 100) / 100;

  // Update parent with pricing
  useEffect(() => {
    onPricingUpdate({
      basePrice,
      discount: tierDiscountAmount + promoDiscount,
      total
    });
  }, [basePrice, tierDiscountAmount, promoDiscount, total]);

  // Validate promo code
  useEffect(() => {
    if (promoCode.length >= 3) {
      const timer = setTimeout(() => {
        validatePromoCode(promoCode);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setPromoValid(null);
      setPromoDiscount(0);
    }
  }, [promoCode]);

  const validatePromoCode = async (code: string) => {
    setValidatingPromo(true);
    try {
      // For demo, just check if it's a valid code
      const validCodes: Record<string, number> = {
        'FIRST10': 10,
        'SAVE20': 20,
        'STUDENT15': 15,
        'WEEKEND25': 25
      };

      if (validCodes[code.toUpperCase()]) {
        setPromoValid(true);
        setPromoDiscount(validCodes[code.toUpperCase()]);
      } else {
        setPromoValid(false);
        setPromoDiscount(0);
      }
    } catch (error) {
      logger.error('[BookingPricingPanel] Failed to validate promo code:', error);
      setPromoValid(false);
      setPromoDiscount(0);
    } finally {
      setValidatingPromo(false);
    }
  };

  return (
    <div className="p-6 border-b">
      <h3 className="text-sm font-medium text-gray-500 mb-3">PRICING</h3>

      {/* Promo Code Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Promo Code</label>
        <div className="relative">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={promoCode}
            onChange={(e) => onPromoCodeChange(e.target.value.toUpperCase())}
            className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent ${
              promoValid === true
                ? 'border-green-500 focus:ring-green-500'
                : promoValid === false
                ? 'border-red-500 focus:ring-red-500'
                : 'focus:ring-[var(--accent)]'
            }`}
            placeholder="Enter promo code"
          />
          {validatingPromo && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--accent)]"></div>
            </div>
          )}
          {promoValid === true && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600">
              ✓
            </div>
          )}
          {promoValid === false && promoCode.length >= 3 && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-600">
              ✗
            </div>
          )}
        </div>
        {promoValid === false && promoCode.length >= 3 && (
          <p className="mt-1 text-sm text-red-600">Invalid promo code</p>
        )}
        {promoValid === true && (
          <p className="mt-1 text-sm text-green-600">Promo code applied! -${promoDiscount}</p>
        )}
      </div>

      {/* Price Breakdown */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Base Price ({hours} hour{hours !== 1 ? 's' : ''})</span>
          <span className="font-medium">${basePrice.toFixed(2)}</span>
        </div>

        {tierDiscountAmount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 flex items-center gap-1">
              {customerTier.charAt(0).toUpperCase() + customerTier.slice(1)} Discount
              <span className="text-xs text-gray-400">({(tierDiscountPercent * 100).toFixed(0)}%)</span>
            </span>
            <span className="font-medium text-green-600">-${tierDiscountAmount.toFixed(2)}</span>
          </div>
        )}

        {promoDiscount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Promo Code</span>
            <span className="font-medium text-green-600">-${promoDiscount.toFixed(2)}</span>
          </div>
        )}

        <div className="border-t pt-2 flex justify-between text-sm">
          <span className="text-gray-600">Subtotal</span>
          <span className="font-medium">${subtotal.toFixed(2)}</span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Tax (13%)</span>
          <span className="font-medium">${tax.toFixed(2)}</span>
        </div>

        <div className="border-t pt-2 flex justify-between">
          <span className="font-semibold text-gray-900">Total</span>
          <span className="font-bold text-xl text-[var(--accent)]">${total.toFixed(2)}</span>
        </div>
      </div>

      {/* Info Note */}
      <div className="mt-4 flex items-start gap-2 text-xs text-gray-500">
        <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
        <p>
          Payment will be processed at the facility. You can pay with cash, credit card, or ClubCoin.
        </p>
      </div>
    </div>
  );
}