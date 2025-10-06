import React, { useState } from 'react';
import { http } from '@/api/http';
import Button from '@/components/ui/Button';
import { Tag, CheckCircle, XCircle } from 'lucide-react';

interface PromoCodeInputProps {
  value: string;
  onChange: (code: string, discount: number) => void;
}

export default function PromoCodeInput({ value, onChange }: PromoCodeInputProps) {
  const [code, setCode] = useState(value);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [discountInfo, setDiscountInfo] = useState<string | null>(null);

  const validatePromoCode = async () => {
    if (!code.trim()) {
      setStatus('idle');
      onChange('', 0);
      return;
    }

    setChecking(true);
    setStatus('idle');

    try {
      const response = await http.post('/promo-codes/validate', {
        code: code.toUpperCase()
      });

      if (response.data.valid) {
        setStatus('valid');
        const discount = response.data.discount_value || 0;
        const discountType = response.data.discount_type;

        if (discountType === 'percentage') {
          setDiscountInfo(`${discount}% off`);
        } else {
          setDiscountInfo(`$${discount} off`);
        }

        onChange(code.toUpperCase(), discount);
      } else {
        setStatus('invalid');
        setDiscountInfo(response.data.message || 'Invalid code');
        onChange('', 0);
      }
    } catch (error) {
      setStatus('invalid');
      setDiscountInfo('Unable to verify code');
      onChange('', 0);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">
        <Tag className="inline w-4 h-4 mr-1" />
        Promo Code / Gift Card
      </label>

      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setStatus('idle');
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                validatePromoCode();
              }
            }}
            placeholder="Enter code"
            className={`w-full p-2 pr-10 border rounded-lg uppercase ${
              status === 'valid' ? 'border-green-500 bg-green-50' :
              status === 'invalid' ? 'border-red-500 bg-red-50' :
              'border-gray-300'
            }`}
          />

          {status === 'valid' && (
            <CheckCircle className="absolute right-2 top-2.5 w-5 h-5 text-green-600" />
          )}

          {status === 'invalid' && (
            <XCircle className="absolute right-2 top-2.5 w-5 h-5 text-red-600" />
          )}
        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={validatePromoCode}
          disabled={checking || !code.trim()}
        >
          {checking ? 'Checking...' : 'Apply'}
        </Button>
      </div>

      {discountInfo && (
        <p className={`text-sm ${
          status === 'valid' ? 'text-green-600' : 'text-red-600'
        }`}>
          {discountInfo}
        </p>
      )}

      {/* Common promo codes display for testing */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
          Test codes: WELCOME20 (20% off), SUMMER50 ($50 off), VIP (Free hour)
        </div>
      )}
    </div>
  );
}