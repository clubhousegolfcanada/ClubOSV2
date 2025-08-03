import React from 'react';
import { render, screen } from '@testing-library/react';
import PasswordStrengthIndicator, { PasswordValidation } from '@/components/PasswordStrengthIndicator';

describe('PasswordStrengthIndicator Component', () => {
  describe('Strength Indicator Mode', () => {
    it('shows "Very Weak" when no requirements are met', () => {
      const validation: PasswordValidation = {
        minLength: false,
        hasUppercase: false,
        hasLowercase: false,
        hasNumber: false
      };
      
      render(<PasswordStrengthIndicator validation={validation} />);
      
      expect(screen.getByText('Very Weak')).toBeInTheDocument();
      expect(screen.getByText('Very Weak')).toHaveClass('text-red-500');
    });

    it('shows "Weak" when 2 requirements are met', () => {
      const validation: PasswordValidation = {
        minLength: true,
        hasUppercase: false,
        hasLowercase: true,
        hasNumber: false
      };
      
      render(<PasswordStrengthIndicator validation={validation} />);
      
      expect(screen.getByText('Weak')).toBeInTheDocument();
      expect(screen.getByText('Weak')).toHaveClass('text-orange-500');
    });

    it('shows "Good" when 3 requirements are met', () => {
      const validation: PasswordValidation = {
        minLength: true,
        hasUppercase: true,
        hasLowercase: true,
        hasNumber: false
      };
      
      render(<PasswordStrengthIndicator validation={validation} />);
      
      expect(screen.getByText('Good')).toBeInTheDocument();
      expect(screen.getByText('Good')).toHaveClass('text-yellow-500');
    });

    it('shows "Strong" when all requirements are met', () => {
      const validation: PasswordValidation = {
        minLength: true,
        hasUppercase: true,
        hasLowercase: true,
        hasNumber: true
      };
      
      render(<PasswordStrengthIndicator validation={validation} />);
      
      expect(screen.getByText('Strong')).toBeInTheDocument();
      expect(screen.getByText('Strong')).toHaveClass('text-green-500');
    });

    it('renders correct number of strength bars', () => {
      const validation: PasswordValidation = {
        minLength: true,
        hasUppercase: true,
        hasLowercase: false,
        hasNumber: false
      };
      
      const { container } = render(<PasswordStrengthIndicator validation={validation} />);
      
      const bars = container.querySelectorAll('.h-1');
      expect(bars).toHaveLength(4);
    });

    it('colors strength bars progressively', () => {
      const validation: PasswordValidation = {
        minLength: true,
        hasUppercase: true,
        hasLowercase: true,
        hasNumber: false
      };
      
      const { container } = render(<PasswordStrengthIndicator validation={validation} />);
      
      const bars = container.querySelectorAll('.h-1');
      expect(bars[0]).toHaveClass('bg-red-500');
      expect(bars[1]).toHaveClass('bg-orange-500');
      expect(bars[2]).toHaveClass('bg-yellow-500');
      expect(bars[3]).toHaveClass('bg-[var(--bg-tertiary)]'); // Not filled
    });
  });

  describe('Requirements Mode', () => {
    it('shows all requirements when showRequirements is true', () => {
      const validation: PasswordValidation = {
        minLength: false,
        hasUppercase: false,
        hasLowercase: false,
        hasNumber: false
      };
      
      render(<PasswordStrengthIndicator validation={validation} showRequirements={true} />);
      
      expect(screen.getByText(/At least 8 characters/)).toBeInTheDocument();
      expect(screen.getByText(/One uppercase letter/)).toBeInTheDocument();
      expect(screen.getByText(/One lowercase letter/)).toBeInTheDocument();
      expect(screen.getByText(/One number/)).toBeInTheDocument();
    });

    it('shows checkmarks for met requirements', () => {
      const validation: PasswordValidation = {
        minLength: true,
        hasUppercase: false,
        hasLowercase: true,
        hasNumber: false
      };
      
      render(<PasswordStrengthIndicator validation={validation} showRequirements={true} />);
      
      expect(screen.getByText(/✓ At least 8 characters/)).toBeInTheDocument();
      expect(screen.getByText(/○ One uppercase letter/)).toBeInTheDocument();
      expect(screen.getByText(/✓ One lowercase letter/)).toBeInTheDocument();
      expect(screen.getByText(/○ One number/)).toBeInTheDocument();
    });

    it('applies green color to met requirements', () => {
      const validation: PasswordValidation = {
        minLength: true,
        hasUppercase: true,
        hasLowercase: true,
        hasNumber: true
      };
      
      render(<PasswordStrengthIndicator validation={validation} showRequirements={true} />);
      
      // Check that all met requirements have green color
      expect(screen.getByText(/✓ At least 8 characters/)).toHaveClass('text-green-500');
      expect(screen.getByText(/✓ One uppercase letter/)).toHaveClass('text-green-500');
      expect(screen.getByText(/✓ One lowercase letter/)).toHaveClass('text-green-500');
      expect(screen.getByText(/✓ One number/)).toHaveClass('text-green-500');
    });

    it('applies muted color to unmet requirements', () => {
      const validation: PasswordValidation = {
        minLength: false,
        hasUppercase: false,
        hasLowercase: false,
        hasNumber: false
      };
      
      render(<PasswordStrengthIndicator validation={validation} showRequirements={true} />);
      
      // Check that all unmet requirements have muted color
      expect(screen.getByText(/○ At least 8 characters/)).toHaveClass('text-[var(--text-muted)]');
      expect(screen.getByText(/○ One uppercase letter/)).toHaveClass('text-[var(--text-muted)]');
      expect(screen.getByText(/○ One lowercase letter/)).toHaveClass('text-[var(--text-muted)]');
      expect(screen.getByText(/○ One number/)).toHaveClass('text-[var(--text-muted)]');
    });

    it('does not show strength bar when showing requirements', () => {
      const validation: PasswordValidation = {
        minLength: true,
        hasUppercase: true,
        hasLowercase: true,
        hasNumber: true
      };
      
      render(<PasswordStrengthIndicator validation={validation} showRequirements={true} />);
      
      expect(screen.queryByText('Strong')).not.toBeInTheDocument();
    });
  });
});