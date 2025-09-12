import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  mobileOptimized?: boolean; // Enable mobile touch target sizes
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  mobileOptimized = true, // Default to mobile-optimized
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = 'font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 touch-manipulation';
  
  const variants = {
    primary: 'bg-primary text-white hover:bg-blue-600 focus:ring-blue-500 disabled:bg-blue-300',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-500 disabled:bg-gray-100',
    danger: 'bg-danger text-white hover:bg-red-600 focus:ring-red-500 disabled:bg-red-300',
  };
  
  // Mobile-optimized sizes ensure minimum 44px touch targets
  const sizes = mobileOptimized ? {
    sm: 'px-4 py-3 text-sm min-h-[44px]', // Was px-3 py-1.5
    md: 'px-5 py-3 text-base min-h-[48px]', // Was px-4 py-2
    lg: 'px-6 py-4 text-lg min-h-[52px]', // Was px-6 py-3
  } : {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };
  
  const widthClass = fullWidth ? 'w-full' : '';
  
  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${widthClass} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
