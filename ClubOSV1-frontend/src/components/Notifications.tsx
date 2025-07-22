import React from 'react';
import { useNotifications } from '@/state/hooks';

const Notifications: React.FC = () => {
  const { notifications, removeNotification } = useNotifications();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-md">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`
            notification p-4 rounded-lg shadow-lg border backdrop-blur-sm
            animate-slideIn flex items-start justify-between gap-3
            ${getNotificationStyles(notification.type)}
          `}
        >
          <div className="flex items-start gap-3">
            <span className="text-xl">{getNotificationIcon(notification.type)}</span>
            <p className="text-sm">{notification.message}</p>
          </div>
          <button
            onClick={() => removeNotification(notification.id)}
            className="text-current opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Close notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};

function getNotificationStyles(type: string): string {
  switch (type) {
    case 'success':
      return 'bg-green-900/90 border-green-700 text-green-100';
    case 'error':
      return 'bg-red-900/90 border-red-700 text-red-100';
    case 'warning':
      return 'bg-yellow-900/90 border-yellow-700 text-yellow-100';
    case 'info':
      return 'bg-blue-900/90 border-blue-700 text-blue-100';
    default:
      return 'bg-gray-900/90 border-gray-700 text-gray-100';
  }
}

function getNotificationIcon(type: string): string {
  switch (type) {
    case 'success':
      return '✓';
    case 'error':
      return '⚠';
    case 'warning':
      return '!';
    case 'info':
      return 'ℹ';
    default:
      return '•';
  }
}

export default Notifications;

<style jsx>{`
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  .animate-slideIn {
    animation: slideIn 0.3s ease-out;
  }
`}</style>
