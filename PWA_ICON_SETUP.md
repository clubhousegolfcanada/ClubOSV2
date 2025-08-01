# PWA Icon Setup Instructions

## Icon Requirements Met
✅ You've provided a golf club icon in ClubOS brand color (#0B3D3A)
✅ The icon has a clean, simple design perfect for app icons

## Required Icon Files

You need to save the uploaded image as these files in `/ClubOSV1-frontend/public/`:

1. **clubos-icon-512.png** - 512x512px (CRITICAL - Missing this blocks Android install)
2. **clubos-icon-192.png** - 192x192px (already exists, but update with new design)
3. **clubos-icon-maskable-512.png** - 512x512px with 20% padding
4. **clubos-icon-maskable-192.png** - 192x192px with 20% padding

## How to Create the Icons

### Option 1: Use an online tool
1. Go to https://maskable.app/editor
2. Upload your icon
3. Adjust padding to ~20% for maskable versions
4. Export at required sizes

### Option 2: Command line (if you have ImageMagick)
```bash
# Create 512x512 version
convert your-icon.png -resize 512x512 clubos-icon-512.png

# Create 192x192 version  
convert your-icon.png -resize 192x192 clubos-icon-192.png

# Create maskable versions with padding
convert your-icon.png -resize 410x410 -background transparent -gravity center -extent 512x512 clubos-icon-maskable-512.png
convert your-icon.png -resize 154x154 -background transparent -gravity center -extent 192x192 clubos-icon-maskable-192.png
```

## Updated manifest.json

Once you've created the icons, update the manifest:

```json
{
  "name": "ClubOS - Golf Simulator Management",
  "short_name": "ClubOS",
  "description": "AI-powered golf simulator management system for Clubhouse 24/7 Golf",
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

## Next Steps

1. Save the icon at the required sizes
2. Place them in `/ClubOSV1-frontend/public/`
3. Update manifest.json
4. Commit and push
5. Test on Android device

The 512x512 icon is the critical missing piece for Android PWA installation!