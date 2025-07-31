import React, { useState, useEffect } from 'react';
import { tokenManager } from '@/utils/tokenManager';
import { AlertCircle, X } from 'lucide-react';

export const SessionExpiryWarning: React.FC = () => {
  const [showWarning, setShowWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    const checkExpiry = () => {
      const token = localStorage.getItem('clubos_token');
      if (!token) return;

      const timeUntilExpiry = tokenManager.getTimeUntilExpiration(token);
      const fiveMinutes = 5 * 60 * 1000; // 5 minutes in ms

      // Show warning if less than 5 minutes left
      if (timeUntilExpiry > 0 && timeUntilExpiry < fiveMinutes) {
        setShowWarning(true);
        setTimeLeft(Math.floor(timeUntilExpiry / 1000)); // Convert to seconds
      } else {
        setShowWarning(false);
      }
    };

    // Check immediately
    checkExpiry();

    // Check every 10 seconds
    const interval = setInterval(checkExpiry, 10000);

    // Update countdown every second when warning is shown
    let countdownInterval: NodeJS.Timeout | null = null;
    if (showWarning) {
      countdownInterval = setInterval(() => {
        setTimeLeft(prev => Math.max(0, prev - 1));
      }, 1000);
    }

    return () => {
      clearInterval(interval);
      if (countdownInterval) clearInterval(countdownInterval);
    };
  }, [mounted, showWarning]);

  if (!showWarning) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="fixed bottom-4 right-4 max-w-sm bg-yellow-50 border border-yellow-200 rounded-lg shadow-lg p-4 z-50">
      <div className="flex items-start">
        <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-yellow-800">
            Session Expiring Soon
          </h3>
          <p className="mt-1 text-sm text-yellow-700">
            Your session will expire in {minutes}:{seconds.toString().padStart(2, '0')}.
            Please save your work.
          </p>
        </div>
        <button
          onClick={() => setShowWarning(false)}
          className="ml-3 text-yellow-600 hover:text-yellow-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};