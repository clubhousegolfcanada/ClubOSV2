import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import logger from '@/services/logger';
import { http } from '@/api/http';

interface GoogleSignInButtonProps {
  rememberMe: boolean;
  loginMode: 'operator' | 'customer';
  className?: string;
}

const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  rememberMe,
  loginMode,
  className = ''
}) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);

  useEffect(() => {
    // Check if we're in an iframe
    setIsInIframe(window.self !== window.top);
  }, []);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);

    try {
      // Get Google OAuth URL from backend with user type
      const params = new URLSearchParams({
        remember_me: String(rememberMe),
        user_type: loginMode === 'customer' ? 'customer' : 'operator'
      });

      // Use http client which has the correct backend URL configured
      const response = await http.get(`/auth/google?${params}`);
      const data = response.data;

      if (data.success && data.data?.authUrl) {
        // Redirect to Google OAuth
        window.location.href = data.data.authUrl;
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error: any) {
      logger.error('Google sign-in failed:', error);
      toast.error(error.message || 'Failed to sign in with Google');
      setIsLoading(false);
    }
  };

  // Don't show if in iframe
  if (isInIframe) {
    return null;
  }

  // Show for both operator and customer modes
  return (
    <>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[var(--border-primary)]" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-[var(--bg-primary)] text-[var(--text-muted)]">
            Or continue with
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isLoading}
        className={`w-full flex justify-center items-center gap-3 py-3 px-4 border border-[var(--border-primary)] rounded-md shadow-sm text-base font-medium text-[var(--text-primary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 ${className}`}
      >
        {/* Google Icon */}
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        {isLoading ? 'Signing in...' :
          loginMode === 'customer' ? 'Continue with Google' : 'Sign in with Google'}
      </button>

      {/* Info text based on mode */}
      {loginMode === 'operator' && (
        <p className="text-xs text-center text-[var(--text-muted)] mt-2">
          For Clubhouse employees only (@clubhouse247golf.com)
        </p>
      )}
      {loginMode === 'customer' && (
        <p className="text-xs text-center text-[var(--text-muted)] mt-2">
          Sign up or sign in instantly with any Google account
        </p>
      )}
    </>
  );
};

export default GoogleSignInButton;