import React from 'react';
import { useAuthState } from '@/state/useStore';
import { getRoleDisplayName, getRoleBadgeStyles } from '@/utils/roleUtils';

interface RoleTagProps {
  className?: string;
  showLabel?: boolean;
}

export const RoleTag: React.FC<RoleTagProps> = ({ className = '', showLabel = true }) => {
  const { user } = useAuthState();

  if (!user) return null;

  return (
    <div className={`inline-flex items-center ${className}`}>
      {showLabel && (
        <span className="text-sm text-gray-500 dark:text-gray-400 mr-2">Role:</span>
      )}
      <span className={getRoleBadgeStyles(user.role)}>
        {getRoleDisplayName(user.role)}
      </span>
    </div>
  );
};

export default RoleTag;
