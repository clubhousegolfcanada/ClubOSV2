import React from 'react';

export interface PasswordValidation {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
}

interface PasswordStrengthIndicatorProps {
  validation: PasswordValidation;
  showRequirements?: boolean;
}

const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({ 
  validation, 
  showRequirements = false 
}) => {
  const getStrength = () => {
    const checks = Object.values(validation).filter(Boolean).length;
    if (checks === 4) return { label: 'Strong', color: 'text-green-500' };
    if (checks === 3) return { label: 'Good', color: 'text-yellow-500' };
    if (checks === 2) return { label: 'Weak', color: 'text-orange-500' };
    return { label: 'Very Weak', color: 'text-red-500' };
  };

  const strength = getStrength();

  if (showRequirements) {
    return (
      <div className="mt-2 space-y-1">
        <div className={`text-xs ${validation.minLength ? 'text-green-500' : 'text-[var(--text-muted)]'}`}>
          {validation.minLength ? '✓' : '○'} At least 8 characters
        </div>
        <div className={`text-xs ${validation.hasUppercase ? 'text-green-500' : 'text-[var(--text-muted)]'}`}>
          {validation.hasUppercase ? '✓' : '○'} One uppercase letter
        </div>
        <div className={`text-xs ${validation.hasLowercase ? 'text-green-500' : 'text-[var(--text-muted)]'}`}>
          {validation.hasLowercase ? '✓' : '○'} One lowercase letter
        </div>
        <div className={`text-xs ${validation.hasNumber ? 'text-green-500' : 'text-[var(--text-muted)]'}`}>
          {validation.hasNumber ? '✓' : '○'} One number
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3, 4].map((level) => {
          const checks = Object.values(validation).filter(Boolean).length;
          return (
            <div
              key={level}
              className={`h-1 flex-1 rounded ${
                checks >= level
                  ? level === 1 ? 'bg-red-500' :
                    level === 2 ? 'bg-orange-500' :
                    level === 3 ? 'bg-yellow-500' :
                    'bg-green-500'
                  : 'bg-[var(--bg-tertiary)]'
              }`}
            />
          );
        })}
      </div>
      <p className={`text-xs ${strength.color}`}>{strength.label}</p>
    </div>
  );
};

export default PasswordStrengthIndicator;