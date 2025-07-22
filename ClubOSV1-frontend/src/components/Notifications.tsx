import React from 'react';
import { useNotifications } from '@/state/hooks';
import { X } from 'lucide-react';

type Notification = {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  timestamp: string;
};

const Notifications: React.FC = () => {
  const { notifications, removeNotification } = useNotifications();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-md">
      {notifications.map((notification: Notification) => (
        <div
          key={notification.id}
          className={`
            flex items-start gap-3 p-4 rounded-lg shadow-lg
            transform transition-all duration-300 ease-in-out
            ${notification.type === 'success' ? 'bg-green-500/10 border border-green-500/20' : ''}
            ${notification.type === 'error' ? 'bg-red-500/10 border border-red-500/20' : ''}
            ${notification.type === 'info' ? 'bg-blue-500/10 border border-blue-500/20' : ''}
            ${notification.type === 'warning' ? 'bg-yellow-500/10 border border-yellow-500/20' : ''}
          `}
        >
          <div className="flex-1">
            <p className={`
              text-sm font-medium
              ${notification.type === 'success' ? 'text-green-400' : ''}
              ${notification.type === 'error' ? 'text-red-400' : ''}
              ${notification.type === 'info' ? 'text-blue-400' : ''}
              ${notification.type === 'warning' ? 'text-yellow-400' : ''}
            `}>
              {notification.message}
            </p>
          </div>
          <button
            onClick={() => removeNotification(notification.id)}
            className="text-gray-400 hover:text-gray-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default Notifications;
