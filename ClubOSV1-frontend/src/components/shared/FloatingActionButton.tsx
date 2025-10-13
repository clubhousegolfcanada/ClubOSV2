import React from 'react';
import { Plus } from 'lucide-react';

interface FloatingActionButtonProps {
  onClick: () => void;
  icon?: React.ReactNode;
  label?: string;
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center';
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  onClick,
  icon = <Plus className="w-6 h-6" />,
  label,
  position = 'bottom-right'
}) => {
  const positionClasses = {
    'bottom-right': 'bottom-20 right-4',
    'bottom-left': 'bottom-20 left-4',
    'bottom-center': 'bottom-20 left-1/2 -translate-x-1/2'
  };

  return (
    <button
      onClick={onClick}
      className={`fixed ${positionClasses[position]} z-40 p-4 bg-[var(--accent)] text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 touch-manipulation`}
      style={{ minWidth: '56px', minHeight: '56px' }}
      aria-label={label || 'Create new ticket'}
    >
      {icon}
    </button>
  );
};