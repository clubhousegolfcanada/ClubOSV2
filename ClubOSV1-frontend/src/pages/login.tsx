import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuthState, useStore } from '@/state/useStore';
import toast from 'react-hot-toast';
import { http } from '@/api/http';
import { Eye, EyeOff, Users, User, ArrowRight } from 'lucide-react';
import { tokenManager } from '@/utils/tokenManager';

const LoginPage = () => {
  const router = useRouter();
  const { login } = useAuthState();
  const { setViewMode } = useStore();
  const [loginMode, setLoginMode] = useState<'operator' | 'customer'>('operator');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(''); // For customer signup
  const [phone, setPhone] = useState(''); // For customer signup
  const [isSignup, setIsSignup] = useState(false); // Toggle between login and signup for customers
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [rememberMe, setRememberMe] = useState(false); // Remember me checkbox state
  
  // Stop token monitoring when login page loads
  useEffect(() => {
    tokenManager.stopTokenMonitoring();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Clear any stale authentication state before attempting login
    if (typeof window !== 'undefined') {
      // Clear old tokens and user data
      tokenManager.clearToken();
      localStorage.removeItem('clubos_user');
      localStorage.removeItem('clubos_view_mode');
      sessionStorage.clear();
      
      // Auth header cleanup now handled by http client
    }

    try {
      // Stop any existing token monitoring first
      tokenManager.stopTokenMonitoring();
      
      // Clear any stale auth data
      tokenManager.clearToken();
      localStorage.removeItem('clubos_user');

      let response;
      
      // Handle customer signup
      if (loginMode === 'customer' && isSignup) {
        response = await http.post('auth/signup', {
          email,
          password,
          name,
          phone,
          role: 'customer'
        });
        
        // Check if signup was successful
        if (response.data.success) {
          // Check if account was auto-approved (has token)
          if (response.data.data?.token) {
            // Auto-approved - log them in immediately
            const { user, token } = response.data.data;
            login(user, token);
            setViewMode('customer');
            toast.success(`Welcome ${user.name}! Your account is ready.`);
            setTimeout(() => {
              router.push('/customer/');
            }, 100);
            return;
          } else {
            // Pending approval - show message and switch to login
            toast.success('Account created! Your account is pending approval. You will be notified once approved.');
            setIsSignup(false);
            setPassword('');
            setName('');
            setPhone('');
            return;
          }
        }
      } else {
        // Handle login (both operator and customer)
        response = await http.post('auth/login', {
          email,
          password,
          rememberMe
        });
      }

      if (response.data.success) {
        const { user, token } = response.data.data;
        
        // Set login timestamp for grace period
        sessionStorage.setItem('clubos_login_timestamp', Date.now().toString());
        
        // Login user with real data
        login(user, token);
        
        // Set view mode based on user role or login mode
        if (user.role === 'customer' || loginMode === 'customer') {
          setViewMode('customer');
        } else {
          setViewMode('operator');
        }

        // Ensure state is properly set before navigation
        await new Promise(resolve => setTimeout(resolve, 200));
        
        toast.success(`Welcome ${isSignup ? '' : 'back'}, ${user.name}!`);
        
        // Navigate based on user role
        if (user.role === 'customer' || loginMode === 'customer') {
          router.push('/customer/');
        } else {
          router.push('/');
        }
      }
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Extract error details
      const errorCode = error.response?.data?.code;
      const errorMessage = error.response?.data?.message;
      
      // Provide specific error messages based on error codes
      let message = errorMessage;
      
      if (errorCode === 'INVALID_CREDENTIALS') {
        message = 'Invalid email or password. Please check your credentials.';
      } else if (errorCode === 'ACCOUNT_PENDING') {
        message = 'Your account is pending approval. You will be notified once approved.';
      } else if (errorCode === 'ACCOUNT_SUSPENDED') {
        message = 'Your account has been suspended. Please contact support.';
      } else if (errorCode === 'ACCOUNT_REJECTED') {
        message = 'Your account application was not approved.';
      } else if (errorCode === 'EMAIL_EXISTS') {
        message = 'An account with this email already exists. Please login instead.';
      } else if (!message) {
        message = isSignup ? 'Registration failed. Please try again.' : 'Login failed. Please check your credentials.';
      }
      
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsResetting(true);

    try {
      const response = await http.post('auth/forgot-password', {
        email: resetEmail
      });

      if (response.data.success) {
        toast.success(response.data.message);
        setShowResetModal(false);
        setResetEmail('');
      }
    } catch (error: any) {
      console.error('Password reset error:', error);
      const message = error.response?.data?.message || 'Failed to send reset email. Please try again.';
      toast.error(message);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-start justify-center bg-[var(--bg-primary)] px-4 pt-20 pb-8">
      <div className="max-w-md w-full space-y-6">
        <div>
          <h1 className="text-center text-2xl sm:text-3xl font-bold bg-gradient-to-r from-[var(--accent)] to-teal-400 bg-clip-text text-transparent">
            {loginMode === 'customer' ? 'Clubhouse Golf' : 'ClubOS'}
          </h1>
          <h2 className="mt-4 sm:mt-6 text-center text-xl sm:text-2xl font-semibold text-[var(--text-primary)]">
            {loginMode === 'customer' ? 
              (isSignup ? 'Create your account' : 'Welcome back!') : 
              'Sign in to operations'
            }
          </h2>
        </div>

        {/* Login Mode Toggle */}
        <div className="flex items-center justify-center space-x-2 bg-[var(--bg-secondary)] rounded-lg p-1">
          <button
            type="button"
            onClick={() => {
              setLoginMode('operator');
              setIsSignup(false);
            }}
            className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md transition-all ${
              loginMode === 'operator' 
                ? 'bg-[var(--accent)] text-white' 
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Operator</span>
          </button>
          <button
            type="button"
            onClick={() => setLoginMode('customer')}
            className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md transition-all ${
              loginMode === 'customer' 
                ? 'bg-[var(--accent)] text-white' 
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Customer</span>
          </button>
        </div>

        <form className="mt-6 sm:mt-8 space-y-4 sm:space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-3 sm:space-y-4">
            {/* Show name field for customer signup */}
            {loginMode === 'customer' && isSignup && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-[var(--text-secondary)]">
                  Full Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  className="mt-1 block w-full px-3 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-md text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent text-base"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[var(--text-secondary)]">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                className="mt-1 block w-full px-3 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-md text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent text-base"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Show phone field for customer signup */}
            {loginMode === 'customer' && isSignup && (
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-[var(--text-secondary)]">
                  Phone Number (optional)
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  className="mt-1 block w-full px-3 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-md text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent text-base"
                  placeholder="(902) 555-0123"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            )}

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[var(--text-secondary)]">
                Password
              </label>
              <div className="relative mt-1">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className="block w-full px-3 py-2.5 pr-10 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-md text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent text-base"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 text-[var(--accent)] focus:ring-[var(--accent)] border-[var(--border-primary)] rounded"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-[var(--text-secondary)]">
                Remember me for 30 days
              </label>
            </div>
            
            <div className="text-sm">
              <button
                type="button"
                onClick={() => setShowResetModal(true)}
                className="font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
              >
                Forgot password?
              </button>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {isLoading ? 
                (isSignup ? 'Creating account...' : 'Signing in...') : 
                (isSignup ? 'Create Account' : 'Sign In')
              }
            </button>
          </div>
        </form>

        {/* Customer signup/login toggle */}
        {loginMode === 'customer' && (
          <div className="text-center">
            <p className="text-sm text-[var(--text-secondary)]">
              {isSignup ? 'Already have an account?' : "Don't have an account?"}
              <button
                type="button"
                onClick={() => setIsSignup(!isSignup)}
                className="ml-2 font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
              >
                {isSignup ? 'Sign In' : 'Sign Up'}
              </button>
            </p>
          </div>
        )}
      </div>

      {/* Password Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--bg-secondary)] rounded-lg p-4 sm:p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
              Reset Password
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Enter your email address and we'll send you instructions to reset your password.
            </p>
            
            <form onSubmit={handlePasswordReset}>
              <div className="mb-4">
                <label htmlFor="reset-email" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Email address
                </label>
                <input
                  id="reset-email"
                  type="email"
                  className="w-full px-3 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-md text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent text-base"
                  placeholder="email@example.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetModal(false);
                    setResetEmail('');
                  }}
                  className="flex-1 px-4 py-2.5 border border-[var(--border-primary)] rounded-md text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  className="flex-1 px-4 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-md text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isResetting ? 'Sending...' : 'Send Reset Email'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
