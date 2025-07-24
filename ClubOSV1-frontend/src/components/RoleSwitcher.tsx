import React from 'react';
import { useAuthState } from '@/state/useStore';
import { User, Shield, HeadphonesIcon } from 'lucide-react';

// Define UserRole type locally
type UserRole = 'admin' | 'operator' | 'support';

const RoleSwitcher: React.FC = () => {
  const { user, setUser } = useAuthState();
  
  const roles: { value: UserRole; label: string; icon: React.ReactNode; color: string }[] = [
    { value: 'admin', label: 'Admin', icon: <Shield className="w-4 h-4" />, color: 'text-red-600' },
    { value: 'operator', label: 'Operator', icon: <User className="w-4 h-4" />, color: 'text-blue-600' },
    { value: 'support', label: 'Support', icon: <HeadphonesIcon className="w-4 h-4" />, color: 'text-green-600' }
  ];
  
  const switchRole = (newRole: UserRole) => {
    if (!user) return;
    
    const updatedUser = {
      ...user,
      role: newRole,
      email: `${newRole}@clubos.com`,
      name: `Demo ${newRole.charAt(0).toUpperCase() + newRole.slice(1)}`
    };
    
    setUser(updatedUser);
    localStorage.setItem('clubos_token', 'stub-jwt-token'); // In production, get new token from backend
  };
  
  if (!user) return null;
  
  return (
    <div className="hidden md:block fixed bottom-4 right-4 bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg p-4 shadow-lg">
      <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
        Test Role Switcher
      </h3>
      <div className="space-y-2">
        {roles.map(({ value, label, icon, color }) => (
          <button
            key={value}
            onClick={() => switchRole(value)}
            className={`
              w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium
              transition-all duration-200
              ${user.role === value 
                ? 'bg-[var(--accent)] text-white' 
                : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--bg-primary)]'
              }
            `}
          >
            <span className={user.role === value ? 'text-white' : color}>{icon}</span>
            {label}
            {user.role === value && (
              <span className="ml-auto text-xs">Current</span>
            )}
          </button>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-[var(--border-secondary)]">
        <p className="text-xs text-[var(--text-muted)]">
          Current: <span className="font-medium">{user.email}</span>
        </p>
      </div>
    </div>
  );
};

export default RoleSwitcher;
