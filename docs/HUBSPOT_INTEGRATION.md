# HubSpot Integration Guide - Public ClubOS Boy

## Overview
This guide explains how to embed the public ClubOS Boy AI assistant into your HubSpot website. The public interface requires no authentication and is available 24/7 for customer inquiries.

## Quick Start

### Basic Embed Code
Add this iframe to any HubSpot page or module:

```html
<iframe 
  src="https://clubos-frontend.vercel.app/public/clubosboy" 
  width="100%" 
  height="800"
  frameborder="0"
  style="border: none; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"
  title="ClubOS Boy - AI Golf Assistant">
</iframe>
```

### Responsive Embed Code
For better mobile responsiveness:

```html
<div style="position: relative; width: 100%; padding-bottom: 100%; height: 0; overflow: hidden;">
  <iframe 
    src="https://clubos-frontend.vercel.app/public/clubosboy" 
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; border-radius: 8px;"
    frameborder="0"
    title="ClubOS Boy - AI Golf Assistant">
  </iframe>
</div>
```

## HubSpot Module Setup

### Step 1: Create a Custom Module
1. In HubSpot, go to Marketing > Files and Templates > Design Tools
2. Create a new module
3. Add a "Rich Text" field or "HTML" field
4. Paste the iframe code above

### Step 2: Add to Pages
1. Edit any HubSpot page
2. Add your custom module
3. The ClubOS Boy interface will appear instantly

### Step 3: Styling Options
You can customize the appearance:

```html
<div style="
  max-width: 800px; 
  margin: 0 auto; 
  padding: 20px;
  background: #f5f5f5;
  border-radius: 12px;
">
  <h2 style="text-align: center; margin-bottom: 20px;">
    Need Help? Ask Our AI Assistant!
  </h2>
  <iframe 
    src="https://clubos-frontend.vercel.app/public/clubosboy" 
    width="100%" 
    height="700"
    frameborder="0"
    style="border: none; border-radius: 8px; background: white;"
    title="ClubOS Boy - AI Golf Assistant">
  </iframe>
</div>
```

## Features

### What Users Can Do
- Ask questions about ClubHouse247 Golf services
- Get help with bookings and reservations
- Inquire about hours and locations
- Learn about golf simulator features
- Get technical support

### Built-in Contact Options
- Email: booking@clubhouse247golf.com
- Instagram: @clubhousegolfcanada
- Text: (902) 707-3748 (one-click SMS on mobile)

### Security Features
- Rate limiting: 10 requests per minute per IP
- No authentication required
- Public requests are logged for analytics
- Automatic timeout after 60 seconds of inactivity

## Mobile Functionality

### SMS Integration
The "Text Now" button automatically:
- Opens the native SMS app on mobile devices
- Pre-fills the phone number (902) 707-3748
- Works on iOS and Android

### Touch-Friendly Design
- Large buttons (minimum 44x44px touch targets)
- Responsive text sizing
- Auto-clearing forms
- Mobile-optimized layout

## Analytics & Monitoring

### What's Tracked
- Total requests per day
- Unique visitors (by IP)
- Common questions
- Response times
- Geographic distribution

### Accessing Analytics
Contact your ClubOS administrator for:
- Daily usage reports
- Popular question topics
- Performance metrics

## Troubleshooting

### Common Issues

**Issue**: Iframe doesn't load
- **Solution**: Check that your HubSpot page is using HTTPS
- **Solution**: Ensure no content blockers are active

**Issue**: "Too many requests" error
- **Cause**: Rate limit exceeded (10 requests/minute)
- **Solution**: Wait 60 seconds or use the text number

**Issue**: Interface looks cut off
- **Solution**: Increase iframe height to at least 700px
- **Solution**: Use responsive embed code above

**Issue**: SMS link doesn't work
- **Cause**: Desktop browsers can't send SMS
- **Solution**: Users should use their mobile device

### Testing Checklist
- [ ] Loads without authentication
- [ ] Questions get responses
- [ ] SMS link works on mobile
- [ ] Form auto-clears after inactivity
- [ ] Contact details are visible
- [ ] Responsive on all devices

## Best Practices

### Placement
- Above the fold on contact pages
- In sidebars on service pages
- As a popup/modal for immediate help
- On 404 error pages

### Context
Add explanatory text:
```html
<p style="text-align: center; margin-bottom: 10px;">
  Get instant answers to your golf simulator questions! 
  Available 24/7 or text us at (902) 707-3748.
</p>
```

### Performance
- Load iframe after page content (lazy loading)
- Use fixed dimensions to prevent layout shift
- Consider loading on user interaction for faster pages

## Support

For technical issues or custom integration needs:
- Email: booking@clubhouse247golf.com
- Check system status at: https://clubos-frontend.vercel.app/api/health

## Updates
Last updated: July 2025
- Added public interface without authentication
- Implemented rate limiting
- Added auto-timeout feature
- Enhanced mobile SMS integration