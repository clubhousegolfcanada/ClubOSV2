import toast from 'react-hot-toast';
import { getErrorMessage, isRateLimitError, isAuthError, getErrorCode } from './error';

/**
 * Display error notification with smart message extraction
 */
export function notifyError(error: unknown, fallbackMessage?: string): void {
  // Don't show auth errors as toasts (handled by interceptor)
  if (isAuthError(error)) {
    return;
  }
  
  // Special handling for rate limit errors
  if (isRateLimitError(error)) {
    toast.error('Too many requests. Please slow down.', {
      duration: 5000,
      icon: '⏱️'
    });
    return;
  }
  
  const message = getErrorMessage(error) || fallbackMessage || 'An error occurred';
  
  // Add error code if available
  const code = getErrorCode(error);
  const finalMessage = code ? `${message} (${code})` : message;
  
  toast.error(finalMessage);
}

/**
 * Display success notification
 */
export function notifySuccess(message: string): void {
  toast.success(message);
}

/**
 * Display info notification
 */
export function notifyInfo(message: string): void {
  toast(message, {
    icon: 'ℹ️'
  });
}

/**
 * Display warning notification
 */
export function notifyWarning(message: string): void {
  toast(message, {
    icon: '⚠️',
    style: {
      background: '#FEF3C7',
      color: '#92400E',
    }
  });
}

/**
 * Display loading notification with promise
 */
export function notifyPromise<T>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((err: unknown) => string);
  }
): Promise<T> {
  return toast.promise(promise, {
    loading: messages.loading,
    success: messages.success,
    error: (err) => {
      if (typeof messages.error === 'function') {
        return messages.error(err);
      }
      return getErrorMessage(err) || messages.error;
    }
  });
}

/**
 * Display custom notification with JSX content
 */
export function notifyCustom(content: React.ReactNode, options?: Parameters<typeof toast>[1]): void {
  toast.custom((t) => (
    <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}>
      <div className="flex-1 w-0 p-4">
        {content}
      </div>
    </div>
  ), options);
}

/**
 * Dismiss all notifications
 */
export function dismissAll(): void {
  toast.dismiss();
}

/**
 * Dismiss specific notification
 */
export function dismiss(toastId: string): void {
  toast.dismiss(toastId);
}