import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuthState, useStore } from '@/state/useStore';
import toast from 'react-hot-toast';
import { http } from '@/api/http';
import { Eye, EyeOff, Users, User } from 'lucide-react';
import { tokenManager } from '@/utils/tokenManager';
import logger from '@/services/logger';
import GoogleSignInButton from '@/components/GoogleSignInButton';

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
  const [rememberMe, setRememberMe] = useState(true); // Default to true for 30-day login

  // Redirect authenticated users away from login page
  useEffect(() => {
    // Check if user is already authenticated
    const token = tokenManager.getToken();
    const currentUser = useAuthState.getState().user;

    // Only redirect if we have both token AND user data
    // This prevents redirect during initial auth setup
    if (token && currentUser) {
      logger.info(`User ${currentUser.email} already authenticated, redirecting...`);

      // Navigate based on user role
      const targetPath = currentUser.role === 'customer'
        ? '/customer/'
        : currentUser.role === 'contractor'
        ? '/checklists'
        : '/';

      router.push(targetPath);
    }
    // Note: We do NOT clear auth data here anymore.
    // Auth should only be cleared on explicit logout action.
  }, []); // Run only once on mount

  // Auto-detect operator mode based on email domain
  useEffect(() => {
    if (email && email.endsWith('@clubhouse247golf.com')) {
      setLoginMode('operator');
    }
  }, [email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Clear any existing auth before attempting new login
      // This ensures a clean state for the new authentication
      tokenManager.clearAllAuth();

      let response;

      // Handle customer signup
      if (loginMode === 'customer' && isSignup) {
        response = await http.post('auth/signup', {
          email,
          password,
          name,
          phone,
          role: 'customer'
        }, { auth: false } as any);

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
        }, { auth: false } as any);
      }

      if (response.data.success) {
        const { user, token } = response.data.data;

        // Use atomic token update to ensure clean auth state
        tokenManager.updateToken(token);

        // Update auth state (also sets viewMode in localStorage)
        login(user, token);

        // Set view mode based on actual user role (not login mode UI state)
        // This ensures operators who accidentally use customer form still get operator view
        setViewMode(user.role === 'customer' ? 'customer' : 'operator');

        // Show success message immediately
        toast.success(`Welcome ${isSignup ? '' : 'back'}, ${user.name}!`);

        // Navigate based on actual user role
        const targetPath = user.role === 'customer'
          ? '/customer/'
          : user.role === 'contractor'
          ? '/checklists'
          : '/';

        // Use router.push with promise to ensure proper navigation
        await router.push(targetPath);
      }
    } catch (error: any) {
      logger.error('Login error:', error);

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
              'Sign in to Operations'
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
            onClick={() => {
              setLoginMode('customer');
            }}
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

        {/* OPERATOR MODE - Simple with both options */}
        {loginMode === 'operator' && (
          <div className="space-y-4">
            {/* Password Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="operator-email" className="block text-sm font-medium text-[var(--text-secondary)]">
                  Email address
                </label>
                <input
                  id="operator-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  className="mt-1 block w-full px-3 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-md text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent text-base"
                  placeholder="email@clubhouse247golf.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label htmlFor="operator-password" className="block text-sm font-medium text-[var(--text-secondary)]">
                  Password
                </label>
                <div className="relative mt-1">
                  <input
                    id="operator-password"
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

              <div className="flex items-center">
                <input
                  id="operator-remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-[var(--accent)] focus:ring-[var(--accent)] border-[var(--border-primary)] rounded"
                />
                <label htmlFor="operator-remember-me" className="ml-2 text-sm text-[var(--text-secondary)]">
                  Keep me signed in for 30 days
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            {/* Google Sign-In Option */}
            <div className="mt-6">
              <GoogleSignInButton
                rememberMe={rememberMe}
                loginMode="operator"
              />
            </div>
          </div>
        )}

        {/* CUSTOMER MODE - Traditional Form with Google Option */}
        {loginMode === 'customer' && (
          <>
            <form className="mt-6 sm:mt-8 space-y-4 sm:space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-3 sm:space-y-4">
                {/* Show name field for customer signup */}
                {isSignup && (
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
                  <label htmlFor="customer-email" className="block text-sm font-medium text-[var(--text-secondary)]">
                    Email address
                  </label>
                  <input
                    id="customer-email"
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
                {isSignup && (
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
                  <label htmlFor="customer-password" className="block text-sm font-medium text-[var(--text-secondary)]">
                    Password
                  </label>
                  <div className="relative mt-1">
                    <input
                      id="customer-password"
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
                  {/* Password requirements hint for signup */}
                  {isSignup && (
                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                      Must be at least 8 characters with uppercase, lowercase, number, and special character (!@#$%^&*...)
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center mb-4">
                <input
                  id="customer-remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-[var(--accent)] focus:ring-[var(--accent)] border-[var(--border-primary)] rounded"
                />
                <label htmlFor="customer-remember-me" className="ml-2 block text-sm text-[var(--text-secondary)]">
                  Keep me signed in (90 days)
                </label>
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

            {/* Google Sign-In Option for Customers */}
            <div className="mt-6">
              <GoogleSignInButton
                rememberMe={rememberMe}
                loginMode="customer"
              />
            </div>

            {/* Customer signup/login toggle */}
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
          </>
        )}
      </div>
    </div>
  );
};

export default LoginPage;