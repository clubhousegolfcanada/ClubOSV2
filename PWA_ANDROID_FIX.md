# PWA Android Fix Guide

## Issues Found

1. **Missing 512x512 icon** (REQUIRED for Android)
2. **display_override might be confusing Android** 
3. **Need to ensure offline.html exists**
4. **May need install prompt handler**

## Quick Fixes

### 1. Update manifest.json
```json
{
  "name": "ClubOS - Golf Simulator Management",
  "short_name": "ClubOS",
  "description": "AI-powered golf simulator management system",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#0B3D3A",
  "theme_color": "#0B3D3A",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/clubos-icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/clubos-icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/clubos-icon-maskable-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "/clubos-icon-maskable-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ],
  "categories": ["business", "productivity"],
  "lang": "en-US",
  "dir": "ltr",
  "prefer_related_applications": false
}
```

### 2. Add Install Prompt Handler
Create `src/hooks/usePWAInstall.ts`:
```typescript
import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const usePWAInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const installPWA = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setIsInstallable(false);
    }
    
    setDeferredPrompt(null);
  };

  return { isInstallable, isInstalled, installPWA };
};
```

### 3. Add Install Banner Component
```tsx
// components/PWAInstallBanner.tsx
import { usePWAInstall } from '@/hooks/usePWAInstall';

export const PWAInstallBanner = () => {
  const { isInstallable, installPWA } = usePWAInstall();

  if (!isInstallable) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 bg-[var(--accent)] text-white p-4 rounded-lg shadow-lg z-50 md:hidden">
      <p className="text-sm mb-2">Install ClubOS for a better experience!</p>
      <div className="flex gap-2">
        <button
          onClick={installPWA}
          className="bg-white text-[var(--accent)] px-4 py-2 rounded font-medium"
        >
          Install
        </button>
        <button
          onClick={() => setIsInstallable(false)}
          className="text-white/80 px-4 py-2"
        >
          Not now
        </button>
      </div>
    </div>
  );
};
```

### 4. Create offline.html
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ClubOS - Offline</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0B3D3A;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      text-align: center;
    }
    .container {
      padding: 2rem;
    }
    h1 {
      font-size: 2rem;
      margin-bottom: 1rem;
    }
    p {
      opacity: 0.8;
      margin-bottom: 2rem;
    }
    button {
      background: white;
      color: #0B3D3A;
      border: none;
      padding: 12px 24px;
      border-radius: 6px;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>You're Offline</h1>
    <p>ClubOS requires an internet connection to work properly.</p>
    <button onclick="window.location.reload()">Try Again</button>
  </div>
</body>
</html>
```

## Icon Requirements

You need these icon files in `/public/`:
- `clubos-icon-192.png` (192x192px)
- `clubos-icon-512.png` (512x512px) **MISSING - REQUIRED**
- `clubos-icon-maskable-192.png` (192x192px with padding)
- `clubos-icon-maskable-512.png` (512x512px with padding)

Maskable icons should have 20% padding on all sides for Android adaptive icons.

## Testing Checklist

1. [ ] Run Lighthouse PWA audit
2. [ ] Test on real Android device
3. [ ] Verify install prompt appears
4. [ ] Check offline page works
5. [ ] Confirm address bar hides after install