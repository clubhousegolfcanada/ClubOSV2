import React from 'react';
import { render, screen } from '@testing-library/react';
import RoleTag from '@/components/RoleTag';
import { useAuthState } from '@/state/useStore';
import { getRoleDisplayName, getRoleBadgeStyles } from '@/utils/roleUtils';

// Mock dependencies
jest.mock('@/state/useStore');
jest.mock('@/utils/roleUtils');

const mockUseAuthState = useAuthState as jest.MockedFunction<typeof useAuthState>;
const mockGetRoleDisplayName = getRoleDisplayName as jest.MockedFunction<typeof getRoleDisplayName>;
const mockGetRoleBadgeStyles = getRoleBadgeStyles as jest.MockedFunction<typeof getRoleBadgeStyles>;

describe('RoleTag Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up default mocks
    mockGetRoleDisplayName.mockImplementation((role) => {
      const roleNames = {
        admin: 'Administrator',
        operator: 'Operator',
        support: 'Support',
        kiosk: 'Kiosk'
      };
      return roleNames[role as keyof typeof roleNames] || role;
    });
    
    mockGetRoleBadgeStyles.mockReturnValue('px-2 py-1 rounded bg-blue-100 text-blue-800');
  });

  it('renders nothing when user is not logged in', () => {
    mockUseAuthState.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: jest.fn(),
      setUser: jest.fn(),
      logout: jest.fn(),
      setAuthLoading: jest.fn()
    });

    const { container } = render(<RoleTag />);
    expect(container.firstChild).toBeNull();
  });

  it('renders role tag with label by default', () => {
    mockUseAuthState.mockReturnValue({
      user: { id: '1', email: 'admin@test.com', name: 'Admin', role: 'admin' },
      isAuthenticated: true,
      isLoading: false,
      login: jest.fn(),
      setUser: jest.fn(),
      logout: jest.fn(),
      setAuthLoading: jest.fn()
    });

    render(<RoleTag />);
    
    expect(screen.getByText('Role:')).toBeInTheDocument();
    expect(screen.getByText('Administrator')).toBeInTheDocument();
  });

  it('renders without label when showLabel is false', () => {
    mockUseAuthState.mockReturnValue({
      user: { id: '1', email: 'operator@test.com', name: 'Operator', role: 'operator' },
      isAuthenticated: true,
      isLoading: false,
      login: jest.fn(),
      setUser: jest.fn(),
      logout: jest.fn(),
      setAuthLoading: jest.fn()
    });

    render(<RoleTag showLabel={false} />);
    
    expect(screen.queryByText('Role:')).not.toBeInTheDocument();
    expect(screen.getByText('Operator')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    mockUseAuthState.mockReturnValue({
      user: { id: '1', email: 'support@test.com', name: 'Support', role: 'support' },
      isAuthenticated: true,
      isLoading: false,
      login: jest.fn(),
      setUser: jest.fn(),
      logout: jest.fn(),
      setAuthLoading: jest.fn()
    });

    render(<RoleTag className="custom-class" />);
    
    const container = screen.getByText('Support').parentElement;
    expect(container).toHaveClass('custom-class');
  });

  it('applies role-specific badge styles', () => {
    mockUseAuthState.mockReturnValue({
      user: { id: '1', email: 'kiosk@test.com', name: 'Kiosk', role: 'kiosk' },
      isAuthenticated: true,
      isLoading: false,
      login: jest.fn(),
      setUser: jest.fn(),
      logout: jest.fn(),
      setAuthLoading: jest.fn()
    });

    render(<RoleTag />);
    
    const badge = screen.getByText('Kiosk');
    expect(badge).toHaveClass('px-2 py-1 rounded bg-blue-100 text-blue-800');
    expect(mockGetRoleBadgeStyles).toHaveBeenCalledWith('kiosk');
  });

  it('renders correctly for all user roles', () => {
    const roles = ['admin', 'operator', 'support', 'kiosk'] as const;
    
    roles.forEach(role => {
      mockUseAuthState.mockReturnValue({
        user: { id: '1', email: `${role}@test.com`, name: role, role },
        isAuthenticated: true,
        isLoading: false,
        login: jest.fn(),
        setUser: jest.fn(),
        logout: jest.fn(),
        setAuthLoading: jest.fn()
      });

      const { rerender } = render(<RoleTag />);
      expect(mockGetRoleDisplayName).toHaveBeenCalledWith(role);
      rerender(<div />); // Clear for next iteration
    });
  });
});