import React from 'react';
import { DollarSign, Tag, CreditCard, AlertCircle } from 'lucide-react';

interface PricingDisplayProps {
  basePrice: number;
  discountAmount: number;
  depositAmount: number;
  changeFee: number;
  totalAmount: number;
  tierColor?: string;
}

export default function PricingDisplay({
  basePrice,
  discountAmount,
  depositAmount,
  changeFee,
  totalAmount,
  tierColor = '#3B82F6'
}: PricingDisplayProps) {
  const formatPrice = (amount: number) => `$${amount.toFixed(2)}`;

  return (
    <div
      className="p-4 rounded-lg border-2"
      style={{ borderColor: tierColor, backgroundColor: `${tierColor}10` }}
    >
      <h3 className="font-medium mb-3 flex items-center gap-2">
        <DollarSign className="w-5 h-5" style={{ color: tierColor }} />
        Booking Summary
      </h3>

      <div className="space-y-2">
        {/* Base Price */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Base Price</span>
          <span className="font-medium">{formatPrice(basePrice)}</span>
        </div>

        {/* Discount */}
        {discountAmount > 0 && (
          <div className="flex justify-between items-center text-green-600">
            <span className="text-sm flex items-center gap-1">
              <Tag className="w-3 h-3" />
              Discount
            </span>
            <span className="font-medium">-{formatPrice(discountAmount)}</span>
          </div>
        )}

        {/* Change Fee */}
        {changeFee > 0 && (
          <div className="flex justify-between items-center text-orange-600">
            <span className="text-sm flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Change Fee
            </span>
            <span className="font-medium">+{formatPrice(changeFee)}</span>
          </div>
        )}

        {/* Deposit */}
        {depositAmount > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 flex items-center gap-1">
              <CreditCard className="w-3 h-3" />
              Deposit Required
            </span>
            <span className="font-medium">{formatPrice(depositAmount)}</span>
          </div>
        )}

        {/* Divider */}
        <div className="border-t pt-2 mt-2">
          <div className="flex justify-between items-center">
            <span className="font-semibold">Total Due</span>
            <span
              className="text-xl font-bold"
              style={{ color: tierColor }}
            >
              {formatPrice(totalAmount)}
            </span>
          </div>
        </div>

        {/* Deposit Note */}
        {depositAmount > 0 && (
          <p className="text-xs text-gray-500 mt-2">
            * ${depositAmount} deposit will be charged now. Remaining balance due at check-in.
          </p>
        )}

        {/* Cancellation Policy */}
        <div className="mt-3 p-2 bg-gray-50 rounded text-xs text-gray-600">
          <p className="font-medium mb-1">Cancellation Policy:</p>
          <ul className="space-y-0.5">
            <li>• Free cancellation up to 24 hours before</li>
            <li>• 50% charge for same-day cancellation</li>
            <li>• Full charge for no-shows</li>
          </ul>
        </div>
      </div>
    </div>
  );
}