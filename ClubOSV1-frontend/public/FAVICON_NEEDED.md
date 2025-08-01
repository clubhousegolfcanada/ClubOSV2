# Favicon Needed

The app is missing a favicon.ico file in the public directory.

## Quick Fix

1. Convert the clubos-icon-192.png to favicon.ico format
2. Place in `/public/favicon.ico`

## Online Tool
Use https://favicon.io/favicon-converter/ to convert the PNG to ICO format.

## Or use command line:
```bash
convert clubos-icon-192.png -resize 16x16 -resize 32x32 -resize 48x48 favicon.ico
```

This will fix the 404 error for favicon.ico.