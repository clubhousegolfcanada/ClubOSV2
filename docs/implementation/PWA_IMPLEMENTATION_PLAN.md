# PWA Implementation Plan for ClubOS

## Overview
Progressive Web App implementation for ClubOS to enable installation on Android/iOS devices with proper offline support and native-like experience.

## Prerequisites
- [x] Valid PNG icon files in correct sizes
- [ ] Local testing environment setup
- [ ] Vercel deployment working properly

## Implementation Steps

### Phase 1: Icon Preparation (Day 1)
1. **Create proper icon files** (if current ones are corrupted)
   - 192x192 PNG for standard icon
   - 512x512 PNG for splash screen
   - 72x72 PNG for badge/notification
   - Optional: maskable versions for Android adaptive icons

2. **Test icon files locally**
   ```bash
   cd ClubOSV1-frontend/public
   file *.png  # Verify all show as valid PNG images
   open *.png  # Visually verify icons look correct
   ```

### Phase 2: Manifest Setup (Day 1)
1. **Create manifest.json**
   ```json
   {
     "name": "ClubOS - Golf Simulator Management",
     "short_name": "ClubOS",
     "description": "AI-powered golf simulator management system",
     "start_url": "/",
     "display": "standalone",
     "background_color": "#000000",
     "theme_color": "#10b981",
     "orientation": "portrait",
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
       }
     ]
   }
   ```

2. **Update _document.tsx** to include manifest
   ```tsx
   <link rel="manifest" href="/manifest.json" />
   <meta name="theme-color" content="#10b981" />
   <link rel="apple-touch-icon" href="/clubos-icon-192.png" />
   ```

### Phase 3: Service Worker (Day 2)
1. **Create minimal service worker** (public/sw.js)
   ```javascript
   // Start with basic caching for offline support
   const CACHE_NAME = 'clubos-v1';
   
   self.addEventListener('install', (event) => {
     event.waitUntil(
       caches.open(CACHE_NAME).then((cache) => {
         return cache.addAll([
           '/',
           '/offline.html'
         ]);
       })
     );
   });
   ```

2. **Create offline fallback page** (public/offline.html)

3. **Register service worker** in _app.tsx
   ```tsx
   useEffect(() => {
     if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
       navigator.serviceWorker.register('/sw.js');
     }
   }, []);
   ```

### Phase 4: Authentication & Middleware (Day 2)
1. **Update middleware.ts** to exclude PWA files
   ```typescript
   // Exclude from auth
   if (pathname.match(/\.(png|jpg|jpeg|gif|ico|json)$/) || 
       pathname === '/sw.js' || 
       pathname === '/offline.html' ||
       pathname === '/manifest.json') {
     return NextResponse.next();
   }
   ```

2. **Update next.config.js** headers
   ```javascript
   headers: async () => [
     {
       source: '/manifest.json',
       headers: [
         { key: 'Content-Type', value: 'application/manifest+json' },
         { key: 'Access-Control-Allow-Origin', value: '*' }
       ]
     }
   ]
   ```

### Phase 5: Testing Protocol (Day 3)
1. **Local testing checklist**
   - [ ] Run `npm run dev` and test on localhost:3000
   - [ ] Open Chrome DevTools > Application > Manifest
   - [ ] Verify no errors in manifest parsing
   - [ ] Check service worker registration
   - [ ] Test "Add to Home Screen" on Chrome desktop
   - [ ] Use Chrome DevTools device emulation for mobile testing
   - [ ] Check Network tab for any 401/404 errors on PWA files

2. **Mobile testing via ngrok**
   ```bash
   # Install ngrok if needed
   brew install ngrok
   
   # Start local dev server
   cd ClubOSV1-frontend && npm run dev
   
   # In another terminal
   ngrok http 3000
   
   # Test on actual Android device using ngrok URL
   ```

### Phase 6: Deployment Strategy (Day 3)
1. **Pre-deployment checks**
   - All tests pass locally
   - No console errors
   - Icons load properly
   - Manifest validates

2. **Deployment steps**
   ```bash
   # Run local build first
   npm run build
   
   # If successful, commit
   git add -A
   git commit -m "feat: Add PWA support with proper testing"
   git push
   ```

3. **Post-deployment verification**
   - Check Vercel logs for errors
   - Test production URL on mobile
   - Verify all PWA files load without auth errors

## Rollback Plan
If issues occur:
```bash
git revert HEAD
git push
```

## Success Criteria
- [ ] App installable on Android Chrome
- [ ] No 401/404 errors on PWA resources
- [ ] Service worker active and caching working
- [ ] Offline page displays when network unavailable
- [ ] Icons display correctly in app drawer

## Timeline
- Day 1: Icons & Manifest (2-3 hours)
- Day 2: Service Worker & Auth (3-4 hours)  
- Day 3: Testing & Deployment (2-3 hours)

Total: ~10 hours over 3 days with thorough testing at each stage.