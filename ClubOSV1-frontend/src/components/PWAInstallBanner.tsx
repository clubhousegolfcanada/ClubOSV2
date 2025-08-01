import { useState } from 'react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Download, X } from 'lucide-react';

export const PWAInstallBanner = () => {
  const { isInstallable, installPWA } = usePWAInstall();
  const [isDismissed, setIsDismissed] = useState(false);

  if (!isInstallable || isDismissed) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 bg-[var(--accent)] text-white p-4 rounded-lg shadow-lg z-40 md:hidden animate-slide-up">
      <button
        onClick={() => setIsDismissed(true)}
        className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/10 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
      
      <div className="flex items-start gap-3">
        <Download className="w-5 h-5 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="font-semibold text-sm mb-1">Install ClubOS</h3>
          <p className="text-xs opacity-90 mb-3">
            Add to your home screen for quick access and offline support
          </p>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                const installed = await installPWA();
                if (installed) {
                  setIsDismissed(true);
                }
              }}
              className="bg-white text-[var(--accent)] px-4 py-2 rounded-md text-sm font-medium hover:bg-white/90 transition-colors"
            >
              Install App
            </button>
            <button
              onClick={() => setIsDismissed(true)}
              className="text-white/80 px-4 py-2 text-sm hover:text-white transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};